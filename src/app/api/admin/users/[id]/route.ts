import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { destroyUserSessions, hashPassword, passwordProblem } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";

const patch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["owner", "admin", "manager", "kitchen", "cashier"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(1).max(128).optional(),
  resetTotp: z.literal(true).optional(),
  unlock: z.literal(true).optional(),
});

export const PATCH = admin<RouteContext<"/api/admin/users/[id]">>("users.manage", async (req, me, log, ctx) => {
  const id = z.string().uuid().parse((await ctx.params).id);
  const b = await body(req, patch, 2048);
  const [t] = await db().select().from(schema.staffUsers).where(eq(schema.staffUsers.id, id));
  if (!t) throw new ApiError(404, "Usuario no encontrado", "not_found");
  if ((t.role === "owner" || b.role === "owner") && me.role !== "owner") throw new ApiError(403, "Solo el dueño puede modificar dueños", "forbidden");
  if (id === me.id && (b.active === false || (b.role && b.role !== me.role))) throw new ApiError(422, "No puedes desactivarte ni cambiar tu propio rol", "self");
  if (t.role === "owner" && (b.active === false || (b.role && b.role !== "owner"))) {
    const [{ n }] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.staffUsers)
      .where(and(eq(schema.staffUsers.role, "owner"), eq(schema.staffUsers.active, true), ne(schema.staffUsers.id, id)));
    if (n === 0) throw new ApiError(422, "Debe quedar al menos un dueño activo", "last_owner");
  }
  const set: Partial<typeof schema.staffUsers.$inferInsert> = {};
  if (b.name) set.name = b.name;
  if (b.role) set.role = b.role;
  if (b.active !== undefined) set.active = b.active;
  if (b.password) {
    const p = passwordProblem(b.password);
    if (p) throw new ApiError(422, p, "weak_password");
    set.passwordHash = await hashPassword(b.password);
    set.passwordChangedAt = new Date();
  }
  if (b.resetTotp) Object.assign(set, { totpEnabled: false, totpSecret: null });
  if (b.unlock) Object.assign(set, { failedLogins: 0, lockedUntil: null });
  if (Object.keys(set).length) await db().update(schema.staffUsers).set(set).where(eq(schema.staffUsers.id, id));
  if (b.role || b.active === false || b.password || b.resetTotp) await destroyUserSessions(id);
  await log("user.update", "staff_user", id, { ...b, password: b.password ? "•••" : undefined });
  return json({ ok: true });
});
