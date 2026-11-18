import { asc } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { hashPassword, passwordProblem } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";

const u = schema.staffUsers;
export const GET = admin("users.manage", async () =>
  json(
    await db()
      .select({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, totpEnabled: u.totpEnabled, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, lockedUntil: u.lockedUntil })
      .from(u)
      .orderBy(asc(u.createdAt)),
  ),
);

const create = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["owner", "admin", "manager", "kitchen", "cashier"]),
  password: z.string().min(1).max(128),
});

export const POST = admin("users.manage", async (req, me, log) => {
  const b = await body(req, create, 2048);
  if (b.role === "owner" && me.role !== "owner") throw new ApiError(403, "Solo el dueño puede crear otro dueño", "forbidden");
  const p = passwordProblem(b.password);
  if (p) throw new ApiError(422, p, "weak_password");
  const rows = await db()
    .insert(u)
    .values({ email: b.email, name: b.name, role: b.role, passwordHash: await hashPassword(b.password) })
    .onConflictDoNothing()
    .returning({ id: u.id });
  if (!rows.length) throw new ApiError(409, "Ya existe un usuario con ese correo", "exists");
  await log("user.create", "staff_user", rows[0].id, { email: b.email, role: b.role });
  return json({ id: rows[0].id }, 201);
});
