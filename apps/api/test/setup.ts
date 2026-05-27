process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://auto8:auto8@localhost:5432/auto8";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
process.env.API_PORT = "4100";
process.env.SLACK_SIGNING_SECRET = "auto8-test-signing-secret";
process.env.SLACK_ALLOWED_WORKSPACE_IDS = "W_AUTO8_TEST";
process.env.GMAIL_CONNECTOR_SECRET = "auto8-test-gmail-secret";
