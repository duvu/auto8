import { IsString, IsNotEmpty } from "class-validator";

export class CreateWhatsappConnectorDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumberId!: string;

  @IsString()
  @IsNotEmpty()
  verifyToken!: string;

  @IsString()
  @IsNotEmpty()
  appSecret!: string;
}
