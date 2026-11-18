"use client";

import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { BurgerMark } from "@/components/Brand";
import { api } from "../_lib/api";
import { Btn, Field, inputCls } from "../_lib/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"pass" | "totp">("pass");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ needTotp?: boolean }>("/api/admin/auth/login", { method: "POST", body: { email, password, code: step === "totp" ? code : undefined } });
      if (r.needTotp) {
        setStep("totp");
        return;
      }
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
    } catch (e) {
      setErr((e as Error).message);
      if (step === "totp") setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2.5">
          <BurgerMark className="size-9" />
          <div>
            <h1 className="font-display text-lg font-extrabold leading-tight">Crea tu Burger</h1>
            <p className="text-xs text-muted">Panel del restaurante</p>
          </div>
        </div>
        {step === "pass" ? (
          <div className="space-y-3">
            <Field label="Correo">
              <input className={inputCls} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Field>
            <Field label="Contraseña">
              <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>
        ) : (
          <Field label="Código de verificación (app de autenticación)">
            <input
              className={inputCls + " text-center text-lg tracking-[0.4em]"}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
        )}
        {err && (
          <p role="alert" className="mt-3 rounded-lg bg-red/15 px-3 py-2 text-sm text-red-300">
            {err}
          </p>
        )}
        <Btn variant="gold" className="mt-5 w-full" disabled={busy}>
          <LockKeyhole className="size-4" /> {busy ? "Comprobando…" : step === "pass" ? "Entrar" : "Verificar"}
        </Btn>
        <p className="mt-4 text-center text-[11px] text-muted">Acceso solo para el personal. Los intentos quedan registrados.</p>
      </form>
    </main>
  );
}
