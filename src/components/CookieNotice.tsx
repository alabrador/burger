"use client";

import { Cookie } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

const KEY = "cb:cookies";
const listeners = new Set<() => void>();
const seen = () => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return true; // sin almacenamiento: no insistimos con el aviso
  }
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * Aviso informativo: la web solo usa cookies y almacenamiento técnicos (carrito,
 * pago y panel), así que no hace falta pedir consentimiento, solo informar.
 */
export default function CookieNotice() {
  const hidden = useSyncExternalStore(subscribe, seen, () => true);
  if (hidden) return null;
  const ok = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    listeners.forEach((fn) => fn());
  };
  return (
    <div role="region" aria-label="Aviso de cookies" className="fixed inset-x-2 bottom-2 z-30 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm">
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-panel/95 p-3 text-xs leading-snug shadow-2xl backdrop-blur">
        <Cookie className="mt-0.5 size-5 shrink-0 text-gold" />
        <p className="flex-1 text-ink/85">
          Solo usamos cookies técnicas para que funcionen el carrito y el pago. Nada de publicidad ni rastreo.{" "}
          <Link href="/cookies" className="font-semibold text-gold underline underline-offset-2">
            Más información
          </Link>
        </p>
        <button onClick={ok} className="shrink-0 rounded-full bg-gold px-3 py-1.5 font-display font-extrabold text-[#1b1208] hover:brightness-110">
          Entendido
        </button>
      </div>
    </div>
  );
}
