import { Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { User } from "@prisma/client";
import type { AssignRfqInput, RfqPipelineStatus } from "@auto8/shared";

import { CurrentUser } from "../rbac/current-user.decorator";
import { Public } from "../rbac/public.decorator";
import { Roles } from "../rbac/roles.decorator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { RfqExtractionService } from "./rfq-extraction.service";
import { IntakeEmailDto } from "./dto/intake-email.dto";
import { SaveQuoteDto } from "./dto/save-quote.dto";
import { UpdateExtractedItemDto } from "./dto/update-extracted-item.dto";
import { QuoteWorkflowService } from "./quote-workflow.service";
import { RfqIntakeService } from "./rfq-intake.service";
import { ItemMatchingService } from "../matching/item-matching.service";
import { JobsService } from "../jobs/jobs.service";
import { PrismaService } from "../prisma/prisma.service";

@Controller("rfqs")
export class RfqsController {
  constructor(
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly quoteWorkflowService: QuoteWorkflowService,
    private readonly rfqExtractionService: RfqExtractionService,
    private readonly itemMatchingService: ItemMatchingService,
    private readonly jobsService: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post("intake-email")
  async intakeEmail(@Body() body: IntakeEmailDto) {
    return this.rfqIntakeService.intakeEmail(body);
  }

  @Get()
  async listRfqs(
    @Query("isRfq") isRfqParam?: string,
    @Query("pipelineStatus") pipelineStatus?: string,
    @Query("assignedToId") assignedToId?: string,
    @Query("includeReplies") includeRepliesParam?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const isRfq = isRfqParam === undefined ? undefined : isRfqParam === "true";
    const includeReplies = includeRepliesParam === "true";
    return this.rfqIntakeService.listRfqs(isRfq, pagination, pipelineStatus, assignedToId, includeReplies);
  }

  @Get(":rfqId/replies")
  async getReplies(@Param("rfqId") rfqId: string) {
    return this.rfqIntakeService.getReplies(rfqId);
  }

  @Get(":rfqId")
  async getRfqDetail(@Param("rfqId") rfqId: string) {
    return this.rfqIntakeService.getRfqDetail(rfqId);
  }

  @Get(":rfqId/extracted-items")
  async getExtractedItems(@Param("rfqId") rfqId: string) {
    return this.rfqExtractionService.getExtractedItems(rfqId);
  }

  @Get(":rfqId/matches")
  async getMatches(@Param("rfqId") rfqId: string) {
    return this.itemMatchingService.getMatchesForRfq(rfqId);
  }

  @Patch(":rfqId/matches/:matchId")
  @Roles(UserRole.quote_operator)
  async updateMatch(
    @Param("matchId") matchId: string,
    @Body() body: { action: "accept" | "override"; overrideDescription?: string; overrideUnitPrice?: number },
  ) {
    return this.itemMatchingService.updateMatch(matchId, body.action, body.overrideDescription, body.overrideUnitPrice);
  }

  @Patch(":rfqId/pipeline-status")
  @Roles(UserRole.quote_operator)
  async updatePipelineStatus(
    @Param("rfqId") rfqId: string,
    @Body() body: { status: RfqPipelineStatus },
  ) {
    await this.rfqIntakeService.updatePipelineStatus(rfqId, body.status);
    return { ok: true };
  }

  @Put(":rfqId/quote")
  @Roles(UserRole.quote_operator)
  async saveQuote(
    @Param("rfqId") rfqId: string,
    @Body() body: SaveQuoteDto,
    @CurrentUser() user: User
  ) {
    return this.quoteWorkflowService.saveDraft(rfqId, body, user.id);
  }

  @Post(":rfqId/quote/generate")
  @Roles(UserRole.quote_operator)
  async generateQuote(
    @Param("rfqId") rfqId: string,
    @CurrentUser() user: User
  ) {
    return this.quoteWorkflowService.generateFromRfq(rfqId, user.id);
  }

  @Post(":rfqId/quote/from-matches")
  @Roles(UserRole.quote_operator)
  async createQuoteFromMatches(
    @Param("rfqId") rfqId: string,
    @CurrentUser() user: User
  ) {
    return this.quoteWorkflowService.createQuoteFromMatches(rfqId, user.id);
  }

  @Post(":rfqId/export-sheet")
  @Roles(UserRole.quote_operator)
  async exportSheet(@Param("rfqId") rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { quote: true },
    });
    if (!rfq) throw new NotFoundException("RFQ not found.");
    if (!rfq.quote || rfq.quote.status !== "approved") {
      throw new ConflictException("RFQ must have an approved quote before exporting to sheet.");
    }
    await this.jobsService.enqueue("sheet_export", { quoteId: rfq.quote.id });
    return { ok: true };
  }

  @Patch(":rfqId/extracted-items/:itemId")
  @Roles(UserRole.quote_operator)
  async updateExtractedItem(
    @Param("rfqId") rfqId: string,
    @Param("itemId") itemId: string,
    @Body() body: UpdateExtractedItemDto,
  ) {
    return this.rfqExtractionService.updateItem(rfqId, itemId, body);
  }

  @Get(":rfqId/extracted-customer")
  async getExtractedCustomer(@Param("rfqId") rfqId: string) {
    return this.rfqExtractionService.getExtractedCustomer(rfqId);
  }

  @Post(":rfqId/quote/:quoteId/revise")
  @Roles(UserRole.quote_operator)
  async reviseQuote(
    @Param("quoteId") quoteId: string,
    @CurrentUser() user: User,
  ) {
    return this.quoteWorkflowService.reviseQuote(quoteId, user.id);
  }

  @Get(":rfqId/quote/revisions")
  async getRevisions(@Param("rfqId") rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { quote: true },
    });
    if (!rfq?.quote) throw new NotFoundException("No quote found for this RFQ.");
    return this.quoteWorkflowService.getRevisions(rfq.quote.id);
  }

  @Get(":rfqId/quote/diff")
  async getQuoteDiff(@Param("rfqId") rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { quote: true },
    });
    if (!rfq?.quote) throw new NotFoundException("No quote found for this RFQ.");
    return this.quoteWorkflowService.getQuoteDiff(rfq.quote.id);
  }

  @Patch(":rfqId/assign")
  @Roles(UserRole.admin)
  async assignRfq(
    @Param("rfqId") rfqId: string,
    @Body() body: AssignRfqInput,
  ) {
    return this.quoteWorkflowService.assignRfq(rfqId, body);
  }

  @Post(":rfqId/extracted-customer/save")
  async saveExtractedCustomer(@Param("rfqId") rfqId: string) {
    const ec = await (this.prisma as unknown as { rfqExtractedCustomer: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> } })
      .rfqExtractedCustomer.findUnique({ where: { rfqId } });
    if (!ec) {
      throw new Error("No extracted customer found for this RFQ");
    }
    const customer = await (this.prisma as unknown as { customer: { create: (args: unknown) => Promise<Record<string, unknown>> } })
      .customer.create({
        data: {
          companyName: (ec["customerCompany"] as string | null) ?? "Unknown",
          contactName: ec["customerContact"] as string | null,
          email: ec["customerEmail"] as string | null,
          phone: ec["customerPhone"] as string | null,
        },
      });
    return customer;
  }
}
