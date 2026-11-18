"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useProgress } from "@react-three/drei";
import {
  Beef,
  Check,
  CirclePlus,
  CupSoda,
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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUN,
  DRINKS,
  DRINK_PRICE,
  CATALOG,
  DONENESS,
  PRESETS,
  PROTEINS,
  money,
  stackOrder,
  thumb,
  totals,
  type DrinkId,
  type Item,
  type ProteinId,
} from "@/lib/catalog";
import { useBurger, type Section } from "@/lib/store";
import { CanArt, FriesArt, Logo, NeonBurger, SauceBottle } from "./Brand";

const BurgerScene = dynamic(() => import("./BurgerScene"), { ssr: false });

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "base", label: "Base", icon: Hamburger },
  { id: "carne", label: "Carne", icon: Beef },
  { id: "quesos", label: "Quesos", icon: Cheese },
  { id: "vegetales", label: "Vegetales", icon: Leaf },
  { id: "salsas", label: "Salsas", icon: Soup },
  { id: "extras", label: "Extras", icon: CirclePlus },
  { id: "bebida", label: "Bebida del combo", icon: CupSoda },
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
    <p
      role="status"
      className="fixed left-1/2 top-16 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-line bg-panel px-4 py-3 text-center text-sm shadow-2xl"
    >
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
  const drink = useBurger((s) => s.drink);
  const count = useBurger((s) => s.count);
  /** precio de un combo: hamburguesa + papas (incluidas) + bebida */
  const unit = t.price + (drink ? DRINK_PRICE : 0);
  return { ...t, layers, unit, count, total: unit * count };
}

function useAddToCart() {
  const add = useBurger((s) => s.addToCart);
  const protein = useBurger((s) => s.protein);
  const doneness = useBurger((s) => s.doneness);
  const { unit, total, count } = useTotals();
  return () => {
    add(unit);
    const how =
      protein === "angus"
        ? `Angus, ${doneness.toLowerCase()}`
        : PROTEINS[protein].label.toLowerCase();
    const what = count > 1 ? `${count} hamburguesas` : "Tu hamburguesa";
    showToast(
      `¡A la plancha! ${what} (${how}) con papas fritas por ${money(total)}.`,
    );
  };
}

export default function Configurator() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <main className="mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,50fr)_minmax(0,50fr)] gap-2 px-2 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(330px,370px)] lg:grid-rows-1 lg:gap-3 lg:px-3 lg:py-3">
        <Stage />
        <IngredientPanel />
      </main>
      <BottomNav />
      <Toast />
    </div>
  );
}

