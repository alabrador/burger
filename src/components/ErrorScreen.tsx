"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { BurgerMark } from "./Brand";

/** Envía el error del navegador al servidor (una vez por error) sin bloquear nada. */
export function useReportError(error: unknown) {
  useEffect(() => {
    const e = error instanceof Error ? error : new Error(String(error));
    try {
      fetch("/api/errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          message: (e.message || "Error").slice(0, 500),
          stack: e.stack?.slice(0, 3000),
          digest: "digest" in e ? String((e as { digest?: unknown }).digest ?? "") || undefined : undefined,
          path: location.pathname.slice(0, 200),
        }),
      }).catch(() => {});
    } catch {
      /* nada */
    }
  }, [error]);
}

/** Pantalla de error de la web pública. El carrito sigue guardado en el navegador. */
export function ErrorScreen({ error, retry, title = "Algo se ha quemado en la plancha" }: { error: unknown; retry?: () => void; title?: string }) {
  useReportError(error);
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-ink">
      <div className="w-full max-w-md text-center">
        <BurgerMark className="mx-auto mb-6 size-16 opacity-90" />
        <h1 className="font-display text-3xl tracking-wide text-gold uppercase sm:text-4xl">{title}</h1>
        <p className="mt-3 text-muted">
          Ha ocurrido un error inesperado y ya nos ha llegado el aviso. Tu carrito sigue guardado: vuelve a intentarlo en unos segundos.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {retry && (
            <button onClick={() => retry()} className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 font-semibold text-char hover:bg-gold-2">
              <RotateCcw className="size-4" /> Reintentar
            </button>
          )}
          <Link href="/" className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 font-semibold hover:border-gold/50">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
