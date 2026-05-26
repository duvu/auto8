import "reflect-metadata";

process.loadEnvFile?.();

import { createApp } from "./bootstrap";

async function main() {
  const app = await createApp();
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`auto8 API listening on http://localhost:${port}/api`);
}

void main();
