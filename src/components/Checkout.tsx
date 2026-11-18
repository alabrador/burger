"use client";

import { Banknote, CreditCard, Loader2, Lock, Smartphone, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { pickupSlots, type DayHours } from "@/lib/hours";
import { useBurger } from "@/lib/store";

type Store = {
  store: { name: string; address: string; city: string; phone: string; hours: DayHours[]; timezone: string; notice: string };
  open: boolean;
  ordering: { enabled: boolean; pausedMessage: string; prepMinutes: number; slotMinutes: number; maxBurgers: number; taxRateBp: number };
  payments: ("stripe" | "bizum" | "paypal" | "cash")[];
  products: { id: string; priceCents: number; available: boolean }[];
};
type Quote = { subtotalCents: number; discountCents: number; totalCents: number; taxCents: number; lines: { title: string; description: string; quantity: number; totalCents: number }[] };
type Payment = { type: "none" } | { type: "redirect"; url: string } | { type: "form"; url: string; fields: Record<string, string> };

const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const eur = (c: number) => fmt.format(c / 100);
const METHODS = {
  stripe: { label: "Tarjeta", sub: "Visa, Mastercard, Apple Pay, Google Pay", icon: CreditCard },
  bizum: { label: "Bizum", sub: "Paga con tu móvil", icon: Smartphone },
  paypal: { label: "PayPal", sub: "Con tu cuenta PayPal", icon: Wallet },
  cash: { label: "En el local", sub: "Efectivo o tarjeta al recoger", icon: Banknote },
} as const;

async function post<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = (j as { details?: { path: string; message: string }[] }).details;
    throw new Error(Array.isArray(d) && d.length ? d[0].message : (j as { error?: string }).error || "No se pudo completar");
  }
  return j as T;
}

const remember = {
  get(): { name: string; email: string; phone: string } {
    try {
      return JSON.parse(localStorage.getItem("cb:cliente") || "null") ?? { name: "", email: "", phone: "" };
    } catch {
      return { name: "", email: "", phone: "" };
    }
  },
  set(v: { name: string; email: string; phone: string }) {
    try {
      localStorage.setItem("cb:cliente", JSON.stringify(v));
    } catch {}
  },
};

export default function Checkout() {
  const open = useBurger((s) => s.checkout);
  const close = useBurger((s) => s.setCheckout);
  if (!open) return null;
  return <Dialog onClose={() => close(false)} />;
}

