import { create } from "zustand";
import { useLive } from "./live";
import { PRESETS, type CategoryId, type Doneness, type DrinkId, type DrinkVariant, type ProteinId, type Qty } from "./catalog";

export type Section = "base" | CategoryId | "papas" | "bebida" | (string & {});

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
  /** líneas del carrito (se guardan en el navegador) */
  cart: CartLine[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  addLine: (l: Omit<CartLine, "key">) => void;
  setLineQty: (key: string, n: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
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
  checkout: boolean;
  setCheckout: (v: boolean) => void;
};

export type CartLine = {
  key: string;
  protein: ProteinId;
  qty: Qty;
  drink: DrinkId | null;
  drinkVariant: DrinkVariant;
  doneness: Doneness;
  quantity: number;
  /** precio unitario mostrado (el servidor lo recalcula al pagar) */
  unit: number;
  title: string;
  desc: string;
};
export const MAX_BURGERS = 10;
const CART_KEY = "cb:carrito";
export const cartCount = (c: CartLine[]) => c.reduce((n, l) => n + l.quantity, 0);
export const cartTotal = (c: CartLine[]) => c.reduce((n, l) => n + l.unit * l.quantity, 0);
function saveCart(c: CartLine[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(c));
  } catch {}
}
export function loadCart(): CartLine[] {
  try {
    const c = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(c) ? c.filter((l) => l && typeof l.key === "string" && l.quantity > 0).slice(0, 20) : [];
  } catch {
    return [];
  }
}

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
  cart: [],
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  addLine: (l) =>
    set((s) => {
      const same = s.cart.find((x) => x.title === l.title && x.desc === l.desc && x.doneness === l.doneness);
      const cart = same
        ? s.cart.map((x) => (x === same ? { ...x, quantity: Math.min(MAX_BURGERS, x.quantity + l.quantity), unit: l.unit } : x))
        : [...s.cart, { ...l, key: crypto.randomUUID() }];
      saveCart(cart);
      return { cart, count: 1 };
    }),
  setLineQty: (key, n) =>
    set((s) => {
      const cart = s.cart.map((x) => (x.key === key ? { ...x, quantity: Math.max(1, Math.min(MAX_BURGERS, n)) } : x));
      saveCart(cart);
      return { cart };
    }),
  removeLine: (key) =>
    set((s) => {
      const cart = s.cart.filter((x) => x.key !== key);
      saveCart(cart);
      return { cart };
    }),
  clearCart: () => {
    saveCart([]);
    set({ cart: [] });
  },
  count: 1,
  drink: "coca",
  drinkVariant: "normal",
  setCount: (count) => set({ count: Math.max(1, Math.min(10, count)) }),
  setDrink: (drink) => set({ drink }),
  setDrinkVariant: (drinkVariant) => set({ drinkVariant }),
  setQty: (id, n) =>
    set((s) => ({
      qty: clean({ ...s.qty, [id]: Math.max(0, Math.min(useLive.getState().items[id]?.max ?? 1, n)) }),
      activePreset: null,
    })),
  toggle: (id) => set((s) => ({ qty: clean({ ...s.qty, [id]: s.qty[id] ? 0 : 1 }), activePreset: null })),
  setProtein: (protein) => set({ protein, activePreset: null }),
  setDoneness: (doneness) => set({ doneness }),
  applyPreset: (name) => {
    const p = PRESETS.find((x) => x.name === name);
    if (!p) return;
    // solo lo que sigue en la carta y no está agotado
    const items = useLive.getState().items;
    const qty = Object.fromEntries(Object.entries(p.qty).filter(([id]) => items[id] && !items[id].soldOut));
    set((s) => ({ qty, protein: p.protein ?? s.protein, activePreset: name }));
  },
  setExploded: (exploded) => set({ exploded }),
  setSpinning: (spinning) => set({ spinning }),
  turn360: () => set((s) => ({ turn: s.turn + 1 })),
  setSection: (section) => set({ section }),
  checkout: false,
  setCheckout: (checkout) => set({ checkout }),
}));
