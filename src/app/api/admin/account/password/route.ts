import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { destroyUserSessions, hashPassword, passwordProblem, verifyPassword } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, body, json, limit } from "@/server/http";

const s = z.object({ current: z.string().min(1).max(128), next: z.string().min(1).max(128) });

export const POST = admin(null, async (req, me, log) => {
  await limit(req, "pwd", 5, 900, me.id);
  const b = await body(req, s, 2048);
  const [u] = await db().select().from(schema.staffUsers).where(eq(schema.staffUsers.id, me.id));
  if (!u || !(await verifyPassword(u.passwordHash, b.current))) throw new ApiError(401, "La contraseña actual no es correcta", "bad_password");
  const p = passwordProblem(b.next);
  if (p) throw new ApiError(422, p, "weak_password");
  await db().update(schema.staffUsers).set({ passwordHash: await hashPassword(b.next), passwordChangedAt: sql`now()` }).where(eq(schema.staffUsers.id, me.id));
  await destroyUserSessions(me.id, me.sid);
  await log("account.password_changed", "staff_user", me.id);
  return json({ ok: true });
});
