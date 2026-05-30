import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const CurrentWorkspaceId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ workspaceId?: string }>();
  return request.workspaceId ?? "default";
});
