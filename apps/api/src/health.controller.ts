import { Controller, Get } from "@nestjs/common";

import { Public } from "./rbac/public.decorator";

@Controller("health")
export class HealthController {
  @Get()
  @Public()
  getHealth() {
    return { ok: true };
  }
}
