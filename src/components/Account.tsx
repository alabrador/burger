"use client";

import { ArrowLeft, Eye, EyeOff, Loader2, LogOut, MailCheck, Repeat2, ShieldCheck, User, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { accountApi, useAccount, type AccountOrder } from "@/lib/account";
import { fromOrder, makeLine } from "@/lib/lines";
import { cartCount, MAX_BURGERS, useBurger } from "@/lib/store";

type View = { v: "login" } | { v: "register" } | { v: "code"; purpose: "register" | "login"; email: string };

const input =
  "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted/70 outline-none focus:border-gold/70 focus:ring-2 focus:ring-gold/20";
const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const STATUS: Record<string, string> = {
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo para recoger",
  collected: "Entregado",
  cancelled: "Cancelado",
};

/** Panel "Mi cuenta": registro e inicio de sesión con código por correo, historial y repetir pedido. */
export default function Account() {
  const open = useAccount((s) => s.open);
  const setOpen = useAccount((s) => s.setOpen);
  const me = useAccount((s) => s.me);
  const [view, setView] = useState<View>({ v: "login" });
  const refresh = useAccount((s) => s.refresh);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);
  // al entrar se vuelve al inicio, para que al salir se vea "Iniciar sesión"
  const [prevMe, setPrevMe] = useState(me);
  if (me !== prevMe) {
    setPrevMe(me);
    if (me) setView({ v: "login" });
  }
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, setOpen]);
  if (!open) return null;

  const title = me ? "Mi cuenta" : view.v === "register" ? "Crear cuenta" : view.v === "code" ? "Revisa tu correo" : "Iniciar sesión";
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="acc-title">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="acc-title" className="flex items-center gap-2 font-display text-base font-extrabold">
            {!me && view.v !== "login" && (
              <button onClick={() => setView({ v: view.v === "code" && view.purpose === "register" ? "register" : "login" })} aria-label="Volver" className="-ml-1 rounded-md p-1 text-muted hover:text-ink">
                <ArrowLeft className="size-4" />
              </button>
            )}
            <User className="size-5 text-gold" /> {title}
          </h2>
          <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-md p-1 text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 text-sm">
          {me === undefined ? (
            <Loader2 className="mx-auto mt-10 size-6 animate-spin text-muted" />
          ) : me ? (
            <Profile />
          ) : view.v === "login" ? (
            <Login onCode={(email) => setView({ v: "code", purpose: "login", email })} onRegister={() => setView({ v: "register" })} />
          ) : view.v === "register" ? (
            <Register onCode={(email) => setView({ v: "code", purpose: "register", email })} onLogin={() => setView({ v: "login" })} />
          ) : (
            <Code purpose={view.purpose} email={view.email} onDone={() => setView({ v: "login" })} />
          )}
        </div>
      </aside>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return msg ? (
    <p role="alert" className="rounded-lg bg-red/15 px-3 py-2 text-red-200">
      {msg}
    </p>
  ) : null;
}

