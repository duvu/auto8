import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { RbacGuard } from "./rbac.guard";

@Module({
  imports: [AuthModule],
  providers: [RbacGuard],
  exports: [RbacGuard, AuthModule],
})
export class RbacModule {}
