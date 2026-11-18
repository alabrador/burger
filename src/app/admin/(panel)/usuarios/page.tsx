"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { api, dt, ROLE } from "../../_lib/api";
import { useMe } from "../../_lib/shell";
import { Btn, Card, Drawer, Field, inputCls, PageHead, Table, Toggle, useData, useToast } from "../../_lib/ui";

type U = { id: string; email: string; name: string; role: string; active: boolean; totpEnabled: boolean; lastLoginAt: string | null; lockedUntil: string | null };
const ROLE_HINT: Record<string, string> = {
  owner: "Todo, incluidos otros dueños",
  admin: "Todo salvo gestionar dueños",
  manager: "Pedidos, productos, cupones, pagos y reembolsos",
  kitchen: "Pantalla de cocina y estados",
  cashier: "Pedidos, escáner QR, cobro y clientes",
};

export default function Usuarios() {
  const me = useMe();
  const toast = useToast();
  const { data, reload } = useData(() => api<U[]>("/api/admin/users"));
  const [open, setOpen] = useState<U | "new" | null>(null);
  const patch = (u: U, body: Record<string, unknown>, ok = "Guardado") =>
    api(`/api/admin/users/${u.id}`, { method: "PATCH", body })
      .then(() => (toast(ok), reload()))
      .catch((e) => toast(e.message, "err"));
  const roles = Object.keys(ROLE).filter((r) => r !== "owner" || me.role === "owner");
  return (
    <>
      <PageHead
        title="Usuarios"
        sub="Personal con acceso al panel y sus permisos"
        actions={
          <Btn variant="gold" onClick={() => setOpen("new")}>
            <Plus className="size-4" /> Nuevo usuario
          </Btn>
        }
      />
      <Card>
        <Table head={["Usuario", "Rol", "2FA", "Último acceso", "Activo", ""]}>
          {data?.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2.5">
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted">{u.email}</div>
                {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <div className="text-xs text-red-300">Bloqueado por intentos fallidos</div>}
              </td>
              <td className="px-4 py-2.5">
                <select className={inputCls + " h-8 w-40"} value={u.role} disabled={u.id === me.id || (u.role === "owner" && me.role !== "owner")} onChange={(e) => patch(u, { role: e.target.value }, "Rol cambiado")} aria-label={`Rol de ${u.name}`}>
                  {Object.entries(ROLE)
                    .filter(([k]) => roles.includes(k) || k === u.role)
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </td>
              <td className="px-4 py-2.5 text-xs">{u.totpEnabled ? <span className="text-emerald-300">Activa</span> : <span className="text-amber-300">No</span>}</td>
              <td className="px-4 py-2.5 text-xs text-muted">{dt(u.lastLoginAt)}</td>
              <td className="px-4 py-2.5">
                <Toggle checked={u.active} disabled={u.id === me.id} onChange={(v) => patch(u, { active: v })} label={`Activo ${u.name}`} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <Btn size="sm" onClick={() => setOpen(u)}>
                  Gestionar
                </Btn>
              </td>
            </tr>
          ))}
        </Table>
        <ul className="mt-4 grid gap-1 text-xs text-muted sm:grid-cols-2">
          {Object.entries(ROLE_HINT).map(([k, v]) => (
            <li key={k}>
              <b className="text-ink">{ROLE[k]}:</b> {v}
            </li>
          ))}
        </ul>
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open === "new" ? "Nuevo usuario" : open ? open.name : ""}>
        {open === "new" ? <New roles={roles} onDone={() => (setOpen(null), reload())} /> : open && <Manage u={open} patch={(b, ok) => patch(open, b, ok).then(() => setOpen(null))} />}
      </Drawer>
    </>
  );
}

function New({ roles, onDone }: { roles: string[]; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", role: "cashier", password: "" });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/api/admin/users", { method: "POST", body: f });
          toast("Usuario creado");
          onDone();
        } catch (e) {
          toast((e as Error).message, "err");
        }
      }}
    >
      <Field label="Nombre">
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
      </Field>
      <Field label="Correo">
        <input className={inputCls} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      </Field>
      <Field label="Rol" hint={ROLE_HINT[f.role]}>
        <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE[r]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Contraseña inicial" hint="Mínimo 10 caracteres con letras y números. Pídele que la cambie y active la 2FA.">
        <input className={inputCls} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={10} />
      </Field>
      <Btn variant="gold" className="w-full">
        Crear
      </Btn>
    </form>
  );
}

function Manage({ u, patch }: { u: U; patch: (b: Record<string, unknown>, ok: string) => void }) {
  const [pwd, setPwd] = useState("");
  return (
    <div className="space-y-4 text-sm">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          patch({ password: pwd }, "Contraseña cambiada y sesiones cerradas");
        }}
      >
        <Field label="Nueva contraseña">
          <input className={inputCls} type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={10} required />
        </Field>
        <Btn size="sm">Cambiar contraseña</Btn>
      </form>
      {u.totpEnabled && (
        <Btn size="sm" variant="danger" onClick={() => confirm("¿Quitar la 2FA? Tendrá que volver a activarla.") && patch({ resetTotp: true }, "2FA restablecida")}>
          Restablecer 2FA (móvil perdido)
        </Btn>
      )}
      {u.lockedUntil && (
        <Btn size="sm" onClick={() => patch({ unlock: true }, "Desbloqueado")}>
          Desbloquear cuenta
        </Btn>
      )}
    </div>
  );
}
