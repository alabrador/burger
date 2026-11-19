"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useProgress } from "@react-three/drei";
import {
  Beef,
  Check,
  CirclePlus,
  CupSoda,
  Hamburger,
  Layers,
  Leaf,
  Maximize,
  Menu,
  RotateCw,
  ShoppingCart,
  Soup,
  User,
  Cheese,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import CookieNotice from "./CookieNotice";
import SiteMenu from "./SiteMenu";
import Account from "./Account";
import { useAccount } from "@/lib/account";
import {
  BUN,
  DRINKS,
  PROTEINS,
  money,
  stackOrder,
  thumb,
  totals,
  type DrinkId,
  type ProteinId,
} from "@/lib/catalog";
import { makeLine } from "@/lib/lines";
import { useLive, type LiveItem } from "@/lib/live";
import { cartCount, cartTotal, loadCart, MAX_BURGERS, useBurger, type Section } from "@/lib/store";
import Cart from "./Cart";
import Checkout from "./Checkout";
import {
  BurgerLoader,
  CanArt,
  FriesArt,
  IngredientsIcon,
  Logo,
  NeonBurger,
  SauceBottle,
} from "./Brand";

const BurgerScene = dynamic(() => import("./BurgerScene"), { ssr: false });

const SECTIONS: {
  id: Section;
  label: string;
  short?: string;
  icon: LucideIcon;
}[] = [
  { id: "base", label: "Base", icon: Hamburger },
  { id: "carne", label: "Carne", icon: Beef },
  { id: "quesos", label: "Quesos", icon: Cheese },
  { id: "vegetales", label: "Vegetales", icon: Leaf },
  { id: "salsas", label: "Salsas", icon: Soup },
  { id: "extras", label: "Extras", icon: CirclePlus },
  { id: "bebida", label: "Bebida del combo", short: "Bebida", icon: CupSoda },
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

function useTotals() {
  const qty = useBurger((s) => s.qty);
  const protein = useBurger((s) => s.protein);
  const prices = useLive((s) => s.prices);
  const models = useLive((s) => s.models);
  const drinkPrice = useLive((s) => s.drinkPrice);
  const t = useMemo(() => totals(qty, protein, prices), [qty, protein, prices]);
  const layers = useMemo(() => stackOrder(qty, protein, models).length, [qty, protein, models]);
  const drink = useBurger((s) => s.drink);
  const count = useBurger((s) => s.count);
  /** precio de un combo: hamburguesa + papas (incluidas) + bebida */
  const unit = t.price + (drink ? drinkPrice : 0);
  return { ...t, layers, unit, count, total: unit * count };
}

/** Añade la hamburguesa actual al carrito; el pago se hace desde el carrito. */
function useAddToCart() {
  return () => {
    const s = useBurger.getState();
    if (cartCount(s.cart) + s.count > MAX_BURGERS)
      return showToast(`Máximo ${MAX_BURGERS} hamburguesas por pedido.`);
    s.addLine(makeLine(s, s.count));
    showToast(`${s.count > 1 ? `${s.count} hamburguesas añadidas` : "Hamburguesa añadida"} al carrito. Abre el carrito para pagar.`);
  };
}

export default function Configurator() {
  const load = useLive((s) => s.load);
  useEffect(() => {
    load();
    useBurger.setState({ cart: loadCart() });
    useAccount.getState().refresh();
  }, [load]);
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <main className="grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,50fr)_minmax(0,50fr)] gap-2 px-2 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_clamp(340px,27vw,640px)] lg:gap-3 lg:px-4 lg:py-3 2xl:gap-4 2xl:px-6 2xl:py-4">
        <Stage />
        <IngredientPanel />
      </main>
      <Toast />
      <Cart />
      <Checkout />
      <Account />
      <CookieNotice />
    </div>
  );
}

/* ---------- cabecera ---------- */
function Header() {
  const lines = useBurger((s) => s.cart);
  const openCart = useBurger((s) => s.setCartOpen);
  const cart = { count: cartCount(lines), total: cartTotal(lines) };
  const [menu, setMenu] = useState(false);
  const me = useAccount((s) => s.me);
  const openAccount = useAccount((s) => s.setOpen);
  return (
    <header className="relative z-40 shrink-0 bg-[linear-gradient(180deg,#1f1613_0%,#140e0c_100%)] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
      <div className="flex h-14 w-full items-center gap-3 px-3 lg:h-16 lg:px-4 2xl:px-6">
        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl hover:bg-white/5"
          aria-label="Abrir menú"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          <Menu className="size-6" />
        </button>
        <div className="max-md:mx-auto">
          <Logo compact />
        </div>
        <div className="hidden flex-1 md:block" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCart(true)}
            className="relative flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-2.5 pr-2.5 transition-colors hover:border-gold/50 lg:pr-3.5"
            aria-label={`Carrito: ${cart.count} hamburguesas, ${money(cart.total)}`}
          >
            <span className="relative">
              <ShoppingCart className="size-5" />
              <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[0.625rem] font-bold text-[#1b1208] ring-2 ring-[#1a1210]">
                {cart.count}
              </span>
            </span>
            <span className="hidden h-5 w-px bg-white/15 lg:block" />
            <span className="hidden font-display text-sm font-bold tabular-nums lg:inline">
              {money(cart.total)}
            </span>
          </button>
          <button
            type="button"
            aria-label={me ? `Mi cuenta: ${me.name}` : "Iniciar sesión o crear cuenta"}
            onClick={() => openAccount(true)}
            className={`grid size-10 place-items-center rounded-full ring-1 transition hover:ring-gold ${me ? "bg-gold font-display text-base font-black text-[#1b1208] ring-gold" : "bg-[linear-gradient(160deg,#3a2b25,#1f1714)] ring-gold/40"}`}
          >
            {me ? me.name.charAt(0).toUpperCase() : <User className="size-5" />}
          </button>
        </div>
      </div>
      <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(227,38,27,0.9)_15%,#ffc21a_50%,rgba(227,38,27,0.9)_85%,transparent)]" />
      <SiteMenu open={menu} onClose={() => setMenu(false)} />
    </header>
  );
}

/* ---------- escenario 3D ---------- */
function Stage() {
  const { exploded, spinning, setExploded, setSpinning, turn360 } = useBurger();
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
        <h1 className="whitespace-nowrap font-display text-lg font-extrabold leading-none lg:text-[1.625rem]">
          Tu Hamburguesa
        </h1>
        <p className="-rotate-3 font-script text-2xl leading-tight text-gold lg:text-[2.25rem]">
          Personalizada
        </p>
        <p className="mt-0.5 hidden text-[0.8125rem] text-ink/80 sm:block">
          Crea tu combinación perfecta con ingredientes premium.
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-black/40 py-0.5 pl-1 pr-2.5 text-[0.6875rem] font-semibold text-gold backdrop-blur-sm lg:text-xs">
          <FriesArt className="size-5" />
          Incluye papas fritas
        </p>
      </div>
      <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5 lg:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:gap-2">
        <Ctl onClick={turn360} label="Dar una vuelta de 360 grados">
          <span className="font-display text-[0.6875rem] font-bold">360°</span>
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
        <Ctl
          className="max-lg:hidden"
          onClick={fullscreen}
          label="Pantalla completa"
        >
          <Maximize className="size-4" />
        </Ctl>
      </div>
      {(active || progress < 100) && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <div className="flex flex-col items-center gap-3">
            <BurgerLoader className="w-24 drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)] lg:w-32" />
            <p className="text-xs font-medium text-ink/80 lg:text-sm">
              Preparando tu hamburguesa{" "}
              <span className="tabular-nums text-gold">
                {Math.round(progress)} %
              </span>
            </p>
            <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10 lg:w-40">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#e3261b,#ffc21a)] transition-[width] duration-300"
                style={{ width: `${Math.round(progress)}%` }}
              />
            </div>
          </div>
        </div>
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
    "grid size-7 place-items-center rounded-md text-base leading-none hover:bg-white/10 disabled:opacity-30";
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end gap-2 lg:inset-x-5 lg:bottom-5">
      <div
        className="pointer-events-auto flex h-8 shrink-0 items-center rounded-full bg-black/40 px-0.5 backdrop-blur-sm lg:h-9 lg:rounded-lg lg:border lg:border-white/25"
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
          className="w-5 text-center font-display text-sm font-bold tabular-nums"
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
      <button
        type="button"
        onClick={add}
        aria-label={`Agregar al carrito, ${money(total)}`}
        className="cta-gold pointer-events-auto flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-full font-display lg:h-9 lg:w-auto lg:rounded-lg lg:px-3 lg:text-[0.8125rem] lg:font-extrabold text-[#1b1208] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ShoppingCart className="size-4" strokeWidth={2.4} />
        <span className="max-lg:hidden">Agregar al carrito</span>
      </button>
      <div className="ml-auto min-w-0 text-right">
        <p className="truncate text-[0.625rem] text-ink/80 lg:text-xs">
          {count > 1
            ? `${count} × ${money(unit)}`
            : drink
              ? "Combo con bebida"
              : "Con papas fritas"}
        </p>
        <p
          className="font-display text-xl font-black leading-none text-white tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] lg:text-[1.75rem]"
          aria-live="polite"
        >
          {money(total)}
        </p>
      </div>
    </div>
  );
}

function Ctl({
  pressed,
  onClick,
  label,
  children,
  className = "",
}: {
  pressed?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`${className} grid size-9 place-items-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm hover:border-gold aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:text-[#1b1208]`}
    >
      {children}
    </button>
  );
}

