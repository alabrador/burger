"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useProgress } from "@react-three/drei";
import {
  Beef,
  Check,
  ChevronRight,
  CirclePlus,
  Crown,
  Flame,
  Gift,
  Hamburger,
  Info,
  Layers,
  Leaf,
  Maximize,
  Menu,
  RotateCw,
  Scale,
  ShoppingCart,
  Soup,
  Star,
  User,
  Cheese,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BUN,
  CATALOG,
  DONENESS,
  ITEMS,
  PRESETS,
  PROTEINS,
  money,
  stackOrder,
  thumb,
  totals,
  type Item,
  type ProteinId,
} from "@/lib/catalog";
import { useBurger, type Section } from "@/lib/store";
import { Logo, NeonBurger } from "./Brand";

const BurgerScene = dynamic(() => import("./BurgerScene"), { ssr: false });

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "base", label: "Base", icon: Hamburger },
  { id: "carne", label: "Carne", icon: Beef },
  { id: "quesos", label: "Quesos", icon: Cheese },
  { id: "vegetales", label: "Vegetales", icon: Leaf },
  { id: "salsas", label: "Salsas", icon: Soup },
  { id: "extras", label: "Extras", icon: CirclePlus },
];

const NAV: { label: string; short: string; icon: LucideIcon }[] = [
  { label: "Crear Hamburguesa", short: "Crear", icon: Hamburger },
  { label: "Nuestras Especiales", short: "Especiales", icon: Star },
  { label: "Promociones", short: "Promociones", icon: Gift },
  { label: "Alérgenos", short: "Alérgenos", icon: Info },
];

/* ---------- toast compartido ---------- */
let showToast: (msg: string) => void = () => {};
function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    showToast = (m) => {
      setMsg(m);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMsg(null), 3000);
    };
  }, []);
  if (!msg) return null;
  return (
    <p role="status" className="fixed left-1/2 top-20 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-line bg-panel px-4 py-3 text-center text-sm shadow-2xl">
      {msg}
    </p>
  );
}
const soon = (what: string) => showToast(`${what}: disponible próximamente.`);

function useTotals() {
  const qty = useBurger((s) => s.qty);
  const protein = useBurger((s) => s.protein);
  const t = useMemo(() => totals(qty, protein), [qty, protein]);
  const layers = useMemo(() => stackOrder(qty, protein).length, [qty, protein]);
  return { ...t, layers };
}

function useAddToCart() {
  const add = useBurger((s) => s.addToCart);
  const protein = useBurger((s) => s.protein);
  const doneness = useBurger((s) => s.doneness);
  const { price } = useTotals();
  return () => {
    add(price);
    const how = protein === "angus" ? `Angus, ${doneness.toLowerCase()}` : PROTEINS[protein].label.toLowerCase();
    showToast(`Hamburguesa (${how}) agregada al carrito por ${money(price)}.`);
  };
}

export default function Configurator() {
  return (
    <div className="min-h-dvh pb-[168px] lg:pb-6">
      <Header />
      <MobileTabs />
      <main className="mx-auto grid max-w-[1680px] gap-4 px-3 pt-3 lg:grid-cols-[210px_minmax(0,1fr)_minmax(400px,450px)] lg:px-4 lg:pt-5">
        <Sidebar />
        <Stage />
        <IngredientPanel />
        <SelectionBar />
        <TotalCard className="hidden lg:flex" />
      </main>
      <div className="fixed inset-x-3 bottom-[72px] z-30 lg:hidden">
        <TotalCard />
      </div>
      <BottomNav />
      <Toast />
    </div>
  );
}

