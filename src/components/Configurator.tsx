"use client";

import dynamic from "next/dynamic";
import { useProgress } from "@react-three/drei";
import { useMemo, useState } from "react";
import { BUN, CATALOG, DONENESS, PRESETS, PROTEINS, money, stackOrder, totals, type Item, type ProteinId } from "@/lib/catalog";
import { useBurger } from "@/lib/store";

const BurgerScene = dynamic(() => import("./BurgerScene"), { ssr: false });

export default function Configurator() {
  const protein = useBurger((s) => s.protein);
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-14 pt-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-4">
        <div>
          <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-accent">Hamburguesas a tu gusto</p>
          <h1 className="m-0 font-display text-[clamp(30px,4.6vw,48px)] font-black uppercase leading-[0.95]">
            Arma tu <span className="brand-mark">{PROTEINS[protein].title}</span>
          </h1>
        </div>
        <p className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] text-muted">
          Incluye pan brioche y {PROTEINS[protein].name}
        </p>
        <div className="stripe h-1.5 w-full rounded-full" aria-hidden />
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Stage />
        <OrderPanel />
      </div>
    </div>
  );
}

function Stage() {
  const { qty, protein, exploded, spinning, setExploded, setSpinning } = useBurger();
  const t = useMemo(() => totals(qty, protein), [qty, protein]);
  const layers = useMemo(() => stackOrder(qty, protein).length, [qty, protein]);
  const { active, progress } = useProgress();
  return (
    <section
      aria-label="Tu hamburguesa en 3D"
      className="stage-bg relative h-[58vh] min-h-[420px] overflow-hidden rounded-[22px] border border-line lg:sticky lg:top-3 lg:h-[min(80vh,760px)] lg:min-h-[520px]"
    >
      <BurgerScene />
      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-2">
        <dl className="pointer-events-auto flex gap-3 rounded-xl sm:gap-4 border border-line bg-white/80 px-3 py-2 backdrop-blur">
          <Stat label="Capas" value={String(layers)} />
          <Stat label="Peso aprox." value={`${t.g} g`} />
          <Stat label="Kcal" value={t.kcal.toLocaleString("es")} />
        </dl>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <Toggle pressed={exploded} onClick={() => setExploded(!exploded)}>Vista por capas</Toggle>
          <Toggle pressed={spinning} onClick={() => setSpinning(!spinning)}>Girar</Toggle>
        </div>
      </div>
      <p className="absolute bottom-4 left-4 rounded-full bg-white/70 px-2.5 py-1.5 text-xs text-muted">
        {active ? `Cargando modelos ${Math.round(progress)} %` : "Arrastra para girar la hamburguesa"}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dd className="order-1 whitespace-nowrap font-mono text-[15px] font-semibold tabular-nums">{value}</dd>
      <dt className="order-2 whitespace-nowrap text-[11px] uppercase tracking-[0.06em] text-muted">{label}</dt>
    </div>
  );
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="rounded-full border border-line bg-white px-3.5 py-2 text-[13px] font-semibold hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
    >
      {children}
    </button>
  );
}

