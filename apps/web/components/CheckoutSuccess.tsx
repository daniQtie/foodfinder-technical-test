"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { getSubscriptionStatus } from "@/lib/api";
import { isLanguage, messages, type Language } from "@/lib/i18n";

const MAX_ATTEMPTS = 6;

export function CheckoutSuccess() {
  const [language, setLanguage] = useState<Language>("en");
  const [active, setActive] = useState(false);
  const [checking, setChecking] = useState(true);
  const copy = messages[language];
  const checkStatus = useCallback(async () => {
    try { const status = await getSubscriptionStatus(); setActive(status.isActive); return status.isActive; } catch { return false; }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("foodfinder-language");
    if (isLanguage(saved)) window.queueMicrotask(() => setLanguage(saved));
    let cancelled = false;
    const poll = async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt += 1) {
        if (await checkStatus()) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
      }
      if (!cancelled) setChecking(false);
    };
    void poll();
    return () => { cancelled = true; };
  }, [checkStatus]);

  const refresh = async () => { setChecking(true); await checkStatus(); setChecking(false); };
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12"><section className="w-full max-w-xl rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-[0_24px_80px_rgba(18,61,43,0.1)] sm:p-10"><span className={`mx-auto grid size-14 place-items-center rounded-full ${active ? "bg-[#dcebdd] text-[#1d633a]" : "bg-[#fff0e9] text-[var(--accent-dark)]"}`}>{active ? <CheckIcon className="size-7" /> : <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />}</span><h1 className="mt-6 text-3xl font-semibold tracking-[-0.045em]">{active ? copy.paymentConfirmed : checking ? copy.paymentReceived : copy.confirmationDelayed}</h1>{!active && !checking && <button type="button" onClick={() => void refresh()} className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white">{copy.refreshStatus}</button>}<Link href="/" className="mx-auto mt-6 block w-fit text-sm font-semibold text-[var(--forest)] underline decoration-[#8ba292] underline-offset-4">{copy.backToSearch}</Link></section></main>
  );
}
