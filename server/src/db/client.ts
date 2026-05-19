import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

export function resolveSqlitePath(): string {
  const configured = process.env.SQLITE_PATH;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(repoRoot, configured);
  }
  return path.resolve(repoRoot, "data/kind.sqlite");
}

let libsqlClient: Client | null = null;
let sqliteDb: ReturnType<typeof drizzleLibsql<typeof schema>> | null = null;
let postgresDb: ReturnType<typeof drizzlePostgres<typeof schema>> | null = null;
let postgresClient: ReturnType<typeof postgres> | null = null;

export function getLibsqlClient() {
  if (!libsqlClient) {
    const dbPath = resolveSqlitePath();
    libsqlClient = createClient({ url: `file:${dbPath}` });
  }
  return libsqlClient;
}

export function getSqlite() {
  if (!sqliteDb) {
    sqliteDb = drizzleLibsql(getLibsqlClient(), { schema });
  }
  return sqliteDb;
}

export function getPostgresUrl(): string | undefined {
  return process.env.POSTGRES_URL?.trim() || undefined;
}

export function isPostgresConfigured(): boolean {
  return Boolean(getPostgresUrl());
}

export function getPostgres() {
  const url = getPostgresUrl();
  if (!url) {
    throw new Error("POSTGRES_URL is not set");
  }
  if (!postgresDb) {
    postgresClient = postgres(url, { max: 5 });
    postgresDb = drizzlePostgres(postgresClient, { schema });
  }
  return postgresDb;
}

export async function closeConnections() {
  if (postgresClient) {
    await postgresClient.end();
    postgresClient = null;
    postgresDb = null;
  }
  if (libsqlClient) {
    libsqlClient.close();
    libsqlClient = null;
    sqliteDb = null;
  }
}
