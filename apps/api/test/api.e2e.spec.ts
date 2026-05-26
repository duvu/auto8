import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { INestApplication } from "@nestjs/common";
import { PrismaClient, UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/bootstrap";

const workspaceDir = join(import.meta.dirname, "..");
const testDbPath = join(workspaceDir, "prisma", "test.db");

const prisma = new PrismaClient();

describe("auto8 RFQ workflow API", () => {
  let app: INestApplication;
  let quoteOperatorId = "";
  let salesApproverId = "";

  beforeAll(async () => {
    execSync("npx prisma db push --force-reset --skip-generate", {
      cwd: workspaceDir,
      env: process.env,
      stdio: "ignore"
    });

    app = await createApp();
    await app.init();
  });

  beforeEach(async () => {
    await prisma.quoteStatusEvent.deleteMany();
    await prisma.quoteLineItem.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.rfq.deleteMany();
    await prisma.rfqEmail.deleteMany();
    await prisma.user.deleteMany();

    const quoteOperator = await prisma.user.create({
      data: {
        email: "operator@auto8.test",
        name: "Quinn Operator",
        role: UserRole.quote_operator
      }
    });

    const salesApprover = await prisma.user.create({
      data: {
        email: "sales@auto8.test",
        name: "Sam Sales",
        role: UserRole.sales_approver
      }
    });

    quoteOperatorId = quoteOperator.id;
    salesApproverId = salesApprover.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect();

    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
  });

  async function createRfq() {
    const response = await request(app.getHttpServer())
      .post("/api/rfqs/intake-email")
      .send({
        fromEmail: "buyer@test.example",
        fromName: "Buyer Test",
        subject: "RFQ: oil filters",
        body: "Need pricing for 15 oil filters.",
        receivedAt: "2026-05-26T08:00:00.000Z"
      });

    expect(response.status).toBe(201);
    return response.body as {
      id: string;
      quote: { id: string } | null;
      workflowState: string;
      history: Array<{ status: string }>;
    };
  }

  it("captures inbound RFQ emails and creates trackable work items", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/rfqs/intake-email")
      .send({
        fromEmail: "buyer@test.example",
        fromName: "Buyer Test",
        subject: "RFQ: brake discs",
        body: "Please quote 20 brake discs.",
        receivedAt: "2026-05-26T08:00:00.000Z"
      });

    expect(response.status).toBe(201);
    expect(response.body.reference).toMatch(/^RFQ-/);
    expect(response.body.workflowState).toBe("new");
    expect(response.body.quote).toBeNull();
  });

  it("saves a draft quote with persistent line items", async () => {
    const rfq = await createRfq();

    const response = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfq.id}/quote`)
      .set("x-user-id", quoteOperatorId)
      .send({
        customerName: "Buyer Test",
        customerCompany: "Test Garage",
        notes: "Draft ready for review.",
        lineItems: [
          {
            description: "Oil filter",
            quantity: 15,
            unitPrice: 9
          }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.workflowState).toBe("draft");
    expect(response.body.quote.status).toBe("draft");
    expect(response.body.quote.lineItems).toHaveLength(1);
    expect(response.body.history.map((event: { status: string }) => event.status)).toEqual(["draft"]);
  });

  it("requires sales role for approval and preserves quote state on forbidden approval", async () => {
    const rfq = await createRfq();

    const savedDraft = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfq.id}/quote`)
      .set("x-user-id", quoteOperatorId)
      .send({
        customerName: "Buyer Test",
        customerCompany: "Test Garage",
        notes: "Awaiting approval.",
        lineItems: [
          {
            description: "Oil filter",
            quantity: 15,
            unitPrice: 9
          }
        ]
      });

    const submitResponse = await request(app.getHttpServer())
      .post(`/api/quotes/${savedDraft.body.quote.id}/submit`)
      .set("x-user-id", quoteOperatorId)
      .send({});

    expect(submitResponse.status).toBe(201);
    expect(submitResponse.body.quote.status).toBe("pending_approval");

    const forbiddenResponse = await request(app.getHttpServer())
      .post(`/api/quotes/${savedDraft.body.quote.id}/approve`)
      .set("x-user-id", quoteOperatorId)
      .send({});

    expect(forbiddenResponse.status).toBe(403);

    const detailResponse = await request(app.getHttpServer()).get(`/api/rfqs/${rfq.id}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.quote.status).toBe("pending_approval");
  });

  it("completes the happy path from RFQ intake to approved quote", async () => {
    const rfq = await createRfq();

    const savedDraft = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfq.id}/quote`)
      .set("x-user-id", quoteOperatorId)
      .send({
        customerName: "Northwind Fleet",
        customerCompany: "Northwind Fleet",
        notes: "Send after sales sign-off.",
        lineItems: [
          {
            description: "Brake pad kit",
            quantity: 40,
            unitPrice: 21
          },
          {
            description: "Rotor pair",
            quantity: 10,
            unitPrice: 70
          }
        ]
      });

    expect(savedDraft.status).toBe(200);

    const submitted = await request(app.getHttpServer())
      .post(`/api/quotes/${savedDraft.body.quote.id}/submit`)
      .set("x-user-id", quoteOperatorId)
      .send({});

    expect(submitted.status).toBe(201);
    expect(submitted.body.workflowState).toBe("pending_approval");

    const approved = await request(app.getHttpServer())
      .post(`/api/quotes/${savedDraft.body.quote.id}/approve`)
      .set("x-user-id", salesApproverId)
      .send({});

    expect(approved.status).toBe(201);
    expect(approved.body.workflowState).toBe("approved");
    expect(approved.body.quote.status).toBe("approved");
    expect(approved.body.history.map((event: { status: string }) => event.status)).toEqual([
      "draft",
      "pending_approval",
      "approved"
    ]);
  });
});