function Password({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className={`${input} pr-11`} type={show ? "text" : "password"} required maxLength={128} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Contraseña" placeholder="Contraseña" />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-1 top-1 grid size-9 place-items-center text-muted hover:text-ink">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button disabled={busy} className="cta-gold flex h-11 w-full items-center justify-center gap-2 rounded-xl font-display text-sm font-extrabold text-[#1b1208] disabled:opacity-60">
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function Login({ onCode, onRegister }: { onCode: (email: string) => void; onRegister: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
          await accountApi("login", { email, password });
          onCode(email.trim().toLowerCase());
        } catch (x) {
          setErr((x as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-muted">Entra para ver tus pedidos y repetir tu burger favorita con un toque.</p>
      <input className={input} type="email" required maxLength={160} autoComplete="email" placeholder="Correo electrónico" aria-label="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Password value={password} onChange={setPassword} autoComplete="current-password" />
      <Err msg={err} />
      <Submit busy={busy}>Continuar</Submit>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="size-4 shrink-0 text-gold" /> Por seguridad, después te enviaremos un código a tu correo.
      </p>
      <p className="border-t border-line pt-4 text-center text-muted">
        ¿No tienes cuenta?{" "}
        <button type="button" onClick={onRegister} className="font-semibold text-gold hover:underline">
          Crear cuenta
        </button>
      </p>
    </form>
  );
}

function Register({ onCode, onLogin }: { onCode: (email: string) => void; onLogin: () => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
          await accountApi("register", { ...f, phone: f.phone || undefined, marketing, acceptTerms: terms });
          onCode(f.email.trim().toLowerCase());
        } catch (x) {
          setErr((x as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input className={input} required minLength={2} maxLength={80} autoComplete="name" placeholder="Nombre" aria-label="Nombre" value={f.name} onChange={set("name")} />
      <input className={input} type="email" required maxLength={160} autoComplete="email" placeholder="Correo electrónico" aria-label="Correo electrónico" value={f.email} onChange={set("email")} />
      <input className={input} type="tel" maxLength={30} autoComplete="tel" placeholder="Teléfono (opcional)" aria-label="Teléfono" value={f.phone} onChange={set("phone")} />
      <Password value={f.password} onChange={(password) => setF({ ...f, password })} autoComplete="new-password" />
      <p className="-mt-1 text-xs text-muted">Mínimo 10 caracteres, con letras y números.</p>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 accent-[#ffc21a]" />
        <span>
          Acepto las{" "}
          <Link href="/condiciones" target="_blank" className="text-gold underline underline-offset-2">
            condiciones
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" target="_blank" className="text-gold underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 accent-[#ffc21a]" />
        <span>Quiero recibir ofertas por correo (opcional).</span>
      </label>
      <Err msg={err} />
      <Submit busy={busy}>Crear cuenta</Submit>
      <p className="border-t border-line pt-4 text-center text-muted">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-gold hover:underline">
          Inicia sesión
        </button>
      </p>
    </form>
  );
}

/** Pantalla del código: al escribir la sexta cifra se verifica sola y, si es correcta, entra. */
function Code({ purpose, email, onDone }: { purpose: "register" | "login"; email: string; onDone: () => void }) {
  const refresh = useAccount((s) => s.refresh);
  const [d, setD] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [wait, setWait] = useState(45);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusTick, setFocusTick] = useState(0);

  // al abrir y tras un código incorrecto, el cursor vuelve a la primera casilla
  useEffect(() => {
    if (!busy) refs.current[0]?.focus();
  }, [focusTick, busy]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async (code: string) => {
    setBusy(true);
    setErr("");
    try {
      await accountApi("verify", { purpose, email, code });
      setOk(true);
      await refresh();
    } catch (x) {
      const e = x as Error & { code?: string };
      setErr(e.message);
      setD(Array(6).fill(""));
      if (e.code === "code_expired") setWait(0);
      setFocusTick((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const fill = (from: number, text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6 - from).split("");
    if (!digits.length) return;
    const next = [...d];
    digits.forEach((c, i) => (next[from + i] = c));
    setD(next);
    const pos = Math.min(5, from + digits.length);
    refs.current[pos]?.focus();
    if (next.every(Boolean)) verify(next.join(""));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-panel-2 p-3">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-gold" />
        <p className="text-muted">
          Te hemos enviado un código de 6 cifras a <b className="text-ink">{email}</b>. Escríbelo y entrarás automáticamente.
        </p>
      </div>
      <fieldset className="flex justify-between gap-2" disabled={busy || ok} aria-label="Código de verificación">
        {d.map((v, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={v}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? 6 : 1}
            aria-label={`Cifra ${i + 1}`}
            className={`h-14 w-full min-w-0 rounded-xl border bg-bg text-center font-display text-2xl font-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25 ${ok ? "border-ok text-ok" : err ? "border-red/70" : "border-line"}`}
            onChange={(e) => {
              const t = e.target.value;
              if (!t) {
                const next = [...d];
                next[i] = "";
                setD(next);
              } else fill(i, t);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !d[i] && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
            }}
            onPaste={(e) => {
              e.preventDefault();
              fill(i, e.clipboardData.getData("text"));
            }}
          />
        ))}
      </fieldset>
      {busy && (
        <p className="flex items-center justify-center gap-2 text-muted">
          <Loader2 className="size-4 animate-spin" /> Comprobando…
        </p>
      )}
      {ok && <p className="text-center font-semibold text-ok">¡Código correcto! Entrando…</p>}
      <Err msg={err} />
      <p className="text-center text-xs text-muted">
        ¿No te llega? Mira en spam o{" "}
        {wait > 0 ? (
          <span>pide otro en {wait} s</span>
        ) : (
          <button
            type="button"
            className="font-semibold text-gold hover:underline"
            onClick={async () => {
              setErr("");
              try {
                await accountApi("resend", { purpose, email });
                setWait(45);
              } catch (x) {
                const e = x as Error & { code?: string };
                if (e.code === "code_expired") onDone();
                setErr(e.message);
              }
            }}
          >
            envía uno nuevo
          </button>
        )}
        .
      </p>
    </div>
  );
}

function Profile() {
  const me = useAccount((s) => s.me)!;
  const orders = useAccount((s) => s.orders);
  const logout = useAccount((s) => s.logout);
  const setOpen = useAccount((s) => s.setOpen);
  const [msg, setMsg] = useState("");

  const repeat = (o: AccountOrder) => {
    const s = useBurger.getState();
    const want = o.items.reduce((n, i) => n + i.quantity, 0);
    if (cartCount(s.cart) + want > MAX_BURGERS) return setMsg(`Máximo ${MAX_BURGERS} hamburguesas por pedido. Vacía un poco el carrito.`);
    const dropped = new Set<string>();
    let added = 0;
    for (const it of o.items) {
      const r = fromOrder(it.config);
      if (!r.line) {
        dropped.add(it.title);
        continue;
      }
      r.dropped.forEach((x) => dropped.add(x));
      s.addLine(makeLine(r.line, it.quantity));
      added += it.quantity;
    }
    if (!added) return setMsg("Ese pedido ya no se puede repetir: sus productos no están disponibles.");
    if (dropped.size) return setMsg(`Añadido al carrito sin: ${[...dropped].join(", ")} (no disponible ahora).`);
    setOpen(false);
    s.setCartOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-gold font-display text-xl font-black text-[#1b1208]">{me.name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-extrabold">{me.name}</p>
          <p className="truncate text-xs text-muted">{me.email}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:border-gold/60 hover:text-ink">
          <LogOut className="size-3.5" /> Salir
        </button>
      </div>
      {msg && <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">{msg}</p>}
      <section>
        <h3 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-muted">Mis pedidos</h3>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-muted">Aún no tienes pedidos. Cuando pidas, aparecerán aquí para repetirlos con un toque.</p>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.code} className="rounded-xl border border-line bg-panel-2 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display font-extrabold tracking-wide">{o.code}</p>
                  <p className="font-display font-extrabold tabular-nums">{fmt.format(o.totalCents / 100)}</p>
                </div>
                <p className="text-xs text-muted">
                  {new Date(o.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} · {STATUS[o.status] ?? o.status}
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {o.items.map((i, n) => (
                    <li key={n}>
                      <b>
                        {i.quantity}× {i.title}
                      </b>{" "}
                      <span className="text-muted">{i.description}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => repeat(o)} className="cta-gold flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg font-display text-xs font-extrabold text-[#1b1208]">
                    <Repeat2 className="size-4" /> Repetir
                  </button>
                  <a href={o.url} className="flex h-9 items-center rounded-lg border border-line px-3 text-xs font-semibold hover:border-gold/60">
                    Ver pedido
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