/* ---------- cabecera ---------- */
function Header() {
  const cart = useBurger((s) => s.cart);
  return (
    <header className="relative z-40 shrink-0 border-b-2 border-red/80 bg-bg">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-2.5 lg:h-16 lg:px-3">
        <button
          type="button"
          className="grid size-10 place-items-center lg:hidden"
          aria-label="Abrir menú"
          onClick={() => soon("Menú")}
        >
          <Menu className="size-6" />
        </button>
        <Logo compact />
        <nav
          aria-label="Principal"
          className="hidden h-full items-stretch gap-6 lg:flex"
        >
          {NAV.map((n, i) => (
            <button
              key={n.label}
              type="button"
              aria-current={i === 0 ? "page" : undefined}
              onClick={() => (i === 0 ? undefined : soon(n.label))}
              className="relative flex items-center gap-2 text-sm font-medium text-ink/90 hover:text-gold aria-[current=page]:text-ink"
            >
              <n.icon className={`size-4 ${i === 0 ? "text-gold" : ""}`} />
              {n.label}
              {i === 0 && (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-gold" />
              )}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => soon("Carrito")}
            className="relative flex h-9 items-center gap-2 rounded-full border border-line px-3"
            aria-label={`Carrito: ${cart.count} hamburguesas, ${money(cart.total)}`}
          >
            <ShoppingCart className="size-5" />
            <span className="absolute -top-1.5 left-5 grid min-w-5 place-items-center rounded-full bg-red px-1 text-[11px] font-bold">
              {cart.count}
            </span>
            <span className="hidden font-display text-sm font-bold tabular-nums lg:inline">
              {money(cart.total)}
            </span>
          </button>
          <button
            type="button"
            aria-label="Mi cuenta"
            onClick={() => soon("Mi cuenta")}
            className="grid size-9 place-items-center rounded-full bg-panel-2"
          >
            <User className="size-5" />
          </button>
        </div>
      </div>
    </header>
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
    <section
      ref={ref}
      aria-label="Tu hamburguesa en 3D"
      className="stage-bg relative h-full min-h-0 overflow-hidden rounded-2xl border border-line"
    >
      <NeonBurger className="pointer-events-none absolute right-[3%] top-[3%] w-28 opacity-90 max-lg:hidden" />
      <BurgerScene />
      <div className="pointer-events-none absolute left-3 top-2.5 max-w-[70%] lg:left-5 lg:top-4">
        <h1 className="whitespace-nowrap font-display text-lg font-extrabold leading-none lg:text-[26px]">
          Tu Hamburguesa
        </h1>
        <p className="-rotate-3 font-script text-2xl leading-tight text-gold lg:text-[36px]">
          Personalizada
        </p>
        <p className="mt-0.5 hidden text-[13px] text-ink/80 sm:block">
          Crea tu combinación perfecta con ingredientes premium.
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-black/40 py-0.5 pl-1 pr-2.5 text-[11px] font-semibold text-gold backdrop-blur-sm lg:text-xs">
          <FriesArt className="size-5" />
          Incluye papas fritas
        </p>
      </div>
      <dl className="absolute left-3 top-[104px] flex flex-col gap-1.5 max-lg:[@media(max-height:760px)]:hidden lg:left-5 lg:top-[170px]">
        <Stat icon={Layers} value={String(layers)} label="Capas" />
        <Stat icon={Scale} value={`≈ ${g} g`} label="Peso aprox." />
        <Stat icon={Flame} value={kcal.toLocaleString("es")} label="Kcal" />
      </dl>
      <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5 lg:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:gap-2">
        <Ctl onClick={turn360} label="Dar una vuelta de 360 grados">
          <span className="font-display text-[11px] font-bold">360°</span>
        </Ctl>
        <Ctl
          pressed={exploded}
          onClick={() => setExploded(!exploded)}
          label="Vista por capas"
        >
          <Layers className="size-4" />
        </Ctl>
        <Ctl
          pressed={spinning}
          onClick={() => setSpinning(!spinning)}
          label="Girar"
        >
          <RotateCw className="size-4" />
        </Ctl>
        <Ctl onClick={fullscreen} label="Pantalla completa">
          <Maximize className="size-4" />
        </Ctl>
      </div>
      {active && (
        <p className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-muted">
          Cargando modelos {Math.round(progress)} %
        </p>
      )}
      <OrderBar />
    </section>
  );
}

function OrderBar() {
  const { total, count, unit } = useTotals();
  const setCount = useBurger((s) => s.setCount);
  const drink = useBurger((s) => s.drink);
  const add = useAddToCart();
  const btn =
    "grid size-8 place-items-center rounded-lg text-lg leading-none hover:bg-white/10 disabled:opacity-30";
  return (
    <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/60 p-1.5 backdrop-blur-md lg:inset-x-auto lg:bottom-4 lg:left-1/2 lg:w-[min(560px,calc(100%-2rem))] lg:-translate-x-1/2 lg:gap-3">
      <div
        className="flex shrink-0 items-center rounded-xl bg-white/8 p-0.5"
        role="group"
        aria-label="Cantidad de hamburguesas"
      >
        <button
          type="button"
          className={btn}
          aria-label="Una hamburguesa menos"
          disabled={count <= 1}
          onClick={() => setCount(count - 1)}
        >
          −
        </button>
        <output
          className="w-6 text-center font-display text-base font-bold tabular-nums"
          aria-live="polite"
        >
          {count}
        </output>
        <button
          type="button"
          className={btn}
          aria-label="Una hamburguesa más"
          disabled={count >= 10}
          onClick={() => setCount(count + 1)}
        >
          +
        </button>
      </div>
      <div className="min-w-[64px] shrink-0">
        <p className="truncate text-[10px] text-muted lg:text-[11px]">
          {count > 1
            ? `${count} × ${money(unit)}`
            : drink
              ? "Combo con bebida"
              : "Con papas fritas"}
        </p>
        <p
          className="font-display text-lg font-black leading-none text-gold tabular-nums lg:text-[22px]"
          aria-live="polite"
        >
          {money(total)}
        </p>
      </div>
      <button
        type="button"
        onClick={add}
        className="red-grad ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 font-display text-xs font-bold min-[401px]:px-3 min-[401px]:text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:h-11 lg:px-4 lg:text-sm"
      >
        <Flame className="size-4 max-[400px]:hidden lg:size-5" />
        Agregar a la plancha
      </button>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-w-[96px] items-center gap-2 rounded-lg border border-white/20 bg-black/35 px-2 py-1 backdrop-blur-sm lg:min-w-[124px] lg:px-2.5 lg:py-1.5">
      <Icon className="size-4 shrink-0 lg:size-5" strokeWidth={1.7} />
      <div className="flex flex-col">
        <dd className="order-1 whitespace-nowrap font-display text-sm font-bold tabular-nums leading-tight lg:text-base">
          {value}
        </dd>
        <dt className="order-2 text-[10px] text-ink/75 lg:text-[11px]">
          {label}
        </dt>
      </div>
    </div>
  );
}

function Ctl({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm hover:border-gold aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:text-[#1b1208]"
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
    <section
      aria-label="Elige tus ingredientes"
      className="card flex min-h-0 flex-1 flex-col rounded-2xl"
    >
      <div className="shrink-0 px-3 pb-2 pt-2.5 lg:px-4 lg:pt-3.5">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold lg:text-lg">
          <Layers className="size-5 text-gold" />
          Elige tus ingredientes
        </h2>
        <div
          className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto"
          role="group"
          aria-label="Combos"
        >
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              aria-pressed={activePreset === p.name}
              onClick={() => applyPreset(p.name)}
              className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:border-gold aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:font-semibold aria-pressed:text-[#1b1208]"
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1 text-[11px] text-muted">
          <Check
            className="size-3.5 shrink-0 rounded-full bg-ok p-0.5 text-white"
            strokeWidth={3}
          />
          Siempre incluye{" "}
          <b className="font-semibold text-ink">{BUN.name.toLowerCase()}</b> y{" "}
          <b className="font-semibold text-ink">papas fritas</b>
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 lg:px-4">
        <CarneGroup />
        {CATALOG.filter((c) => c.id !== "carne").map((c) => (
          <Group key={c.id} id={c.id} count={c.items.length}>
            {c.items.map((it) => (
              <ItemTile key={it.id} item={it} />
            ))}
          </Group>
        ))}
        <BebidaGroup />
      </div>
    </section>
  );
}

function Group({
  id,
  children,
  extra,
  count,
}: {
  id: Section;
  children: React.ReactNode;
  extra?: React.ReactNode;
  count?: number;
}) {
  const S = SECTIONS.find((s) => s.id === id)!;
  const qty = useBurger((s) => s.qty);
  const picked =
    CATALOG.find((c) => c.id === id)?.items.filter((i) => qty[i.id]).length ??
    0;
  return (
    <section
      aria-label={S.label}
      className="border-t border-line pb-2.5 pt-2 first:border-t-0 first:pt-0"
    >
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        <S.icon className="size-3.5 text-gold" />
        {S.label}
        {count ? (
          <span className="ml-auto font-medium normal-case tracking-normal">
            {picked ? `${picked} elegido${picked > 1 ? "s" : ""}` : "Opcional"}
          </span>
        ) : null}
      </h3>
      <div className="grid grid-cols-4 gap-1.5">
        {children}
      </div>
      {extra}
    </section>
  );
}

const tileCls =
  "relative flex min-w-0 flex-col items-center justify-between rounded-xl border px-1 pb-1 pt-1 text-center transition-colors";
const tileOn = "border-gold bg-gold/10";
const tileOff = "border-line bg-black/20 hover:border-gold/60";

function Tick() {
  return (
    <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-gold text-[#1b1208]">
      <Check className="size-3" strokeWidth={3.5} />
    </span>
  );
}

function TileText({ name, sub }: { name: string; sub?: string }) {
  return (
    <>
      <span className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight">
        {name}
      </span>
      {sub && (
        <span className="mt-auto text-[10px] leading-tight text-muted">{sub}</span>
      )}
    </>
  );
}

function ItemTile({ item }: { item: Item }) {
  const protein = useBurger((s) => s.protein);
  const n = useBurger((s) => s.qty[item.id] ?? 0);
  const setQty = useBurger((s) => s.setQty);
  const on = n > 0;
  const art =
    item.id in SAUCE_BOTTLE ? (
      <SauceBottle
        color={item.swatch}
        cap={SAUCE_BOTTLE[item.id]}
        className="size-9"
      />
    ) : (
      <Thumb src={thumb(item.id, protein)} size={36} />
    );
  return (
    <div className={`${tileCls} ${on ? tileOn : tileOff}`}>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setQty(item.id, on ? 0 : 1)}
        className="flex w-full flex-1 flex-col items-center"
        aria-label={`${item.name}${on ? ", elegido" : ""}`}
      >
        {art}
        <TileText
          name={item.name}
          sub={on && item.max > 1 ? undefined : priceLabel(item, protein)}
        />
      </button>
      {on && item.max > 1 && (
        <div className="mt-0.5 flex items-center gap-1">
          <button
            type="button"
            aria-label={`Quitar ${item.name}`}
            onClick={() => setQty(item.id, n - 1)}
            className="grid size-5 place-items-center rounded-full bg-panel-2 text-xs leading-none hover:bg-line"
          >
            −
          </button>
          <output className="w-3 text-center text-[11px] font-bold tabular-nums">
            {n}
          </output>
          <button
            type="button"
            aria-label={`Añadir ${item.name}`}
            disabled={n >= item.max}
            onClick={() => setQty(item.id, n + 1)}
            className="grid size-5 place-items-center rounded-full bg-panel-2 text-xs leading-none hover:bg-line disabled:opacity-30"
          >
            +
          </button>
        </div>
      )}
      {on && <Tick />}
    </div>
  );
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  names,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  names?: Record<T, string>;
}) {
  return (
    <div role="group" aria-label={label} className="mt-1.5 flex gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className="flex-1 whitespace-nowrap rounded-full border border-line px-1.5 py-1 text-[11px] aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:font-semibold aria-pressed:text-[#1b1208]"
        >
          {names ? names[o] : o}
        </button>
      ))}
    </div>
  );
}

function CarneGroup() {
  const { protein, doneness, setProtein, setDoneness } = useBurger();
  const extra = CATALOG.find((c) => c.id === "carne")!.items[0];
  return (
    <Group
      id="carne"
      extra={
        protein === "angus" && (
          <Chips
            label="Término de la carne"
            options={DONENESS}
            value={doneness}
            onChange={setDoneness}
          />
        )
      }
    >
      {(Object.keys(PROTEINS) as ProteinId[]).map((k) => {
        const P = PROTEINS[k];
        const on = protein === k;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => setProtein(k)}
            className={`${tileCls} ${on ? tileOn : tileOff}`}
          >
            <Thumb src={thumb("protein", k)} size={36} />
            <TileText
              name={
                k === "angus"
                  ? "Angus 250 g"
                  : k === "grilled"
                    ? "Pollo plancha"
                    : "Pollo crispy"
              }
              sub={P.surcharge ? `+${money(P.surcharge)}` : "Incluido"}
            />
            {on && <Tick />}
          </button>
        );
      })}
      <ItemTile item={{ ...extra, name: "Doble carne" }} />
    </Group>
  );
}

