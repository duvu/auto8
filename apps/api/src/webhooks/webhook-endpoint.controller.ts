import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { Roles } from "../rbac/roles.decorator";
import { CurrentWorkspaceId } from "../rbac/current-workspace-id.decorator";
import type { CreateWebhookEndpointDto, UpdateWebhookEndpointDto } from "./dto/webhook-endpoint.dto";
import { WebhookEndpointService } from "./webhook-endpoint.service";

@Controller("webhooks/endpoints")
@Roles("admin")
export class WebhookEndpointController {
  constructor(private readonly endpointService: WebhookEndpointService) {}

  @Post()
  create(@Body() dto: CreateWebhookEndpointDto, @CurrentWorkspaceId() workspaceId?: string) {
    return this.endpointService.create(dto, workspaceId ?? "default");
  }

  @Get()
  list(@CurrentWorkspaceId() workspaceId?: string) {
    return this.endpointService.list(workspaceId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateWebhookEndpointDto) {
    return this.endpointService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.endpointService.remove(id);
  }

  @Post(":id/test")
  testEndpoint(@Param("id") id: string) {
    return this.endpointService.test(id);
  }
}
