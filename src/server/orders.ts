import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { loadCatalog, priceLine, type PricedLine } from "./catalog";
import { db, schema } from "./db";
import { ApiError } from "./http";
import { bumpBoard } from "./kds";
import { enqueue, processOutbox } from "./mail/outbox";
import type { MailOrder, Template } from "./mail/templates";
import { taxIncluded } from "./money";
import { kv } from "./redis";
import { getSettings, isOpenAt, paymentConfig } from "./settings";

export type Order = typeof schema.orders.$inferSelect;
export type OrderStatus = Order["status"];
type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/* ---------- validación de entrada ---------- */

const id = z.string().regex(/^[a-z0-9_]{1,32}$/);
export const lineSchema = z.object({
  protein: id,
  items: z.record(id, z.number().int().min(1).max(5)).refine((r) => Object.keys(r).length <= 30, "Demasiados ingredientes"),
  drink: id.nullable(),
  quantity: z.number().int().min(1).max(50),
});

export const createOrderSchema = z.object({
  lines: z.array(lineSchema).min(1).max(10),
  customer: z.object({
    name: z.string().trim().min(2, "Escribe tu nombre").max(80).regex(/^[^<>{}]*$/, "Caracteres no permitidos"),
    email: z.string().trim().toLowerCase().email("Correo no válido").max(160),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^\+?[0-9 ]{9,16}$/, "Teléfono no válido")
      .or(z.literal(""))
      .optional(),
    marketing: z.boolean().optional(),
  }),
  pickup: z.union([z.literal("asap"), z.string().datetime({ offset: true })]),
  paymentMethod: z.enum(["stripe", "paypal", "bizum", "cash"]),
  coupon: z.string().trim().toUpperCase().max(32).regex(/^[A-Z0-9_-]*$/).optional(),
  notes: z.string().trim().max(300).optional(),
  acceptTerms: z.literal(true, { message: "Debes aceptar la política de privacidad" }),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/* ---------- utilidades ---------- */

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I/L
export const newCode = () => Array.from({ length: 6 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

const slotStart = (d: Date, slotMin: number) => new Date(Math.floor(d.getTime() / (slotMin * 60_000)) * slotMin * 60_000);

export async function couponDiscount(tx: Tx | ReturnType<typeof db>, code: string, subtotal: number) {
  const [c] = await tx.select().from(schema.coupons).where(eq(schema.coupons.code, code));
  const now = new Date();
  if (!c || !c.active || (c.validFrom && c.validFrom > now) || (c.validTo && c.validTo < now))
    throw new ApiError(422, "El cupón no es válido", "bad_coupon");
  if (c.maxUses !== null && c.usedCount >= c.maxUses) throw new ApiError(422, "El cupón ya se ha agotado", "bad_coupon");
  if (subtotal < c.minTotalCents) throw new ApiError(422, "El pedido no llega al mínimo del cupón", "bad_coupon");
  const d = c.type === "percent" ? Math.round((subtotal * Math.min(100, c.value)) / 100) : c.value;
  return Math.min(d, subtotal);
}

/** Calcula importes sin crear el pedido (para mostrar el total con cupón en el checkout). */
export async function quote(lines: z.infer<typeof lineSchema>[], coupon?: string) {
  const [cat, st] = await Promise.all([loadCatalog(), getSettings()]);
  const priced = lines.map((l) => priceLine(cat, { protein: l.protein, items: l.items, drink: l.drink }, l.quantity));
  const burgers = priced.reduce((a, l) => a + l.quantity, 0);
  if (burgers > st.orders.maxBurgersPerOrder)
    throw new ApiError(422, `Máximo ${st.orders.maxBurgersPerOrder} hamburguesas por pedido`, "too_many");
  const subtotal = priced.reduce((a, l) => a + l.totalCents, 0);
  const discount = coupon ? await couponDiscount(db(), coupon, subtotal) : 0;
  const total = subtotal - discount;
  return { priced, subtotal, discount, total, tax: taxIncluded(total, st.orders.taxRateBp), taxRateBp: st.orders.taxRateBp };
}

/** Hora de recogida: lo antes posible o una hora concreta dentro del horario. */
export async function resolvePickup(pickup: string) {
  const st = await getSettings();
  const now = Date.now();
  const earliest = now + st.orders.prepMinutes * 60_000;
  const slotMs = st.orders.slotMinutes * 60_000;
  let candidates: Date[];
  if (pickup === "asap") {
    if (!isOpenAt(st.store, new Date(now))) throw new ApiError(409, "Ahora mismo estamos cerrados. Elige una hora de recogida.", "closed");
    // "Lo antes posible": si la franja está llena pasamos a la siguiente (hasta 2 h más tarde).
    const first = new Date(earliest);
    candidates = [first];
    for (let t = slotStart(first, st.orders.slotMinutes).getTime() + slotMs; candidates.length < Math.ceil(120 / st.orders.slotMinutes) + 1; t += slotMs)
      if (isOpenAt(st.store, new Date(t))) candidates.push(new Date(t));
  } else {
    const at = new Date(pickup);
    if (at.getTime() < earliest - 60_000)
      throw new ApiError(422, `La recogida debe ser dentro de ${st.orders.prepMinutes} minutos como mínimo`, "pickup_too_soon");
    if (at.getTime() > now + 3 * 86_400_000) throw new ApiError(422, "Solo se puede programar hasta 3 días", "pickup_too_far");
    if (!isOpenAt(st.store, at)) throw new ApiError(422, "A esa hora el local está cerrado", "pickup_closed");
    candidates = [at];
  }
  return { candidates, slotMinutes: st.orders.slotMinutes, maxPerSlot: st.orders.maxPerSlot, timeoutMin: st.orders.pendingTimeoutMin };
}

export function mailOrder(o: Order, items: PricedLine[] | (typeof schema.orderItems.$inferSelect)[]): MailOrder & { id: string } {
  return {
    id: o.id,
    code: o.code,
    customerName: o.customerName,
    totalCents: o.totalCents,
    taxCents: o.taxCents,
    discountCents: o.discountCents,
    paymentMethod: o.paymentMethod,
    pickupAt: o.pickupAt,
    items: items.map((i) => ({ quantity: i.quantity, title: i.title, description: i.description, totalCents: i.totalCents })),
  };
}

async function orderItems(tx: Tx | ReturnType<typeof db>, orderId: string) {
  return tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
}

/** Envía en segundo plano, tras responder, los correos encolados para ese pedido. */
export function flushMail(orderId?: string) {
  try {
    after(() => processOutbox(10, orderId).catch((e) => console.error("[mail]", e)));
  } catch {
    processOutbox(10, orderId).catch(() => {});
  }
}

/* ---------- crear pedido ---------- */

export async function createOrder(input: CreateOrderInput, ip: string, idemKey: string | null) {
  const st = await getSettings();
  if (!st.orders.enabled) throw new ApiError(503, st.orders.pausedMessage, "paused");
  const pay = await paymentConfig();
  if (!pay[input.paymentMethod].enabled) throw new ApiError(422, "Ese método de pago no está disponible", "bad_method");

  // Idempotencia: el mismo Idempotency-Key devuelve el mismo pedido (reintentos, doble clic).
  if (idemKey) {
    const prev = await db().select().from(schema.orders).where(eq(schema.orders.idempotencyKey, idemKey));
    if (prev[0]) return { order: prev[0], replay: true };
    if (!(await kv().setNx(`idem:${idemKey}`, "1", 60))) throw new ApiError(409, "Pedido en proceso, espera un momento", "in_progress");
  }

  try {
    const q = await quote(input.lines, input.coupon || undefined);
    const pickup = await resolvePickup(input.pickup);
    const cashFlow = input.paymentMethod === "cash";

    const order = await db().transaction(async (tx) => {
      // Capacidad por franja: bloqueo por franja para que no se cuele nadie con carga alta.
      let pickupAt: Date | null = null;
      for (const at of pickup.candidates) {
        const slot = slotStart(at, pickup.slotMinutes);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"slot:" + slot.toISOString()}))`);
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.orders)
          .where(
            and(
              gte(schema.orders.pickupAt, slot),
              lt(schema.orders.pickupAt, new Date(slot.getTime() + pickup.slotMinutes * 60_000)),
              ne(schema.orders.status, "cancelled"),
              // los pendientes de pago caducados no ocupan sitio
              sql`not (${schema.orders.status} = 'pending_payment' and ${schema.orders.createdAt} < now() - make_interval(mins => ${pickup.timeoutMin}))`,
            ),
          );
        if (n < pickup.maxPerSlot) {
          pickupAt = at;
          break;
        }
      }
      if (!pickupAt)
        throw new ApiError(409, input.pickup === "asap" ? "Estamos a tope ahora mismo. Elige una hora de recogida más tarde." : "Esa franja está completa. Elige otra hora de recogida.", "slot_full");

      if (input.coupon) {
        const upd = await tx
          .update(schema.coupons)
          .set({ usedCount: sql`${schema.coupons.usedCount} + 1` })
          .where(and(eq(schema.coupons.code, input.coupon), sql`(${schema.coupons.maxUses} is null or ${schema.coupons.usedCount} < ${schema.coupons.maxUses})`))
          .returning({ code: schema.coupons.code });
        if (!upd.length) throw new ApiError(422, "El cupón ya se ha agotado", "bad_coupon");
      }

      const c = input.customer;
      const [cust] = await tx
        .insert(schema.customers)
        .values({ email: c.email, name: c.name, phone: c.phone || null, marketingOptIn: !!c.marketing })
        .onConflictDoUpdate({
          target: schema.customers.email,
          set: { name: c.name, phone: c.phone || sql`${schema.customers.phone}`, marketingOptIn: !!c.marketing, anonymizedAt: null },
        })
        .returning({ id: schema.customers.id });

      let created: Order | undefined;
      for (let i = 0; i < 5 && !created; i++) {
        const rows = await tx
          .insert(schema.orders)
          .values({
            code: newCode(),
            customerId: cust.id,
            customerName: c.name,
            customerEmail: c.email,
            customerPhone: c.phone || null,
            status: cashFlow ? "confirmed" : "pending_payment",
            paymentStatus: "pending",
            paymentMethod: input.paymentMethod,
            subtotalCents: q.subtotal,
            discountCents: q.discount,
            totalCents: q.total,
            taxCents: q.tax,
            taxRate: q.taxRateBp,
            couponCode: input.coupon || null,
            pickupAt,
            notes: input.notes || null,
            idempotencyKey: idemKey,
            ip,
          })
          .onConflictDoNothing({ target: schema.orders.code })
          .returning();
        created = rows[0];
      }
      if (!created) throw new Error("No se pudo generar un código de pedido");
      await tx.insert(schema.orderItems).values(q.priced.map((l) => ({ ...l, orderId: created.id })));
      await tx.insert(schema.orderEvents).values({ orderId: created.id, type: "created", message: `Pedido creado (${input.paymentMethod})` });
      if (cashFlow) await onConfirmed(tx, created, q.priced);
      return created;
    });

    bumpBoard();
    if (cashFlow) flushMail(order.id);
    return { order, replay: false };
  } catch (e) {
    if (idemKey) await kv().del(`idem:${idemKey}`);
    if (idemKey && (e as { code?: string })?.code === "23505") {
      const prev = await db().select().from(schema.orders).where(eq(schema.orders.idempotencyKey, idemKey));
      if (prev[0]) return { order: prev[0], replay: true };
    }
    throw e;
  }
}

/** Al confirmarse (pago o efectivo): estadísticas del cliente y correos. */
async function onConfirmed(tx: Tx, o: Order, items?: PricedLine[] | (typeof schema.orderItems.$inferSelect)[]) {
  if (o.customerId)
    await tx
      .update(schema.customers)
      .set({
        ordersCount: sql`${schema.customers.ordersCount} + 1`,
        totalSpentCents: sql`${schema.customers.totalSpentCents} + ${o.totalCents}`,
        lastOrderAt: sql`now()`,
      })
      .where(eq(schema.customers.id, o.customerId));
  const its = items ?? (await orderItems(tx, o.id));
  const m = mailOrder(o, its);
  await enqueue(tx, "confirmed", o.customerEmail, m);
  const notify = (await getSettings()).orders.notifyEmail;
  if (notify) await enqueue(tx, "staff_new_order", notify, m);
}

/* ---------- pagos ---------- */

/** Marca un pedido como pagado. Idempotente: si ya estaba pagado no hace nada. */
export async function markPaid(orderId: string, provider: Order["paymentMethod"], ref: string, amountCents: number, raw?: unknown) {
  const res = await db().transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!o) throw new Error(`Pedido ${orderId} no existe`);
    await tx
      .insert(schema.payments)
      .values({ orderId, provider, providerRef: ref, status: "paid", amountCents, raw: raw ?? null })
      .onConflictDoUpdate({ target: [schema.payments.provider, schema.payments.providerRef], set: { status: "paid", updatedAt: sql`now()` } });
    if (o.paymentStatus === "paid") return null;
    if (amountCents !== o.totalCents) {
      // Se cobró un importe distinto: queda registrado para revisar/reembolsar desde el admin, sin confirmar el pedido.
      await tx.insert(schema.orderEvents).values({ orderId, type: "payment:mismatch", message: `Importe cobrado ${amountCents} ≠ total ${o.totalCents}. Revisar y reembolsar.` });
      console.error(`[pago] importe no coincide en pedido ${o.code}`);
      return null;
    }
    const wasCancelled = o.status === "cancelled";
    const [u] = await tx
      .update(schema.orders)
      .set({
        paymentStatus: "paid",
        paidAt: sql`now()`,
        updatedAt: sql`now()`,
        status: o.status === "pending_payment" || wasCancelled ? "confirmed" : o.status,
        cancelledAt: null,
      })
      .where(eq(schema.orders.id, orderId))
      .returning();
    await tx.insert(schema.orderEvents).values({ orderId, type: "payment:paid", message: `Pago recibido por ${provider} (${ref})` });
    if (o.status === "pending_payment" || wasCancelled) await onConfirmed(tx, u);
    return u;
  });
  if (res) {
    bumpBoard();
    flushMail(orderId);
  }
  return res;
}

export async function markPaymentFailed(orderId: string, provider: Order["paymentMethod"], ref: string, reason: string) {
  await db().transaction(async (tx) => {
    await tx
      .insert(schema.payments)
      .values({ orderId, provider, providerRef: ref, status: "failed", amountCents: 0, raw: { reason } })
      .onConflictDoNothing();
    await tx.insert(schema.orderEvents).values({ orderId, type: "payment:failed", message: reason.slice(0, 200) });
  });
}

/* ---------- estados ---------- */

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["collected", "preparing", "cancelled"],
  collected: [],
  cancelled: [],
};
const MAIL_ON: Partial<Record<OrderStatus, Template>> = { preparing: "preparing", ready: "ready", collected: "collected", cancelled: "cancelled" };
export const canMove = (from: OrderStatus, to: OrderStatus) => NEXT[from].includes(to);

export async function setStatus(
  orderId: string,
  to: OrderStatus,
  by: { id: string; email: string } | null,
  opts: { reason?: string; cashPaid?: boolean; notify?: boolean } = {},
) {
  const res = await db().transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!o) throw new ApiError(404, "Pedido no encontrado", "not_found");
    if (o.status === to) return o;
    if (!canMove(o.status, to)) throw new ApiError(409, `No se puede pasar de "${o.status}" a "${to}"`, "bad_transition");
    if (to === "confirmed" && o.paymentMethod !== "cash" && o.paymentStatus !== "paid")
      throw new ApiError(409, "El pedido aún no está pagado", "unpaid");
    const now = new Date();
    const patch: Partial<Order> = { status: to, updatedAt: now };
    if (to === "ready") patch.readyAt = now;
    if (to === "collected") {
      patch.collectedAt = now;
      if (o.paymentMethod === "cash" && o.paymentStatus !== "paid") {
        if (!opts.cashPaid) throw new ApiError(409, "Cobra el pedido en efectivo antes de entregarlo", "cash_unpaid");
        patch.paymentStatus = "paid";
        patch.paidAt = now;
      }
    }
    if (to === "cancelled") patch.cancelledAt = now;
    const [u] = await tx.update(schema.orders).set(patch).where(eq(schema.orders.id, orderId)).returning();
    if (patch.paymentStatus === "paid")
      await tx.insert(schema.payments).values({ orderId, provider: "cash", providerRef: `cash-${o.code}`, status: "paid", amountCents: o.totalCents }).onConflictDoNothing();
    await tx
      .insert(schema.orderEvents)
      .values({ orderId, type: `status:${to}`, message: opts.reason?.slice(0, 300) ?? null, userId: by?.id ?? null });
    if (to === "cancelled" && o.couponCode)
      await tx.update(schema.coupons).set({ usedCount: sql`greatest(${schema.coupons.usedCount} - 1, 0)` }).where(eq(schema.coupons.code, o.couponCode));
    if (to === "confirmed" && o.status === "pending_payment") await onConfirmed(tx, u);
    const tpl = MAIL_ON[to];
    // No avisamos de la cancelación automática de pedidos que nunca se pagaron.
    if (tpl && opts.notify !== false && !(to === "cancelled" && o.status === "pending_payment"))
      await enqueue(tx, tpl, o.customerEmail, mailOrder(u, await orderItems(tx, orderId)));
    return u;
  });
  bumpBoard();
  flushMail(orderId);
  return res;
}

/** Cancela pedidos online que no se pagaron a tiempo. Lo llama el cron. */
export async function expireUnpaid() {
  const mins = (await getSettings()).orders.pendingTimeoutMin;
  const stale = await db()
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "pending_payment"), lt(schema.orders.createdAt, new Date(Date.now() - mins * 60_000))))
    .limit(200);
  for (const s of stale) await setStatus(s.id, "cancelled", null, { reason: "Pago no completado a tiempo", notify: false }).catch(() => {});
  return stale.length;
}

export async function getOrderByCode(code: string) {
  const [o] = await db().select().from(schema.orders).where(eq(schema.orders.code, code));
  if (!o) return null;
  const [items, events] = await Promise.all([
    orderItems(db(), o.id),
    db().select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, o.id)).orderBy(schema.orderEvents.createdAt),
  ]);
  return { order: o, items, events };
}

export const ACTIVE: OrderStatus[] = ["confirmed", "preparing", "ready"];
export const activeFilter = inArray(schema.orders.status, ACTIVE);

/**
 * Mantenimiento ligero sin depender del cron (en Vercel Hobby solo hay 1 cron al día):
 * como mucho una vez por minuto, tras responder, caduca pedidos sin pagar y envía correos.
 */
export async function maintenance() {
  if (!(await kv().setNx("maint:lock", "1", 60).catch(() => false))) return;
  const run = async () => {
    await expireUnpaid().catch((e) => console.error("[maint]", e));
    await processOutbox(50).catch((e) => console.error("[maint]", e));
  };
  try {
    after(run);
  } catch {
    run();
  }
}
