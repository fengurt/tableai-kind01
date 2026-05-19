import "dotenv/config";
import { buildApp } from "./app.js";
import { closeConnections } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";

const PORT = Number(process.env.API_PORT ?? 8788);
const HOST = process.env.HOST ?? "127.0.0.1";

async function start() {
  await runMigrations();
  const app = await buildApp({ logger: true });
  await app.listen({ port: PORT, host: HOST });
  console.log(`API http://${HOST}:${PORT} (SQLite primary)`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await app.close();
      await closeConnections();
      process.exit(0);
    });
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
