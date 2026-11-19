import { z } from "zod";
import { admin } from "@/server/admin";
import { body, json } from "@/server/http";
import { getSettings, saveSetting } from "@/server/settings";

const b = z.object({ enabled: z.boolean(), pausedMessage: z.string().trim().min(1).max(160).optional() });

/** Pausa o reanuda los pedidos al momento (botón del dashboard), p. ej. si falla la cocina o un pago. */
export const POST = admin("orders.pause", async (req, _me, log) => {
  const v = await body(req, b);
  const cur = (await getSettings()).orders;
  const next = await saveSetting("orders", { ...cur, enabled: v.enabled, pausedMessage: v.pausedMessage ?? cur.pausedMessage });
  await log(v.enabled ? "orders.resume" : "orders.pause", "settings", "orders", { pausedMessage: next.pausedMessage });
  return json({ enabled: next.enabled, pausedMessage: next.pausedMessage });
});
