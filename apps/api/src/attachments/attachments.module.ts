import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AttachmentService } from "./attachment.service";

@Module({
  imports: [PrismaModule],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentsModule {}
