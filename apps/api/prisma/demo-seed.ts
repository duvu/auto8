import {
  PrismaClient,
  QuoteStatus,
  RfqWorkflowState,
  UserRole,
} from "@prisma/client";

/**
 * Seeds 5 demo RFQ records across different pipeline stages.
 * Called from seed.ts when SEED_DEMO=true or --demo flag is passed.
 */
export async function seedDemoRfqs(
  prisma: PrismaClient,
  operatorId: string,
  salesId: string,
): Promise<void> {
  // Prefix to avoid collision with existing seeds
  const PREFIX = "DEMO-";

  // ── RFQ-D001: classified (fresh intake, no items, no quote) ──────────────
  const intake1 = await prisma.rfqIntake.create({
    data: {
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: "procurement@acme-corp.example",
      senderName: "Alice Procurement",
      subject: "RFQ: hydraulic fittings for excavator fleet",
      body: `Dear Auto8 team,

We are in urgent need of hydraulic fittings for our excavator fleet undergoing
maintenance next month. Please provide pricing for the following:

- 20x PN-HF-3/4-NPT  (3/4" NPT hydraulic fitting, stainless)
- 50x PN-HF-1/2-NPT  (1/2" NPT hydraulic fitting, stainless)
- 10x PN-HH-12MM     (12mm high-pressure hydraulic hose end)

Delivery by June 15 is required. Please include lead time and payment terms.

Best regards,
Alice`,
      receivedAt: new Date("2026-05-26T08:00:00.000Z"),
      rawPayload: JSON.stringify({ seed: true, messageId: `${PREFIX}rfq-001` }),
      rfqPipelineStatus: "classified",
      isRfq: true,
      classificationScore: 0.94,
      classificationReason: "Contains explicit part numbers and delivery request",
    },
  });

  await prisma.rfq.create({
    data: {
      reference: `${PREFIX}RFQ-001`,
      workflowState: RfqWorkflowState.new,
      intakeId: intake1.id,
    },
  });

  // ── RFQ-D002: ready_for_quote (extracted items, no quote yet) ────────────
  const intake2 = await prisma.rfqIntake.create({
    data: {
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: "parts@western-trucks.example",
      senderName: "Bob Parts Manager",
      subject: "RFQ: truck brake system components",
      body: `Hello,

Please quote the following brake system components for our truck fleet:

Item 1: Part# WH-BK-DISC-12 — Brake disc rotor 12", qty 24
Item 2: Part# WH-BK-PAD-SET — Brake pad set (front), qty 24
Item 3: Part# WH-BK-CALIPER — Brake caliper assembly, qty 12

Our reference PO is WT-2026-0541. Terms are Net 30. We need delivery within 2 weeks.

Thanks,
Bob`,
      receivedAt: new Date("2026-05-26T10:30:00.000Z"),
      rawPayload: JSON.stringify({ seed: true, messageId: `${PREFIX}rfq-002` }),
      rfqPipelineStatus: "ready_for_quote",
      isRfq: true,
      classificationScore: 0.98,
      classificationReason: "Part numbers, quantities, and delivery terms present",
    },
  });

  const rfq2 = await prisma.rfq.create({
    data: {
      reference: `${PREFIX}RFQ-002`,
      workflowState: RfqWorkflowState.new,
      intakeId: intake2.id,
    },
  });

  // Extracted items for RFQ-D002
  await prisma.rfqExtractedItem.createMany({
    data: [
      {
        rfqId: rfq2.id,
        partNumber: "WH-BK-DISC-12",
        description: "Brake disc rotor 12 inch",
        quantity: 24,
        unit: "pcs",
        confidence: 0.95,
        confidenceReason: "Part number, description, and quantity all explicitly stated",
      },
      {
        rfqId: rfq2.id,
        partNumber: "WH-BK-PAD-SET",
        description: "Brake pad set (front)",
        quantity: 24,
        unit: "set",
        confidence: 0.93,
        confidenceReason: "Part number and quantity explicitly stated",
      },
      {
        rfqId: rfq2.id,
        partNumber: "WH-BK-CALIPER",
        description: "Brake caliper assembly",
        quantity: 12,
        unit: "pcs",
        confidence: 0.91,
        confidenceReason: "Part number and quantity explicitly stated",
      },
    ],
  });

  // ── RFQ-D003: quote_draft_created (quote in draft) ───────────────────────
  const intake3 = await prisma.rfqIntake.create({
    data: {
      sourceType: "slack",
      sourceLabel: "Slack / #rfqs",
      senderEmail: "carla@depot-logistics.example",
      senderName: "Carla Depot Ops",
      subject: "RFQ: engine oil and filters for depot fleet",
      body: `Hi team, Carla from Depot Logistics here. We need to stock up before July:

- Part# ENO-5W30-4L   Engine oil 5W-30, 4L jugs — 60 units
- Part# FLT-OIL-STD   Standard oil filter — 60 units
- Part# FLT-AIR-HD    Heavy-duty air filter — 30 units

We usually order quarterly. Can you include bulk discount info? Thanks`,
      receivedAt: new Date("2026-05-26T13:00:00.000Z"),
      rawPayload: JSON.stringify({
        seed: true,
        messageId: `${PREFIX}rfq-003`,
        source: "slack",
      }),
      slackWorkspaceId: "W_DEMO_001",
      slackWorkspaceName: "Auto8 Demo",
      slackChannelId: "C_RFQS",
      slackChannelName: "rfqs",
      slackSubmitterId: "U_CARLA",
      slackSubmitterName: "Carla Depot Ops",
      slackSubmitterEmail: "carla@depot-logistics.example",
      rfqPipelineStatus: "quote_draft_created",
      isRfq: true,
      classificationScore: 0.96,
      classificationReason: "Part numbers, quantities, and fleet context present",
    },
  });

  const rfq3 = await prisma.rfq.create({
    data: {
      reference: `${PREFIX}RFQ-003`,
      workflowState: RfqWorkflowState.draft,
      intakeId: intake3.id,
    },
  });

  // Extracted items for RFQ-D003
  await prisma.rfqExtractedItem.createMany({
    data: [
      {
        rfqId: rfq3.id,
        partNumber: "ENO-5W30-4L",
        description: "Engine oil 5W-30 4L",
        quantity: 60,
        unit: "unit",
        confidence: 0.97,
        confidenceReason: "Part number, full description, quantity all stated",
      },
      {
        rfqId: rfq3.id,
        partNumber: "FLT-OIL-STD",
        description: "Standard oil filter",
        quantity: 60,
        unit: "pcs",
        confidence: 0.94,
        confidenceReason: "Part number and quantity explicitly stated",
      },
      {
        rfqId: rfq3.id,
        partNumber: "FLT-AIR-HD",
        description: "Heavy-duty air filter",
        quantity: 30,
        unit: "pcs",
        confidence: 0.92,
        confidenceReason: "Part number and quantity explicitly stated",
      },
    ],
  });

  // Draft quote for RFQ-D003
  const quote3 = await prisma.quote.create({
    data: {
      rfqId: rfq3.id,
      customerName: "Carla Depot Ops",
      customerCompany: "Depot Logistics",
      notes: "Quarterly bulk order — consider discount pricing.",
      discount: 0,
      tax: 0,
      grandTotal: 2340,
      paymentTerms: "Net 30",
      deliveryTerms: "FOB Origin",
      validityDays: 14,
      status: QuoteStatus.draft,
      createdById: operatorId,
      lineItems: {
        create: [
          {
            description: "Engine oil 5W-30 4L",
            quantity: 60,
            unitPrice: 22,
            subtotal: 1320,
            sortOrder: 0,
          },
          {
            description: "Standard oil filter",
            quantity: 60,
            unitPrice: 8,
            subtotal: 480,
            sortOrder: 1,
          },
          {
            description: "Heavy-duty air filter",
            quantity: 30,
            unitPrice: 18,
            subtotal: 540,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  await prisma.quoteStatusEvent.create({
    data: {
      quoteId: quote3.id,
      actorId: operatorId,
      status: QuoteStatus.draft,
      createdAt: new Date("2026-05-26T14:00:00.000Z"),
    },
  });

  // ── RFQ-D004: quote_submitted ────────────────────────────────────────────
  const intake4 = await prisma.rfqIntake.create({
    data: {
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: "david@cityworks.example",
      senderName: "David City Works",
      subject: "RFQ: power tools for city maintenance crew",
      body: `Auto8 Team,

Our maintenance crew needs replacement power tools for Q3 operations. Please quote:

- 10x Heavy-duty angle grinder 7-inch (PN: PT-AG-7)
- 8x  Cordless impact wrench 18V kit (PN: PT-IW-18V)
- 15x Work light LED 60W portable (PN: LT-WK-LED60)

Delivery required by July 1. We are a city government buyer, Net 60 terms expected.

David Chen
City Works Department`,
      receivedAt: new Date("2026-05-25T16:00:00.000Z"),
      rawPayload: JSON.stringify({ seed: true, messageId: `${PREFIX}rfq-004` }),
      rfqPipelineStatus: "quote_submitted",
      isRfq: true,
      classificationScore: 0.97,
      classificationReason: "Explicit part numbers, quantities, delivery date, payment terms",
    },
  });

  const rfq4 = await prisma.rfq.create({
    data: {
      reference: `${PREFIX}RFQ-004`,
      workflowState: RfqWorkflowState.pending_approval,
      intakeId: intake4.id,
    },
  });

  const quote4 = await prisma.quote.create({
    data: {
      rfqId: rfq4.id,
      customerName: "David Chen",
      customerCompany: "City Works Department",
      notes: "Government buyer — Net 60 terms required.",
      discount: 0,
      tax: 0,
      grandTotal: 2680,
      paymentTerms: "Net 60",
      deliveryTerms: "Delivered Duty Paid",
      validityDays: 30,
      status: QuoteStatus.pending_approval,
      createdById: operatorId,
      submittedAt: new Date("2026-05-25T17:30:00.000Z"),
      lineItems: {
        create: [
          {
            description: "Heavy-duty angle grinder 7-inch",
            quantity: 10,
            unitPrice: 89,
            subtotal: 890,
            sortOrder: 0,
          },
          {
            description: "Cordless impact wrench 18V kit",
            quantity: 8,
            unitPrice: 145,
            subtotal: 1160,
            sortOrder: 1,
          },
          {
            description: "Work light LED 60W portable",
            quantity: 15,
            unitPrice: 42,
            subtotal: 630,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  await prisma.quoteStatusEvent.createMany({
    data: [
      {
        quoteId: quote4.id,
        actorId: operatorId,
        status: QuoteStatus.draft,
        createdAt: new Date("2026-05-25T17:00:00.000Z"),
      },
      {
        quoteId: quote4.id,
        actorId: operatorId,
        status: QuoteStatus.pending_approval,
        createdAt: new Date("2026-05-25T17:30:00.000Z"),
      },
    ],
  });

  // ── RFQ-D005: approved (full lifecycle complete) ─────────────────────────
  const intake5 = await prisma.rfqIntake.create({
    data: {
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: "elena@northport-shipping.example",
      senderName: "Elena Northport",
      subject: "RFQ: maritime safety equipment Q2",
      body: `Dear Auto8,

Northport Shipping requires the following for our Q2 vessel safety check:

- 20 Life ring buoys (PN: SAF-LRB-30) — SOLAS compliant
- 50 Personal flotation devices type III (PN: SAF-PFD-3)
- 10 Fire extinguisher marine 2.5kg (PN: SAF-FE-25M)

We are an existing customer (account NPSH-001). Please apply standard trade pricing.

Elena Radford
Procurement Manager, Northport Shipping`,
      receivedAt: new Date("2026-05-24T09:00:00.000Z"),
      rawPayload: JSON.stringify({ seed: true, messageId: `${PREFIX}rfq-005` }),
      rfqPipelineStatus: "approved",
      isRfq: true,
      classificationScore: 0.99,
      classificationReason: "SOLAS part numbers, quantities, customer account reference",
    },
  });

  const rfq5 = await prisma.rfq.create({
    data: {
      reference: `${PREFIX}RFQ-005`,
      workflowState: RfqWorkflowState.approved,
      intakeId: intake5.id,
    },
  });

  const quote5 = await prisma.quote.create({
    data: {
      rfqId: rfq5.id,
      customerName: "Elena Radford",
      customerCompany: "Northport Shipping",
      notes: "Existing customer NPSH-001. Standard trade pricing applied.",
      discount: 0,
      tax: 0,
      grandTotal: 2380,
      paymentTerms: "Net 30",
      deliveryTerms: "CIF Northport Dock",
      validityDays: 30,
      status: QuoteStatus.approved,
      createdById: operatorId,
      approvedById: salesId,
      submittedAt: new Date("2026-05-24T10:00:00.000Z"),
      approvedAt: new Date("2026-05-24T11:30:00.000Z"),
      lineItems: {
        create: [
          {
            description: "Life ring buoy 30 inch SOLAS compliant",
            quantity: 20,
            unitPrice: 65,
            subtotal: 1300,
            sortOrder: 0,
          },
          {
            description: "Personal flotation device type III",
            quantity: 50,
            unitPrice: 18,
            subtotal: 900,
            sortOrder: 1,
          },
          {
            description: "Fire extinguisher marine 2.5kg",
            quantity: 10,
            unitPrice: 18,
            subtotal: 180,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  await prisma.quoteStatusEvent.createMany({
    data: [
      {
        quoteId: quote5.id,
        actorId: operatorId,
        status: QuoteStatus.draft,
        createdAt: new Date("2026-05-24T09:30:00.000Z"),
      },
      {
        quoteId: quote5.id,
        actorId: operatorId,
        status: QuoteStatus.pending_approval,
        createdAt: new Date("2026-05-24T10:00:00.000Z"),
      },
      {
        quoteId: quote5.id,
        actorId: salesId,
        status: QuoteStatus.approved,
        createdAt: new Date("2026-05-24T11:30:00.000Z"),
      },
    ],
  });

  // Sheet export marker — enqueue a completed sheet_export job for RFQ-D005
  await prisma.backgroundJob.create({
    data: {
      type: "sheet_export",
      status: "completed",
      payload: JSON.stringify({ quoteId: quote5.id }),
      attempts: 1,
      maxAttempts: 3,
    },
  });

  console.log("Demo seed complete: 5 demo RFQs across pipeline stages.");
}
