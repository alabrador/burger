import { admin } from "@/server/admin";
import { json, limit } from "@/server/http";
import { reconcilePayments } from "@/server/reconcile";

/** Conciliación de pagos bajo demanda (además de la diaria del cron). */
export const POST = admin("payments.view", async (req, me, log) => {
  await limit(req, "reconcile", 3, 300, me.id);
  const r = await reconcilePayments();
  await log("payments.reconcile", undefined, undefined, { fixed: r.fixed.length, issues: r.issues.map((i) => [i.kind, i.items.length]) });
  return json(r);
});
