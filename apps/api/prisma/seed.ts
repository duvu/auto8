import * as bcrypt from 'bcrypt';
import { PrismaClient, QuoteStatus, RfqWorkflowState, RfqSourceType, UserRole } from '@prisma/client';

process.loadEnvFile?.();
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // ── Cleanup (dependency order) ──────────────────────────────────────────────
  await prisma.backgroundJob.deleteMany();
  await prisma.quoteStatusEvent.deleteMany();
  await prisma.quoteLineItem.deleteMany();
  await prisma.quoteEmailSend.deleteMany();
  await prisma.quoteEmail.deleteMany();
  await prisma.magicLinkToken.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.rfqItemMatch.deleteMany();
  await prisma.rfqExtractedItem.deleteMany();
  await prisma.rfqExtractedCustomer.deleteMany();
  await prisma.rfqAttachment.deleteMany();
  await prisma.rfq.deleteMany();
  await prisma.rfqIntake.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCatalogue.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.connector.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.quoteTemplateLineItem.deleteMany();
  await prisma.quoteTemplate.deleteMany();
  await prisma.inviteToken.deleteMany();
  await prisma.emailVerifyToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
  console.log('Cleanup complete.');

  // ── Workspace ───────────────────────────────────────────────────────────────
  const demoWorkspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    update: { name: 'Acme Auto Parts' },
    create: { slug: 'demo', name: 'Acme Auto Parts' },
  });

  // ── Subscription ────────────────────────────────────────────────────────────
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.subscription.upsert({
    where: { workspaceId: demoWorkspace.id },
    update: { plan: 'trial', status: 'trialing', trialEndsAt },
    create: { workspaceId: demoWorkspace.id, plan: 'trial', status: 'trialing', trialEndsAt },
  });

  // ── Users ───────────────────────────────────────────────────────────────────
  const adminHash = bcrypt.hashSync('admin123', 10);
  const opHash    = bcrypt.hashSync('auto8', 10);
  const salesHash = bcrypt.hashSync('auto8', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@auto8.dev' },
    update: { passwordHash: adminHash, workspaceId: demoWorkspace.id, isEmailVerified: true },
    create: { email: 'admin@auto8.dev', name: 'Auto8 Admin', role: UserRole.admin, passwordHash: adminHash, workspaceId: demoWorkspace.id, isEmailVerified: true },
  });

  const opUser = await prisma.user.upsert({
    where: { email: 'operator@auto8.dev' },
    update: { passwordHash: opHash, workspaceId: demoWorkspace.id, isEmailVerified: true },
    create: { email: 'operator@auto8.dev', name: 'Quinn Operator', role: UserRole.quote_operator, passwordHash: opHash, workspaceId: demoWorkspace.id, isEmailVerified: true },
  });

  await prisma.user.upsert({
    where: { email: 'operator2@auto8.dev' },
    update: { passwordHash: opHash, workspaceId: demoWorkspace.id, isEmailVerified: true },
    create: { email: 'operator2@auto8.dev', name: 'Alex Operator', role: UserRole.quote_operator, passwordHash: opHash, workspaceId: demoWorkspace.id, isEmailVerified: true },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@auto8.dev' },
    update: { passwordHash: salesHash, workspaceId: demoWorkspace.id, isEmailVerified: true },
    create: { email: 'sales@auto8.dev', name: 'Sam Sales', role: UserRole.sales_approver, passwordHash: salesHash, workspaceId: demoWorkspace.id, isEmailVerified: true },
  });

  console.log('Users seeded.');

  // ── Customers (10) ──────────────────────────────────────────────────────────
  const customerData = [
    { companyName: 'Northwind Fleet Services', contactName: 'Nina Buyer', email: 'nina@northwind.example', phone: '+1-555-0101' },
    { companyName: 'Eastgate Service Center', contactName: 'Evan Procurement', email: 'evan@eastgate.example', phone: '+1-555-0102' },
    { companyName: 'Acme Corp', contactName: 'Alice Manager', email: 'alice@acmecorp.example', phone: '+1-555-0103' },
    { companyName: 'City Works Department', contactName: 'Carlos Works', email: 'carlos@cityworks.example', phone: '+1-555-0104' },
    { companyName: 'Northport Shipping', contactName: 'Nancy Ports', email: 'nancy@northport.example', phone: '+1-555-0105' },
    { companyName: 'Depot Logistics', contactName: 'Derek Depot', email: 'derek@depotlogistics.example', phone: '+1-555-0106' },
    { companyName: 'Summit Machinery', contactName: 'Sara Summit', email: 'sara@summit.example', phone: '+1-555-0107' },
    { companyName: 'Harbor Industrial', contactName: 'Henry Harbor', email: 'henry@harbor.example', phone: '+1-555-0108' },
    { companyName: 'Pacific Trade Co', contactName: 'Paula Pacific', email: 'paula@pacific.example', phone: '+1-555-0109' },
    { companyName: 'Metro Parts Inc', contactName: 'Mike Metro', email: 'mike@metro.example', phone: '+1-555-0110' },
  ];

  const customers = await Promise.all(
    customerData.map(c => prisma.customer.create({ data: { ...c, workspaceId: demoWorkspace.id } }))
  );
  console.log('Customers seeded:', customers.length);

  // ── Product Catalogue + Products (20) ───────────────────────────────────────
  const catalogue = await prisma.productCatalogue.create({
    data: { name: 'Acme Auto Parts Catalogue', workspaceId: demoWorkspace.id },
  });

  const productData = [
    // Hydraulic Fittings (5)
    { productCode: 'HF-001', productName: 'Hydraulic Fitting 1/4" NPT', description: 'Stainless steel NPT fitting 1/4 inch', brand: 'HydroFit', unit: 'pcs', basePrice: 8.50, categoryTags: ['hydraulic', 'fitting'] },
    { productCode: 'HF-002', productName: 'Hydraulic Fitting 3/8" NPT', description: 'Stainless steel NPT fitting 3/8 inch', brand: 'HydroFit', unit: 'pcs', basePrice: 10.00, categoryTags: ['hydraulic', 'fitting'] },
    { productCode: 'HF-003', productName: 'Hydraulic Hose 1/2" x 1m', description: 'High-pressure hydraulic hose 500mm', brand: 'HydroFit', unit: 'pcs', basePrice: 22.00, categoryTags: ['hydraulic', 'hose'] },
    { productCode: 'HF-004', productName: 'Hydraulic Coupling Male', description: 'Quick-disconnect male coupling', brand: 'HydroFit', unit: 'pcs', basePrice: 15.75, categoryTags: ['hydraulic', 'coupling'] },
    { productCode: 'HF-005', productName: 'Hydraulic Coupling Female', description: 'Quick-disconnect female coupling', brand: 'HydroFit', unit: 'pcs', basePrice: 15.75, categoryTags: ['hydraulic', 'coupling'] },
    // Automotive Filters (5)
    { productCode: 'AF-001', productName: 'Oil Filter - Universal', description: 'Universal spin-on oil filter', brand: 'FilterPro', unit: 'pcs', basePrice: 12.00, categoryTags: ['filter', 'oil'] },
    { productCode: 'AF-002', productName: 'Air Filter - Panel', description: 'Panel air filter for standard engines', brand: 'FilterPro', unit: 'pcs', basePrice: 18.50, categoryTags: ['filter', 'air'] },
    { productCode: 'AF-003', productName: 'Fuel Filter - In-Line', description: 'In-line fuel filter for petrol engines', brand: 'FilterPro', unit: 'pcs', basePrice: 9.00, categoryTags: ['filter', 'fuel'] },
    { productCode: 'AF-004', productName: 'Cabin Air Filter', description: 'HEPA cabin air filter', brand: 'FilterPro', unit: 'pcs', basePrice: 24.00, categoryTags: ['filter', 'cabin'] },
    { productCode: 'AF-005', productName: 'Hydraulic Return Filter', description: 'Return line hydraulic filter', brand: 'FilterPro', unit: 'pcs', basePrice: 35.00, categoryTags: ['filter', 'hydraulic'] },
    // Safety Equipment (5)
    { productCode: 'SE-001', productName: 'Safety Gloves - Mechanic', description: 'Cut-resistant mechanic gloves M/L/XL', brand: 'SafeGuard', unit: 'pairs', basePrice: 14.00, categoryTags: ['safety', 'gloves'] },
    { productCode: 'SE-002', productName: 'Safety Goggles - Clear', description: 'Anti-fog clear safety goggles', brand: 'SafeGuard', unit: 'pcs', basePrice: 8.00, categoryTags: ['safety', 'eyewear'] },
    { productCode: 'SE-003', productName: 'Hi-Vis Vest - Class 2', description: 'ANSI Class 2 high-visibility vest', brand: 'SafeGuard', unit: 'pcs', basePrice: 16.00, categoryTags: ['safety', 'ppe'] },
    { productCode: 'SE-004', productName: 'Hard Hat - White', description: 'ANSI Z89.1 compliant hard hat', brand: 'SafeGuard', unit: 'pcs', basePrice: 22.50, categoryTags: ['safety', 'head'] },
    { productCode: 'SE-005', productName: 'Safety Boots - Steel Toe', description: 'Steel-toe safety boots EU 40-46', brand: 'SafeGuard', unit: 'pairs', basePrice: 89.00, categoryTags: ['safety', 'footwear'] },
    // Power Tools (5)
    { productCode: 'PT-001', productName: 'Impact Wrench 1/2"', description: '450 Nm cordless impact wrench', brand: 'PowerMax', unit: 'pcs', basePrice: 189.00, categoryTags: ['tool', 'impact'] },
    { productCode: 'PT-002', productName: 'Angle Grinder 4.5"', description: '850W angle grinder with guard', brand: 'PowerMax', unit: 'pcs', basePrice: 65.00, categoryTags: ['tool', 'grinder'] },
    { productCode: 'PT-003', productName: 'Cordless Drill 18V', description: '18V Li-Ion cordless drill', brand: 'PowerMax', unit: 'pcs', basePrice: 129.00, categoryTags: ['tool', 'drill'] },
    { productCode: 'PT-004', productName: 'Torque Wrench 1/2" Drive', description: '20-200 Nm click torque wrench', brand: 'PowerMax', unit: 'pcs', basePrice: 55.00, categoryTags: ['tool', 'torque'] },
    { productCode: 'PT-005', productName: 'Socket Set 1/2" Drive (26pc)', description: '26-piece metric socket set with case', brand: 'PowerMax', unit: 'set', basePrice: 98.00, categoryTags: ['tool', 'socket'] },
  ];

  const products = await Promise.all(
    productData.map(p => prisma.product.create({ data: { ...p, catalogueId: catalogue.id } }))
  );
  console.log('Products seeded:', products.length);

  // ── Connectors (3) ──────────────────────────────────────────────────────────
  await prisma.connector.createMany({
    data: [
      { type: 'gmail', label: 'Gmail Connector', credentialsJson: JSON.stringify({ email: 'demo@acme.example', refreshToken: 'mock-refresh-token' }), isEnabled: false, workspaceId: demoWorkspace.id },
      { type: 'slack', label: 'Slack Connector', credentialsJson: JSON.stringify({ botToken: 'xoxb-mock-token', signingSecret: 'mock-secret' }), isEnabled: false, workspaceId: demoWorkspace.id },
      { type: 'whatsapp', label: 'WhatsApp Connector', credentialsJson: JSON.stringify({ phoneNumberId: '1234567890', accessToken: 'mock-access-token', appSecret: 'mock-app-secret' }), isEnabled: false, workspaceId: demoWorkspace.id },
    ],
  });
  console.log('Connectors seeded.');

  // ── Quote Templates (2) ─────────────────────────────────────────────────────
  const tpl1 = await prisma.quoteTemplate.create({
    data: {
      name: 'Standard Parts Quote',
      description: 'Standard template for automotive parts quotations',
      headerNotes: 'Thank you for your inquiry. Prices valid for 30 days.',
      paymentTerms: 'Net 30',
      deliveryTerms: 'FOB Origin',
      validityDays: 30,
      workspaceId: demoWorkspace.id,
      createdById: adminUser.id,
      lineItems: {
        create: [
          { description: 'Part A - Hydraulic Fitting', quantity: 10, unitPrice: 8.50, sortOrder: 0 },
          { description: 'Part B - Oil Filter', quantity: 5, unitPrice: 12.00, sortOrder: 1 },
          { description: 'Part C - Safety Gloves', quantity: 20, unitPrice: 14.00, sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.quoteTemplate.create({
    data: {
      name: 'Bulk Order Discount',
      description: 'Template for bulk orders with volume discount applied',
      headerNotes: 'Bulk pricing applies for orders over 50 units. Discount auto-applied.',
      paymentTerms: 'Net 45',
      deliveryTerms: 'DDP Destination',
      validityDays: 14,
      workspaceId: demoWorkspace.id,
      createdById: adminUser.id,
      lineItems: {
        create: [
          { description: 'Bulk Item - Socket Set (10% discount for qty 10+)', quantity: 10, unitPrice: 88.20, sortOrder: 0 },
          { description: 'Bulk Item - Impact Wrench (5% discount for qty 5+)', quantity: 5, unitPrice: 179.55, sortOrder: 1 },
        ],
      },
    },
  });
  console.log('Quote templates seeded.');


  // ── RFQ Pipeline Stages (8) ─────────────────────────────────────────────────

  // 7.1 Stage: new
  const intake1 = await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.email,
      sourceLabel: 'Gmail / demo@acme.example',
      senderEmail: 'buyer@northwind.example',
      senderName: 'Nina Buyer',
      subject: 'RFQ: hydraulic fittings for Q3 maintenance',
      body: 'Hi, we need pricing for 50 hydraulic fittings (1/4" NPT) and 20 hydraulic couplings for our Q3 maintenance cycle.',
      receivedAt: new Date('2026-05-20T09:00:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-new-001' }),
      rfqPipelineStatus: 'new',
      isRfq: false,
    },
  });
  await prisma.rfq.create({
    data: { reference: 'RFQ-2001', workflowState: RfqWorkflowState.new, intakeId: intake1.id },
  });

  // 7.2 Stage: needs_review
  const intake2 = await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.email,
      sourceLabel: 'Gmail / demo@acme.example',
      senderEmail: 'info@acmecorp.example',
      senderName: 'Alice Manager',
      subject: 'Re: parts availability',
      body: 'Hello, do you have any brake pads in stock? Also interested in oil filters if available.',
      receivedAt: new Date('2026-05-21T10:30:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-review-002' }),
      rfqPipelineStatus: 'needs_review',
      isRfq: false,
      classificationScore: 0.55,
      classificationReason: 'Message is ambiguous — mentions parts but may be a general enquiry.',
    },
  });
  await prisma.rfq.create({
    data: { reference: 'RFQ-2002', workflowState: RfqWorkflowState.new, intakeId: intake2.id },
  });

  // 7.3 Stage: classified
  const intake3 = await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.slack,
      sourceLabel: 'Slack / #rfqs',
      senderEmail: 'derek@depotlogistics.example',
      senderName: 'Derek Depot',
      subject: 'RFQ via Slack: safety equipment',
      body: 'Need 100 pairs of safety gloves, 50 hard hats, and 50 hi-vis vests for our warehouse crew.',
      receivedAt: new Date('2026-05-22T08:15:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-classified-003', source: 'slack' }),
      rfqPipelineStatus: 'classified',
      isRfq: true,
      classificationScore: 0.94,
      classificationReason: 'Clear request for specific products with quantities.',
      slackWorkspaceId: 'W_DEMO',
      slackWorkspaceName: 'Acme Demo',
      slackChannelId: 'C_RFQS',
      slackChannelName: 'rfqs',
      slackSubmitterId: 'U_DEREK',
      slackSubmitterName: 'Derek Depot',
      slackSubmitterEmail: 'derek@depotlogistics.example',
    },
  });
  await prisma.rfq.create({
    data: { reference: 'RFQ-2003', workflowState: RfqWorkflowState.new, intakeId: intake3.id },
  });

  // 7.4 Stage: ready_for_quote (with extracted items + customer)
  const intake4 = await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.email,
      sourceLabel: 'Gmail / demo@acme.example',
      senderEmail: 'sara@summit.example',
      senderName: 'Sara Summit',
      subject: 'RFQ: power tools for new facility',
      body: 'Please quote 5x Impact Wrench 1/2", 10x Cordless Drill 18V, and 3x Angle Grinder 4.5" for our new facility setup.',
      receivedAt: new Date('2026-05-23T14:00:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-ready-004' }),
      rfqPipelineStatus: 'ready_for_quote',
      isRfq: true,
      classificationScore: 0.97,
      classificationReason: 'Clear RFQ with specific products and quantities.',
    },
  });
  const rfq4 = await prisma.rfq.create({
    data: { reference: 'RFQ-2004', workflowState: RfqWorkflowState.new, intakeId: intake4.id },
  });
  const item4a = await prisma.rfqExtractedItem.create({
    data: { rfqId: rfq4.id, description: 'Impact Wrench 1/2"', quantity: 5, unit: 'pcs', confidence: 0.98 },
  });
  const item4b = await prisma.rfqExtractedItem.create({
    data: { rfqId: rfq4.id, description: 'Cordless Drill 18V', quantity: 10, unit: 'pcs', confidence: 0.97 },
  });
  const item4c = await prisma.rfqExtractedItem.create({
    data: { rfqId: rfq4.id, description: 'Angle Grinder 4.5"', quantity: 3, unit: 'pcs', confidence: 0.95 },
  });
  await prisma.rfqItemMatch.createMany({
    data: [
      { rfqExtractedItemId: item4a.id, productId: products.find(p => p.productCode === 'PT-001')!.id, score: 0.96, status: 'matched' },
      { rfqExtractedItemId: item4b.id, productId: products.find(p => p.productCode === 'PT-003')!.id, score: 0.94, status: 'matched' },
      { rfqExtractedItemId: item4c.id, productId: products.find(p => p.productCode === 'PT-002')!.id, score: 0.93, status: 'matched' },
    ],
  });
  await prisma.rfqExtractedCustomer.create({
    data: {
      rfqId: rfq4.id,
      customerId: customers.find(c => c.companyName === 'Summit Machinery')!.id,
      customerCompany: 'Summit Machinery',
      customerContact: 'Sara Summit',
      customerEmail: 'sara@summit.example',
      deliveryLocation: '100 Summit Rd, Springfield',
    },
  });

  // 7.5 Stage: quote_draft_created
  const intake5 = await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.email,
      sourceLabel: 'Gmail / demo@acme.example',
      senderEmail: 'nancy@northport.example',
      senderName: 'Nancy Ports',
      subject: 'RFQ: automotive filters bulk order',
      body: 'We need 100 oil filters and 50 air filters for our fleet maintenance this month. Please provide pricing.',
      receivedAt: new Date('2026-05-24T09:00:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-draft-005' }),
      rfqPipelineStatus: 'quote_draft_created',
      isRfq: true,
      classificationScore: 0.96,
    },
  });
  const rfq5 = await prisma.rfq.create({
    data: { reference: 'RFQ-2005', workflowState: RfqWorkflowState.draft, intakeId: intake5.id },
  });
  const quote5 = await prisma.quote.create({
    data: {
      rfqId: rfq5.id,
      customerName: 'Nancy Ports',
      customerCompany: 'Northport Shipping',
      notes: 'Bulk order for monthly fleet maintenance.',
      status: QuoteStatus.draft,
      createdById: opUser.id,
      customerId: customers.find(c => c.companyName === 'Northport Shipping')!.id,
      lineItems: {
        create: [
          { description: 'Oil Filter - Universal', quantity: 100, unitPrice: 12.00, sortOrder: 0, subtotal: 1200.00, productId: products.find(p => p.productCode === 'AF-001')!.id },
          { description: 'Air Filter - Panel', quantity: 50, unitPrice: 18.50, sortOrder: 1, subtotal: 925.00, productId: products.find(p => p.productCode === 'AF-002')!.id },
        ],
      },
      grandTotal: 2125.00,
    },
  });

  // 7.6 Stage: quote_submitted
  const intake6 = await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.email,
      sourceLabel: 'Gmail / demo@acme.example',
      senderEmail: 'evan@eastgate.example',
      senderName: 'Evan Procurement',
      subject: 'RFQ: spark plugs and air filters',
      body: 'Please quote 80 spark plugs and 30 air filters for our monthly service jobs.',
      receivedAt: new Date('2026-05-25T10:00:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-submitted-006' }),
      rfqPipelineStatus: 'quote_submitted',
      isRfq: true,
      classificationScore: 0.95,
    },
  });
  const rfq6 = await prisma.rfq.create({
    data: { reference: 'RFQ-2006', workflowState: RfqWorkflowState.pending_approval, intakeId: intake6.id },
  });
  const quote6 = await prisma.quote.create({
    data: {
      rfqId: rfq6.id,
      customerName: 'Evan Procurement',
      customerCompany: 'Eastgate Service Center',
      notes: 'Standard monthly service order.',
      status: QuoteStatus.pending_approval,
      createdById: opUser.id,
      submittedAt: new Date('2026-05-25T11:30:00Z'),
      customerId: customers.find(c => c.companyName === 'Eastgate Service Center')!.id,
      lineItems: {
        create: [
          { description: 'Spark Plug Pack (set of 4)', quantity: 80, unitPrice: 12.00, sortOrder: 0, subtotal: 960.00 },
          { description: 'Air Filter - Panel', quantity: 30, unitPrice: 18.50, sortOrder: 1, subtotal: 555.00, productId: products.find(p => p.productCode === 'AF-002')!.id },
        ],
      },
      grandTotal: 1515.00,
    },
  });

  // 7.7 Stage: approved (with BackgroundJob for sheet_export)
  const intake7 = await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.whatsapp,
      sourceLabel: 'WhatsApp Business',
      senderEmail: 'mike@metro.example',
      senderName: 'Mike Metro',
      subject: 'WhatsApp RFQ: socket sets',
      body: 'Hi, we need 20 socket sets and 10 torque wrenches. Can you send a quote ASAP?',
      receivedAt: new Date('2026-05-26T08:30:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-approved-007', from: 'whatsapp' }),
      rfqPipelineStatus: 'approved',
      isRfq: true,
      classificationScore: 0.93,
    },
  });
  const rfq7 = await prisma.rfq.create({
    data: { reference: 'RFQ-2007', workflowState: RfqWorkflowState.approved, intakeId: intake7.id },
  });
  const quote7 = await prisma.quote.create({
    data: {
      rfqId: rfq7.id,
      customerName: 'Mike Metro',
      customerCompany: 'Metro Parts Inc',
      notes: 'Urgent order — WhatsApp lead.',
      status: QuoteStatus.approved,
      createdById: opUser.id,
      approvedById: salesUser.id,
      submittedAt: new Date('2026-05-26T09:00:00Z'),
      approvedAt: new Date('2026-05-26T10:00:00Z'),
      customerId: customers.find(c => c.companyName === 'Metro Parts Inc')!.id,
      lineItems: {
        create: [
          { description: 'Socket Set 1/2" Drive (26pc)', quantity: 20, unitPrice: 98.00, sortOrder: 0, subtotal: 1960.00, productId: products.find(p => p.productCode === 'PT-005')!.id },
          { description: 'Torque Wrench 1/2" Drive', quantity: 10, unitPrice: 55.00, sortOrder: 1, subtotal: 550.00, productId: products.find(p => p.productCode === 'PT-004')!.id },
        ],
      },
      grandTotal: 2510.00,
    },
  });
  await prisma.backgroundJob.create({
    data: {
      type: 'sheet_export',
      status: 'pending',
      payload: JSON.stringify({ quoteId: quote7.id }),
    },
  });

  // 7.8 Stage: sent
  const intake8 = await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.email,
      sourceLabel: 'Gmail / demo@acme.example',
      senderEmail: 'carlos@cityworks.example',
      senderName: 'Carlos Works',
      subject: 'RFQ: hi-vis vests and hard hats for city crew',
      body: 'Good morning, we need 200 hi-vis vests and 100 hard hats for our road maintenance crew.',
      receivedAt: new Date('2026-05-27T07:00:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-sent-008' }),
      rfqPipelineStatus: 'sent',
      isRfq: true,
      classificationScore: 0.98,
    },
  });
  const rfq8 = await prisma.rfq.create({
    data: { reference: 'RFQ-2008', workflowState: RfqWorkflowState.approved, intakeId: intake8.id },
  });
  const quote8 = await prisma.quote.create({
    data: {
      rfqId: rfq8.id,
      customerName: 'Carlos Works',
      customerCompany: 'City Works Department',
      notes: 'City government procurement — priority fulfilment.',
      status: QuoteStatus.approved,
      createdById: opUser.id,
      approvedById: salesUser.id,
      submittedAt: new Date('2026-05-27T08:00:00Z'),
      approvedAt: new Date('2026-05-27T09:00:00Z'),
      customerId: customers.find(c => c.companyName === 'City Works Department')!.id,
      lineItems: {
        create: [
          { description: 'Hi-Vis Vest - Class 2', quantity: 200, unitPrice: 16.00, sortOrder: 0, subtotal: 3200.00, productId: products.find(p => p.productCode === 'SE-003')!.id },
          { description: 'Hard Hat - White', quantity: 100, unitPrice: 22.50, sortOrder: 1, subtotal: 2250.00, productId: products.find(p => p.productCode === 'SE-004')!.id },
        ],
      },
      grandTotal: 5450.00,
    },
  });
  await prisma.quoteEmail.create({
    data: {
      quoteId: quote8.id,
      subject: 'Quote QT-2008 — Hi-Vis Vests & Hard Hats',
      body: 'Dear Carlos, please find your quote attached. Total: USD 5,450.00. Payment terms: Net 30.',
      recipientEmail: 'carlos@cityworks.example',
      status: 'sent',
      sends: {
        create: {
          recipientEmail: 'carlos@cityworks.example',
          status: 'sent',
          sentAt: new Date('2026-05-27T09:30:00Z'),
          sentByUserId: opUser.id,
        },
      },
    },
  });

  // ── Reply threads (2 intakes linked to sent RFQ) ────────────────────────────
  await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.email,
      sourceLabel: 'Gmail / demo@acme.example',
      senderEmail: 'carlos@cityworks.example',
      senderName: 'Carlos Works',
      subject: 'Re: Quote QT-2008 — Hi-Vis Vests & Hard Hats',
      body: 'Thanks for the quote. Could you also include 50 pairs of safety boots in the order?',
      receivedAt: new Date('2026-05-27T11:00:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-reply-009' }),
      rfqPipelineStatus: 'new',
      isRfq: true,
      isReply: true,
      replyToRfqId: rfq8.id,
    },
  });
  await prisma.rfqIntake.create({
    data: {
      sourceType: RfqSourceType.email,
      sourceLabel: 'Gmail / demo@acme.example',
      senderEmail: 'carlos@cityworks.example',
      senderName: 'Carlos Works',
      subject: 'Re: Quote QT-2008 — delivery confirmation?',
      body: 'Hi again, can you confirm the delivery date? We need everything by end of June.',
      receivedAt: new Date('2026-05-28T08:00:00Z'),
      rawPayload: JSON.stringify({ seed: true, messageId: 'seed-reply-010' }),
      rfqPipelineStatus: 'new',
      isRfq: false,
      isReply: true,
      replyToRfqId: rfq8.id,
    },
  });
  console.log('RFQ pipeline stages seeded.');

  // ── QuoteStatusEvent history ────────────────────────────────────────────────
  // Quote 5 (draft)
  await prisma.quoteStatusEvent.create({
    data: { quoteId: quote5.id, status: QuoteStatus.draft, actorId: opUser.id, createdAt: new Date('2026-05-24T10:00:00Z') },
  });

  // Quote 6 (pending_approval)
  await prisma.quoteStatusEvent.createMany({
    data: [
      { quoteId: quote6.id, status: QuoteStatus.draft, actorId: opUser.id, createdAt: new Date('2026-05-25T10:30:00Z') },
      { quoteId: quote6.id, status: QuoteStatus.pending_approval, actorId: opUser.id, createdAt: new Date('2026-05-25T11:30:00Z') },
    ],
  });

  // Quote 7 (approved)
  await prisma.quoteStatusEvent.createMany({
    data: [
      { quoteId: quote7.id, status: QuoteStatus.draft, actorId: opUser.id, createdAt: new Date('2026-05-26T08:45:00Z') },
      { quoteId: quote7.id, status: QuoteStatus.pending_approval, actorId: opUser.id, createdAt: new Date('2026-05-26T09:00:00Z') },
      { quoteId: quote7.id, status: QuoteStatus.approved, actorId: salesUser.id, createdAt: new Date('2026-05-26T10:00:00Z') },
    ],
  });

  // Quote 8 (approved + email sent)
  await prisma.quoteStatusEvent.createMany({
    data: [
      { quoteId: quote8.id, status: QuoteStatus.draft, actorId: opUser.id, createdAt: new Date('2026-05-27T07:30:00Z') },
      { quoteId: quote8.id, status: QuoteStatus.pending_approval, actorId: opUser.id, createdAt: new Date('2026-05-27T08:00:00Z') },
      { quoteId: quote8.id, status: QuoteStatus.approved, actorId: salesUser.id, createdAt: new Date('2026-05-27T09:00:00Z') },
    ],
  });

  console.log('Quote status events seeded.');
  console.log('Demo seed complete!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
