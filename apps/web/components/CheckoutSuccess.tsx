"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { Brand } from "@/components/Brand";
import { confirmCheckout, getSubscriptionStatus } from "@/lib/api";
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

  const reconcileCheckout = useCallback(async () => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) return checkStatus();
    try {
      const status = await confirmCheckout(sessionId);
      setActive(status.isActive);
      return status.isActive;
    } catch {
      return checkStatus();
    }
  }, [checkStatus]);

  useEffect(() => {
    const saved = window.localStorage.getItem("foodfinder-language");
    if (isLanguage(saved)) window.queueMicrotask(() => setLanguage(saved));
    let cancelled = false;
    const poll = async () => {
      if (await reconcileCheckout()) {
        if (!cancelled) setChecking(false);
        return;
      }
      for (let attempt = 1; attempt < MAX_ATTEMPTS && !cancelled; attempt += 1) {
        if (await checkStatus()) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
      }
      if (!cancelled) setChecking(false);
    };
    void poll();
    return () => { cancelled = true; };
  }, [checkStatus, reconcileCheckout]);

  const refresh = async () => { setChecking(true); await reconcileCheckout(); setChecking(false); };
  return (
    <main className="checkout-shell"><Link href="/" aria-label={copy.appName}><Brand/></Link><section className="checkout-card" aria-live="polite"><span className="checkout-icon">{active ? <CheckIcon className="size-7"/> : checking ? <span className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"/> : <span className="text-3xl" aria-hidden="true">↻</span>}</span><h1>{active ? copy.paymentConfirmed : checking ? copy.paymentReceived : copy.confirmationDelayed}</h1>{!active && !checking && <button type="button" onClick={() => void refresh()} className="button button-accent">{copy.refreshStatus}</button>}<Link href="/" className="checkout-back">{copy.backToSearch}</Link></section><p>{copy.demoLabel}</p></main>
  );
}
