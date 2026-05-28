import { Body, Controller, Get, Post, Put } from "@nestjs/common";
import type { UserRole } from "@auto8/shared";
import { Roles } from "../rbac/roles.decorator";
import { SettingsService } from "./settings.service";
import { UpdateLlmSettingDto } from "./dto/update-llm-setting.dto";

@Controller("settings")
@Roles("admin" as UserRole)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("llm")
  getLlmSetting() {
    return this.settingsService.getLlmSetting();
  }

  @Put("llm")
  updateLlmSetting(@Body() dto: UpdateLlmSettingDto) {
    return this.settingsService.updateLlmSetting(dto);
  }

  @Post("llm/test")
  testLlmConnection() {
    return this.settingsService.testLlmConnection();
  }
}