/* ---------- panel de ingredientes ---------- */

function IngredientPanel() {
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Mueve la barra de progreso al hacer scroll.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const onScroll = () => {
      const max = root.scrollHeight - root.clientHeight;
      if (bar.current)
        bar.current.style.transform = `scaleX(${max > 0 ? root.scrollTop / max : 1})`;
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    if (root.firstElementChild) ro.observe(root.firstElementChild);
    window.addEventListener("resize", onScroll);
    return () => {
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro.disconnect();
    };
  }, []);
  const cats = useLive((s) => s.cats);

  return (
    <section
      aria-label="Elige tus ingredientes"
      className="card @container flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
    >
      <div className="shrink-0 px-3 pb-2.5 pt-2.5 lg:px-4 lg:pt-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-gold/12 text-gold ring-1 ring-gold/30">
            <IngredientsIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-extrabold leading-tight lg:text-lg">
              Elige tus ingredientes
            </h2>
            <p className="truncate text-[0.6875rem] text-muted">
              Siempre incluye{" "}
              <b className="font-semibold text-ink">{BUN.name.toLowerCase()}</b>{" "}
              y <b className="font-semibold text-ink">papas fritas</b>
            </p>
          </div>
        </div>
      </div>
      <div className="relative h-0.5 shrink-0 bg-white/5">
        <div
          ref={bar}
          className="absolute inset-0 origin-left scale-x-0 bg-[linear-gradient(90deg,#e3261b,#ffc21a)] transition-transform duration-150"
        />
      </div>
      <div
        ref={scroller}
        className="pro-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 lg:px-4"
      >
        <CarneGroup />
        {cats.filter((c) => c.id !== "carne" && c.items.length).map((c) => (
          <Group key={c.id} id={c.id} label={c.name} count={c.items.length}>
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
  label,
  children,
  extra,
  count,
}: {
  id: Section;
  label?: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
  count?: number;
}) {
  const S = { icon: CirclePlus, ...SECTIONS.find((s) => s.id === id), label: label ?? SECTIONS.find((s) => s.id === id)?.label ?? id };
  const qty = useBurger((s) => s.qty);
  const cats = useLive((s) => s.cats);
  const picked =
    cats.find((c) => c.id === id)?.items.filter((i) => qty[i.id]).length ??
    0;
  return (
    <section id={`grp-${id}`} aria-label={S.label} className="pb-3">
      <h3 className="sticky top-0 z-10 -mx-3 mb-1.5 flex items-center gap-1.5 border-b border-line/70 bg-[#1d1513]/95 px-3 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted backdrop-blur-md lg:-mx-4 lg:px-4">
        <S.icon className="size-3.5 text-gold" />
        {S.label}
        {count ? (
          <span className="ml-auto font-medium normal-case tracking-normal">
            {picked ? `${picked} elegido${picked > 1 ? "s" : ""}` : "Opcional"}
          </span>
        ) : null}
      </h3>
      <div className="grid grid-cols-4 gap-1.5 @[30rem]:grid-cols-5 @[38rem]:grid-cols-6 2xl:gap-2">
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
      <span className="mt-0.5 line-clamp-2 text-[0.6875rem] font-semibold leading-tight">
        {name}
      </span>
      {sub && (
        <span className="mt-auto text-[0.625rem] leading-tight text-muted">
          {sub}
        </span>
      )}
    </>
  );
}

function ItemTile({ item }: { item: LiveItem }) {
  const protein = useBurger((s) => s.protein);
  const surcharge = useLive((s) => s.prices.surcharge[protein]);
  const n = useBurger((s) => s.qty[item.id] ?? 0);
  const setQty = useBurger((s) => s.setQty);
  const on = n > 0;
  const out = item.soldOut && !on;
  const art = item.img ? (
    // eslint-disable-next-line @next/next/no-img-element -- foto subida en el admin
    <img src={item.img} alt="" className="mx-auto size-9 rounded-md object-cover drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]" />
  ) : item.model && item.model in SAUCE_BOTTLE ? (
    <SauceBottle
      color={item.swatch}
      cap={SAUCE_BOTTLE[item.model]}
      className="size-9"
    />
  ) : item.model || item.id === "patty_x" ? (
    <Thumb src={thumb(item.id === "patty_x" ? item.id : item.model!, protein)} size={36} />
  ) : (
    <span className="mx-auto block size-9 rounded-full ring-2 ring-white/15" style={{ background: item.swatch }} />
  );
  return (
    <div className={`${tileCls} ${on ? tileOn : tileOff} ${out ? "opacity-45" : ""}`}>
      <button
        type="button"
        aria-pressed={on}
        disabled={out}
        onClick={() => setQty(item.id, on ? 0 : 1)}
        className="flex w-full flex-1 flex-col items-center disabled:cursor-not-allowed"
        aria-label={`${item.name}${on ? ", elegido" : out ? ", agotado" : ""}`}
      >
        {art}
        <TileText
          name={item.name}
          sub={out ? "Agotado" : on && item.max > 1 ? undefined : priceLabel(item, surcharge)}
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
          <output className="w-3 text-center text-[0.6875rem] font-bold tabular-nums">
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
          className="flex-1 whitespace-nowrap rounded-full border border-line px-1.5 py-1 text-[0.6875rem] aria-pressed:border-gold aria-pressed:[background:linear-gradient(180deg,#ffd23f,#ffb000)] aria-pressed:font-semibold aria-pressed:text-[#1b1208]"
        >
          {names ? names[o] : o}
        </button>
      ))}
    </div>
  );
}

