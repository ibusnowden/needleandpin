// Localisation from day one (§11, §15 C): i18next with ICU message format. Arabic is right-to-left;
// the <html dir> attribute flips the whole HTML layer, while the Phaser map stays geographic.
import i18next from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };

export const LANGUAGES = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "ar", name: "العربية", dir: "rtl" },
] as const;
export type Lang = (typeof LANGUAGES)[number]["code"];

function initial(): Lang {
  try {
    const saved = localStorage.getItem("np.lang");
    if (saved === "en" || saved === "ar") return saved;
  } catch { /* storage may be blocked */ }
  return typeof navigator !== "undefined" && navigator.language?.startsWith("ar") ? "ar" : "en";
}

export const i18n = i18next.createInstance();
void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: initial(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnObjects: true,
  });

export function applyDirection(lang: string) {
  const def = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  document.documentElement.lang = def.code;
  document.documentElement.dir = def.dir;
}

export function setLanguage(lang: Lang) {
  void i18n.changeLanguage(lang);
  applyDirection(lang);
  try { localStorage.setItem("np.lang", lang); } catch { /* ignore */ }
}

/** Format numbers in the active locale (Arabic-Indic digits for Arabic). */
export function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

/** Pick the active language's text from a bilingual content object ({en, ar}). */
export function tx(t: { en: string; ar: string } | undefined): string {
  if (!t) return "";
  return (i18n.language === "ar" ? t.ar : t.en) || t.en;
}
