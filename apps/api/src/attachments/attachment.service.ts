import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async parseAttachment(rfqAttachmentId: string): Promise<void> {
    const attachment = await this.prisma.rfqAttachment.findUnique({
      where: { id: rfqAttachmentId },
    });

    if (!attachment) {
      throw new Error(`RfqAttachment ${rfqAttachmentId} not found`);
    }

    if (attachment.parseStatus === "done") {
      this.logger.log(`Attachment ${rfqAttachmentId} already parsed, skipping`);
      return;
    }

    let parsedText: string;

    try {
      const ext = path.extname(attachment.filename).toLowerCase();
      const mime = attachment.mimeType.toLowerCase();

      if (ext === ".pdf" || mime === "application/pdf") {
        parsedText = await this.parsePdf(attachment.storagePath);
      } else if (
        ext === ".docx" ||
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        parsedText = await this.parseDocx(attachment.storagePath);
      } else if (
        ext === ".xlsx" ||
        mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        parsedText = await this.parseXlsx(attachment.storagePath);
      } else if (ext === ".csv" || mime === "text/csv") {
        parsedText = await this.parseCsv(attachment.storagePath);
      } else if (ext === ".txt" || mime === "text/plain") {
        parsedText = await this.parseTxt(attachment.storagePath);
      } else {
        // Unsupported type — mark as failed with empty text
        this.logger.warn(`Unsupported attachment type: ${ext} (${mime})`);
        await this.prisma.rfqAttachment.update({
          where: { id: rfqAttachmentId },
          data: { parsedText: "", parseStatus: "failed" },
        });
        await this.aggregateAttachmentContent(attachment.rfqIntakeId);
        return;
      }

      await this.prisma.rfqAttachment.update({
        where: { id: rfqAttachmentId },
        data: { parsedText, parseStatus: "done" },
      });

      // After successful parse, check if all attachments for this RFQ are done
      await this.aggregateAttachmentContent(attachment.rfqIntakeId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to parse attachment ${rfqAttachmentId}: ${errorMsg}`);
      await this.prisma.rfqAttachment.update({
        where: { id: rfqAttachmentId },
        data: { parseStatus: "failed" },
      });
      // Still run aggregation so remaining settled attachments unblock rfq_extract
      await this.aggregateAttachmentContent(attachment.rfqIntakeId);
      throw err;
    }
  }

  private async parsePdf(filePath: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }

  private async parseDocx(filePath: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth") as {
      extractRawText: (opts: { path: string }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private async parseXlsx(filePath: string): Promise<string> {
    const XLSX_ROW_CAP = 500;
    const workbook = XLSX.readFile(filePath);
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      lines.push(`[Sheet: ${sheetName}]`);
      const cappedRows = rows.slice(0, XLSX_ROW_CAP);
      for (const row of cappedRows) {
        lines.push(Object.values(row).join("\t"));
      }
      if (rows.length > XLSX_ROW_CAP) {
        lines.push(`[... truncated at ${XLSX_ROW_CAP} rows]`);
      }
    }
    return lines.join("\n");
  }

  private async parseTxt(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, "utf-8");
  }

  private async parseCsv(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, "utf-8");
  }

  async aggregateAttachmentContent(rfqIntakeId: string): Promise<boolean> {
    const attachments = await this.prisma.rfqAttachment.findMany({
      where: { rfqIntakeId },
    });

    // Only aggregate when all attachments are settled (done or failed), not just done
    const allSettled = attachments.every(
      (a) => a.parseStatus === "done" || a.parseStatus === "failed",
    );
    if (!allSettled) return false;

    const combined = attachments
      .map((a) => {
        if (a.parseStatus === "failed") {
          return `[File: ${a.filename} — parse failed]`;
        }
        return `[File: ${a.filename}]\n${a.parsedText ?? ""}`;
      })
      .join("\n\n");

    await this.prisma.rfqIntake.update({
      where: { id: rfqIntakeId },
      data: { attachmentContent: combined },
    });

    this.logger.log(
      `Aggregated ${attachments.length} attachment(s) for RfqIntake ${rfqIntakeId}`,
    );
    return true;
  }
}
