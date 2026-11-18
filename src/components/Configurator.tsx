"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useProgress } from "@react-three/drei";
import {
  Beef,
  Check,
  ChevronRight,
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
  FRIES,
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
import { CanArt, FriesArt, Logo, NeonBurger } from "./Brand";

const BurgerScene = dynamic(() => import("./BurgerScene"), { ssr: false });

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "base", label: "Base", icon: Hamburger },
  { id: "carne", label: "Carne", icon: Beef },
  { id: "quesos", label: "Quesos", icon: Cheese },
  { id: "vegetales", label: "Vegetales", icon: Leaf },
  { id: "salsas", label: "Salsas", icon: Soup },
  { id: "extras", label: "Extras", icon: CirclePlus },
  { id: "papas", label: "Papas", icon: Hamburger },
  { id: "bebida", label: "Bebida", icon: CupSoda },
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
          className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto lg:flex-wrap"
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
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 lg:px-4">
        <BaseRow />
        <CarneRow />
        {CATALOG.filter((c) => c.id !== "carne").map((c) => (
          <CategoryRow key={c.id} id={c.id} items={c.items} />
        ))}
        <PapasRow />
        <BebidaRow />
      </div>
    </section>
  );
}

function RowShell({
  id,
  open,
  summary,
  children,
}: {
  id: Section;
  open: boolean;
  summary: React.ReactNode;
  children?: React.ReactNode;
}) {
  const setSection = useBurger((s) => s.setSection);
  const S = SECTIONS.find((s) => s.id === id)!;
  return (
    <div id={`sec-${id}`} className="scroll-mt-2 border-t border-line py-1.5">
      <div className="grid grid-cols-[84px_44px_minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setSection(open ? null : id)}
          className="flex items-center gap-1.5 text-left font-display text-sm font-bold"
          aria-expanded={open}
        >
          <S.icon className="size-4 shrink-0 text-gold" />
          {S.label}
        </button>
        {summary}
        {children ? (
          <button
            type="button"
            onClick={() => setSection(open ? null : id)}
            aria-label={open ? `Cerrar ${S.label}` : `Ver todo en ${S.label}`}
            className="grid size-7 place-items-center rounded-full hover:bg-panel-2"
          >
            <ChevronRight
              className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="size-7" />
        )}
      </div>
      {open && children && (
        <div className="mt-1.5 rounded-xl bg-black/25 p-1.5">{children}</div>
      )}
    </div>
  );
}

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

