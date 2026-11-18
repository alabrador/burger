import "server-only";
import { db, schema } from "./db";

export async function audit(
  who: { id?: string | null; email?: string | null } | null,
  action: string,
  entity?: string,
  entityId?: string | null,
  data?: unknown,
  ip?: string,
) {
  try {
    await db()
      .insert(schema.auditLog)
      .values({ userId: who?.id ?? null, userEmail: who?.email ?? null, action, entity, entityId: entityId ?? null, data: data ?? null, ip });
  } catch (e) {
    console.error("[audit]", e);
  }
}