function Dialog({ onClose }: { onClose: () => void }) {
  const qty = useBurger((s) => s.qty);
  const protein = useBurger((s) => s.protein);
  const drink = useBurger((s) => s.drink);
  const variant = useBurger((s) => s.drinkVariant);
  const count = useBurger((s) => s.count);
  const line = useMemo(() => ({ protein, items: qty, drink: drink ? (variant === "zero" ? `${drink}_zero` : drink) : null, quantity: count }), [qty, protein, drink, variant, count]);

  const [store, setStore] = useState<Store | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [cust, setCust] = useState(() => (typeof window === "undefined" ? { name: "", email: "", phone: "" } : remember.get()));
  const [pickup, setPickup] = useState("asap");
  const [method, setMethod] = useState<keyof typeof METHODS | "">("");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const idem = useRef<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/store")
      .then((r) => r.json())
      .then((s: Store) => {
        setStore(s);
        setMethod((m) => m || s.payments[0] || "");
      })
      .catch(() => setErr("No se pudo cargar el local. Revisa tu conexión."));
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    dialog.current?.focus();
    return () => removeEventListener("keydown", k);
  }, [onClose]);

  useEffect(() => {
    post<Quote>("/api/orders/quote", { lines: [line], coupon: applied || undefined })
      .then((q) => (setQuote(q), setErr("")))
      .catch((e) => {
        if (applied) {
          setApplied("");
          setErr(e.message);
        } else setErr(e.message);
      });
  }, [line, applied]);

  const slots = useMemo(() => (store ? pickupSlots(store.store, store.ordering.prepMinutes, store.ordering.slotMinutes, 40) : []), [store]);
  // si está cerrado, "lo antes posible" no vale: usamos la primera hora disponible
  const pick = store && !store.open && pickup === "asap" ? (slots[0]?.toISOString() ?? "") : pickup;
  const slotLabel = (d: Date) => {
    const today = new Date().toDateString() === d.toDateString();
    return d.toLocaleString("es-ES", { timeZone: store?.store.timezone, ...(today ? {} : { weekday: "short" }), hour: "2-digit", minute: "2-digit" }) + (today ? "" : "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) return setErr("Elige cómo quieres pagar");
    setBusy(true);
    setErr("");
    try {
      remember.set(cust);
      idem.current ??= crypto.randomUUID();
      const r = await post<{ code: string; token: string; payment: Payment }>(
        "/api/orders",
        {
          lines: [line],
          customer: { name: cust.name, email: cust.email, phone: cust.phone || "", marketing },
          pickup: pick,
          paymentMethod: method,
          coupon: applied || undefined,
          notes: notes || undefined,
          acceptTerms: terms,
        },
        { "Idempotency-Key": idem.current! },
      );
      const p = r.payment;
      if (p.type === "redirect") location.href = p.url;
      else if (p.type === "form") {
        const f = document.createElement("form");
        f.method = "POST";
        f.action = p.url;
        for (const [k, v] of Object.entries(p.fields)) {
          const i = document.createElement("input");
          i.type = "hidden";
          i.name = k;
          i.value = v;
          f.appendChild(i);
        }
        document.body.appendChild(f);
        f.submit();
      } else location.href = `/pedido?c=${r.code}&t=${r.token}`;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const paused = store && !store.ordering.enabled;
  const noSlots = store && !store.open && slots.length === 0;
  const input = "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm outline-none focus:border-gold/70 focus:ring-2 focus:ring-gold/20";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="co-title">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div ref={dialog} tabIndex={-1} className="relative flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-panel shadow-2xl outline-none sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="co-title" className="font-display text-base font-extrabold">
            Tu pedido
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </header>
        <form onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
          {store?.store.notice && <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">{store.store.notice}</p>}
          {paused && <p className="rounded-lg bg-red/15 px-3 py-2 text-red-200">{store.ordering.pausedMessage}</p>}

          <section aria-label="Resumen">
            {quote ? (
              <ul className="space-y-2">
                {quote.lines.map((l, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-display font-bold text-gold">{l.quantity}×</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{l.title}</span>
                      <span className="block text-xs text-muted">{l.description}</span>
                    </span>
                    <span className="tabular-nums">{eur(l.totalCents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Calculando…</p>
            )}
          </section>

          <section className="grid gap-2 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-muted">Nombre</span>
              <input className={input} required minLength={2} maxLength={80} autoComplete="name" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">Correo (te enviamos el QR)</span>
              <input className={input} type="email" required maxLength={160} autoComplete="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">Teléfono (opcional)</span>
              <input className={input} type="tel" maxLength={20} autoComplete="tel" pattern="\+?[0-9 ]{9,16}" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
            </label>
          </section>

          <label className="block">
            <span className="mb-1 block text-xs text-muted">Recogida en {store?.store.name ?? "el local"}</span>
            <select className={input} value={pick} onChange={(e) => setPickup(e.target.value)} required disabled={!store || !!noSlots}>
              {store?.open && <option value="asap">Lo antes posible (~{store.ordering.prepMinutes} min)</option>}
              {slots.map((d) => (
                <option key={d.toISOString()} value={d.toISOString()}>
                  {slotLabel(d)}
                </option>
              ))}
            </select>
            {noSlots && <span className="mt-1 block text-xs text-red-300">No hay horas disponibles en los próximos días.</span>}
          </label>

          <fieldset>
            <legend className="mb-1 text-xs text-muted">Pago</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {store?.payments.map((m) => {
                const M = METHODS[m];
                return (
                  <label key={m} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 ${method === m ? "border-gold bg-gold/10" : "border-line"}`}>
                    <input type="radio" name="pay" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                    <M.icon className={`size-5 ${method === m ? "text-gold" : "text-muted"}`} />
                    <span>
                      <span className="block font-semibold">{M.label}</span>
                      <span className="block text-[11px] text-muted">{M.sub}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {store && !store.payments.length && <p className="text-xs text-red-300">No hay métodos de pago activos.</p>}
          </fieldset>

          <div className="flex gap-2">
            <input className={input} placeholder="Código de descuento" value={coupon} maxLength={32} onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} aria-label="Código de descuento" />
            <button type="button" className="h-10 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold hover:border-gold/60 disabled:opacity-40" disabled={!coupon || coupon === applied} onClick={() => setApplied(coupon)}>
              Aplicar
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-muted">Nota para cocina (opcional)</span>
            <input className={input} maxLength={300} placeholder="Ej.: sin sal en las papas" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="space-y-1.5 text-xs text-muted">
            <label className="flex items-start gap-2">
              <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 accent-[#ffc21a]" />
              <span>Acepto que se usen mis datos para gestionar el pedido y avisarme de su estado (RGPD).</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 accent-[#ffc21a]" />
              <span>Quiero recibir ofertas por correo (opcional).</span>
            </label>
          </div>

          {err && (
            <p role="alert" className="rounded-lg bg-red/15 px-3 py-2 text-red-200">
              {err}
            </p>
          )}

          {quote && (
            <dl className="space-y-0.5 border-t border-line pt-3 text-right text-xs text-muted">
              {quote.discountCents > 0 && (
                <div>
                  Descuento {applied}: −{eur(quote.discountCents)}
                </div>
              )}
              <div>IVA incluido: {eur(quote.taxCents)}</div>
            </dl>
          )}
          <button
            disabled={busy || !quote || !!paused || !!noSlots || !store?.payments.length}
            className="cta-gold flex h-11 w-full items-center justify-center gap-2 rounded-xl font-display text-sm font-extrabold text-[#1b1208] disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {quote ? (method === "cash" ? `Confirmar pedido · ${eur(quote.totalCents)}` : `Pagar ${eur(quote.totalCents)}`) : "Hacer pedido"}
          </button>
          <p className="text-center text-[11px] text-muted">Pago seguro. Te llegará un correo con el QR para recoger.</p>
        </form>
      </div>
    </div>
  );
}
