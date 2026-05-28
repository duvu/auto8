import { Body, Controller, Get, Headers, Param, Post, Put, Req } from "@nestjs/common";

import type { IntakeEmailInput, SaveQuoteInput, SlackRfqIntakeInput } from "@auto8/shared";

import { RfqsService } from "./rfqs.service";

@Controller("rfqs")
export class RfqsController {
  constructor(private readonly rfqsService: RfqsService) {}

  @Post("intake-email")
  async intakeEmail(@Body() body: IntakeEmailInput) {
    return this.rfqsService.intakeEmail(body);
  }

  @Post("intake-slack")
  async intakeSlack(
    @Body() body: SlackRfqIntakeInput,
    @Req() request: { rawBody?: Buffer; headers: Record<string, string | string[] | undefined> }
  ) {
    const rawPayload = request.rawBody?.toString("utf8") ?? JSON.stringify(body);
    return this.rfqsService.intakeSlack(body, rawPayload, request.headers);
  }

  @Get()
  async listRfqs() {
    return this.rfqsService.listRfqs();
  }

  @Get(":rfqId")
  async getRfqDetail(@Param("rfqId") rfqId: string) {
    return this.rfqsService.getRfqDetail(rfqId);
  }

  @Put(":rfqId/quote")
  async saveQuote(
    @Param("rfqId") rfqId: string,
    @Body() body: SaveQuoteInput,
    @Headers("x-user-id") userId?: string
  ) {
    return this.rfqsService.saveDraft(rfqId, body, userId);
  }
}
