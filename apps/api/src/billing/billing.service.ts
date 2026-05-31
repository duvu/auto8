import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import type { Stripe as StripeTypes } from "stripe/cjs/stripe.core.js";

import { PrismaService } from "../prisma/prisma.service";

export interface SubscriptionView {
  enabled: boolean;
  plan: string | null;
  status: string;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  sePayOrderCode: string | null;
}

type StripeInstance = ReturnType<typeof Stripe>;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly billingEnabled: boolean;
  private stripe: StripeInstance | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.billingEnabled = process.env['BILLING_ENABLED'] === 'true';
    const secretKey = this.config.get<string>("STRIPE_SECRET_KEY");
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    } else {
      this.logger.warn("STRIPE_SECRET_KEY not set — Stripe billing disabled");
    }
  }

  async getSubscription(workspaceId: string): Promise<SubscriptionView> {
    if (!this.billingEnabled) {
      return {
        enabled: false,
        plan: null,
        status: 'disabled',
        trialEndsAt: null,
        stripeCustomerId: null,
        stripeSubId: null,
        sePayOrderCode: null,
      };
    }
    const sub = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (!sub) throw new NotFoundException("Subscription not found.");
    return {
      enabled: true,
      plan: sub.plan,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubId: sub.stripeSubId,
      sePayOrderCode: sub.sePayOrderCode,
    };
  }

  async createStripeCheckout(workspaceId: string, userId: string): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException("Stripe is not configured on this server.");
    }

    const priceId = this.config.get<string>("STRIPE_PRICE_ID");
    if (!priceId) throw new BadRequestException("Stripe price not configured.");

    const frontendUrl = this.config.get<string>("FRONTEND_URL", "http://localhost:3000");

    const sub = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (!sub) throw new NotFoundException("Subscription not found.");

    let customerId = sub.stripeCustomerId;
    if (!customerId) {
      const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
      const customer = await this.stripe.customers.create({
        metadata: { workspaceId, userId },
        name: workspace?.name,
      });
      customerId = customer.id;
      await this.prisma.subscription.update({
        where: { workspaceId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/billing?success=true`,
      cancel_url: `${frontendUrl}/billing?canceled=true`,
      metadata: { workspaceId },
    });

    return { url: session.url! };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.stripe) return;

    const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      this.logger.warn("STRIPE_WEBHOOK_SECRET not set — skipping webhook");
      return;
    }

    let event: StripeTypes.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${String(err)}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as StripeTypes.Checkout.Session;
      const workspaceId = session.metadata?.["workspaceId"];
      if (workspaceId && session.subscription) {
        await this.prisma.subscription.update({
          where: { workspaceId },
          data: {
            plan: "pro",
            status: "active",
            stripeSubId: session.subscription as string,
          },
        });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as StripeTypes.Subscription;
      const existing = await this.prisma.subscription.findFirst({
        where: { stripeSubId: sub.id },
      });
      if (existing) {
        await this.prisma.subscription.update({
          where: { id: existing.id },
          data: { status: "canceled", plan: "trial" },
        });
      }
    }
  }

  async confirmSePayTransfer(
    workspaceId: string,
    transferContent: string,
    amount: number,
  ): Promise<{ confirmed: boolean }> {
    const sub = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (!sub) throw new NotFoundException("Subscription not found.");

    const orderCode = sub.sePayOrderCode;
    const planPrice = parseFloat(this.config.get<string>("SEPAY_PLAN_PRICE_USD", "0"));

    if (!orderCode) throw new BadRequestException("No pending SePay order.");

    const contentMatch = transferContent.includes(orderCode);
    const amountMatch = Math.abs(amount - planPrice) < 0.01;

    if (!contentMatch || !amountMatch) {
      return { confirmed: false };
    }

    await this.prisma.subscription.update({
      where: { workspaceId },
      data: { plan: "pro", status: "active" },
    });

    return { confirmed: true };
  }

  async initSePayOrder(workspaceId: string): Promise<{
    orderCode: string;
    bankAccount: string;
    bankCode: string;
    amount: number;
  }> {
    const sub = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (!sub) throw new NotFoundException("Subscription not found.");

    const orderCode = `AUTO8-${workspaceId.substring(0, 8).toUpperCase()}-${Date.now()}`;
    await this.prisma.subscription.update({
      where: { workspaceId },
      data: { sePayOrderCode: orderCode },
    });

    return {
      orderCode,
      bankAccount: this.config.get<string>("SEPAY_ACCOUNT_NUMBER", ""),
      bankCode: this.config.get<string>("SEPAY_BANK_CODE", ""),
      amount: parseFloat(this.config.get<string>("SEPAY_PLAN_PRICE_USD", "0")),
    };
  }
}
