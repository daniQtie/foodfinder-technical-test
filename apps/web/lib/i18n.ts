import de from "../messages/de.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import nl from "../messages/nl.json";

export const LANGUAGES = ["en", "nl", "de", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];
export type Messages = typeof en;
export type MessageKey = keyof Messages;

export const languageNames: Record<Language, string> = {
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",
  fr: "Français",
};

export const messages: Record<Language, Messages> = { en, nl, de, fr };

export const isLanguage = (value: string | null): value is Language =>
  value !== null && LANGUAGES.some((language) => language === value);
