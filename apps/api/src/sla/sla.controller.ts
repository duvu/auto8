import { Body, Controller, Get, Patch } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import type { UpdateSlaConfigInput } from "@auto8/shared";

import { Roles } from "../rbac/roles.decorator";
import { SlaService } from "./sla.service";

@Controller("sla-config")
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get()
  getConfig() {
    return this.slaService.getConfig();
  }

  @Patch()
  @Roles(UserRole.admin)
  updateConfig(@Body() body: UpdateSlaConfigInput) {
    return this.slaService.updateConfig(body);
  }
}
