import { IsDateString, IsOptional, IsString } from "class-validator";

import type { SlackRfqIntakeInput } from "@auto8/shared";

export class SlackRfqIntakeDto implements SlackRfqIntakeInput {
  @IsString()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  workspaceName?: string;

  @IsString()
  channelId!: string;

  @IsOptional()
  @IsString()
  channelName?: string;

  @IsString()
  submitterId!: string;

  @IsOptional()
  @IsString()
  submitterName?: string;

  @IsOptional()
  @IsString()
  submitterEmail?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  @IsDateString()
  submittedAt!: string;
}
