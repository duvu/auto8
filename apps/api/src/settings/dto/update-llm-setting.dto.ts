import { IsEnum, IsOptional, IsString, IsUrl } from "class-validator";
import { LLM_PROVIDER_KINDS, type LlmProviderKind } from "@auto8/shared";

export class UpdateLlmSettingDto {
  @IsEnum(LLM_PROVIDER_KINDS)
  provider!: LlmProviderKind;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  baseUrl?: string;
}
