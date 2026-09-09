import { languageNames, LANGUAGES, type Language } from "@/lib/i18n";

type LanguageSelectorProps = { language: Language; label: string; onChange: (language: Language) => void };

export function LanguageSelector({ language, label, onChange }: LanguageSelectorProps) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={language} onChange={(event) => onChange(event.target.value as Language)} className="appearance-none rounded-full border border-[var(--line)] bg-white py-2.5 pr-10 pl-4 text-sm font-medium text-[var(--forest)] outline-none transition hover:border-[#9dab9f] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
        {LANGUAGES.map((code) => <option key={code} value={code}>{languageNames[code]}</option>)}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs" aria-hidden="true">⌄</span>
    </label>
  );
}
