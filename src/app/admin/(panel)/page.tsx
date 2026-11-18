"use client";

import { Activity, Beef, ChartColumn, CircleX, CreditCard, ReceiptText, ShoppingBag, Sparkles, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ago, api, eur, METHOD } from "../_lib/api";
import { Card, cx, StatusBadge, useData } from "../_lib/ui";

type Dash = {
  kpi: { orders: number; revenue: number; refunds: number; avg: number; cancelled: number; customers: number };
  live: { status: string; n: number }[];
  series: { bucket: string; orders: number; revenue: number }[];
  methods: { method: string; n: number; revenue: number }[];
  proteins: { id: string; n: number }[];
  ingredients: { id: string; n: number }[];
  prepMinutes: number;
};
type P = { id: string; name: string };
const RANGES = [
  ["today", "Hoy"],
  ["7d", "7 días"],
  ["30d", "30 días"],
] as const;

type Recent = { rows: { id: string; code: string; status: string; customerName: string; totalCents: number; createdAt: string; paymentMethod: string }[] };

export default function Dashboard() {
  const [range, setRange] = useState<string>("today");
  const { data: d, error } = useData(() => api<Dash>(`/api/admin/dashboard?range=${range}`), [range]);
  const { data: products } = useData(() => api<P[]>("/api/admin/products"));
  const { data: recent } = useData(() => api<Recent>("/api/admin/orders?size=10"));
  const name = (id: string) => products?.find((p) => p.id === id)?.name ?? id;
  const live = (s: string) => d?.live.find((x) => x.status === s)?.n ?? 0;
  const inKitchen = live("confirmed") + live("preparing");
  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  const per = range === "today" ? "hoy" : range === "7d" ? "últimos 7 días" : "últimos 30 días";

  return (
    <>
      <div className="admin-hero -mx-4 mb-6 px-4 pt-6 pb-7 text-white lg:-mx-8 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-black tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/70 first-letter:uppercase">{today}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/15 bg-white/[0.06] p-1" role="tablist" aria-label="Periodo">
              {RANGES.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={cx("rounded-lg px-3.5 py-1.5 text-xs font-semibold transition", range === k ? "bg-gold text-char" : "text-white/75 hover:text-white")}>
                  {l}
                </button>
              ))}
            </div>
            <Link href="/admin/cocina" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold hover:bg-white/10">
              <Activity className="size-4 text-gold" /> {inKitchen} en cocina
            </Link>
          </div>
        </div>
        {error && <p className="mb-4 rounded-lg bg-red/20 px-3 py-2 text-sm">{error}</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="Ingresos" value={d ? eur(d.kpi.revenue) : "…"} sub={per} tone="#ffc21a" icon={<TrendingUp className="size-4" />} />
          <Stat label="Pedidos" value={d?.kpi.orders ?? "…"} sub={per} tone="#f97316" icon={<ShoppingBag className="size-4" />} />
          <Stat label="Ticket medio" value={d ? eur(d.kpi.avg) : "…"} sub="por pedido" tone="#facc15" icon={<ReceiptText className="size-4" />} />
          <Stat label="Clientes nuevos" value={d?.kpi.customers ?? "…"} sub={d?.prepMinutes ? `Preparación ~${d.prepMinutes} min` : per} tone="#34d399" icon={<Users className="size-4" />} />
          <Stat label="Cancelados" value={d?.kpi.cancelled ?? "…"} sub={d ? `Reembolsos ${eur(d.kpi.refunds)}` : ""} tone="#e3261b" icon={<CircleX className="size-4" />} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Evolución de ingresos" sub={range === "today" ? "Ventas por hora de hoy" : "Ventas por día"} icon={<ChartColumn className="size-4" />} className="xl:col-span-2">
          {d && <Bars data={d.series} hourly={range === "today"} />}
        </Card>
        <Card
          title={
            <span className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
              Cocina en vivo
            </span>
          }
          actions={<span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">{inKitchen + live("ready")} activos</span>}
        >
          <ul className="space-y-2.5">
            {(["confirmed", "preparing", "ready", "pending_payment"] as const).map((s) => (
              <li key={s} className="flex items-center justify-between rounded-xl border border-line bg-panel-2 px-4 py-3">
                <StatusBadge s={s} />
                <span className="font-display text-2xl font-black tabular-nums">{live(s)}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/cocina" className="mt-4 block rounded-xl bg-char py-2.5 text-center text-sm font-semibold text-white hover:bg-char-2">
            Abrir pantalla de cocina
          </Link>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Pedidos recientes" actions={<Link href="/admin/pedidos" className="text-sm font-semibold text-gold-ink hover:underline">Ver todos →</Link>} flush className="xl:col-span-1 xl:row-span-2">
          {recent && !recent.rows.length ? (
            <p className="py-10 text-center text-sm text-muted">Aún no hay pedidos.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent?.rows.slice(0, 7).map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/pedidos?id=${o.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-panel-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-ink">
                      <ShoppingBag className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-bold">#{o.code}</span>
                      <span className="block truncate text-xs text-muted">
                        {o.customerName} · {ago(o.createdAt)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-display text-sm font-extrabold tabular-nums">{eur(o.totalCents)}</span>
                      <StatusBadge s={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Métodos de pago" icon={<CreditCard className="size-4" />}>
          <Rank rows={(d?.methods ?? []).map((m) => ({ label: METHOD[m.method] ?? m.method, n: m.n, sub: eur(m.revenue) }))} />
        </Card>
        <Card title="Proteínas" icon={<Beef className="size-4" />}>
          <Rank rows={(d?.proteins ?? []).map((m) => ({ label: name(m.id), n: m.n }))} />
        </Card>
        <Card title="Ingredientes más pedidos" icon={<Sparkles className="size-4" />} className="xl:col-span-2">
          <Rank rows={(d?.ingredients ?? []).map((m) => ({ label: name(m.id), n: m.n }))} />
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, sub, tone, icon }: { label: string; value: React.ReactNode; sub?: string; tone: string; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] px-4 pt-4 pb-3.5 backdrop-blur" style={{ boxShadow: `inset 0 3px 0 ${tone}` }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.08em] text-white/80 uppercase">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-white/90">{icon}</span>
      </div>
      <div className="mt-1.5 font-display text-[26px] leading-tight font-black tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/55">{sub}</div>}
    </div>
  );
}

/** Barras de una sola serie (ventas), con tooltip al pasar el ratón. */
function Bars({ data: raw, hourly }: { data: Dash["series"]; hourly: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!raw.some((d) => d.orders)) return <p className="py-12 text-center text-sm text-muted">Sin ventas en este periodo.</p>;
  const data = raw;
  const top = Math.max(...data.map((d) => d.revenue), 1);
  const step = Math.pow(10, Math.floor(Math.log10(top / 100 / 4 || 1)));
  const tick = [1, 2, 2.5, 5, 10].map((m) => m * step).find((t) => (top / 100) / t <= 4) ?? step * 10;
  const max = tick * 4 * 100;
  const lab = (b: string) => (hourly ? `${b}:00` : new Date(b).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }));
  return (
    <div className="relative pl-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-60">
        {[4, 3, 2, 1, 0].map((k) => (
          <div key={k} className="absolute inset-x-0 flex items-center gap-2" style={{ top: `${((4 - k) / 4) * 100}%` }}>
            <span className="w-10 -translate-y-1/2 text-right text-[10px] text-muted tabular-nums">{Math.round((tick * k) * 100) / 100} €</span>
            <span className={cx("h-px flex-1 -translate-y-1/2", k ? "border-t border-dashed border-line" : "bg-line")} />
          </div>
        ))}
      </div>
      <div className="relative flex h-60 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.bucket} className="group relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div className={cx("mx-auto w-full max-w-9 rounded-t-md transition", hover === i ? "bg-char" : "bg-gold")} style={{ height: d.revenue ? `${Math.max(1.5, (d.revenue / max) * 100)}%` : "0" }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{lab(data[0].bucket)}</span>
        <span>{lab(data[data.length - 1].bucket)}</span>
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-xl bg-char px-3 py-2 text-xs text-white shadow-xl" style={{ left: `min(calc(${((hover + 0.5) / data.length) * 100}% ), calc(100% - 9rem))` }}>
          <div className="font-semibold">{lab(data[hover].bucket)}</div>
          <div>{eur(data[hover].revenue)}</div>
          <div className="text-white/60">{data[hover].orders} pedidos</div>
        </div>
      )}
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.bucket}>
              <td>{lab(d.bucket)}</td>
              <td>{eur(d.revenue)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rank({ rows }: { rows: { label: string; n: number; sub?: string }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">Sin datos.</p>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex justify-between text-[13px]">
            <span className="font-medium">{r.label}</span>
            <span className="text-muted tabular-nums">
              {r.n}
              {r.sub ? ` · ${r.sub}` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-panel-2 ring-1 ring-line ring-inset">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#ffc21a,#f2ab00)]" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
