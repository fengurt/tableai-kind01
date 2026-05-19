import fs from "node:fs";
import path from "node:path";
import { getLibsqlClient, resolveSqlitePath } from "./client.js";

const migrationsSql = `
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
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  seeker_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_cents INTEGER NOT NULL,
  tags TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_match',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  brief_id TEXT REFERENCES briefs(id),
  expert_id TEXT REFERENCES experts(id),
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  feedback_preview TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY DEFAULT 'postgres',
  last_synced_at INTEGER,
  last_error TEXT
);
`;

export async function runMigrations() {
  const dbPath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const client = getLibsqlClient();
  await client.executeMultiple(migrationsSql);
  console.log(`SQLite migrated: ${dbPath}`);
}

const isMain =
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js");

if (isMain) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
