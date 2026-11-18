"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { BurgerMark } from "@/components/Brand";
import { api } from "../_lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"pass" | "totp">("pass");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

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

  const lbl = "mb-1.5 block text-[11px] font-bold tracking-[0.12em] text-white/85 uppercase";
  const inp = "h-12 w-full rounded-xl border-0 bg-white pr-3 pl-10 text-[15px] text-char placeholder:text-zinc-400 outline-none ring-4 ring-transparent transition focus:ring-gold/40";
  return (
    <main className="admin-ui relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div aria-hidden className="absolute inset-0 bg-gold" />
      <div aria-hidden className="absolute inset-0 bg-char [clip-path:polygon(0_68%,100%_18%,100%_100%,0_100%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 brand-stripe" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center">
          <span className="grid size-24 place-items-center rounded-[28px] bg-char shadow-[0_20px_40px_-18px_rgb(0_0_0/0.7)] ring-4 ring-white/40">
            <BurgerMark className="h-14 w-[4.5rem]" />
          </span>
          <span className="mt-3 font-display text-[30px] leading-none font-black text-char uppercase italic drop-shadow-[0_1px_0_rgb(255_255_255/0.4)]">Crea tu Burger</span>
          <svg viewBox="0 0 100 8" className="mt-1 h-2 w-40" aria-hidden preserveAspectRatio="none">
            <path d="M2 6C30 1 70 0 98 3" stroke="#e3261b" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-char p-7 text-white shadow-[0_30px_60px_-25px_rgb(0_0_0/0.8)]">
          <p className="text-center text-[11px] font-bold tracking-[0.2em] text-gold uppercase">Panel de administración</p>
          <h1 className="mt-1 text-center font-display text-[30px] leading-tight font-black uppercase italic">{step === "pass" ? "Iniciar sesión" : "Verificación"}</h1>
          <div className="mx-auto mt-2 mb-6 h-1 w-10 rounded-full bg-red" />
          {step === "pass" ? (
            <div className="space-y-4">
              <label className="block">
                <span className={lbl}>Correo</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-char/70" />
                  <input className={inp} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus placeholder="tu@correo.com" />
                </span>
              </label>
              <label className="block">
                <span className={lbl}>Contraseña</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-char/70" />
                  <input className={inp + " pr-11"} type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute top-3 right-3 text-char/60 hover:text-char">
                    {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </span>
              </label>
            </div>
          ) : (
            <label className="block">
              <span className={lbl}>Código de tu app de autenticación</span>
              <input
                className={inp + " pl-3 text-center text-xl font-bold tracking-[0.5em]"}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          )}
          {err && (
            <p role="alert" className="mt-4 rounded-xl bg-red/20 px-3 py-2.5 text-sm text-white ring-1 ring-red/50">
              {err}
            </p>
          )}
          <button disabled={busy} className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gold font-display text-lg font-black tracking-wide text-char uppercase italic shadow-[0_10px_24px_-10px_rgb(255_194_26/0.9)] transition hover:bg-gold-2 disabled:opacity-60">
            {busy ? "Comprobando…" : step === "pass" ? "Continuar" : "Verificar"} <ArrowRight className="size-5" strokeWidth={2.5} />
          </button>
          <p className="mt-5 text-center text-[11px] text-white/50">Acceso solo para el personal. Los intentos quedan registrados.</p>
        </form>
        <p className="mt-5 text-center text-[11px] text-white/60">© Crea tu Burger · Todos los derechos reservados</p>
      </div>
    </main>
  );
}
