import { desc } from "drizzle-orm";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { query } from "@/server/http";
import { listSchema, orderFilters } from "@/server/order-filters";

const cell = (v: unknown) => {
  let s = v instanceof Date ? v.toISOString() : String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita inyección de fórmulas en Excel
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET = admin("payments.view", async (req, me, log) => {
  const f = query(req, listSchema);
  const o = schema.orders;
  const rows = await db().select().from(o).where(orderFilters(f)).orderBy(desc(o.createdAt)).limit(20_000);
  const head = ["codigo", "fecha", "estado", "pago", "metodo", "cliente", "email", "telefono", "subtotal", "descuento", "iva", "total", "cupon", "recogida"];
  const lines = rows.map((r) =>
    [r.code, r.createdAt, r.status, r.paymentStatus, r.paymentMethod, r.customerName, r.customerEmail, r.customerPhone, (r.subtotalCents / 100).toFixed(2), (r.discountCents / 100).toFixed(2), (r.taxCents / 100).toFixed(2), (r.totalCents / 100).toFixed(2), r.couponCode, r.pickupAt]
      .map(cell)
      .join(";"),
  );
  await log("orders.export", "orders", null, { count: rows.length, filters: f });
  return new Response("﻿" + [head.join(";"), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
});
