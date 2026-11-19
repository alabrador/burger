import { and, eq, isNull, sql } from "drizzle-orm";
import { PERMS, can, type Perm } from "@/server/auth";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { json } from "@/server/http";

export const GET = admin(null, async (_req, me) => {
  const openErrors = can(me.role, "audit.view")
    ? await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.appErrors)
        .where(and(isNull(schema.appErrors.resolvedAt), eq(schema.appErrors.level, "error")))
        .then((r) => r[0].n)
        .catch(() => 0)
    : 0;
  return json({
    id: me.id,
    email: me.email,
    name: me.name,
    role: me.role,
    csrf: me.csrf,
    totpEnabled: me.totpEnabled,
    perms: (Object.keys(PERMS) as Perm[]).filter((p) => can(me.role, p)),
    openErrors,
  });
});
