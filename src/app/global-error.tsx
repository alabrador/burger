"use client";

import { useReportError } from "@/components/ErrorScreen";

/** Último recurso: falla el layout raíz. Estilos en línea porque aquí no se cargan los globales. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useReportError(error);
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#120d0b", color: "#f6efe9", fontFamily: "Inter, system-ui, sans-serif", padding: 16 }}>
        <title>Crea tu Burger</title>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontFamily: "Anton, Impact, sans-serif", fontWeight: 400, fontSize: 34, letterSpacing: 1, color: "#ffc21a", textTransform: "uppercase", margin: 0 }}>
            Volvemos enseguida
          </h1>
          <p style={{ color: "#b9aaa2", lineHeight: 1.5 }}>Ha ocurrido un error inesperado y ya nos ha llegado el aviso. Tu carrito sigue guardado.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
            <button onClick={() => retry()} style={{ background: "#ffc21a", color: "#1c1917", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 600, fontSize: 16, cursor: "pointer" }}>
              Reintentar
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarga completa a propósito: el layout raíz ha fallado */}
            <a href="/" style={{ color: "#f6efe9", border: "1px solid rgba(255,255,255,.15)", borderRadius: 999, padding: "12px 24px", fontWeight: 600, textDecoration: "none" }}>
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
