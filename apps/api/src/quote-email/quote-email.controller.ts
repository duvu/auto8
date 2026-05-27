import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { User } from "@prisma/client";

import { CurrentUser } from "../rbac/current-user.decorator";
import { Roles } from "../rbac/roles.decorator";
import { QuoteEmailService } from "./quote-email.service";
import { UpdateQuoteEmailDto } from "./dto/update-quote-email.dto";

@Controller("quotes")
export class QuoteEmailController {
  constructor(private readonly quoteEmailService: QuoteEmailService) {}

  @Get(":quoteId/email")
  @Roles(UserRole.quote_operator)
  async getDraft(@Param("quoteId") quoteId: string) {
    return this.quoteEmailService.getDraft(quoteId);
  }

  @Patch(":quoteId/email")
  @Roles(UserRole.quote_operator)
  async updateDraft(
    @Param("quoteId") quoteId: string,
    @Body() body: UpdateQuoteEmailDto
  ) {
    return this.quoteEmailService.updateDraft(quoteId, body);
  }

  @Post(":quoteId/email/send")
  @Roles(UserRole.quote_operator)
  async send(@Param("quoteId") quoteId: string, @CurrentUser() user: User) {
    return this.quoteEmailService.send(quoteId, user.id);
  }
}
