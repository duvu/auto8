"use client";

import { useState } from "react";

import type { ConnectorType } from "@auto8/shared";

interface SetupStep {
  title: string;
  description: string;
}

const SETUP_GUIDES: Record<ConnectorType, { docsUrl: string; steps: SetupStep[] }> = {
  gmail: {
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    steps: [
      { title: "Create a Google Cloud project", description: "Go to console.cloud.google.com and create or select a project." },
      { title: "Enable the Gmail API", description: "In the API Library, search for Gmail API and enable it for your project." },
      { title: "Create OAuth2 credentials", description: "Under Credentials, create an OAuth 2.0 Client ID (type: Web application). Note the Client ID and Client Secret." },
      { title: "Obtain a refresh token", description: "Run the OAuth2 consent flow (e.g. via OAuth Playground) to get a long-lived refresh token. Set the scope to https://www.googleapis.com/auth/gmail.modify." },
      { title: "Enter credentials above", description: "Paste the Client ID, Client Secret, and Refresh Token. Set the search query (e.g. is:unread subject:RFQ) to filter relevant emails." },
    ],
  },
  slack: {
    docsUrl: "https://api.slack.com/apps",
    steps: [
      { title: "Create a Slack app", description: "Go to api.slack.com/apps and click Create New App. Choose 'From scratch' and name your app." },
      { title: "Add bot token scopes", description: "Under OAuth & Permissions → Bot Token Scopes, add: channels:history, groups:history, im:history, mpim:history, channels:read, chat:write." },
      { title: "Install app to workspace", description: "Click Install to Workspace under OAuth & Permissions. Copy the Bot User OAuth Token (starts with xoxb-)." },
      { title: "Copy signing secret", description: "Under Basic Information → App Credentials, copy the Signing Secret." },
      { title: "Find workspace ID", description: "In Slack, right-click your workspace name → Copy → Copy Workspace ID (starts with T)." },
    ],
  },
  outlook: {
    docsUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    steps: [
      { title: "Register an Azure app", description: "Go to portal.azure.com → Azure Active Directory → App registrations → New registration." },
      { title: "Configure API permissions", description: "Under API permissions, add Microsoft Graph: Mail.Read, Mail.ReadWrite (delegated). Grant admin consent." },
      { title: "Create a client secret", description: "Under Certificates & secrets, create a new client secret. Copy the value immediately (it won't be shown again)." },
      { title: "Obtain a refresh token", description: "Use MSAL or the OAuth2 auth code flow to get a refresh token with Mail.Read scope. The tenant ID is 'common' for personal accounts." },
      { title: "Enter credentials above", description: "Paste the Client ID, Client Secret, Refresh Token, and optionally Tenant ID." },
    ],
  },
  whatsapp: {
    docsUrl: "https://developers.facebook.com/apps",
    steps: [
      { title: "Create a Meta app", description: "Go to developers.facebook.com/apps and create a Business app. Add the WhatsApp product." },
      { title: "Get app secret", description: "Under App Settings → Basic, copy the App Secret. This is used for HMAC-SHA256 webhook verification." },
      { title: "Get phone number ID", description: "Under WhatsApp → Getting Started, note your test phone number ID. For production, register a real number." },
      { title: "Set up webhook", description: "Under WhatsApp → Configuration, set the webhook URL to: https://your-domain.com/webhooks/whatsapp. Set a Verify Token (any string you choose) and subscribe to messages." },
      { title: "Get access token", description: "For production, generate a System User token with whatsapp_business_messaging permission. For testing, the temporary token from the dashboard works." },
    ],
  },
  telegram: {
    docsUrl: "https://t.me/BotFather",
    steps: [
      { title: "Create a bot via BotFather", description: "Open Telegram and message @BotFather. Send /newbot and follow prompts. Copy the bot token (format: 1234567890:AAFxxxxxx)." },
      { title: "Choose a webhook secret", description: "Pick any string to use as the webhook secret — this will be appended to the webhook URL to authenticate requests." },
      { title: "Register webhook", description: "After the connector is created, call the Telegram API to register your webhook: GET https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-domain.com/webhooks/telegram/{secret}&secret_token={secret}" },
      { title: "Verify it works", description: "Send a message to your bot. It should appear as an intake in auto8 within seconds." },
    ],
  },
  zalo: {
    docsUrl: "https://developers.zalo.me/",
    steps: [
      { title: "Create a Zalo Developer account", description: "Go to developers.zalo.me, register or log in with your Zalo account." },
      { title: "Create an Official Account (OA)", description: "Create or link a Zalo Official Account. Then create a new app in the developer console and attach it to your OA." },
      { title: "Get App ID and App Secret", description: "Under your app's settings, copy the App ID and App Secret. The App Secret is used for HMAC-SHA256 webhook verification." },
      { title: "Set up webhook callback", description: "In your OA settings → Webhook, enter the callback URL: https://your-domain.com/webhooks/zalo/{connectorId}. Set a Verify Token of your choice." },
      { title: "Get OA Access Token (optional)", description: "If you want to test connectivity, generate an OA Access Token in the developer console. It is not required for receive-only mode." },
    ],
  },
};

interface ConnectorSetupGuideProps {
  type: ConnectorType;
}

export function ConnectorSetupGuide({ type }: ConnectorSetupGuideProps) {
  const [open, setOpen] = useState(false);
  const guide = SETUP_GUIDES[type];
  if (!guide) return null;

  return (
    <div className="border rounded text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 font-medium text-gray-700"
      >
        <span>Setup guide for {type}</span>
        <span className="text-gray-400 text-xs">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>
      {open && (
        <div className="border-t px-4 py-3 space-y-3 bg-gray-50">
          <ol className="space-y-3 list-decimal list-inside">
            {guide.steps.map((step, i) => (
              <li key={i} className="text-gray-700">
                <span className="font-medium">{step.title}</span>
                <p className="text-gray-500 mt-0.5 ml-5">{step.description}</p>
              </li>
            ))}
          </ol>
          <a
            href={guide.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-blue-600 hover:underline text-xs"
          >
            Official documentation →
          </a>
        </div>
      )}
    </div>
  );
}
