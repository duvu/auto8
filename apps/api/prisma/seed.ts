import { PrismaClient, QuoteStatus, RfqWorkflowState, UserRole } from "@prisma/client";

process.loadEnvFile?.();

const prisma = new PrismaClient();

async function main() {
  await prisma.quoteStatusEvent.deleteMany();
  await prisma.quoteLineItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.rfq.deleteMany();
  await prisma.rfqEmail.deleteMany();
  await prisma.user.deleteMany();

  const quoteOperator = await prisma.user.create({
    data: {
      email: "operator@auto8.dev",
      name: "Quinn Operator",
      role: UserRole.quote_operator
    }
  });

  const salesApprover = await prisma.user.create({
    data: {
      email: "sales@auto8.dev",
      name: "Sam Sales",
      role: UserRole.sales_approver
    }
  });

  const freshEmail = await prisma.rfqEmail.create({
    data: {
      fromEmail: "buyer@northwind.example",
      fromName: "Nina Buyer",
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
      emailId: freshEmail.id
    }
  });

  const approvalEmail = await prisma.rfqEmail.create({
    data: {
      fromEmail: "procurement@eastgate.example",
      fromName: "Evan Procurement",
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
      emailId: approvalEmail.id
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
