import { IsEmail, IsOptional, IsString } from "class-validator";

export class InviteDto {
  @IsEmail()
  email!: string;
}

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  password!: string;
}
