"use client";

import { Check, ChefHat, Clock, Loader2, MapPin, PackageCheck, ReceiptText, XCircle } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { BurgerMark } from "@/components/Brand";
import StripeCard, { type StripePay } from "@/components/StripeCard";

type O = {
  code: string; status: string; paymentStatus: string; paymentMethod: string; customerName: string; pickupAt: string | null; createdAt: string;
  subtotalCents: number; discountCents: number; totalCents: number; taxCents: number;
  items: { title: string; description: string; quantity: number; totalCents: number }[];
  qr: string | null; store: { name: string; address: string; phone: string };
};

const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const eur = (c: number) => fmt.format(c / 100);
const STEPS = [
  { s: "confirmed", label: "Confirmado", icon: ReceiptText },
  { s: "preparing", label: "En la plancha", icon: ChefHat },
  { s: "ready", label: "Listo", icon: Check },
  { s: "collected", label: "Entregado", icon: PackageCheck },
];
const TITLE: Record<string, string> = {
  pending_payment: "Esperando el pago",
  confirmed: "¡Pedido confirmado!",
  preparing: "Tu burger está en la plancha",
  ready: "¡Listo para recoger!",
  collected: "¡Que aproveche!",
  cancelled: "Pedido cancelado",
};

export default function Pedido() {
  const [o, setO] = useState<O | null>(null);
  const [err, setErr] = useState("");
  const [qr, setQr] = useState("");
  const [p, setP] = useState({ c: "", t: "", pago: "" });
  const [retrying, setRetrying] = useState(false);
  const [card, setCard] = useState<StripePay | null>(null);

  const load = useCallback(async (c: string, t: string) => {
    const r = await fetch(`/api/orders/${encodeURIComponent(c)}?t=${encodeURIComponent(t)}`, { cache: "no-store" });
    if (!r.ok) return setErr(r.status === 404 ? "No encontramos este pedido. Revisa el enlace del correo." : "No se pudo cargar el pedido.");
    const j = (await r.json()) as O;
    setO(j);
    if (j.qr) setQr(await QRCode.toDataURL(j.qr, { margin: 1, width: 260, color: { dark: "#120d0b", light: "#ffffff" } }));
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const v = { c: sp.get("c") || "", t: sp.get("t") || "", pago: sp.get("pago") || "" };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la URL solo existe en el navegador
    setP(v);
    if (!v.c || !v.t) return setErr("Enlace incompleto.");
    load(v.c, v.t);
  }, [load]);

  useEffect(() => {
    if (!o || ["collected", "cancelled"].includes(o.status)) return;
    const fast = o.status === "pending_payment" && p.pago === "ok";
    const id = setInterval(() => !document.hidden && load(p.c, p.t), fast ? 2500 : 10_000);
    return () => clearInterval(id);
  }, [o, p, load]);

  const retry = async () => {
    setRetrying(true);
    const r = await fetch(`/api/orders/${p.c}/pay?t=${p.t}`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error || "No se pudo reintentar el pago");
      return setRetrying(false);
    }
    const pay = j.payment;
    if (pay.type === "stripe") {
      setCard(pay);
      setRetrying(false);
    } else if (pay.type === "redirect") location.href = pay.url;
    else if (pay.type === "form") {
      const f = document.createElement("form");
      f.method = "POST";
      f.action = pay.url;
      for (const [k, v] of Object.entries(pay.fields as Record<string, string>)) {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = k;
        i.value = v;
        f.appendChild(i);
      }
      document.body.appendChild(f);
      f.submit();
    }
  };

  const idx = o ? STEPS.findIndex((s) => s.s === o.status) : -1;
  const pickup = o?.pickupAt ? new Date(o.pickupAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid", weekday: "long", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <main className="min-h-dvh bg-bg px-4 py-6">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-5 flex items-center gap-2">
          <BurgerMark className="size-8" />
          <span className="font-display text-lg font-extrabold">Crea tu Burger</span>
        </Link>
        {err && <p className="rounded-xl border border-red/40 bg-red/10 p-4 text-sm text-red-200">{err}</p>}
        {!o && !err && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Cargando tu pedido…
          </p>
        )}
        {o && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-line bg-panel p-5 text-center">
              <p className="text-xs tracking-widest text-muted uppercase">Pedido</p>
              <p className="font-display text-4xl font-black tracking-[0.2em] text-gold">{o.code}</p>
              <h1 className="mt-2 font-display text-xl font-extrabold">{TITLE[o.status]}</h1>
              {o.status === "pending_payment" && (
                <div className="mt-3 space-y-3 text-sm">
                  {p.pago === "ok" ? (
                    <p className="flex items-center justify-center gap-2 text-muted">
                      <Loader2 className="size-4 animate-spin" /> Confirmando el pago con el banco…
                    </p>
                  ) : (
                    <>
                      <p className="text-muted">{p.pago === "ko" ? "El pago no se completó." : "Aún no hemos recibido el pago."}</p>
                      {card ? (
                        <div className="text-left">
                          <StripeCard pay={card} />
                        </div>
                      ) : (
                        <button onClick={retry} disabled={retrying} className="cta-gold h-10 rounded-xl px-5 font-display text-sm font-extrabold text-[#1b1208] disabled:opacity-60">
                          {retrying ? "Abriendo…" : `Pagar ${eur(o.totalCents)}`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {o.status === "cancelled" && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted">
                  <XCircle className="size-4" /> Si ya pagaste, te devolveremos el importe.
                </p>
              )}
              {qr && o.status !== "cancelled" && o.status !== "collected" && (
                <div className="mt-4">
                  <img src={qr} alt={`QR de recogida del pedido ${o.code}`} className="mx-auto size-52 rounded-xl bg-white p-2" />
                  <p className="mt-2 text-xs text-muted">Enseña este QR en el mostrador. También te lo enviamos por correo.</p>
                </div>
              )}
            </section>

            {o.status !== "cancelled" && o.status !== "pending_payment" && (
              <ol className="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-panel p-3" aria-label="Estado">
                {STEPS.map((s, i) => (
                  <li key={s.s} className="flex flex-col items-center gap-1 text-center" aria-current={i === idx ? "step" : undefined}>
                    <span className={`grid size-9 place-items-center rounded-full ${i <= idx ? "bg-gold text-[#1b1208]" : "bg-panel-2 text-muted"} ${i === idx ? "ring-4 ring-gold/25" : ""}`}>
                      <s.icon className="size-4" />
                    </span>
                    <span className={`text-[11px] ${i <= idx ? "text-ink" : "text-muted"}`}>{s.label}</span>
                  </li>
                ))}
              </ol>
            )}

            <section className="space-y-2 rounded-2xl border border-line bg-panel p-4 text-sm">
              {pickup && (
                <p className="flex items-center gap-2">
                  <Clock className="size-4 text-gold" /> Recogida: <b className="capitalize">{pickup}</b>
                </p>
              )}
              {o.store.address && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-gold" /> {o.store.name} · {o.store.address}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-panel p-4 text-sm">
              <ul className="space-y-2">
                {o.items.map((i, k) => (
                  <li key={k} className="flex gap-3">
                    <span className="font-display font-bold text-gold">{i.quantity}×</span>
                    <span className="min-w-0 flex-1">
                      <b>{i.title}</b>
                      <span className="block text-xs text-muted">{i.description}</span>
                    </span>
                    <span className="tabular-nums">{eur(i.totalCents)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-0.5 border-t border-line pt-3 text-right text-xs text-muted">
                {o.discountCents > 0 && <div>Descuento: −{eur(o.discountCents)}</div>}
                <div>IVA incluido: {eur(o.taxCents)}</div>
                <div className="text-base font-bold text-ink">Total {eur(o.totalCents)}</div>
                <div>
                  {o.paymentMethod === "cash" ? "Pago en el local" : o.paymentStatus === "paid" ? "Pagado" : o.paymentStatus === "refunded" ? "Reembolsado" : "Pendiente"}
                </div>
              </dl>
            </section>
            {o.store.phone && (
              <p className="text-center text-xs text-muted">
                ¿Algún problema? Llámanos al <a className="text-gold" href={`tel:${o.store.phone}`}>{o.store.phone}</a>
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
