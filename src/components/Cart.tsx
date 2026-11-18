"use client";

import { Lock, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import { money, thumb } from "@/lib/catalog";
import { cartCount, cartTotal, MAX_BURGERS, useBurger } from "@/lib/store";

/** Carrito: revisar las hamburguesas añadidas y pasar a pagar. */
export default function Cart() {
  const open = useBurger((s) => s.cartOpen);
  const setOpen = useBurger((s) => s.setCartOpen);
  const cart = useBurger((s) => s.cart);
  const setQty = useBurger((s) => s.setLineQty);
  const remove = useBurger((s) => s.removeLine);
  const pay = useBurger((s) => s.setCheckout);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, setOpen]);
  if (!open) return null;

  const count = cartCount(cart);
  const btn = "grid size-7 place-items-center rounded-full bg-panel-2 hover:bg-line disabled:opacity-30";
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <button aria-label="Cerrar carrito" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="cart-title" className="flex items-center gap-2 font-display text-base font-extrabold">
            <ShoppingCart className="size-5 text-gold" /> Tu carrito
            {count > 0 && <span className="text-sm font-semibold text-muted">· {count} hamburguesa{count > 1 ? "s" : ""}</span>}
          </h2>
          <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-md p-1 text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </header>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted">
            <ShoppingCart className="size-10 text-line" />
            Tu carrito está vacío.
            <button onClick={() => setOpen(false)} className="mt-1 rounded-xl border border-line px-4 py-2 font-semibold text-ink hover:border-gold/60">
              Crear una hamburguesa
            </button>
          </div>
        ) : (
          <>
            <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-4">
              {cart.map((l) => (
                <li key={l.key} className="flex gap-3 py-4">
                  <Image src={thumb("protein", l.protein)} alt="" width={48} height={48} className="size-12 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-tight">{l.title}</p>
                      <button onClick={() => remove(l.key)} aria-label={`Quitar ${l.title}`} className="text-muted hover:text-red">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted">{l.desc}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5" role="group" aria-label="Cantidad">
                        <button className={btn} aria-label="Una menos" disabled={l.quantity <= 1} onClick={() => setQty(l.key, l.quantity - 1)}>
                          <Minus className="size-3.5" />
                        </button>
                        <output className="w-5 text-center font-display text-sm font-bold tabular-nums">{l.quantity}</output>
                        <button className={btn} aria-label="Una más" disabled={count >= MAX_BURGERS} onClick={() => setQty(l.key, l.quantity + 1)}>
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <span className="font-display font-extrabold tabular-nums">{money(l.unit * l.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="space-y-3 border-t border-line p-4">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted">Total (IVA incluido)</span>
                <span className="font-display text-2xl font-black tabular-nums">{money(cartTotal(cart))}</span>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  pay(true);
                }}
                className="cta-gold flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-extrabold text-[#1b1208]"
              >
                <Lock className="size-4" /> Pagar {money(cartTotal(cart))}
              </button>
              <button onClick={() => setOpen(false)} className="w-full text-center text-sm font-semibold text-muted hover:text-ink">
                Seguir creando
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
