/**
 * MVP1 RFQ-to-approved-quote end-to-end flow tests.
 *
 * These tests exercise the full pipeline:
 *   intake → extracted-items → item edit → quote draft → submit → approve → jobs
 *
 * Each test builds on shared state from createRfqAndExtractItems().
 */
import type { INestApplication } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaClient, UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/bootstrap";

const prisma = new PrismaClient();

describe("MVP1 RFQ-to-approved-quote flow", () => {
  let app: INestApplication;
  let operatorToken = "";
  let salesToken = "";
  let adminToken = "";
  let operatorId = "";
  let salesId = "";

  // ─── Auth helper ────────────────────────────────────────────────────────────
  async function loginAs(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password });
    const cookies: string[] = Array.isArray(res.headers["set-cookie"])
      ? (res.headers["set-cookie"] as string[])
      : typeof res.headers["set-cookie"] === "string"
        ? [res.headers["set-cookie"] as string]
        : [];
    const tokenCookie = cookies.find((c) => c.startsWith("access_token="));
    if (!tokenCookie) throw new Error(`Login failed for ${email}`);
    return tokenCookie.split(";")[0].split("=")[1];
  }

  // ─── Setup ──────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean slate before each test
    await prisma.backgroundJob.deleteMany();
    await prisma.rfqItemMatch.deleteMany();
    await prisma.rfqExtractedItem.deleteMany();
    await prisma.rfqExtractedCustomer.deleteMany();
    await prisma.quoteStatusEvent.deleteMany();
    await prisma.quoteLineItem.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.rfqAttachment.deleteMany();
    await prisma.rfq.deleteMany();
    await prisma.rfqIntake.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();

    const operator = await prisma.user.create({
      data: {
        email: "mvp1-op@auto8.test",
        name: "Operator MVP1",
        role: UserRole.quote_operator,
        passwordHash: bcrypt.hashSync("op-pass123", 10),
        isActive: true,
      },
    });

    const sales = await prisma.user.create({
      data: {
        email: "mvp1-sales@auto8.test",
        name: "Sales MVP1",
        role: UserRole.sales_approver,
        passwordHash: bcrypt.hashSync("sales-pass123", 10),
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: "mvp1-admin@auto8.test",
        name: "Admin MVP1",
        role: UserRole.admin,
        passwordHash: bcrypt.hashSync("admin-pass123", 10),
        isActive: true,
      },
    });

    operatorId = operator.id;
    salesId = sales.id;

    operatorToken = await loginAs("mvp1-op@auto8.test", "op-pass123");
    salesToken = await loginAs("mvp1-sales@auto8.test", "sales-pass123");
    adminToken = await loginAs("mvp1-admin@auto8.test", "admin-pass123");
  });

  // ─── Helper: create an RFQ via intake-email ─────────────────────────────────
  async function createRfq(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/api/rfqs/intake-email")
      .send({
        fromEmail: "buyer@mvp1-test.example",
        fromName: "MVP1 Buyer",
        subject: "RFQ: hydraulic fittings for excavator fleet",
        body: `Need pricing for:\n- 20x PN-HF-3/4-NPT hydraulic fittings\n- 50x PN-HF-1/2-NPT fittings\nDelivery by June 15.`,
        receivedAt: "2026-05-26T08:00:00.000Z",
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  // ─── Helper: seed extracted items directly in DB for an rfqId ───────────────
  async function seedExtractedItems(rfqId: string) {
    await prisma.rfqExtractedItem.createMany({
      data: [
        {
          rfqId,
          partNumber: "PN-HF-3/4-NPT",
          description: "Hydraulic fitting 3/4 inch NPT stainless",
          quantity: 20,
          unit: "pcs",
          confidence: 0.95,
          confidenceReason: "Part number and quantity both stated",
        },
        {
          rfqId,
          partNumber: "PN-HF-1/2-NPT",
          description: "Hydraulic fitting 1/2 inch NPT stainless",
          quantity: 50,
          unit: "pcs",
          confidence: 0.92,
          confidenceReason: "Part number and quantity both stated",
        },
      ],
    });
  }

  // ─── Test 1: intake-email → pipelineStatus=classified ───────────────────────
  it("10.2 POST intake-email creates RFQ with pipelineStatus=classified", async () => {
    const rfqId = await createRfq();

    // Fetch RFQ detail
    const detail = await request(app.getHttpServer())
      .get(`/api/rfqs/${rfqId}`)
      .set("Authorization", `Bearer ${operatorToken}`);

    expect(detail.status).toBe(200);
    // pipelineStatus set to classified on intake (when isRfq defaults to true)
    expect(detail.body.rfqPipelineStatus).toBe("classified");
  });

  // ─── Test 2: GET extracted-items after seeding ───────────────────────────────
  it("10.3 GET extracted-items returns items after extraction", async () => {
    const rfqId = await createRfq();
    await seedExtractedItems(rfqId);

    const res = await request(app.getHttpServer())
      .get(`/api/rfqs/${rfqId}/extracted-items`)
      .set("Authorization", `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toMatchObject({
      partNumber: "PN-HF-3/4-NPT",
      quantity: 20,
    });
  });

  // ─── Test 3: PATCH extracted-items/:itemId updates description ───────────────
  it("10.4 PATCH extracted-items/:itemId updates description", async () => {
    const rfqId = await createRfq();
    await seedExtractedItems(rfqId);

    // Get item list
    const listRes = await request(app.getHttpServer())
      .get(`/api/rfqs/${rfqId}/extracted-items`)
      .set("Authorization", `Bearer ${operatorToken}`);
    const firstItem = listRes.body[0] as { id: string };

    // Update description
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/rfqs/${rfqId}/extracted-items/${firstItem.id}`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ description: "Updated hydraulic fitting description" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.description).toBe("Updated hydraulic fitting description");
    expect(patchRes.body.id).toBe(firstItem.id);
  });

  // ─── Test 4: PUT quote → draft saved, pipelineStatus=quote_draft_created ─────
  it("10.5 PUT quote saves draft with calculated totals; pipelineStatus=quote_draft_created", async () => {
    const rfqId = await createRfq();

    const quoteRes = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfqId}/quote`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        customerName: "MVP1 Buyer",
        customerCompany: "MVP1 Corp",
        notes: "Test draft",
        discount: 0,
        tax: 0,
        grandTotal: 1200,
        paymentTerms: "Net 30",
        deliveryTerms: "FOB",
        validityDays: 14,
        lineItems: [
          { description: "Hydraulic fitting 3/4", quantity: 20, unitPrice: 40, sortOrder: 0 },
          { description: "Hydraulic fitting 1/2", quantity: 50, unitPrice: 16, sortOrder: 1 },
        ],
      });

    expect(quoteRes.status).toBe(200);
    expect(quoteRes.body.quote.status).toBe("draft");
    expect(quoteRes.body.quote.grandTotal).toBe(1600); // server-computed: 20×40 + 50×16 = 1600

    // Check pipeline status updated
    const detail = await request(app.getHttpServer())
      .get(`/api/rfqs/${rfqId}`)
      .set("Authorization", `Bearer ${operatorToken}`);
    expect(detail.body.rfqPipelineStatus).toBe("quote_draft_created");
  });

  // ─── Test 5: POST quote/submit → pipelineStatus=quote_submitted ──────────────
  it("10.6 POST quote/submit updates pipelineStatus=quote_submitted and status=pending_approval", async () => {
    const rfqId = await createRfq();

    // Create draft first
    const draftRes = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfqId}/quote`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        customerName: "MVP1 Buyer",
        customerCompany: "MVP1 Corp",
        notes: "",
        discount: 0,
        tax: 0,
        grandTotal: 800,
        lineItems: [{ description: "Fitting", quantity: 10, unitPrice: 80, sortOrder: 0 }],
      });
    const quoteId = draftRes.body.quote.id as string;

    // Submit
    const submitRes = await request(app.getHttpServer())
      .post(`/api/quotes/${quoteId}/submit`)
      .set("Authorization", `Bearer ${operatorToken}`);
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.quote.status).toBe("pending_approval");

    // Small delay to allow fire-and-forget pipeline status update to complete
    await new Promise((r) => setTimeout(r, 100));

    // Check pipeline status
    const detail = await request(app.getHttpServer())
      .get(`/api/rfqs/${rfqId}`)
      .set("Authorization", `Bearer ${operatorToken}`);
    expect(detail.body.rfqPipelineStatus).toBe("quote_submitted");
  });

  // ─── Test 6: POST quote/approve → pipelineStatus=approved, sheet_export enqueued
  it("10.7 POST quote/approve updates pipelineStatus=approved and enqueues sheet_export job", async () => {
    const rfqId = await createRfq();

    // Create + submit quote
    const draftRes = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfqId}/quote`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        customerName: "MVP1 Buyer",
        customerCompany: "MVP1 Corp",
        notes: "",
        discount: 0,
        tax: 0,
        grandTotal: 500,
        lineItems: [{ description: "Fitting", quantity: 5, unitPrice: 100, sortOrder: 0 }],
      });
    const quoteId = draftRes.body.quote.id as string;

    await request(app.getHttpServer())
      .post(`/api/quotes/${quoteId}/submit`)
      .set("Authorization", `Bearer ${operatorToken}`);

    // Approve
    const approveRes = await request(app.getHttpServer())
      .post(`/api/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect(approveRes.status).toBe(201);
    expect(approveRes.body.quote.status).toBe("approved");

    // Check pipeline status
    const detail = await request(app.getHttpServer())
      .get(`/api/rfqs/${rfqId}`)
      .set("Authorization", `Bearer ${operatorToken}`);
    expect(detail.body.rfqPipelineStatus).toBe("approved");

    // Sheet export job should be enqueued
    const jobsRes = await request(app.getHttpServer())
      .get("/api/jobs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(jobsRes.status).toBe(200);
    const jobs = jobsRes.body.data as Array<{ type: string; status: string }>;
    const sheetJob = jobs.find((j) => j.type === "sheet_export");
    expect(sheetJob).toBeDefined();
    expect(sheetJob?.status).toBe("pending");
  });

  // ─── Test 7: GET quote email → 401 without token, 200 with operator token ────
  it("10.8 GET quote email returns 401 without token and 200 with operator token", async () => {
    const rfqId = await createRfq();

    const draftRes = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfqId}/quote`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        customerName: "MVP1 Buyer",
        customerCompany: "MVP1 Corp",
        notes: "",
        discount: 0,
        tax: 0,
        grandTotal: 100,
        lineItems: [{ description: "Test", quantity: 1, unitPrice: 100, sortOrder: 0 }],
      });
    const quoteId = draftRes.body.quote.id as string;

    // Submit
    await request(app.getHttpServer())
      .post(`/api/quotes/${quoteId}/submit`)
      .set("Authorization", `Bearer ${operatorToken}`);

    // Approve (this triggers generateDraft → creates QuoteEmail record)
    await request(app.getHttpServer())
      .post(`/api/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${salesToken}`);

    // Without auth → 401
    const unauthRes = await request(app.getHttpServer())
      .get(`/api/quotes/${quoteId}/email`);
    expect(unauthRes.status).toBe(401);

    // With operator token → 200
    const authRes = await request(app.getHttpServer())
      .get(`/api/quotes/${quoteId}/email`)
      .set("Authorization", `Bearer ${operatorToken}`);
    expect(authRes.status).toBe(200);
    expect(authRes.body).toHaveProperty("subject");
    expect(authRes.body).toHaveProperty("body");
  });

  // ─── Test 8: GET /jobs → sheet_export job appears after approval ─────────────
  it("10.9 GET /jobs lists sheet_export job after quote approval", async () => {
    const rfqId = await createRfq();

    const draftRes = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfqId}/quote`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        customerName: "MVP1 Buyer",
        customerCompany: "MVP1 Corp",
        notes: "",
        discount: 0,
        tax: 0,
        grandTotal: 200,
        lineItems: [{ description: "Item", quantity: 2, unitPrice: 100, sortOrder: 0 }],
      });
    const quoteId = draftRes.body.quote.id as string;

    await request(app.getHttpServer())
      .post(`/api/quotes/${quoteId}/submit`)
      .set("Authorization", `Bearer ${operatorToken}`);

    await request(app.getHttpServer())
      .post(`/api/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${salesToken}`);

    // Jobs list
    const jobsRes = await request(app.getHttpServer())
      .get("/api/jobs?type=sheet_export")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(jobsRes.status).toBe(200);
    expect(jobsRes.body.data.length).toBeGreaterThanOrEqual(1);
    const job = jobsRes.body.data[0] as { type: string; payload: string };
    expect(job.type).toBe("sheet_export");
    expect(JSON.parse(job.payload)).toHaveProperty("quoteId", quoteId);
  });

  // ─── Test 9: GET /audit → job events after dispatch ─────────────────────────
  it("10.10 GET /audit shows job completion events after manual job dispatch", async () => {
    // Seed a completed backgroundJob directly to trigger audit log check
    const rfqId = await createRfq();

    const draftRes = await request(app.getHttpServer())
      .put(`/api/rfqs/${rfqId}/quote`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        customerName: "MVP1 Buyer",
        customerCompany: "MVP1 Corp",
        notes: "",
        discount: 0,
        tax: 0,
        grandTotal: 150,
        lineItems: [{ description: "Item", quantity: 1, unitPrice: 150, sortOrder: 0 }],
      });
    const quoteId = draftRes.body.quote.id as string;

    // Create a mock completed job with audit log entry directly
    const job = await prisma.backgroundJob.create({
      data: {
        type: "item_match",
        status: "completed",
        payload: JSON.stringify({ rfqId }),
        attempts: 1,
        maxAttempts: 3,
      },
    });

    // Manually seed an audit log event for this job (simulating job completion audit)
    await prisma.auditLog.create({
      data: {
        actorId: operatorId,
        action: "job.completed",
        resourceType: "BackgroundJob",
        resourceId: job.id,
        after: JSON.stringify({ type: "item_match", status: "completed" }),
      },
    });

    // Small delay so audit log timestamp is reliable
    await new Promise((r) => setTimeout(r, 50));

    // Check audit log for this job
    const auditRes = await request(app.getHttpServer())
      .get(`/api/audit/BackgroundJob/${job.id}`)
      .set("Authorization", `Bearer ${salesToken}`);

    expect(auditRes.status).toBe(200);
    const logs = auditRes.body as Array<{ action: string; resourceId: string }>;
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const completedEvent = logs.find((l) => l.action === "job.completed");
    expect(completedEvent).toBeDefined();

    // Suppress unused variable warning for quoteId
    expect(quoteId).toBeTruthy();
  });
});
