import "dotenv/config";
import Fastify from "fastify";
import { eq } from "drizzle-orm";
import {
  closeConnections,
  getSqlite,
  isPostgresConfigured,
} from "./db/client.js";
import { experts, briefs, requests, syncState } from "./db/schema.js";
import { runMigrations } from "./db/migrate.js";
import { syncSqliteToPostgres } from "./db/sync.js";

const PORT = Number(process.env.API_PORT ?? 8788);
const SYNC_ON_WRITE = process.env.SYNC_ON_WRITE === "1";

async function maybeSyncAfterWrite() {
  if (!SYNC_ON_WRITE || !isPostgresConfigured()) return;
  try {
    await syncSqliteToPostgres();
  } catch (err) {
    console.error("[sync-on-write]", err);
  }
}

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  sqlite: true,
  postgres: isPostgresConfigured(),
  syncOnWrite: SYNC_ON_WRITE,
}));

app.get("/api/experts", async () => {
  const db = getSqlite();
  return db.select().from(experts);
});

app.get("/api/briefs", async () => {
  const db = getSqlite();
  return db.select().from(briefs);
});

app.get("/api/requests", async () => {
  const db = getSqlite();
  return db.select().from(requests);
});

app.get("/api/sync/status", async () => {
  const db = getSqlite();
  const [row] = await db.select().from(syncState).where(eq(syncState.id, "postgres"));
  return {
    postgresConfigured: isPostgresConfigured(),
    lastSyncedAt: row?.lastSyncedAt ?? null,
    lastError: row?.lastError ?? null,
  };
});

app.post("/api/sync", async (_req, reply) => {
  if (!isPostgresConfigured()) {
    return reply.status(400).send({ error: "POSTGRES_URL not configured" });
  }
  const counts = await syncSqliteToPostgres();
  return { ok: true, counts };
});

app.post("/api/briefs", async (req, reply) => {
  const body = req.body as {
    title?: string;
    description?: string;
    budgetCents?: number;
    tags?: string;
  };
  if (!body?.title || !body?.description) {
    return reply.status(400).send({ error: "title and description required" });
  }
  const id = `brief-${Date.now()}`;
  const now = new Date();
  const db = getSqlite();
  const row = {
    id,
    seekerId: null,
    title: body.title,
    description: body.description,
    budgetCents: body.budgetCents ?? 25000,
    tags: body.tags ?? "",
    status: "pending_match",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(briefs).values(row);
  await maybeSyncAfterWrite();
  return reply.status(201).send(row);
});

async function start() {
  await runMigrations();
  await app.listen({ port: PORT, host: "127.0.0.1" });
  console.log(`API http://127.0.0.1:${PORT} (SQLite primary)`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await closeConnections();
    process.exit(0);
  });
}
