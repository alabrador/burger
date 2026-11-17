import { create } from "zustand";
import { ITEMS, PRESETS, type Doneness, type ProteinId, type Qty } from "./catalog";

type State = {
  qty: Qty;
  protein: ProteinId;
  doneness: Doneness;
  exploded: boolean;
  spinning: boolean;
  activePreset: string | null;
  setQty: (id: string, n: number) => void;
  toggle: (id: string) => void;
  setProtein: (p: ProteinId) => void;
  setDoneness: (d: Doneness) => void;
  applyPreset: (name: string) => void;
  setExploded: (v: boolean) => void;
  setSpinning: (v: boolean) => void;
};

const clean = (q: Qty) => Object.fromEntries(Object.entries(q).filter(([, n]) => n > 0));

export const useBurger = create<State>((set) => ({
  qty: { ...PRESETS[0].qty },
  protein: "angus",
  doneness: "Tres cuartos",
  exploded: false,
  spinning: true,
  activePreset: PRESETS[0].name,
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
}));
