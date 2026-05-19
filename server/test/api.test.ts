import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { resetDbForTests } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";

const tmpRoot = mkdtempSync(join(tmpdir(), "kind-api-test-"));

before(() => {
  process.env.SQLITE_PATH = join(tmpRoot, "test.sqlite");
  delete process.env.POSTGRES_URL;
});

after(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  await resetDbForTests();
  await runMigrations();
});

describe("API", () => {
  it("GET /health returns ok", async () => {
    const app = await buildApp();
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { ok: boolean; sqlite: boolean };
    assert.equal(body.ok, true);
    assert.equal(body.sqlite, true);
    await app.close();
  });

  it("GET /api/experts returns array", async () => {
    const app = await buildApp();
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/api/experts" });
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.json()));
    await app.close();
  });

  it("POST /api/briefs validates body", async () => {
    const app = await buildApp();
    await app.ready();
    const res = await app.inject({
      method: "POST",
      url: "/api/briefs",
      payload: { title: "only title" },
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it("POST /api/briefs creates brief", async () => {
    const app = await buildApp();
    await app.ready();
    const res = await app.inject({
      method: "POST",
      url: "/api/briefs",
      payload: {
        title: "Test critique",
        description: "Need portfolio review",
        budgetCents: 25000,
        tags: "fine_art",
      },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json() as { id: string; title: string; status: string };
    assert.match(body.id, /^brief-/);
    assert.equal(body.title, "Test critique");
    assert.equal(body.status, "pending_match");

    const list = await app.inject({ method: "GET", url: "/api/briefs" });
    const briefs = list.json() as { id: string }[];
    assert.ok(briefs.some((b) => b.id === body.id));
    await app.close();
  });

  it("POST /api/sync without postgres returns 400", async () => {
    const app = await buildApp();
    await app.ready();
    const res = await app.inject({ method: "POST", url: "/api/sync" });
    assert.equal(res.statusCode, 400);
    await app.close();
  });
});
