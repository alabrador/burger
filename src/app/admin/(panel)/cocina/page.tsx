"use client";

import { Bell, BellOff, Check, ChefHat, Maximize, PackageCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ago, eur, hm } from "../../_lib/api";
import { Btn, cx, PageHead, useToast } from "../../_lib/ui";

type KOrder = {
  id: string; code: string; status: string; customerName: string; pickupAt: string; createdAt: string; paidAt: string | null; notes: string | null; paymentMethod: string; paymentStatus: string; totalCents: number;
  items: { id: number; quantity: number; title: string; description: string; totalCents: number }[];
};
const COLS = [
  { s: "confirmed", label: "Nuevos", tone: "border-sky-500/50" },
  { s: "preparing", label: "En la plancha", tone: "border-amber-500/50" },
  { s: "ready", label: "Listos para recoger", tone: "border-emerald-500/50" },
];

function beep() {
  try {
    const a = new AudioContext();
    const o = a.createOscillator();
    const g = a.createGain();
    o.connect(g);
    g.connect(a.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.5);
    o.start();
    o.stop(a.currentTime + 0.5);
  } catch {}
}

/** Pantalla de cocina (KDS): se actualiza sola cada pocos segundos. */
export default function Cocina() {
  const toast = useToast();
  const [orders, setOrders] = useState<KOrder[]>([]);
  const [sound, setSound] = useState(true);
  const [, tick] = useState(0);
  const v = useRef(0);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ v: number; changed: boolean; orders?: KOrder[] }>(`/api/admin/kitchen?v=${v.current}`);
      v.current = r.v;
      if (!r.changed || !r.orders) return;
      const fresh = r.orders.filter((o) => o.status === "confirmed" && known.current && !known.current.has(o.id));
      if (fresh.length && sound) beep();
      known.current = new Set(r.orders.map((o) => o.id));
      setOrders(r.orders);
    } catch {}
  }, [sound]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    const c = setInterval(() => tick((x) => x + 1), 30_000);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [load]);

  const move = async (o: KOrder, status: string) => {
    const cash = status === "collected" && o.paymentMethod === "cash" && o.paymentStatus !== "paid";
    if (cash && !confirm(`¿Has cobrado ${eur(o.totalCents)} en efectivo?`)) return;
    try {
      setOrders((l) => l.map((x) => (x.id === o.id ? { ...x, status } : x)));
      await api(`/api/admin/orders/${o.id}`, { method: "PATCH", body: { status, cashPaid: cash || undefined } });
      v.current = 0;
      load();
    } catch (e) {
      toast((e as Error).message, "err");
      v.current = 0;
      load();
    }
  };

  return (
    <>
      <PageHead
        title="Cocina"
        sub="Pedidos en curso por orden de recogida"
        actions={
          <>
            <Btn onClick={() => setSound((s) => !s)} aria-label={sound ? "Silenciar avisos" : "Activar avisos"}>
              {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            </Btn>
            <Btn onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Pantalla completa">
              <Maximize className="size-4" />
            </Btn>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {COLS.map((c) => {
          const list = orders.filter((o) => o.status === c.s);
          return (
            <section key={c.s} className={cx("rounded-xl border-t-4 bg-panel/60 p-3", c.tone)}>
              <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
                {c.label} <span className="rounded-full bg-panel-2 px-2 text-xs text-muted">{list.length}</span>
              </h2>
              <div className="space-y-3">
                {list.map((o) => {
                  const late = new Date(o.pickupAt).getTime() < Date.now() && o.status !== "ready";
                  return (
                    <article key={o.id} className={cx("rounded-lg border bg-panel p-3", late ? "border-red/70" : "border-line")}>
                      <header className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="font-display text-xl font-extrabold tracking-widest">{o.code}</span>
                        <span className={cx("text-xs", late ? "font-bold text-red-700" : "text-muted")}>Recoge {hm(o.pickupAt)}</span>
                      </header>
                      <div className="mb-2 text-xs text-muted">
                        {o.customerName} · {ago(o.paidAt ?? o.createdAt)}
                      </div>
                      <ul className="space-y-1.5">
                        {o.items.map((i) => (
                          <li key={i.id} className="text-sm">
                            <b className="text-gold-ink">{i.quantity}×</b> <b>{i.title}</b>
                            <div className="text-xs text-muted">{i.description}</div>
                          </li>
                        ))}
                      </ul>
                      {o.notes && <p className="mt-2 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-800">Nota: {o.notes}</p>}
                      <div className="mt-3">
                        {o.status === "confirmed" && (
                          <Btn variant="gold" className="w-full" onClick={() => move(o, "preparing")}>
                            <ChefHat className="size-4" /> A la plancha
                          </Btn>
                        )}
                        {o.status === "preparing" && (
                          <Btn variant="ok" className="w-full" onClick={() => move(o, "ready")}>
                            <Check className="size-4" /> Listo
                          </Btn>
                        )}
                        {o.status === "ready" && (
                          <Btn className="w-full" onClick={() => move(o, "collected")}>
                            <PackageCheck className="size-4" /> Entregado{o.paymentMethod === "cash" && o.paymentStatus !== "paid" ? " (cobrar)" : ""}
                          </Btn>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!list.length && <p className="py-6 text-center text-xs text-muted">Nada por aquí</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
