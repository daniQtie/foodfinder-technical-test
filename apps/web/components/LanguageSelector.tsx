import { useEffect, useRef, useState } from "react";
import { languageNames, LANGUAGES, type Language } from "@/lib/i18n";

type LanguageSelectorProps = { language: Language; label: string; onChange: (language: Language) => void };

export function LanguageSelector({ language, label, onChange }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="language-menu" ref={ref}>
      <button type="button" className="language-trigger" aria-label={label} aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((value) => !value)}>
        <span className="language-label">{label}</span><span>{languageNames[language]}</span><span className="language-caret" aria-hidden="true">⌄</span>
      </button>
      {open && <ul className="language-options" role="listbox" aria-label={label}>
        {LANGUAGES.map((code) => <li key={code} role="option" aria-selected={language === code}><button type="button" onClick={() => { onChange(code); setOpen(false); }}>{languageNames[code]}</button></li>)}
      </ul>}
    </div>
  );
}
