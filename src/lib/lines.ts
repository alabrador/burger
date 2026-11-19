import { DRINKS, PROTEINS, totals, type Doneness, type DrinkId, type DrinkVariant, type ProteinId, type Qty } from "./catalog";
import { useLive } from "./live";
import type { CartLine } from "./store";

export type LineInput = { protein: ProteinId; qty: Qty; drink: DrinkId | null; drinkVariant: DrinkVariant; doneness: Doneness };

/** Construye una línea de carrito (título, descripción y precio actual) a partir de una combinación. */
export function makeLine(c: LineInput, quantity: number): Omit<CartLine, "key"> {
  const live = useLive.getState();
  const order = Object.keys(live.items);
  const parts = Object.entries(c.qty)
    .filter(([, n]) => n > 0)
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([id, n]) => {
      const name = id === "patty_x" ? (n === 1 ? "Doble carne" : "Triple carne") : (live.items[id]?.name ?? id);
      return n > 1 && id !== "patty_x" ? `${n}× ${name}` : name;
    });
  const drink = c.drink ? `${DRINKS[c.drink].name}${c.drinkVariant === "zero" ? " Zero" : ""}` : "";
  const unit = totals(c.qty, c.protein, live.prices).price + (c.drink ? live.drinkPrice : 0);
  return {
    protein: c.protein,
    qty: { ...c.qty },
    drink: c.drink,
    drinkVariant: c.drinkVariant,
    doneness: c.doneness,
    quantity,
    unit,
    title: `Burger ${live.proteins[c.protein]?.name ?? PROTEINS[c.protein].label}`,
    desc: [parts.join(", ") || "Sin ingredientes extra", ["Papas fritas", drink].filter(Boolean).join(" · ")].join(" · "),
  };
}

/**
 * Convierte la configuración guardada en un pedido anterior en una combinación actual.
 * Quita lo que ya no está en la carta o está agotado y avisa de ello.
 */
export function fromOrder(cfg: { protein: string; items: Record<string, number>; drink: string | null }): { line: LineInput | null; dropped: string[] } {
  const live = useLive.getState();
  const protein = cfg.protein as ProteinId;
  if (!(protein in PROTEINS) || !live.proteins[protein]?.available || live.proteins[protein]?.soldOut) return { line: null, dropped: [] };
  const dropped: string[] = [];
  const qty: Qty = {};
  for (const [id, n] of Object.entries(cfg.items)) {
    const it = live.items[id];
    if (!it || it.soldOut) dropped.push(it?.name ?? id);
    else qty[id] = Math.min(n, it.max);
  }
  let drink: DrinkId | null = null;
  let drinkVariant: DrinkVariant = "normal";
  if (cfg.drink) {
    const base = cfg.drink.replace(/_zero$/, "") as DrinkId;
    if (base in DRINKS && !live.drinksOut.has(cfg.drink)) {
      drink = base;
      drinkVariant = cfg.drink.endsWith("_zero") ? "zero" : "normal";
    } else dropped.push("bebida");
  }
  return { line: { protein, qty, drink, drinkVariant, doneness: "Tres cuartos" }, dropped };
}
