import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import en from "../messages/en.json";
import vi from "../messages/vi.json";
import zh from "../messages/zh.json";

const messages = { en, vi, zh } as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";
  const validLocale = (["en", "vi", "zh"] as const).includes(locale as "en" | "vi" | "zh") ? (locale as "en" | "vi" | "zh") : "en";

  return {
    locale: validLocale,
    messages: messages[validLocale],
  };
});
