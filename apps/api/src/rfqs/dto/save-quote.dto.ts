import { IsInt, IsNumber, IsString, ValidateNested, IsArray, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

import type { QuoteLineItemInput, SaveQuoteInput } from "@auto8/shared";

export class QuoteLineItemDto implements QuoteLineItemInput {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  productId?: string;
}

export class SaveQuoteDto implements SaveQuoteInput {
  @IsString()
  customerName!: string;

  @IsString()
  customerCompany!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @IsOptional()
  @IsNumber()
  grandTotal?: number;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  deliveryTerms?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  lineItems!: QuoteLineItemDto[];
}
