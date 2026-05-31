import { IsIn, IsNotEmpty, IsObject } from "class-validator";

import { CONNECTOR_TYPES } from "@auto8/shared";
import type { ConnectorType } from "@auto8/shared";

export class TestCredentialsDto {
  @IsIn(CONNECTOR_TYPES)
  @IsNotEmpty()
  type!: ConnectorType;

  @IsObject()
  credentials!: Record<string, string>;
}
