"use client";

import { useTranslations } from "next-intl";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "vi", label: "VI" },
];

export function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");

  function setLocale(locale: string) {
    document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  const currentLocale =
    typeof document !== "undefined"
      ? (document.cookie.match(/(?:^|;\s*)locale=([^;]*)/))?.[1] ?? "en"
      : "en";

  return (
    <div className="flex items-center gap-1" aria-label={t("label")}>
      {LOCALES.map((loc) => (
        <button
          key={loc.code}
          type="button"
          onClick={() => setLocale(loc.code)}
          className={`text-xs px-2 py-1 rounded-md transition-colors ${
            currentLocale === loc.code
              ? "bg-accent text-white"
              : "text-muted hover:text-ink hover:bg-accent-soft"
          }`}
          aria-pressed={currentLocale === loc.code}
        >
          {loc.label}
        </button>
      ))}
    </div>
  );
}
