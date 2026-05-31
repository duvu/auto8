import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { CurrentWorkspaceId } from "../rbac";
import { Roles } from "../rbac";

@Controller("analytics")
@Roles("admin", "sales_approver")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("rfq-volume")
  getRfqVolume(@CurrentWorkspaceId() workspaceId: string) {
    return this.analyticsService.getRfqVolume(workspaceId);
  }

  @Get("win-rate")
  getWinRate(@CurrentWorkspaceId() workspaceId: string) {
    return this.analyticsService.getWinRate(workspaceId);
  }

  @Get("response-time")
  getResponseTime(@CurrentWorkspaceId() workspaceId: string) {
    return this.analyticsService.getResponseTime(workspaceId);
  }

  @Get("top-customers")
  getTopCustomers(@CurrentWorkspaceId() workspaceId: string) {
    return this.analyticsService.getTopCustomers(workspaceId);
  }

  @Get("connectors")
  getConnectors(@CurrentWorkspaceId() workspaceId: string) {
    return this.analyticsService.getConnectors(workspaceId);
  }
}
