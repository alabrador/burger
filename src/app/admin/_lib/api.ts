"use client";

let csrf = "";
export const setCsrf = (t: string) => {
  csrf = t;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

/** fetch del admin: JSON, cabecera CSRF y vuelta al login si caduca la sesión. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(path, {
    method: opts.method || "GET",
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.method && opts.method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (r.status === 401 && !path.includes("/auth/login")) {
    location.href = `/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new HttpError(401, "Sesión caducada");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = (j as { details?: { path: string; message: string }[] }).details;
    const msg = (j as { error?: string }).error || `Error ${r.status}`;
    throw new HttpError(r.status, Array.isArray(d) && d.length ? `${msg}: ${d.map((x) => `${x.path} ${x.message}`).join(", ")}` : msg, Array.isArray(d) ? d : undefined);
  }
  return j as T;
}

const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const eur = (c: number) => fmt.format((c || 0) / 100);
export const dt = (s: string | Date | null | undefined, o: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) =>
  s ? new Date(s).toLocaleString("es-ES", { timeZone: "Europe/Madrid", ...o }) : "—";
export const hm = (s: string | Date | null | undefined) => dt(s, { hour: "2-digit", minute: "2-digit" });
export const ago = (s: string | Date) => {
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`;
};

export const STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Pendiente de pago", cls: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30" },
  confirmed: { label: "Nuevo", cls: "bg-sky-500/15 text-sky-300 ring-sky-500/30" },
  preparing: { label: "En preparación", cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  ready: { label: "Listo", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  collected: { label: "Entregado", cls: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20" },
  cancelled: { label: "Cancelado", cls: "bg-red-500/15 text-red-300 ring-red-500/30" },
};
export const PAY: Record<string, { label: string; cls: string }> = {
  pending: { label: "Sin pagar", cls: "text-zinc-400" },
  paid: { label: "Pagado", cls: "text-emerald-400" },
  failed: { label: "Fallido", cls: "text-red-400" },
  refunded: { label: "Reembolsado", cls: "text-violet-300" },
  partially_refunded: { label: "Reemb. parcial", cls: "text-violet-300" },
};
export const METHOD: Record<string, string> = { stripe: "Tarjeta", paypal: "PayPal", bizum: "Bizum", cash: "Efectivo" };
export const ROLE: Record<string, string> = { owner: "Dueño", admin: "Administrador", manager: "Encargado", kitchen: "Cocina", cashier: "Caja" };
