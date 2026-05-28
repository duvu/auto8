import { IsEnum, IsNotEmpty, IsObject, IsString } from "class-validator";

export class CreateConnectorDto {
  @IsEnum(["gmail", "slack", "outlook"])
  type!: "gmail" | "slack" | "outlook";

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsObject()
  credentials!: Record<string, string>;
}
