"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api, ROLE } from "../../_lib/api";
import { useMe } from "../../_lib/shell";
import { Btn, Card, Field, inputCls, PageHead, useToast } from "../../_lib/ui";

export default function Cuenta() {
  const me = useMe();
  const toast = useToast();
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [off, setOff] = useState({ password: "", code: "" });

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.again) return toast("Las contraseñas no coinciden", "err");
    try {
      await api("/api/admin/account/password", { method: "POST", body: { current: pw.current, next: pw.next } });
      toast("Contraseña cambiada. Se cerraron tus otras sesiones.");
      setPw({ current: "", next: "", again: "" });
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/admin/account/2fa", { method: "POST", body: { code } });
      alert("2FA activada. Vuelve a entrar con tu contraseña y el código de la app.");
      location.href = "/admin/login";
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/admin/account/2fa", { method: "DELETE", body: off });
      location.href = "/admin/login";
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <>
      <PageHead title="Mi cuenta" sub={`${me.name} · ${me.email} · ${ROLE[me.role]}`} />
      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <Card title="Verificación en dos pasos (2FA)">
          {me.totpEnabled ? (
            <form className="space-y-3" onSubmit={disable}>
              <p className="flex items-center gap-2 text-sm text-emerald-300">
                <ShieldCheck className="size-4" /> Activada
              </p>
              <Field label="Contraseña">
                <input className={inputCls} type="password" value={off.password} onChange={(e) => setOff({ ...off, password: e.target.value })} required />
              </Field>
              <Field label="Código actual">
                <input className={inputCls} inputMode="numeric" maxLength={6} value={off.code} onChange={(e) => setOff({ ...off, code: e.target.value.replace(/\D/g, "") })} required />
              </Field>
              <Btn variant="danger" size="sm">
                Desactivar 2FA
              </Btn>
            </form>
          ) : setup ? (
            <form className="space-y-3" onSubmit={enable}>
              <p className="text-sm text-muted">Escanea el QR con Google Authenticator, Microsoft Authenticator o 1Password y escribe el código de 6 cifras.</p>
              <img src={setup.qr} alt="QR para la app de autenticación" className="size-44 rounded-lg bg-white p-2" />
              <p className="font-mono text-[11px] break-all text-muted">{setup.secret}</p>
              <Field label="Código">
                <input className={inputCls + " tracking-[0.3em]"} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus />
              </Field>
              <Btn variant="gold">Activar</Btn>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-300">Sin activar. Recomendado para todo el personal, obligatorio para dueños y administradores.</p>
              <Btn variant="gold" onClick={() => api<{ qr: string; secret: string }>("/api/admin/account/2fa").then(setSetup)}>
                Configurar 2FA
              </Btn>
            </div>
          )}
        </Card>
        <Card title="Cambiar contraseña">
          <form className="space-y-3" onSubmit={changePw}>
            <Field label="Contraseña actual">
              <input className={inputCls} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
            </Field>
            <Field label="Nueva contraseña" hint="Mínimo 10 caracteres con letras y números">
              <input className={inputCls} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={10} />
            </Field>
            <Field label="Repetir">
              <input className={inputCls} type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} required />
            </Field>
            <Btn variant="gold">Cambiar</Btn>
          </form>
        </Card>
      </div>
    </>
  );
}
