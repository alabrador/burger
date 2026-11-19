import { and, desc, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { body, json, query } from "@/server/http";

const e = schema.appErrors;
const q = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1), status: z.enum(["open", "resolved", "all"]).default("open") });

export const GET = admin("audit.view", async (req) => {
  const f = query(req, q);
  const where = f.status === "open" ? isNull(e.resolvedAt) : f.status === "resolved" ? isNotNull(e.resolvedAt) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db().select().from(e).where(where).orderBy(desc(e.lastAt)).limit(50).offset((f.page - 1) * 50),
    db().select({ total: sql<number>`count(*)::int` }).from(e).where(where),
  ]);
  return json({ rows, total, page: f.page, size: 50 });
});

const patch = z.object({ ids: z.array(z.number().int().positive()).max(500).optional(), all: z.boolean().optional(), reopen: z.boolean().optional() });

/** Marca errores como resueltos (o los reabre). Si vuelven a ocurrir, se reabren solos. */
export const PATCH = admin("audit.view", async (req, _me, log) => {
  const b = await body(req, patch);
  if (!b.all && !b.ids?.length) return json({ updated: 0 });
  const rows = await db()
    .update(e)
    .set({ resolvedAt: b.reopen ? null : sql`now()` })
    .where(and(b.all ? isNull(e.resolvedAt) : inArray(e.id, b.ids!)))
    .returning({ id: e.id });
  await log(b.reopen ? "errors.reopen" : "errors.resolve", "app_error", b.all ? "all" : String(b.ids!.length));
  return json({ updated: rows.length });
});
