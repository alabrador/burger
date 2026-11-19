"use client";

import { create } from "zustand";

export type AccountOrder = {
  code: string;
  status: string;
  totalCents: number;
  createdAt: string;
  url: string;
  items: { quantity: number; title: string; description: string; config: { protein: string; items: Record<string, number>; drink: string | null } }[];
};
export type Me = { name: string; email: string; phone: string | null };

type S = {
  /** undefined = aún cargando; null = sin sesión */
  me: Me | null | undefined;
  orders: AccountOrder[];
  open: boolean;
  setOpen: (v: boolean) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

/** Llamada a /api/account/* con el mensaje de error del servidor. */
export async function accountApi<T = { ok: true }>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(`/api/account/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? undefined : { "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = (j as { details?: { message: string }[] | { left?: number } }).details;
    let msg = Array.isArray(d) && d.length ? d[0].message : (j as { error?: string }).error || "No se pudo completar";
    if (d && !Array.isArray(d) && typeof d.left === "number") msg += `. Te quedan ${d.left} intento${d.left === 1 ? "" : "s"}.`;
    throw Object.assign(new Error(msg), { code: (j as { code?: string }).code, status: r.status });
  }
  return j as T;
}

export const useAccount = create<S>((set) => ({
  me: undefined,
  orders: [],
  open: false,
  setOpen: (open) => set({ open }),
  refresh: async () => {
    try {
      const d = await accountApi<{ customer: Me | null; orders?: AccountOrder[] }>("me");
      set({ me: d.customer, orders: d.orders ?? [] });
    } catch {
      set({ me: null, orders: [] });
    }
  },
  logout: async () => {
    await accountApi("logout", {}).catch(() => {});
    set({ me: null, orders: [] });
  },
}));
