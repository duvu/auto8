import { Controller, Get } from "@nestjs/common";
import { SetupService } from "./setup.service";
import { Roles } from "../rbac/roles.decorator";

@Controller("setup")
@Roles("admin")
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get("status")
  getStatus() {
    return this.setupService.getStatus();
  }
}
