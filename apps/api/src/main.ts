import "reflect-metadata";

process.loadEnvFile?.();

import { Logger } from "@nestjs/common";
import { createApp } from "./bootstrap";

async function main() {
  const app = await createApp();
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  const logger = new Logger("Bootstrap");
  logger.log(`auto8 API listening on http://localhost:${port}/api`);
}

void main();
