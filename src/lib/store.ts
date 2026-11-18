import { create } from "zustand";
import { ITEMS, PRESETS, type CategoryId, type Doneness, type DrinkId, type DrinkVariant, type ProteinId, type Qty } from "./catalog";

export type Section = "base" | CategoryId | "papas" | "bebida";

type State = {
  qty: Qty;
  protein: ProteinId;
  doneness: Doneness;
  exploded: boolean;
  spinning: boolean;
  /** se incrementa para pedir una vuelta completa de 360° */
  turn: number;
  activePreset: string | null;
  section: Section | null;
  cart: { count: number; total: number };
  /** cuántas hamburguesas iguales se agregan */
  count: number;
  drink: DrinkId | null;
  drinkVariant: DrinkVariant;
  setCount: (n: number) => void;
  setDrink: (d: DrinkId | null) => void;
  setDrinkVariant: (v: DrinkVariant) => void;
  setQty: (id: string, n: number) => void;
  toggle: (id: string) => void;
  setProtein: (p: ProteinId) => void;
  setDoneness: (d: Doneness) => void;
  applyPreset: (name: string) => void;
  setExploded: (v: boolean) => void;
  setSpinning: (v: boolean) => void;
  turn360: () => void;
  setSection: (s: Section | null) => void;
  addToCart: (unitPrice: number) => void;
};

const clean = (q: Qty) => Object.fromEntries(Object.entries(q).filter(([, n]) => n > 0));

export const useBurger = create<State>((set) => ({
  qty: { ...PRESETS[0].qty },
  protein: "angus",
  doneness: "Tres cuartos",
  exploded: false,
  spinning: true,
  turn: 0,
  activePreset: PRESETS[0].name,
  section: "base",
  cart: { count: 0, total: 0 },
  count: 1,
  drink: "coca",
  drinkVariant: "normal",
  setCount: (count) => set({ count: Math.max(1, Math.min(10, count)) }),
  setDrink: (drink) => set({ drink }),
  setDrinkVariant: (drinkVariant) => set({ drinkVariant }),
  setQty: (id, n) =>
    set((s) => ({
      qty: clean({ ...s.qty, [id]: Math.max(0, Math.min(ITEMS[id]?.max ?? 1, n)) }),
      activePreset: null,
    })),
  toggle: (id) => set((s) => ({ qty: clean({ ...s.qty, [id]: s.qty[id] ? 0 : 1 }), activePreset: null })),
  setProtein: (protein) => set({ protein, activePreset: null }),
  setDoneness: (doneness) => set({ doneness }),
  applyPreset: (name) => {
    const p = PRESETS.find((x) => x.name === name);
    if (!p) return;
    set((s) => ({ qty: { ...p.qty }, protein: p.protein ?? s.protein, activePreset: name }));
  },
  setExploded: (exploded) => set({ exploded }),
  setSpinning: (spinning) => set({ spinning }),
  turn360: () => set((s) => ({ turn: s.turn + 1 })),
  setSection: (section) => set({ section }),
  addToCart: (unit) => set((s) => ({ cart: { count: s.cart.count + s.count, total: s.cart.total + unit * s.count }, count: 1 })),
}));
