import { IsString, IsNotEmpty } from "class-validator";

export class CreateTelegramConnectorDto {
  @IsString()
  @IsNotEmpty()
  botToken!: string;

  @IsString()
  @IsNotEmpty()
  webhookSecret!: string;
}
