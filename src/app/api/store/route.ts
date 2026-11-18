import { loadCatalog } from "@/server/catalog";
import { handle, json } from "@/server/http";
import { getSettings, isOpenAt, paymentConfig } from "@/server/settings";

/** Datos públicos para el checkout: local, horario, métodos de pago y disponibilidad. */
export const GET = handle(async () => {
  const [st, pay, cat] = await Promise.all([getSettings(), paymentConfig(), loadCatalog()]);
  return json(
    {
      store: { name: st.store.name, address: st.store.address, city: st.store.city, phone: st.store.phone, hours: st.store.hours, timezone: st.store.timezone, notice: st.store.notice },
      open: isOpenAt(st.store, new Date()),
      ordering: { enabled: st.orders.enabled, pausedMessage: st.orders.pausedMessage, prepMinutes: st.orders.prepMinutes, slotMinutes: st.orders.slotMinutes, maxBurgers: st.orders.maxBurgersPerOrder, taxRateBp: st.orders.taxRateBp },
      payments: (["stripe", "bizum", "paypal", "cash"] as const).filter((m) => pay[m].enabled),
      products: cat.map((p) => ({ id: p.id, priceCents: p.priceCents, available: p.active && !p.soldOut, allergens: p.allergens })),
    },
    { headers: { "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=30" } },
  );
});
