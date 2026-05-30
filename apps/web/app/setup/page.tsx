"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SetupStatusView } from "@auto8/shared";
import { WorkspaceShell } from "../../components/workspace-shell";
import { getSetupStatus } from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";

type Step = {
  key: keyof Omit<SetupStatusView, "completed">;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

const STEPS: Step[] = [
  {
    key: "llmConfigured",
    title: "Configure LLM provider",
    description: "Set up an AI provider (OpenAI, Anthropic, Google Gemini, or Ollama) to enable RFQ classification, extraction, and catalogue enrichment.",
    actionLabel: "Go to Settings →",
    href: "/settings",
  },
  {
    key: "catalogueLoaded",
    title: "Load your product catalogue",
    description: "Upload a spreadsheet with your products so auto8 can match RFQ line items to real products and suggest prices.",
    actionLabel: "Upload catalogue →",
    href: "/catalogue/upload",
  },
  {
    key: "connectorConfigured",
    title: "Add an inbox connector",
    description: "Connect a Gmail or Outlook inbox (or Slack) so RFQs arrive automatically without manual entry.",
    actionLabel: "Add connector →",
    href: "/connectors/new",
  },
  {
    key: "teamMembersAdded",
    title: "Invite team members",
    description: "Add sales operators and approvers so the team can collaborate on quotes.",
    actionLabel: "Add users →",
    href: "/users/new",
  },
];

export default function SetupPage() {
  const authResult = useRequireAuth("admin");
  const [status, setStatus] = useState<SetupStatusView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSetupStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  const stepsCompleted = status
    ? STEPS.filter((s) => status[s.key]).length
    : 0;

  return (
    <WorkspaceShell
      title="Setup"
      description="Complete these steps to get auto8 ready for production use."
      authUser={authResult.user}
      section="Setup"
    >
      <div className="max-w-2xl mx-auto space-y-4">
        {loading ? (
          <p className="text-sm text-muted">Loading setup status...</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 bg-border rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all"
                  style={{ width: `${(stepsCompleted / STEPS.length) * 100}%` }}
                />
              </div>
              <span className="text-sm text-muted shrink-0">{stepsCompleted}/{STEPS.length} complete</span>
            </div>

            {STEPS.map((step, index) => {
              const done = status ? status[step.key] : false;
              return (
                <div
                  key={step.key}
                  className={`flex gap-4 rounded-xl border p-4 transition-colors ${done ? "border-green-200 bg-green-50" : "border-border bg-surface"}`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? "bg-green-500 text-white" : "bg-bg border border-border text-muted"}`}>
                    {done ? "✓" : index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${done ? "text-green-800" : "text-ink"}`}>{step.title}</p>
                    <p className="text-xs text-muted mt-0.5">{step.description}</p>
                    {!done && (
                      <Link href={step.href} className="inline-block mt-2 text-xs font-medium text-accent underline hover:opacity-80">
                        {step.actionLabel}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}

            {status?.completed && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-sm font-semibold text-green-800">🎉 All setup steps complete!</p>
                <p className="text-xs text-green-700 mt-1">auto8 is ready to process RFQs.</p>
                <Link href="/" className="inline-block mt-2 text-xs font-medium text-green-800 underline hover:opacity-80">Go to dashboard →</Link>
              </div>
            )}
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}
