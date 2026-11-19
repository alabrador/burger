"use client";

// Carta en vivo: arranca con la carta base (src/lib/catalog.ts) y se reemplaza con
// la del admin (/api/catalog) en cuanto llega: precios, nombres, agotados e ingredientes nuevos.
import { create } from "zustand";
import { DEFAULT_ALLERGENS } from "./allergens";
import { BASE_PRICE, CATALOG, DRINK_PRICE, PROTEINS, type Item, type ModelMap, type Prices, type ProteinId } from "./catalog";

export type LiveItem = Item & { soldOut: boolean; model: string | null; img: string | null };
export type LiveCategory = { id: string; name: string; items: LiveItem[] };

type Api = {
  categories: { id: string; name: string }[];
  products: { id: string; kind: string; category: string; name: string; note: string | null; priceCents: number; grams: number; kcal: number; max: number; soldOut: boolean; model: string | null; swatch: string; img: string | null; allergens?: string[] }[];
};

type Live = {
  cats: LiveCategory[];
  items: Record<string, LiveItem>;
  prices: Prices;
  models: ModelMap;
  /** proteínas: nombre visible y si están agotadas */
  proteins: Record<ProteinId, { name: string; soldOut: boolean; available: boolean }>;
  drinkPrice: number;
  drinksOut: Set<string>;
  /** alérgenos por id de producto (pan, proteínas e ingredientes) */
  allergens: Record<string, string[]>;
  loaded: boolean;
  load: () => Promise<void>;
};

function build(cats: LiveCategory[], extra: Partial<Live> = {}) {
  const items = Object.fromEntries(cats.flatMap((c) => c.items.map((i) => [i.id, i])));
  const base = extra.prices?.base ?? BASE_PRICE;
  const surcharge = extra.prices?.surcharge ?? STATIC_SURCHARGE;
  return {
    cats,
    items,
    prices: { base, surcharge, items },
    models: Object.fromEntries(Object.values(items).map((i) => [i.id, { model: i.model }])),
  };
}

const STATIC_SURCHARGE = Object.fromEntries(Object.entries(PROTEINS).map(([k, p]) => [k, p.surcharge])) as Record<ProteinId, number>;
const STATIC_CATS: LiveCategory[] = CATALOG.map((c) => ({
  id: c.id,
  name: c.name,
  items: c.items.map((i) => ({ ...i, soldOut: false, model: i.id === "patty_x" ? null : i.id, img: null })),
}));

export const useLive = create<Live>((set, get) => ({
  ...build(STATIC_CATS),
  proteins: Object.fromEntries(Object.entries(PROTEINS).map(([k, p]) => [k, { name: p.label, soldOut: false, available: true }])) as Live["proteins"],
  drinkPrice: DRINK_PRICE,
  drinksOut: new Set(),
  allergens: DEFAULT_ALLERGENS,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const r = await fetch("/api/catalog");
      if (!r.ok) return;
      const d = (await r.json()) as Api;
      const byId = new Map(d.products.map((p) => [p.id, p]));
      const cats: LiveCategory[] = d.categories
        .filter((c) => !["base", "bebidas"].includes(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          items: d.products
            .filter((p) => p.kind === "ingredient" && p.category === c.id)
            .map((p) => ({ id: p.id, name: p.name, note: p.note ?? undefined, price: p.priceCents / 100, g: p.grams, kcal: p.kcal, max: p.max, swatch: p.swatch, soldOut: p.soldOut, model: p.model, img: p.img })),
        }));
      const surcharge = { ...STATIC_SURCHARGE };
      const proteins = { ...get().proteins };
      for (const k of Object.keys(PROTEINS) as ProteinId[]) {
        const p = byId.get(k);
        surcharge[k] = p ? p.priceCents / 100 : surcharge[k];
        proteins[k] = { name: p?.name ?? proteins[k].name, soldOut: !!p?.soldOut, available: !!p };
      }
      const base = byId.get("burger");
      set({
        ...build(cats, { prices: { base: base ? base.priceCents / 100 : BASE_PRICE, surcharge, items: {} } }),
        proteins,
        drinkPrice: (byId.get("coca") ?? byId.get("sprite"))?.priceCents ? (byId.get("coca") ?? byId.get("sprite"))!.priceCents / 100 : DRINK_PRICE,
        drinksOut: new Set(d.products.filter((p) => p.kind === "drink" && p.soldOut).map((p) => p.id).concat(["coca", "coca_zero", "sprite", "sprite_zero"].filter((id) => !byId.has(id)))),
        allergens: Object.fromEntries(d.products.map((p) => [p.id, p.allergens ?? DEFAULT_ALLERGENS[p.id] ?? []])),
        loaded: true,
      });
    } catch {
      /* sin conexión: seguimos con la carta base */
    }
  },
}));
