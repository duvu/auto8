import { IsString, IsNotEmpty, IsUrl, IsArray, IsOptional, IsBoolean } from "class-validator";

export class CreateWebhookEndpointDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsString()
  @IsNotEmpty()
  secret!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];
}

export class UpdateWebhookEndpointDto {
  @IsUrl({ require_tld: false })
  @IsOptional()
  url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