function Summary({
  name,
  note,
  control,
}: {
  name: string;
  note?: string;
  control?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-tight">
          {name}
        </p>
        {note && <p className="truncate text-[11px] text-muted">{note}</p>}
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
          <Summary
            name={BUN.name}
            note={BUN.note}
            control={
              <Check
                className="size-5 shrink-0 rounded-full bg-ok p-1 text-white"
                strokeWidth={3}
                aria-label="Incluido"
              />
            }
          />
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
            <Summary
              name={P.name}
              note={P.note + (P.surcharge ? ` · +${money(P.surcharge)}` : "")}
            />
          </>
        }
      >
        <div
          role="group"
          aria-label="Proteína"
          className="grid grid-cols-3 gap-2"
        >
          {(Object.keys(PROTEINS) as ProteinId[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={protein === k}
              onClick={() => setProtein(k)}
              className="flex flex-col items-center rounded-xl border border-line px-1 pb-2 pt-1 text-xs font-semibold aria-pressed:border-gold aria-pressed:bg-gold/15"
            >
              <Thumb src={thumb("protein", k)} size={44} />
              {PROTEINS[k].label}
            </button>
          ))}
        </div>
        <ItemRow item={extra} />
      </RowShell>
      {protein === "angus" && (
        <div
          role="group"
          aria-label="Término de la carne"
          className="-mt-0.5 mb-1.5 flex w-full gap-1.5 pl-[90px] pr-8"
        >
          {DONENESS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={doneness === d}
              onClick={() => setDoneness(d)}
              className="flex-1 whitespace-nowrap rounded-full border border-line px-1.5 py-1 text-[11px] aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:font-semibold aria-pressed:text-[#1b1208]"
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function PapasRow() {
  return (
    <RowShell
      id="papas"
      open={false}
      summary={
        <>
          <FriesArt className="mx-auto size-11" />
          <Summary
            name={FRIES.name}
            note={FRIES.note}
            control={
              <Check
                className="size-5 shrink-0 rounded-full bg-ok p-1 text-white"
                strokeWidth={3}
                aria-label="Incluidas"
              />
            }
          />
        </>
      }
    />
  );
}

function BebidaRow() {
  const { drink, drinkVariant, setDrink, setDrinkVariant } = useBurger();
  const open = useBurger((s) => s.section === "bebida");
  const D = drink ? DRINKS[drink] : null;
  const chip =
    "flex-1 whitespace-nowrap rounded-full border border-line px-1.5 py-1 text-[11px] aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:font-semibold aria-pressed:text-[#1b1208]";
  return (
    <>
      <RowShell
        id="bebida"
        open={open}
        summary={
          <>
            {D ? (
              <CanArt
                color={D.color}
                zero={drinkVariant === "zero"}
                className="mx-auto size-11"
              />
            ) : (
              <span className="mx-auto grid size-11 place-items-center rounded-xl border border-dashed border-line text-muted">
                <CupSoda className="size-5" />
              </span>
            )}
            <Summary
              name={
                D
                  ? `${D.name}${drinkVariant === "zero" ? " Zero" : ""}`
                  : "Sin bebida"
              }
              note={
                D
                  ? `Lata 355 ml · +${money(DRINK_PRICE)}`
                  : "Toca la flecha para elegir"
              }
            />
          </>
        }
      >
        <div
          role="group"
          aria-label="Bebida"
          className="grid grid-cols-3 gap-1.5"
        >
          {([null, "coca", "sprite"] as (DrinkId | null)[]).map((k) => (
            <button
              key={k ?? "none"}
              type="button"
              aria-pressed={drink === k}
              onClick={() => setDrink(k)}
              className="flex flex-col items-center rounded-xl border border-line px-1 pb-1.5 pt-1 text-[11px] font-semibold aria-pressed:border-gold aria-pressed:bg-gold/15"
            >
              {k ? (
                <CanArt
                  color={DRINKS[k].color}
                  zero={drinkVariant === "zero"}
                  className="size-10"
                />
              ) : (
                <span className="grid size-10 place-items-center text-muted">
                  <CupSoda className="size-5" />
                </span>
              )}
              {k ? DRINKS[k].name : "Sin bebida"}
            </button>
          ))}
        </div>
      </RowShell>
      {drink && (
        <div
          role="group"
          aria-label="Tipo de bebida"
          className="-mt-0.5 mb-1.5 flex w-full gap-1.5 pl-[90px] pr-8"
        >
          {(["normal", "zero"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={drinkVariant === v}
              onClick={() => setDrinkVariant(v)}
              className={chip}
            >
              {v === "normal" ? "Normal" : "Zero azúcar"}
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
              note={
                chosen.length > 1
                  ? `+${chosen.length - 1} más · ${chosen
                      .slice(1)
                      .map((c) => c.name)
                      .join(", ")}`
                  : [first.note, priceLabel(first, protein)]
                      .filter(Boolean)
                      .join(" · ")
              }
              control={<Control item={first} />}
            />
          </>
        ) : (
          <>
            <span className="grid size-11 place-items-center rounded-xl border border-dashed border-line text-muted">
              <S.icon className="size-5" />
            </span>
            <Summary
              name={`Sin ${S.label.toLowerCase()}`}
              note="Toca la flecha para elegir"
            />
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
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 px-1 py-1 [&+&]:border-t [&+&]:border-line/60">
      <Thumb src={thumb(item.id, protein)} size={40} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold">{item.name}</p>
        <p className="truncate text-[11px] text-muted">
          {[item.note, priceLabel(item, protein)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Control item={item} />
    </div>
  );
}

function priceLabel(it: Item, protein: ProteinId) {
  const p =
    it.id === "patty_x" ? it.price + PROTEINS[protein].surcharge : it.price;
  return p ? `+${money(p)}` : "Sin costo";
}

function Control({ item }: { item: Item }) {
  return item.max > 1 ? <Stepper item={item} /> : <Switch item={item} />;
}

function Stepper({ item }: { item: Item }) {
  const n = useBurger((s) => s.qty[item.id] ?? 0);
  const setQty = useBurger((s) => s.setQty);
  const btn =
    "grid size-6 place-items-center rounded-full bg-panel-2 text-base leading-none hover:bg-line disabled:opacity-35";
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-line p-0.5">
      <button
        type="button"
        className={btn}
        aria-label={`Quitar ${item.name}`}
        disabled={n <= 0}
        onClick={() => setQty(item.id, n - 1)}
      >
        −
      </button>
      <output
        className="w-5 text-center font-display text-sm font-bold tabular-nums"
        aria-live="polite"
      >
        {n}
      </output>
      <button
        type="button"
        className={btn}
        aria-label={`Añadir ${item.name}`}
        disabled={n >= item.max}
        onClick={() => setQty(item.id, n + 1)}
      >
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
      className="relative h-6 w-10 shrink-0 rounded-full bg-panel-2 ring-1 ring-line transition-colors aria-checked:bg-gold aria-checked:ring-gold"
    >
      <span
        className={`absolute top-1 size-4 rounded-full bg-white shadow transition-[left] ${on ? "left-5" : "left-1"}`}
      />
    </button>
  );
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
