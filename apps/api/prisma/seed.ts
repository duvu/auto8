import * as bcrypt from "bcrypt";

import { PrismaClient, QuoteStatus, RfqWorkflowState, UserRole } from "@prisma/client";

process.loadEnvFile?.();

const prisma = new PrismaClient();

async function main() {
  await prisma.quoteStatusEvent.deleteMany();
  await prisma.quoteLineItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.rfq.deleteMany();
  await prisma.rfqIntake.deleteMany();
  await prisma.user.deleteMany();

  const operatorPasswordHash = bcrypt.hashSync("auto8", 10);
  const salesPasswordHash = bcrypt.hashSync("auto8", 10);
  const adminPasswordHash = bcrypt.hashSync("admin123", 10);

  // Upsert admin user
  await prisma.user.upsert({
    where: { email: "admin@auto8.dev" },
    update: { passwordHash: adminPasswordHash, isActive: true },
    create: {
      email: "admin@auto8.dev",
      name: "Auto8 Admin",
      role: UserRole.admin,
      isActive: true,
      passwordHash: adminPasswordHash,
    },
  });

  const quoteOperator = await prisma.user.create({
    data: {
      email: "operator@auto8.dev",
      name: "Quinn Operator",
      role: UserRole.quote_operator,
      passwordHash: operatorPasswordHash,
    }
  });

  const salesApprover = await prisma.user.create({
    data: {
      email: "sales@auto8.dev",
      name: "Sam Sales",
      role: UserRole.sales_approver,
      passwordHash: salesPasswordHash,
    }
  });

  const freshEmail = await prisma.rfqIntake.create({
    data: {
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: "buyer@northwind.example",
      senderName: "Nina Buyer",
      subject: "RFQ: brake pads for fleet maintenance",
      body: "Need pricing for 40 brake pad kits for our June maintenance cycle.",
      receivedAt: new Date("2026-05-25T09:00:00.000Z"),
      rawPayload: JSON.stringify({ seed: true, messageId: "seed-rfq-1" })
    }
  });

  await prisma.rfq.create({
    data: {
      reference: "RFQ-1001",
      workflowState: RfqWorkflowState.new,
      intakeId: freshEmail.id
    }
  });

  const approvalEmail = await prisma.rfqIntake.create({
    data: {
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: "procurement@eastgate.example",
      senderName: "Evan Procurement",
      subject: "RFQ: spark plugs and air filters",
      body: "Please quote 80 spark plugs and 30 air filters for monthly service jobs.",
      receivedAt: new Date("2026-05-24T14:30:00.000Z"),
      rawPayload: JSON.stringify({ seed: true, messageId: "seed-rfq-2" })
    }
  });

  const seededRfq = await prisma.rfq.create({
    data: {
      reference: "RFQ-1002",
      workflowState: RfqWorkflowState.pending_approval,
      intakeId: approvalEmail.id
    }
  });

  const slackIntake = await prisma.rfqIntake.create({
    data: {
      sourceType: "slack",
      sourceLabel: "Slack / #rfqs",
      senderEmail: "avery@westfleet.example",
      senderName: "Avery Service Lead",
      subject: "RFQ: wiper blades for depot vans",
      body: "Slack intake from depot ops: please quote 55 wiper blade sets for next week's service rotation.",
      receivedAt: new Date("2026-05-25T12:15:00.000Z"),
      rawPayload: JSON.stringify({ seed: true, messageId: "seed-rfq-3", source: "slack" }),
      slackWorkspaceId: "W_AUTO8_DEMO",
      slackWorkspaceName: "Auto8 Demo Workspace",
      slackChannelId: "C_RFQ_DEMO",
      slackChannelName: "rfqs",
      slackSubmitterId: "U_SERVICE_LEAD",
      slackSubmitterName: "Avery Service Lead",
      slackSubmitterEmail: "avery@westfleet.example"
    }
  });

  await prisma.rfq.create({
    data: {
      reference: "RFQ-1003",
      workflowState: RfqWorkflowState.new,
      intakeId: slackIntake.id
    }
  });

  const quote = await prisma.quote.create({
    data: {
      rfqId: seededRfq.id,
      customerName: "Eastgate Service Center",
      customerCompany: "Eastgate Service Center",
      notes: "Priority approval demo quote.",
      status: QuoteStatus.pending_approval,
      createdById: quoteOperator.id,
      submittedAt: new Date("2026-05-24T15:00:00.000Z"),
      lineItems: {
        create: [
          {
            description: "Spark plug pack",
            quantity: 80,
            unitPrice: 12,
            sortOrder: 0
          },
          {
            description: "Air filter",
            quantity: 30,
            unitPrice: 20,
            sortOrder: 1
          }
        ]
      }
    }
  });

  await prisma.quoteStatusEvent.createMany({
    data: [
      {
        quoteId: quote.id,
        actorId: quoteOperator.id,
        status: QuoteStatus.draft,
        createdAt: new Date("2026-05-24T14:45:00.000Z")
      },
      {
        quoteId: quote.id,
        actorId: quoteOperator.id,
        status: QuoteStatus.pending_approval,
        createdAt: new Date("2026-05-24T15:00:00.000Z")
      }
    ]
  });

  console.log("Seeded users:", { quoteOperator: quoteOperator.email, salesApprover: salesApprover.email });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
