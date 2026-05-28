import { Body, Controller, Param, Post } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../rbac/current-user.decorator";
import { Roles } from "../rbac/roles.decorator";
import { QuoteWorkflowService } from "../rfqs/quote-workflow.service";

import type { User } from "@prisma/client";
import type { ApproveQuoteInput } from "@auto8/shared";

@Controller("quotes")
export class QuotesController {
  constructor(private readonly quoteWorkflowService: QuoteWorkflowService) {}

  @Post(":quoteId/submit")
  @Roles(UserRole.quote_operator)
  async submitForApproval(@Param("quoteId") quoteId: string, @CurrentUser() user: User) {
    return this.quoteWorkflowService.submitForApproval(quoteId, user.id);
  }

  @Post(":quoteId/approve")
  @Roles(UserRole.sales_approver)
  async approveQuote(
    @Param("quoteId") quoteId: string,
    @CurrentUser() user: User,
    @Body() body: ApproveQuoteInput = {}
  ) {
    return this.quoteWorkflowService.approveQuote(quoteId, user.id, body.autoSend ?? false);
  }
}
