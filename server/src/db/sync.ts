import { sql } from "drizzle-orm";
import {
  closeConnections,
  getPostgres,
  getPostgresUrl,
  getSqlite,
  isPostgresConfigured,
} from "./client.js";
import { briefs, experts, requests, syncState } from "./schema.js";

async function ensurePostgresTables() {
  const pg = getPostgres();
  await pg.execute(sql`
    CREATE TABLE IF NOT EXISTS experts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role_key TEXT NOT NULL,
      bio_key TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      rating TEXT NOT NULL,
      review_count INTEGER NOT NULL,
      response_hours INTEGER NOT NULL,
      image_url TEXT,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);
  await pg.execute(sql`
    CREATE TABLE IF NOT EXISTS briefs (
      id TEXT PRIMARY KEY,
      seeker_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      budget_cents INTEGER NOT NULL,
      tags TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_match',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);
  await pg.execute(sql`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      brief_id TEXT REFERENCES briefs(id),
      expert_id TEXT REFERENCES experts(id),
      status TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      feedback_preview TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);
  await pg.execute(sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      id TEXT PRIMARY KEY DEFAULT 'postgres',
      last_synced_at TIMESTAMPTZ,
      last_error TEXT
    );
  `);
}

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

async function upsertExperts() {
  const sqlite = getSqlite();
  const pg = getPostgres();
  const rows = await sqlite.select().from(experts);
  for (const row of rows) {
    await pg.execute(sql`
      INSERT INTO experts (
        id, name, role_key, bio_key, price_cents, rating,
        review_count, response_hours, image_url, updated_at
      ) VALUES (
        ${row.id}, ${row.name}, ${row.roleKey}, ${row.bioKey}, ${row.priceCents},
        ${row.rating}, ${row.reviewCount}, ${row.responseHours}, ${row.imageUrl},
        ${toIso(row.updatedAt)}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role_key = EXCLUDED.role_key,
        bio_key = EXCLUDED.bio_key,
        price_cents = EXCLUDED.price_cents,
        rating = EXCLUDED.rating,
        review_count = EXCLUDED.review_count,
        response_hours = EXCLUDED.response_hours,
        image_url = EXCLUDED.image_url,
        updated_at = EXCLUDED.updated_at
    `);
  }
  return rows.length;
}

async function upsertBriefs() {
  const sqlite = getSqlite();
  const pg = getPostgres();
  const rows = await sqlite.select().from(briefs);
  for (const row of rows) {
    await pg.execute(sql`
      INSERT INTO briefs (
        id, seeker_id, title, description, budget_cents, tags,
        status, created_at, updated_at
      ) VALUES (
        ${row.id}, ${row.seekerId}, ${row.title}, ${row.description},
        ${row.budgetCents}, ${row.tags}, ${row.status},
        ${toIso(row.createdAt)}::timestamptz, ${toIso(row.updatedAt)}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        seeker_id = EXCLUDED.seeker_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        budget_cents = EXCLUDED.budget_cents,
        tags = EXCLUDED.tags,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `);
  }
  return rows.length;
}

async function upsertRequests() {
  const sqlite = getSqlite();
  const pg = getPostgres();
  const rows = await sqlite.select().from(requests);
  for (const row of rows) {
    await pg.execute(sql`
      INSERT INTO requests (
        id, brief_id, expert_id, status, amount_cents,
        feedback_preview, created_at, updated_at
      ) VALUES (
        ${row.id}, ${row.briefId}, ${row.expertId}, ${row.status},
        ${row.amountCents}, ${row.feedbackPreview},
        ${toIso(row.createdAt)}::timestamptz, ${toIso(row.updatedAt)}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        brief_id = EXCLUDED.brief_id,
        expert_id = EXCLUDED.expert_id,
        status = EXCLUDED.status,
        amount_cents = EXCLUDED.amount_cents,
        feedback_preview = EXCLUDED.feedback_preview,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `);
  }
  return rows.length;
}

export async function syncSqliteToPostgres(): Promise<{
  experts: number;
  briefs: number;
  requests: number;
}> {
  if (!isPostgresConfigured()) {
    throw new Error("POSTGRES_URL is required for sync");
  }

  await ensurePostgresTables();
  const counts = {
    experts: await upsertExperts(),
    briefs: await upsertBriefs(),
    requests: await upsertRequests(),
  };

  const now = new Date();
  const sqlite = getSqlite();
  await sqlite
    .insert(syncState)
    .values({ id: "postgres", lastSyncedAt: now, lastError: null })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { lastSyncedAt: now, lastError: null },
    });

  return counts;
}

async function main() {
  if (!isPostgresConfigured()) {
    console.error("Set POSTGRES_URL to sync SQLite → PostgreSQL");
    process.exit(1);
  }
  console.log(`Syncing to ${getPostgresUrl()?.replace(/:[^:@]+@/, ":***@")}`);
  const counts = await syncSqliteToPostgres();
  console.log("Sync complete:", counts);
  await closeConnections();
}

const isMain =
  process.argv[1]?.endsWith("sync.ts") ||
  process.argv[1]?.endsWith("sync.js");

if (isMain) {
  main().catch(async (err) => {
    console.error(err);
    const sqlite = getSqlite();
    await sqlite
      .insert(syncState)
      .values({
        id: "postgres",
        lastSyncedAt: null,
        lastError: String(err),
      })
      .onConflictDoUpdate({
        target: syncState.id,
        set: { lastError: String(err) },
      });
    await closeConnections();
    process.exit(1);
  });
}
