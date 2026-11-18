import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { json, query } from "@/server/http";

const q = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1), action: z.string().max(40).optional(), entity: z.string().max(40).optional(), entityId: z.string().max(80).optional() });

export const GET = admin("audit.view", async (req) => {
  const f = query(req, q);
  const a = schema.auditLog;
  const where = and(f.action ? ilike(a.action, `${f.action.replace(/[%_\\]/g, "")}%`) : undefined, f.entity ? eq(a.entity, f.entity) : undefined, f.entityId ? eq(a.entityId, f.entityId) : undefined);
  const [rows, [{ total }]] = await Promise.all([
    db().select().from(a).where(where).orderBy(desc(a.id)).limit(50).offset((f.page - 1) * 50),
    db().select({ total: sql<number>`count(*)::int` }).from(a).where(where),
  ]);
  return json({ rows, total, page: f.page, size: 50 });
});
