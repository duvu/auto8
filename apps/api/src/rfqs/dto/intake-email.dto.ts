import { IsDateString, IsOptional, IsString } from "class-validator";

import type { IntakeEmailInput } from "@auto8/shared";

export class IntakeEmailDto implements IntakeEmailInput {
  @IsString()
  fromEmail!: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  @IsDateString()
  receivedAt!: string;
}
