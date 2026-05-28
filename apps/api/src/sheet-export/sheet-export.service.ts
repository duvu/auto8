import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SheetExportService {
  private readonly logger = new Logger(SheetExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return !!(
      this.config.get<string>("GOOGLE_SHEET_ID")?.trim() &&
      this.config.get<string>("GOOGLE_SERVICE_ACCOUNT_KEY")?.trim()
    );
  }

  async exportQuote(quoteId: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.debug("Sheet export skipped: GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_KEY not configured");
      return;
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        lineItems: true,
        rfq: {
          include: { intake: true },
        },
        statusEvents: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!quote) {
      this.logger.warn(`Quote ${quoteId} not found for sheet export`);
      return;
    }

    const approvedEvent = quote.statusEvents[0];
    const rfq = quote.rfq;
    const intake = rfq?.intake;

    const row = [
      rfq?.id ?? "",
      quote.id,
      intake?.subject ?? "",
      intake?.senderEmail ?? "",
      intake?.receivedAt?.toISOString() ?? "",
      approvedEvent?.createdAt?.toISOString() ?? "",
      JSON.stringify(quote.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      }))),
      (quote as { grandTotal?: number | null }).grandTotal ?? 0,
      "USD",
      (quote as { paymentTerms?: string | null }).paymentTerms ?? "",
      (quote as { deliveryTerms?: string | null }).deliveryTerms ?? "",
    ];

    const sheetId = this.config.get<string>("GOOGLE_SHEET_ID")!;
    const serviceAccountKeyJson = this.config.get<string>("GOOGLE_SERVICE_ACCOUNT_KEY")!;
    const serviceAccountKey = JSON.parse(serviceAccountKeyJson) as { client_email: string; private_key: string };

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A:K",
      valueInputOption: "RAW",
      requestBody: {
        values: [row],
      },
    });

    this.logger.log(`Exported quote ${quoteId} to Google Sheet ${sheetId}`);
  }
}
