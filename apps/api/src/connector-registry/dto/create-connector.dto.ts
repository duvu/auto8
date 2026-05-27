import { IsEnum, IsObject, IsString } from "class-validator";

export class CreateConnectorDto {
  @IsEnum(["gmail", "slack"])
  type!: "gmail" | "slack";

  @IsString()
  label!: string;

  @IsObject()
  credentials!: Record<string, string>;
}
