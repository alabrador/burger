import "server-only";
import type { NextRequest } from "next/server";
import { audit } from "./audit";
import { requireStaff, type Perm, type Staff } from "./auth";
import { clientIp, handle } from "./http";

type Ctx = { params: Promise<Record<string, string>> };

/** Route handler del admin: sesión + permiso + CSRF, y una función para auditar. */
export function admin<C extends Ctx | unknown = unknown>(
  perm: Perm | null,
  fn: (req: NextRequest, me: Staff, log: (action: string, entity?: string, id?: string | null, data?: unknown) => Promise<void>, ctx: C) => Promise<Response>,
) {
  return handle<C>(async (req, ctx) => {
    const me = await requireStaff(req, perm ?? undefined);
    const ip = clientIp(req);
    return fn(req, me, (a, e, id, d) => audit(me, a, e, id, d, ip), ctx);
  });
}
