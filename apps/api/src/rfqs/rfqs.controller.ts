import { Body, Controller, Get, Headers, Param, Post, Put, Req } from "@nestjs/common";

import type { IntakeEmailInput, SaveQuoteInput, SlackRfqIntakeInput } from "@auto8/shared";

import { RfqsService } from "./rfqs.service";

@Controller()
export class RfqsController {
  constructor(private readonly rfqsService: RfqsService) {}

  @Post("rfqs/intake-email")
  async intakeEmail(@Body() body: IntakeEmailInput) {
    return this.rfqsService.intakeEmail(body);
  }

  @Post("rfqs/intake-slack")
  async intakeSlack(
    @Body() body: SlackRfqIntakeInput,
    @Req() request: { rawBody?: Buffer; headers: Record<string, string | string[] | undefined> }
  ) {
    const rawPayload = request.rawBody?.toString("utf8") ?? JSON.stringify(body);
    return this.rfqsService.intakeSlack(body, rawPayload, request.headers);
  }

  @Get("rfqs")
  async listRfqs() {
    return this.rfqsService.listRfqs();
  }

  @Get("rfqs/:rfqId")
  async getRfqDetail(@Param("rfqId") rfqId: string) {
    return this.rfqsService.getRfqDetail(rfqId);
  }

  @Put("rfqs/:rfqId/quote")
  async saveQuote(
    @Param("rfqId") rfqId: string,
    @Body() body: SaveQuoteInput,
    @Headers("x-user-id") userId?: string
  ) {
    return this.rfqsService.saveDraft(rfqId, body, userId);
  }

  @Post("quotes/:quoteId/submit")
  async submitForApproval(@Param("quoteId") quoteId: string, @Headers("x-user-id") userId?: string) {
    return this.rfqsService.submitForApproval(quoteId, userId);
  }

  @Post("quotes/:quoteId/approve")
  async approveQuote(@Param("quoteId") quoteId: string, @Headers("x-user-id") userId?: string) {
    return this.rfqsService.approveQuote(quoteId, userId);
  }
}
