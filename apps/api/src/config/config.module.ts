import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import * as Joi from "joi";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        GMAIL_CLIENT_ID: Joi.string().optional(),
        GMAIL_CLIENT_SECRET: Joi.string().optional(),
        GMAIL_REFRESH_TOKEN: Joi.string().optional(),
        GMAIL_SEARCH_QUERY: Joi.string().optional().default("is:unread"),
        GMAIL_MAX_RESULTS: Joi.number().integer().optional().default(20),
        GMAIL_CRON_SCHEDULE: Joi.string().optional().default("0 * * * *"),
        GMAIL_CONNECTOR_SECRET: Joi.string().optional(),
        SLACK_SIGNING_SECRET: Joi.string().optional(),
        SLACK_BOT_TOKEN: Joi.string().optional(),
        SLACK_ALLOWED_WORKSPACE_IDS: Joi.string().optional().default(""),
        SMTP_HOST: Joi.string().optional(),
        SMTP_PORT: Joi.number().integer().optional().default(587),
        SMTP_USER: Joi.string().optional(),
        SMTP_PASS: Joi.string().optional(),
        QUOTE_EMAIL_FROM: Joi.string().optional(),
        OPENAI_API_KEY: Joi.string().optional(),
        OPENAI_MODEL: Joi.string().optional().default("gpt-4o-mini"),
        RFQ_CLASSIFICATION_THRESHOLD: Joi.number().min(0).max(1).optional().default(0.7),
        QUOTE_EMAIL_AI: Joi.boolean().optional().default(false),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().optional().default("24h"),
        JWT_ACCESS_EXPIRES_IN: Joi.string().optional().default("15m"),
        JWT_REFRESH_EXPIRES_IN: Joi.string().optional().default("7d"),
        ALLOWED_ORIGINS: Joi.string().optional().default("http://localhost:3000"),
        SMTP_SECURE: Joi.boolean().optional().default(true),
        FRONTEND_URL: Joi.string().optional().default("http://localhost:3000"),
        ATTACHMENT_STORAGE_PATH: Joi.string().optional().default("./attachments"),
        GOOGLE_SHEET_ID: Joi.string().optional(),
        GOOGLE_SERVICE_ACCOUNT_KEY: Joi.string().optional(),
        CONNECTOR_AUTO_DISABLE_THRESHOLD: Joi.number().integer().optional().default(5),
      }),
    }),
  ],
})
export class ConfigModule {}
