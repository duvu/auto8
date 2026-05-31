import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { Public } from "../rbac/public.decorator";
import { Roles } from "../rbac/roles.decorator";
import { PortalService } from "./portal.service";

@Controller("portal")
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Roles("quote_operator", "admin")
  @Post("quotes/:quoteId/share")
  createShareLink(@Param("quoteId") quoteId: string) {
    return this.portalService.createShareLink(quoteId);
  }

  @Roles("quote_operator", "admin")
  @Delete("quotes/:quoteId/share")
  revokeShareLinks(@Param("quoteId") quoteId: string) {
    return this.portalService.revokeShareLinks(quoteId);
  }

  @Public()
  @Throttle({ public: { ttl: 60000, limit: 30 } })
  @Get("q/:token/data")
  getQuoteData(@Param("token") token: string) {
    return this.portalService.getQuoteData(token);
  }

  @Public()
  @Throttle({ public: { ttl: 60000, limit: 30 } })
  @Post("q/:token/accept")
  acceptQuote(@Param("token") token: string) {
    return this.portalService.acceptQuote(token);
  }

  @Public()
  @Throttle({ public: { ttl: 60000, limit: 30 } })
  @Post("q/:token/reject")
  rejectQuote(@Param("token") token: string, @Body("note") note?: string) {
    return this.portalService.rejectQuote(token, note);
  }

  @Public()
  @Throttle({ public: { ttl: 60000, limit: 30 } })
  @Post("q/:token/revision")
  requestRevision(@Param("token") token: string, @Body("note") note: string) {
    if (!note) throw new NotFoundException("note is required");
    return this.portalService.requestRevision(token, note);
  }
}
