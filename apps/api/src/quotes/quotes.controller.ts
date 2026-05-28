import { Controller, Headers, Param, Post } from "@nestjs/common";

import { RfqsService } from "../rfqs/rfqs.service";

@Controller("quotes")
export class QuotesController {
  constructor(private readonly rfqsService: RfqsService) {}

  @Post(":quoteId/submit")
  async submitForApproval(@Param("quoteId") quoteId: string, @Headers("x-user-id") userId?: string) {
    return this.rfqsService.submitForApproval(quoteId, userId);
  }

  @Post(":quoteId/approve")
  async approveQuote(@Param("quoteId") quoteId: string, @Headers("x-user-id") userId?: string) {
    return this.rfqsService.approveQuote(quoteId, userId);
  }
}
