import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    rawBody: true
  });

  app.setGlobalPrefix("api");

  return app;
}
