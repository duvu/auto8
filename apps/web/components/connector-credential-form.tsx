"use client";

import { useState } from "react";

import type { ConnectorFieldDef, ConnectorType } from "@auto8/shared";
import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";
import { startOAuth2Flow } from "../lib/api";

const OAUTH2_TYPES: ConnectorType[] = ["gmail", "slack", "outlook"];

interface ConnectorCredentialFormProps {
  type: ConnectorType;
  credentials: Record<string, string>;
  onChange: (credentials: Record<string, string>) => void;
  editMode?: boolean;
}

export function ConnectorCredentialForm({ type, credentials, onChange, editMode = false }: ConnectorCredentialFormProps) {
  const fields = CONNECTOR_FIELD_DEFS[type] ?? [];
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const isOAuth2Type = OAUTH2_TYPES.includes(type);

  function handleChange(key: string, value: string) {
    onChange({ ...credentials, [key]: value });
  }

  function handleBlur(key: string) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  function toggleShow(key: string) {
    setShowSecret((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (isOAuth2Type) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          This connector uses OAuth2. Click the button below to authorize access.
        </p>
        <button
          type="button"
          onClick={() => startOAuth2Flow(type as "gmail" | "slack" | "outlook")}
          className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700"
        >
          Connect via OAuth2
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field: ConnectorFieldDef) => {
        const value = credentials[field.key] ?? "";
        const isTouched = touched[field.key];
        const hasError = isTouched && field.required && !value.trim();
        const isSecret = field.secret;
        const revealed = showSecret[field.key];
        const inputType = isSecret && !revealed ? "password" : "text";

        return (
          <div key={field.key}>
            <label className="block text-sm font-medium mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type={inputType}
                value={value}
                placeholder={editMode && isSecret ? "(leave blank to keep current)" : field.placeholder}
                onChange={(e) => handleChange(field.key, e.target.value)}
                onBlur={() => handleBlur(field.key)}
                className={`border rounded px-3 py-2 text-sm w-full ${isSecret ? "pr-16" : ""} ${hasError ? "border-red-400 bg-red-50" : ""}`}
                autoComplete="off"
              />
              {isSecret && (
                <button
                  type="button"
                  onClick={() => toggleShow(field.key)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800 px-1"
                  tabIndex={-1}
                >
                  {revealed ? "Hide" : "Show"}
                </button>
              )}
            </div>
            {field.description && (
              <p className="text-xs text-gray-500 mt-1">{field.description}</p>
            )}
            {field.hint && (
              <p className="text-xs text-blue-600 mt-0.5">{field.hint}</p>
            )}
            {hasError && (
              <p className="text-xs text-red-600 mt-0.5">{field.label} is required.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Returns true if all required fields for the given type are non-empty */
export function validateConnectorCredentials(type: ConnectorType, credentials: Record<string, string>): boolean {
  const fields = CONNECTOR_FIELD_DEFS[type] ?? [];
  return fields.filter((f) => f.required).every((f) => !!(credentials[f.key] ?? "").trim());
}

/** Returns an empty credentials object initialized for the given type */
export function emptyCredentials(type: ConnectorType): Record<string, string> {
  const fields = CONNECTOR_FIELD_DEFS[type] ?? [];
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}
