import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { WorkspaceService } from "./workspace.service";
import { Roles } from "../rbac/roles.decorator";

class CreateWorkspaceDto {
  name!: string;
  slug!: string;
}

class UpdateWorkspaceDto {
  name?: string;
  slug?: string;
}

@Controller("workspaces")
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.workspaceService.findById(id);
  }

  @Patch(":id")
  @Roles("admin", "super_admin")
  update(@Param("id") id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaceService.update(id, dto);
  }

  @Post()
  @Roles("super_admin")
  create(@Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.create(dto);
  }

  @Get()
  @Roles("super_admin")
  findAll() {
    return this.workspaceService.findAll();
  }
}
