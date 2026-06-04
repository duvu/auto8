"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "../../components/app-shell";
import { useRequireAuth } from "../../lib/use-require-auth";
import { API_BASE_URL } from "../../lib/config";

interface SubscriptionView {
  enabled?: boolean;
  id: string;
  plan: string | null;
  status: string;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  sePayOrderCode: string | null;
}

interface SePayOrder {
  bankCode: string;
  accountNumber: string;
  amount: number;
  orderCode: string;
  content: string;
}

export default function BillingPage() {
  const t = useTranslations("billing");
  const auth = useRequireAuth("admin");
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [sePayOrder, setSePayOrder] = useState<SePayOrder | null>(null);
  const [sePayLoading, setSePayLoading] = useState(false);

  useEffect(() => {
    if (!auth || auth.forbidden) return;
    fetch(`${API_BASE_URL}/api/billing/subscription`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load subscription.");
        return res.json() as Promise<SubscriptionView>;
      })
      .then(setSub)
      .catch(() => setError("Failed to load billing status."))
      .finally(() => setLoading(false));
  }, [auth]);

  if (!auth || auth.forbidden) return null;

  const trialDaysLeft = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  const isActive = sub?.status === "active";
  const isTrial = sub?.status === "trialing";
  const isExpired = !isActive && !isTrial;

  async function handleStripeCheckout() {
    setCheckoutLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/stripe/checkout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create checkout session.");
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch {
      setError("Failed to start Stripe checkout.");
      setCheckoutLoading(false);
    }
  }

  async function handleSePayInit() {
    setSePayLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/sepay/init`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to init SePay order.");
      const data = (await res.json()) as SePayOrder;
      setSePayOrder(data);
    } catch {
      setError("Failed to generate SePay payment details.");
    } finally {
      setSePayLoading(false);
    }
  }

  return (
    <AppShell title={t("title")}>
      <div className="max-w-lg">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
        )}

        {loading && <p className="text-sm text-muted">Loading...</p>}

        {sub && sub.enabled === false && (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 rounded p-4 text-sm">
            <p className="font-medium mb-1">Billing is not enabled for this deployment.</p>
            <p className="text-gray-500">Set <code className="bg-gray-100 px-1 rounded">BILLING_ENABLED=true</code> to enable subscription management.</p>
          </div>
        )}

        {sub && sub.enabled !== false && (
          <>
            <div className="border border-border rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink">Plan</span>
                <span className="text-sm font-semibold text-ink capitalize">{sub.plan}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink">Status</span>
                <span className={`text-sm font-semibold ${isActive ? "text-green-600" : isTrial ? "text-blue-600" : "text-red-600"}`}>
                  {isActive ? t("planActive") : isTrial ? t("planTrial") : t("planExpired")}
                </span>
              </div>
              {isTrial && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">Trial ends in</span>
                  <span className={`text-sm font-semibold ${trialDaysLeft <= 3 ? "text-red-600" : "text-ink"}`}>
                    {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {!isActive && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-ink">Upgrade</h2>

                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-ink mb-2">{t("stripeCheckout")}</h3>
                  <button
                    onClick={() => { void handleStripeCheckout(); }}
                    disabled={checkoutLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
                  >
                    {checkoutLoading ? "Redirecting..." : "Upgrade with Stripe"}
                  </button>
                </div>

                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-ink mb-2">Pay via bank transfer (SePay)</h3>
                  {!sePayOrder ? (
                    <button
                      onClick={() => { void handleSePayInit(); }}
                      disabled={sePayLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50"
                    >
                      {sePayLoading ? "Generating..." : "Get bank transfer details"}
                    </button>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Bank:</span> {sePayOrder.bankCode}</p>
                      <p><span className="font-medium">Account:</span> {sePayOrder.accountNumber}</p>
                      <p><span className="font-medium">Amount:</span> {sePayOrder.amount.toLocaleString()} VND</p>
                      <p><span className="font-medium">Transfer content:</span></p>
                      <code className="block bg-gray-100 border rounded px-3 py-2 text-xs font-mono select-all">
                        {sePayOrder.content}
                      </code>
                      <p className="text-xs text-muted mt-2">
                        Copy the transfer content exactly. Your account will be activated within minutes after transfer is confirmed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isActive && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded p-3 text-sm">
                Your subscription is active. No action needed.
              </div>
            )}

            {isExpired && !isTrial && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm mt-4">
                Your trial has expired. Please upgrade to continue using auto8.
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
