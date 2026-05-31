import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Request } from "express";

import { CurrentUser } from "../rbac/current-user.decorator";
import { CurrentWorkspaceId } from "../rbac/current-workspace-id.decorator";
import { Public } from "../rbac/public.decorator";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  private readonly billingEnabled: boolean;

  constructor(private readonly billingService: BillingService) {
    this.billingEnabled = process.env['BILLING_ENABLED'] === 'true';
  }

  private checkEnabled(): void {
    if (!this.billingEnabled) {
      throw new ServiceUnavailableException('Billing is not enabled for this deployment');
    }
  }

  @Get("subscription")
  async getSubscription(@CurrentWorkspaceId() workspaceId: string) {
    return this.billingService.getSubscription(workspaceId);
  }

  @Post("stripe/checkout")
  @HttpCode(HttpStatus.OK)
  async stripeCheckout(
    @CurrentWorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
  ) {
    this.checkEnabled();
    return this.billingService.createStripeCheckout(workspaceId, user.id);
  }

  @Public()
  @Post("stripe/webhook")
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(@Req() req: RawBodyRequest<Request>): Promise<{ received: boolean }> {
    this.checkEnabled();
    const sig = req.headers["stripe-signature"] as string;
    const rawBody = req.rawBody ?? Buffer.from("");
    await this.billingService.handleStripeWebhook(rawBody, sig);
    return { received: true };
  }

  @Post("sepay/init")
  @HttpCode(HttpStatus.OK)
  async initSePayOrder(@CurrentWorkspaceId() workspaceId: string) {
    this.checkEnabled();
    return this.billingService.initSePayOrder(workspaceId);
  }

  @Public()
  @Post("sepay/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmSePayTransfer(
    @Body() body: { workspaceId: string; transferContent: string; amount: number },
  ) {
    this.checkEnabled();
    return this.billingService.confirmSePayTransfer(
      body.workspaceId,
      body.transferContent,
      body.amount,
    );
  }
}
