import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import en from "../messages/en.json";
import vi from "../messages/vi.json";

const messages = { en, vi } as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";
  const validLocale = (["en", "vi"] as const).includes(locale as "en" | "vi") ? (locale as "en" | "vi") : "en";

  return {
    locale: validLocale,
    messages: messages[validLocale],
  };
});