function CarneGroup() {
  const { protein, setProtein } = useBurger();
  const carne = useLive((s) => s.cats.find((c) => c.id === "carne"));
  const proteins = useLive((s) => s.proteins);
  const surcharge = useLive((s) => s.prices.surcharge);
  return (
    <Group id="carne" label={carne?.name}>
      {(Object.keys(proteins) as ProteinId[]).filter((k) => proteins[k].available).map((k) => {
        const on = protein === k;
        const out = proteins[k].soldOut && !on;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            disabled={out}
            onClick={() => setProtein(k)}
            className={`${tileCls} ${on ? tileOn : tileOff} ${out ? "cursor-not-allowed opacity-45" : ""}`}
          >
            <Thumb src={thumb("protein", k)} size={36} />
            <TileText
              name={
                // si el admin la renombra se ve su nombre; si no, el corto de siempre
                proteins[k].name !== PROTEINS[k].label
                  ? proteins[k].name
                  : k === "angus"
                    ? "Angus 250 g"
                    : k === "grilled"
                      ? "Pollo plancha"
                      : "Pollo crispy"
              }
              sub={out ? "Agotado" : surcharge[k] ? `+${money(surcharge[k])}` : "Incluido"}
            />
            {on && <Tick />}
          </button>
        );
      })}
      {carne?.items.map((it) => (
        <ItemTile key={it.id} item={it.id === "patty_x" ? { ...it, name: "Doble carne" } : it} />
      ))}
    </Group>
  );
}

function BebidaGroup() {
  const { drink, drinkVariant, setDrink, setDrinkVariant } = useBurger();
  const drinkPrice = useLive((s) => s.drinkPrice);
  const drinksOut = useLive((s) => s.drinksOut);
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
        const out = !!k && !on && drinksOut.has(drinkVariant === "zero" ? `${k}_zero` : k);
        return (
          <button
            key={k ?? "none"}
            type="button"
            aria-pressed={on}
            disabled={out}
            onClick={() => setDrink(k)}
            className={`${tileCls} ${on ? tileOn : tileOff} ${out ? "cursor-not-allowed opacity-45" : ""}`}
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
              sub={out ? "Agotado" : k ? `+${money(drinkPrice)}` : "—"}
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
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
    />
  );
}

function priceLabel(it: LiveItem, surcharge: number) {
  const p = it.id === "patty_x" ? it.price + surcharge : it.price;
  return p ? `+${money(p)}` : "Gratis";
}