/* ---------- cabecera ---------- */
function Header() {
  const cart = useBurger((s) => s.cart);
  return (
    <header className="sticky top-0 z-40 border-b-2 border-red/80 bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-3 lg:h-20 lg:px-4">
        <button type="button" className="grid size-10 place-items-center lg:hidden" aria-label="Abrir menú" onClick={() => soon("Menú")}>
          <Menu className="size-7" />
        </button>
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <div className="hidden lg:block">
          <Logo />
        </div>
        <nav aria-label="Principal" className="hidden h-full items-stretch gap-8 lg:flex">
          {NAV.map((n, i) => (
            <button
              key={n.label}
              type="button"
              aria-current={i === 0 ? "page" : undefined}
              onClick={() => (i === 0 ? undefined : soon(n.label))}
              className="relative flex items-center gap-2.5 text-[15px] font-medium text-ink/90 hover:text-gold aria-[current=page]:text-ink"
            >
              <n.icon className={`size-5 ${i === 0 ? "text-gold" : ""}`} />
              {n.label}
              {i === 0 && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-gold" />}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => soon("Carrito")}
            className="relative flex h-11 items-center gap-2 rounded-full border border-line px-3.5"
            aria-label={`Carrito: ${cart.count} hamburguesas, ${money(cart.total)}`}
          >
            <ShoppingCart className="size-6" />
            <span className="absolute -top-1.5 left-6 grid min-w-5 place-items-center rounded-full bg-red px-1 text-[11px] font-bold">{cart.count}</span>
            <span className="hidden font-display text-base font-bold tabular-nums lg:inline">{money(cart.total)}</span>
          </button>
          <button type="button" aria-label="Mi cuenta" onClick={() => soon("Mi cuenta")} className="grid size-11 place-items-center rounded-full bg-panel-2">
            <User className="size-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------- pestañas móviles y menú lateral ---------- */
function useOpenSection() {
  const setSection = useBurger((s) => s.setSection);
  return useCallback(
    (id: Section) => {
      setSection(id);
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    [setSection],
  );
}

function MobileTabs() {
  const section = useBurger((s) => s.section);
  const open = useOpenSection();
  return (
    <nav aria-label="Categorías" className="no-scrollbar flex gap-2 overflow-x-auto px-3 pt-3 lg:hidden">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={section === s.id}
          onClick={() => open(s.id)}
          className="flex min-w-[78px] flex-col border border-line bg-panel items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:text-[#1b1208]"
        >
          <s.icon className="size-6" />
          {s.label}
        </button>
      ))}
    </nav>
  );
}

function Sidebar() {
  const section = useBurger((s) => s.section);
  const protein = useBurger((s) => s.protein);
  const open = useOpenSection();
  const P = PROTEINS[protein];
  return (
    <aside className="hidden flex-col gap-4 lg:flex">
      <nav aria-label="Categorías" className="card flex flex-col gap-1 rounded-2xl p-3">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={section === s.id}
            onClick={() => open(s.id)}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-left font-display text-[17px] font-bold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:text-[#1b1208] ${i ? "border-t border-line/60 aria-pressed:border-transparent" : ""}`}
          >
            <s.icon className="size-6 shrink-0" />
            {s.label}
          </button>
        ))}
      </nav>
      <div className="relative overflow-hidden rounded-2xl border border-line p-4 [background:radial-gradient(120%_80%_at_80%_100%,#ff6a00_0%,#b3260b_35%,#2a120b_75%)]">
        <Crown className="size-8 text-gold" />
        <p className="relative z-10 mt-1 font-display text-2xl font-extrabold leading-tight">{P.name}</p>
        <p className="relative z-10 mt-2 max-w-[62%] border-t border-gold/60 pt-2 text-sm text-ink/85">{P.promo}</p>
        <Image src={thumb("protein", protein)} alt="" width={120} height={120} className="absolute -bottom-8 -right-10 drop-shadow-2xl" />
      </div>
    </aside>
  );
}

/* ---------- escenario 3D ---------- */
function Stage() {
  const { exploded, spinning, setExploded, setSpinning, turn360 } = useBurger();
  const { g, kcal, layers } = useTotals();
  const { active, progress } = useProgress();
  const ref = useRef<HTMLElement>(null);
  const fullscreen = () => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };
  return (
    <section ref={ref} aria-label="Tu hamburguesa en 3D" className="stage-bg relative h-[500px] overflow-hidden rounded-2xl border border-line lg:h-[680px]">
      <NeonBurger className="pointer-events-none absolute right-[4%] top-[4%] w-28 opacity-90 lg:w-48" />
      <BurgerScene />
      <div className="pointer-events-none absolute left-4 top-4 max-w-[64%] lg:left-8 lg:top-7 lg:max-w-[52%]">
        <h1 className="whitespace-nowrap font-display text-[28px] font-extrabold leading-none lg:text-[44px]">Tu Hamburguesa</h1>
        <p className="-mt-0.5 -rotate-3 font-script text-[38px] leading-tight text-gold lg:text-[62px]">Personalizada</p>
        <p className="mt-2 text-sm text-ink/85 lg:text-lg">Crea tu combinación perfecta con ingredientes premium.</p>
      </div>
      <dl className="absolute left-4 top-[170px] flex flex-col gap-2 lg:left-8 lg:top-[270px] lg:gap-3">
        <Stat icon={Layers} value={String(layers)} label="Capas" />
        <Stat icon={Scale} value={`≈ ${g} g`} label="Peso aprox." />
        <Stat icon={Flame} value={kcal.toLocaleString("es")} label="Kcal" />
      </dl>
      <div className="absolute inset-x-0 bottom-4 flex items-center justify-start gap-1.5 pl-4 pr-16 sm:justify-center sm:gap-2 lg:bottom-6 lg:gap-3">
        <Ctl onClick={turn360} label="Dar una vuelta de 360 grados">
          <span className="font-display text-sm font-bold">360°</span>
        </Ctl>
        <Ctl pressed={exploded} onClick={() => setExploded(!exploded)} label="Vista por capas">
          <Layers className="size-5" />
          <span className="sm:hidden">Capas</span>
          <span className="max-sm:hidden">Vista por capas</span>
        </Ctl>
        <Ctl pressed={spinning} onClick={() => setSpinning(!spinning)} label="Girar">
          <RotateCw className="size-5" />
          <span>Girar</span>
        </Ctl>
      </div>
      <button type="button" onClick={fullscreen} aria-label="Pantalla completa" className="absolute bottom-4 right-4 grid size-11 place-items-center rounded-xl border border-white/20 bg-black/40 lg:bottom-6 lg:right-6">
        <Maximize className="size-5" />
      </button>
      {active && (
        <p className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-muted">
          Cargando modelos {Math.round(progress)} %
        </p>
      )}
    </section>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex min-w-[118px] items-center gap-2.5 rounded-xl border border-white/25 bg-black/35 px-3 py-1.5 backdrop-blur-sm lg:min-w-[150px] lg:py-2">
      <Icon className="size-6 shrink-0 lg:size-7" strokeWidth={1.6} />
      <div className="flex flex-col">
        <dd className="order-1 whitespace-nowrap font-display text-base font-bold tabular-nums lg:text-xl">{value}</dd>
        <dt className="order-2 text-xs text-ink/80">{label}</dt>
      </div>
    </div>
  );
}

function Ctl({ pressed, onClick, label, children }: { pressed?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 bg-black/45 px-3 text-sm sm:gap-2 sm:px-4 font-semibold backdrop-blur-sm hover:border-gold aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:text-[#1b1208] lg:px-5"
    >
      {children}
    </button>
  );
}

/* ---------- panel de ingredientes ---------- */
function IngredientPanel() {
  const activePreset = useBurger((s) => s.activePreset);
  const applyPreset = useBurger((s) => s.applyPreset);
  return (
    <section aria-label="Elige tus ingredientes" className="card flex flex-col rounded-2xl lg:max-h-[680px]">
      <div className="px-4 pb-3 pt-4 lg:px-5">
        <h2 className="flex items-center gap-2.5 font-display text-[22px] font-extrabold lg:text-[26px]">
          <Layers className="size-8 text-gold" />
          Elige tus ingredientes
        </h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Combos">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              aria-pressed={activePreset === p.name}
              onClick={() => applyPreset(p.name)}
              className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium hover:border-gold aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:font-semibold aria-pressed:text-[#1b1208]"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 lg:px-5">
        <BaseRow />
        <CarneRow />
        {CATALOG.filter((c) => c.id !== "carne").map((c) => (
          <CategoryRow key={c.id} id={c.id} items={c.items} />
        ))}
      </div>
    </section>
  );
}

function RowShell({ id, open, summary, children }: { id: Section; open: boolean; summary: React.ReactNode; children?: React.ReactNode }) {
  const setSection = useBurger((s) => s.setSection);
  const S = SECTIONS.find((s) => s.id === id)!;
  return (
    <div id={`sec-${id}`} className="scroll-mt-24 border-t border-line py-2.5">
      <div className="grid grid-cols-[84px_48px_minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2 sm:grid-cols-[104px_60px_minmax(0,1fr)_auto]">
        <button type="button" onClick={() => setSection(open ? null : id)} className="flex items-center gap-2 text-left font-display text-[15px] font-bold sm:text-base" aria-expanded={open}>
          <S.icon className="size-5 shrink-0 text-gold" />
          {S.label}
        </button>
        {summary}
        <button
          type="button"
          onClick={() => setSection(open ? null : id)}
          aria-label={open ? `Cerrar ${S.label}` : `Ver todo en ${S.label}`}
          className="grid size-8 place-items-center rounded-full hover:bg-panel-2"
        >
          <ChevronRight className={`size-5 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
      </div>
      {open && children && <div className="mt-2 rounded-xl bg-black/25 p-2">{children}</div>}
    </div>
  );
}

function Thumb({ src, size = 56 }: { src: string; size?: number }) {
  return <Image src={src} alt="" width={size} height={size} className="mx-auto object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]" style={{ width: size, height: size }} />;
}

function Summary({ name, note, control }: { name: string; note?: string; control?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate font-display text-[15px] font-semibold leading-tight">{name}</p>
        {note && <p className="truncate text-xs text-muted">{note}</p>}
      </div>
      {control}
    </div>
  );
}

function BaseRow() {
  const open = useBurger((s) => s.section === "base");
  return (
    <RowShell
      id="base"
      open={open}
      summary={
        <>
          <Thumb src="/thumbs/bun.webp" />
          <Summary name={BUN.name} note={BUN.note} control={<Check className="size-6 shrink-0 rounded-full bg-ok p-1 text-white" strokeWidth={3} aria-label="Incluido" />} />
        </>
      }
    />
  );
}

function CarneRow() {
  const { protein, doneness, setProtein, setDoneness } = useBurger();
  const open = useBurger((s) => s.section === "carne");
  const P = PROTEINS[protein];
  const extra = CATALOG.find((c) => c.id === "carne")!.items[0];
  return (
    <>
      <RowShell
        id="carne"
        open={open}
        summary={
          <>
            <Thumb src={thumb("protein", protein)} />
            <Summary name={P.name} note={P.note + (P.surcharge ? ` · +${money(P.surcharge)}` : "")} />
          </>
        }
      >
        <div role="group" aria-label="Proteína" className="grid grid-cols-3 gap-2">
          {(Object.keys(PROTEINS) as ProteinId[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={protein === k}
              onClick={() => setProtein(k)}
              className="flex flex-col items-center rounded-xl border border-line px-1 pb-2 pt-1 text-xs font-semibold aria-pressed:border-gold aria-pressed:bg-gold/15"
            >
              <Thumb src={thumb("protein", k)} size={56} />
              {PROTEINS[k].label}
            </button>
          ))}
        </div>
        <ItemRow item={extra} />
      </RowShell>
      {protein === "angus" && (
        <div role="group" aria-label="Término de la carne" className="-mt-1 mb-2 ml-auto flex w-full max-w-[330px] gap-1.5 sm:mr-10">
          {DONENESS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={doneness === d}
              onClick={() => setDoneness(d)}
              className="flex-1 rounded-full border border-line px-2 py-1.5 text-[13px] aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:font-semibold aria-pressed:text-[#1b1208]"
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function CategoryRow({ id, items }: { id: Section; items: Item[] }) {
  const qty = useBurger((s) => s.qty);
  const open = useBurger((s) => s.section === id);
  const protein = useBurger((s) => s.protein);
  const chosen = items.filter((i) => qty[i.id]);
  const first = chosen[0];
  const S = SECTIONS.find((s) => s.id === id)!;
  return (
    <RowShell
      id={id}
      open={open}
      summary={
        first ? (
          <>
            <Thumb src={thumb(first.id, protein)} />
            <Summary
              name={first.name}
              note={chosen.length > 1 ? `+${chosen.length - 1} más · ${chosen.slice(1).map((c) => c.name).join(", ")}` : [first.note, priceLabel(first, protein)].filter(Boolean).join(" · ")}
              control={<Control item={first} />}
            />
          </>
        ) : (
          <>
            <span className="grid size-13 place-items-center rounded-xl border border-dashed border-line text-muted">
              <S.icon className="size-6" />
            </span>
            <Summary name={`Sin ${S.label.toLowerCase()}`} note="Toca la flecha para elegir" />
          </>
        )
      }
    >
      {items.map((it) => (
        <ItemRow key={it.id} item={it} />
      ))}
    </RowShell>
  );
}

function ItemRow({ item }: { item: Item }) {
  const protein = useBurger((s) => s.protein);
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2.5 px-1 py-1.5 [&+&]:border-t [&+&]:border-line/60">
      <Thumb src={thumb(item.id, protein)} size={50} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        <p className="truncate text-xs text-muted">{[item.note, priceLabel(item, protein)].filter(Boolean).join(" · ")}</p>
      </div>
      <Control item={item} />
    </div>
  );
}

function priceLabel(it: Item, protein: ProteinId) {
  const p = it.id === "patty_x" ? it.price + PROTEINS[protein].surcharge : it.price;
  return p ? `+${money(p)}` : "Sin costo";
}

function Control({ item }: { item: Item }) {
  return item.max > 1 ? <Stepper item={item} /> : <Switch item={item} />;
}

function Stepper({ item }: { item: Item }) {
  const n = useBurger((s) => s.qty[item.id] ?? 0);
  const setQty = useBurger((s) => s.setQty);
  const btn = "grid size-7 place-items-center rounded-full bg-panel-2 text-xl leading-none hover:bg-line disabled:opacity-35";
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-line p-0.5">
      <button type="button" className={btn} aria-label={`Quitar ${item.name}`} disabled={n <= 0} onClick={() => setQty(item.id, n - 1)}>
        −
      </button>
      <output className="w-5 text-center font-display text-base font-bold tabular-nums" aria-live="polite">
        {n}
      </output>
      <button type="button" className={btn} aria-label={`Añadir ${item.name}`} disabled={n >= item.max} onClick={() => setQty(item.id, n + 1)}>
        +
      </button>
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
      className="relative h-7 w-12 shrink-0 rounded-full bg-panel-2 ring-1 ring-line transition-colors aria-checked:bg-gold aria-checked:ring-gold"
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

/* ---------- selección, total y menú inferior ---------- */
function SelectionBar() {
  const qty = useBurger((s) => s.qty);
  const protein = useBurger((s) => s.protein);
  const open = useOpenSection();
  const { g, kcal, layers } = useTotals();
  const parts = useMemo(() => {
    const ids = ["bun", "protein", ...Object.keys(qty).filter((k) => k !== "patty_x" && ITEMS[k])];
    return ids.map((id) => ({ id, src: thumb(id, protein), name: id === "bun" ? BUN.name : id === "protein" ? PROTEINS[protein].name : ITEMS[id].name }));
  }, [qty, protein]);
  return (
    <section aria-label="Tu selección" className="card hidden items-center gap-5 rounded-2xl px-5 py-3 lg:col-span-2 lg:flex">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Layers className="size-6 text-gold" />
          Tu selección ({layers} capas)
        </p>
        <ul className="no-scrollbar mt-1.5 flex items-center gap-1.5 overflow-x-auto">
          {parts.map((p) => (
            <li key={p.id} title={p.name} className="shrink-0">
              <Thumb src={p.src} size={60} />
              <span className="sr-only">{p.name}</span>
            </li>
          ))}
          <li className="shrink-0">
            <button type="button" onClick={() => open("extras")} aria-label="Añadir más ingredientes" className="ml-1 grid size-8 place-items-center rounded-full border border-line hover:border-gold">
              +
            </button>
          </li>
        </ul>
      </div>
      <div className="flex shrink-0 items-center gap-4 border-l border-line pl-5">
        <MiniStat icon={Scale} value={`≈ ${g} g`} label="Peso aprox." />
        <MiniStat icon={Flame} value={kcal.toLocaleString("es")} label="Kcal" />
      </div>
    </section>
  );
}

function MiniStat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-7 text-gold" strokeWidth={1.7} />
      <div>
        <p className="font-display text-lg font-bold tabular-nums leading-tight">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function TotalCard({ className = "flex" }: { className?: string }) {
  const { price } = useTotals();
  const add = useAddToCart();
  return (
    <div className={`gold-grad items-center gap-3 rounded-2xl p-3 shadow-[0_10px_30px_-10px_rgba(255,170,0,0.5)] lg:p-4 ${className}`}>
      <div className="min-w-[96px] pl-1 lg:pl-3">
        <p className="text-sm font-semibold lg:text-lg">Total</p>
        <p className="font-display text-[28px] font-black tabular-nums leading-none lg:text-[34px]" aria-live="polite">
          {money(price)}
        </p>
      </div>
      <button
        type="button"
        onClick={add}
        className="red-grad flex flex-1 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl py-3.5 font-display text-lg font-bold shadow-lg hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:py-4 lg:text-xl"
      >
        <ShoppingCart className="size-6 lg:size-7" />
        Agregar al carrito
      </button>
    </div>
  );
}

function BottomNav() {
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-line bg-bg/95 backdrop-blur lg:hidden">
      {NAV.map((n, i) => (
        <button
          key={n.short}
          type="button"
          aria-current={i === 0 ? "page" : undefined}
          onClick={() => (i === 0 ? window.scrollTo({ top: 0, behavior: "smooth" }) : soon(n.label))}
          className="relative flex flex-col items-center justify-center gap-0.5 text-xs text-ink/85 aria-[current=page]:text-gold"
        >
          <n.icon className="size-6" />
          {n.short}
          {i === 0 && <span className="absolute bottom-1 h-1 w-14 rounded-full bg-gold" />}
        </button>
      ))}
    </nav>
  );
}
