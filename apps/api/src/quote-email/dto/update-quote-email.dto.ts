import { IsEmail, IsOptional, IsString } from "class-validator";

export class UpdateQuoteEmailDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;
}
