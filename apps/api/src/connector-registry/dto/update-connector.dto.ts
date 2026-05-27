import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

export class UpdateConnectorDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}