function OrderPanel() {
  const { qty, protein, doneness, activePreset, applyPreset, setProtein, setDoneness } = useBurger();
  const t = useMemo(() => totals(qty, protein), [qty, protein]);
  const [toast, setToast] = useState<string | null>(null);
  const P = PROTEINS[protein];

  const addToCart = () => {
    const how = protein === "angus" ? `Angus, ${doneness.toLowerCase()}` : P.label.toLowerCase();
    setToast(`Hamburguesa (${how}) agregada al carrito por ${money(t.price)}.`);
    window.setTimeout(() => setToast(null), 3200);
  };

  return (
    <aside aria-label="Tu pedido" className="overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_10px_30px_-18px_rgba(60,30,10,0.35)]">
      <div className="border-b border-line px-5 pb-3 pt-4">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted">Tu hamburguesa</p>
        <h2 className="mb-2.5 mt-0.5 font-display text-2xl font-extrabold uppercase">Elige tus ingredientes</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Combos">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              aria-pressed={activePreset === p.name}
              onClick={() => applyPreset(p.name)}
              className="rounded-full border border-transparent bg-gold-soft px-3 py-1.5 text-[12.5px] font-semibold hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:text-accent"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <section className="border-b border-line px-5 py-3.5">
        <h3 className="mb-2 font-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] text-accent">Base</h3>
        <Row swatch={BUN.swatch} name={BUN.name} note={BUN.note} control={<Included />} />
        <div role="group" aria-label="Proteína" className="my-2 flex overflow-hidden rounded-full border border-line">
          {(Object.keys(PROTEINS) as ProteinId[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={protein === k}
              onClick={() => setProtein(k)}
              className="flex-1 bg-surface-2 px-1.5 py-2.5 text-[13px] font-semibold [&+&]:border-l [&+&]:border-line aria-pressed:bg-accent aria-pressed:text-white"
            >
              {PROTEINS[k].label}
            </button>
          ))}
        </div>
        <Row
          swatch={P.swatch}
          name={P.name}
          note={P.note + (P.surcharge ? ` · +${money(P.surcharge)}` : "")}
          control={<Included />}
        />
        {protein === "angus" && (
          <div role="group" aria-label="Término de la carne" className="mt-1.5 flex overflow-hidden rounded-[10px] border border-line">
            {DONENESS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={doneness === d}
                onClick={() => setDoneness(d)}
                className="flex-1 bg-surface-2 px-1 py-[7px] text-[12.5px] [&+&]:border-l [&+&]:border-line aria-pressed:bg-gold aria-pressed:font-semibold"
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </section>

      {CATALOG.map((c) => (
        <section key={c.name} className="border-b border-line px-5 py-3.5">
          <h3 className="mb-2 font-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] text-accent">{c.name}</h3>
          {c.items.map((it) => (
            <Row
              key={it.id}
              swatch={it.id === "patty_x" ? P.swatch : it.swatch}
              name={it.name}
              note={[it.note, priceLabel(it, protein)].filter(Boolean).join(" · ")}
              control={it.max > 1 ? <Stepper item={it} /> : <Switch item={it} />}
            />
          ))}
        </section>
      ))}

      <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-white px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-muted">Total</p>
          <p className="font-mono text-2xl font-semibold tabular-nums" aria-live="polite">{money(t.price)}</p>
        </div>
        <button
          type="button"
          onClick={addToCart}
          className="rounded-full bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Agregar al carrito
        </button>
      </div>
      {toast && (
        <p role="status" className="mx-5 mb-4 rounded-xl bg-ink px-4 py-3 text-sm text-white">
          {toast}
        </p>
      )}
    </aside>
  );
}

function priceLabel(it: Item, protein: ProteinId) {
  const p = it.id === "patty_x" ? it.price + PROTEINS[protein].surcharge : it.price;
  return p ? `+${money(p)}` : "Sin costo";
}

function Row({ swatch, name, note, control }: { swatch: string; name: string; note?: string; control: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 py-2 [&+&]:border-t [&+&]:border-dashed [&+&]:border-line">
      <span className="size-[30px] rounded-[9px] border border-black/10" style={{ background: swatch }} aria-hidden />
      <div>
        <p className="text-sm font-semibold leading-tight">{name}</p>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      {control}
    </div>
  );
}

function Included() {
  return <span className="text-xs font-semibold text-ok">Incluido</span>;
}

function Stepper({ item }: { item: Item }) {
  const n = useBurger((s) => s.qty[item.id] ?? 0);
  const setQty = useBurger((s) => s.setQty);
  const btn = "grid size-8 place-items-center rounded-full text-lg leading-none hover:bg-white disabled:opacity-35";
  return (
    <div className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5">
      <button type="button" className={btn} aria-label={`Quitar ${item.name}`} disabled={n <= 0} onClick={() => setQty(item.id, n - 1)}>−</button>
      <output className="w-5 text-center font-mono text-sm tabular-nums" aria-live="polite">{n}</output>
      <button type="button" className={btn} aria-label={`Añadir ${item.name}`} disabled={n >= item.max} onClick={() => setQty(item.id, n + 1)}>+</button>
    </div>
  );
}

function Switch({ item }: { item: Item }) {
  const on = useBurger((s) => !!s.qty[item.id]);
  const toggle = useBurger((s) => s.toggle);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={item.name}
      onClick={() => toggle(item.id)}
      className="relative h-7 w-12 rounded-full bg-surface-2 ring-1 ring-line transition-colors aria-checked:bg-accent aria-checked:ring-accent"
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}