function BebidaGroup() {
  const { drink, drinkVariant, setDrink, setDrinkVariant } = useBurger();
  return (
    <Group
      id="bebida"
      extra={
        drink && (
          <Chips
            label="Tipo de bebida"
            options={["normal", "zero"] as const}
            value={drinkVariant}
            onChange={setDrinkVariant}
            names={{ normal: "Normal", zero: "Zero azúcar" }}
          />
        )
      }
    >
      {([null, "coca", "sprite"] as (DrinkId | null)[]).map((k) => {
        const on = drink === k;
        return (
          <button
            key={k ?? "none"}
            type="button"
            aria-pressed={on}
            onClick={() => setDrink(k)}
            className={`${tileCls} ${on ? tileOn : tileOff}`}
          >
            {k ? (
              <CanArt
                color={DRINKS[k].color}
                zero={drinkVariant === "zero"}
                className="size-9"
              />
            ) : (
              <span className="grid size-9 place-items-center text-muted">
                <CupSoda className="size-5" />
              </span>
            )}
            <TileText
              name={k ? DRINKS[k].name : "Sin bebida"}
              sub={k ? `+${money(DRINK_PRICE)}` : "—"}
            />
            {on && <Tick />}
          </button>
        );
      })}
    </Group>
  );
}

/** color de la tapa de cada bote de salsa */
const SAUCE_BOTTLE: Record<string, string> = {
  house: "#f3ead9",
  ketchup: "#f4f1ec",
  mustard: "#c8161d",
  bbq: "#1b1b1b",
};

function Thumb({ src, size = 44 }: { src: string; size?: number }) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="mx-auto object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
      style={{ width: size, height: size }}
    />
  );
}

function priceLabel(it: Item, protein: ProteinId) {
  const p =
    it.id === "patty_x" ? it.price + PROTEINS[protein].surcharge : it.price;
  return p ? `+${money(p)}` : "Gratis";
}

/* ---------- menú inferior móvil ---------- */
function BottomNav() {
  return (
    <nav
      aria-label="Principal"
      className="grid h-14 shrink-0 grid-cols-4 border-t border-line bg-bg lg:hidden"
    >
      {NAV.map((n, i) => (
        <button
          key={n.short}
          type="button"
          aria-current={i === 0 ? "page" : undefined}
          onClick={() => (i === 0 ? undefined : soon(n.label))}
          className="relative flex flex-col items-center justify-center gap-0.5 text-[11px] text-ink/85 aria-[current=page]:text-gold"
        >
          <n.icon className="size-5" />
          {n.short}
          {i === 0 && (
            <span className="absolute bottom-1 h-1 w-14 rounded-full bg-gold" />
          )}
        </button>
      ))}
    </nav>
  );
}
