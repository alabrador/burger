import { PERMS, can, type Perm } from "@/server/auth";
import { admin } from "@/server/admin";
import { json } from "@/server/http";

export const GET = admin(null, async (_req, me) =>
  json({
    id: me.id,
    email: me.email,
    name: me.name,
    role: me.role,
    csrf: me.csrf,
    totpEnabled: me.totpEnabled,
    perms: (Object.keys(PERMS) as Perm[]).filter((p) => can(me.role, p)),
  }),
);
