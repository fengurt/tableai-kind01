import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resetDbForTests } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";

const tmpRoot = mkdtempSync(join(tmpdir(), "kind-migrate-test-"));
const dbPath = join(tmpRoot, "migrate.sqlite");

before(() => {
  process.env.SQLITE_PATH = dbPath;
});

after(async () => {
  await resetDbForTests();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("migrations", () => {
  it("creates sqlite database file", async () => {
    await resetDbForTests();
    assert.ok(!existsSync(dbPath));
    await runMigrations();
    assert.ok(existsSync(dbPath));
  });
});
