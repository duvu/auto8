import { IsArray, IsString } from "class-validator";

export class MergeCustomersDto {
  @IsArray()
  @IsString({ each: true })
  mergeIds!: string[];
}
