"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../_lib/api";
import { Btn, Card, cx, Field, inputCls, PageHead, Toggle, useData, useToast } from "../../_lib/ui";

type Range = { open: string; close: string };
type S = {
  store: { name: string; legalName: string; taxId: string; address: string; city: string; postalCode: string; phone: string; email: string; timezone: string; hours: Range[][]; notice: string };
  orders: { enabled: boolean; pausedMessage: string; prepMinutes: number; slotMinutes: number; maxPerSlot: number; maxBurgersPerOrder: number; taxRateBp: number; pendingTimeoutMin: number; notifyEmail: string };
  smtp: { host: string; port: number; secure: boolean; user: string; fromName: string; fromEmail: string; replyTo: string; hasPass: boolean; fromEnv: boolean };
  payments: {
    cash: { enabled: boolean };
    stripe: { enabled: boolean; hasSecretKey: boolean; hasWebhookSecret: boolean; fromEnv: boolean; ready: boolean; webhookUrl: string };
    paypal: { enabled: boolean; env: "sandbox" | "live"; clientId: string; hasClientSecret: boolean; webhookId: string; fromEnv: boolean; ready: boolean; webhookUrl: string };
    bizum: { enabled: boolean; env: "test" | "live"; merchantCode: string; terminal: string; hasSecretKey: boolean; fromEnv: boolean; ready: boolean; notifyUrl: string };
  };
};
const TABS = [
  ["store", "Local"],
  ["hours", "Horario"],
  ["orders", "Pedidos"],
  ["smtp", "Correo"],
  ["payments", "Pagos"],
] as const;
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function Configuracion() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("store");
  const { data, reload } = useData(() => api<S>("/api/admin/settings"));
  return (
    <>
      <PageHead title="Configuración" sub="Datos del local, horario, pedidos, correo y pasarelas de pago" />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap", tab === k ? "border-gold font-semibold text-gold-ink" : "border-transparent text-muted hover:text-ink")}>
            {l}
          </button>
        ))}
      </div>
      {!data ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="max-w-3xl">
          {tab === "store" && <Store s={data} onSaved={reload} />}
          {tab === "hours" && <Hours s={data} onSaved={reload} />}
          {tab === "orders" && <Orders s={data} onSaved={reload} />}
          {tab === "smtp" && <Smtp s={data} onSaved={reload} />}
          {tab === "payments" && <Payments s={data} onSaved={reload} />}
        </div>
      )}
    </>
  );
}

function useSave(section: string, onSaved: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    save: async (value: unknown) => {
      setBusy(true);
      try {
        await api("/api/admin/settings", { method: "PUT", body: { section, value } });
        toast("Configuración guardada");
        onSaved();
      } catch (e) {
        toast((e as Error).message, "err");
      } finally {
        setBusy(false);
      }
    },
  };
}

function Store({ s, onSaved }: { s: S; onSaved: () => void }) {
  const [f, setF] = useState(s.store);
  const { save, busy } = useSave("store", onSaved);
  const inp = (k: keyof S["store"], label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}>
      <input className={inputCls} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
    </Field>
  );
  return (
    <Card title="Datos del local">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save(f);
        }}
      >
        {inp("name", "Nombre comercial", { required: true, minLength: 2 })}
        {inp("legalName", "Razón social (factura)")}
        {inp("taxId", "NIF / CIF")}
        {inp("phone", "Teléfono", { type: "tel" })}
        {inp("email", "Correo de contacto", { type: "email" })}
        {inp("address", "Dirección")}
        {inp("postalCode", "Código postal")}
        {inp("city", "Ciudad")}
        <Field label="Zona horaria">
          <select className={inputCls} value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>
            <option value="Europe/Madrid">Península y Baleares</option>
            <option value="Atlantic/Canary">Canarias</option>
          </select>
        </Field>
        <Field label="Aviso en la web (opcional)" className="sm:col-span-2">
          <input className={inputCls} value={f.notice} onChange={(e) => setF({ ...f, notice: e.target.value })} maxLength={200} placeholder="Ej.: Hoy cerramos a las 22:00" />
        </Field>
        <div className="sm:col-span-2">
          <Btn variant="gold" disabled={busy}>
            Guardar
          </Btn>
        </div>
      </form>
    </Card>
  );
}

function Hours({ s, onSaved }: { s: S; onSaved: () => void }) {
  const [h, setH] = useState(s.store.hours);
  const { save, busy } = useSave("store", onSaved);
  const upd = (d: number, fn: (r: Range[]) => Range[]) => setH((x) => x.map((r, i) => (i === d ? fn(r) : r)));
  return (
    <Card title="Horario de pedidos" actions={<span className="text-xs text-muted">Tramos que pasan de medianoche: cierre menor que apertura</span>}>
      <ul className="divide-y divide-line/60">
        {ORDER.map((d) => (
          <li key={d} className="flex flex-wrap items-center gap-2 py-2.5">
            <span className="w-24 text-sm font-medium">{DAYS[d]}</span>
            {h[d].length === 0 && <span className="text-sm text-muted">Cerrado</span>}
            {h[d].map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                <input type="time" className={inputCls + " w-28"} value={r.open} onChange={(e) => upd(d, (rs) => rs.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} aria-label={`${DAYS[d]} apertura ${i + 1}`} />
                –
                <input type="time" className={inputCls + " w-28"} value={r.close} onChange={(e) => upd(d, (rs) => rs.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} aria-label={`${DAYS[d]} cierre ${i + 1}`} />
                <button onClick={() => upd(d, (rs) => rs.filter((_, j) => j !== i))} aria-label="Quitar tramo" className="p-1 text-muted hover:text-red-700">
                  <Trash2 className="size-4" />
                </button>
              </span>
            ))}
            {h[d].length < 3 && (
              <Btn size="sm" onClick={() => upd(d, (rs) => [...rs, { open: "12:00", close: "16:00" }])}>
                <Plus className="size-3.5" /> Tramo
              </Btn>
            )}
          </li>
        ))}
      </ul>
      <Btn variant="gold" className="mt-3" disabled={busy} onClick={() => save({ ...s.store, hours: h })}>
        Guardar horario
      </Btn>
    </Card>
  );
}

function Orders({ s, onSaved }: { s: S; onSaved: () => void }) {
  const [f, setF] = useState(s.orders);
  const { save, busy } = useSave("orders", onSaved);
  const num = (k: keyof S["orders"], label: string, min: number, max: number, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} type="number" min={min} max={max} value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
    </Field>
  );
  return (
    <Card title="Pedidos">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(f);
        }}
      >
        <div className="rounded-lg border border-line bg-panel-2 p-3">
          <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={f.enabled ? "Aceptando pedidos" : "Pedidos en pausa"} />
          {!f.enabled && (
            <Field label="Mensaje para los clientes" className="mt-2">
              <input className={inputCls} value={f.pausedMessage} onChange={(e) => setF({ ...f, pausedMessage: e.target.value })} maxLength={160} />
            </Field>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {num("prepMinutes", "Preparación mínima (min)", 5, 120)}
          {num("slotMinutes", "Franja de recogida (min)", 5, 60)}
          {num("maxPerSlot", "Pedidos máx. por franja", 1, 500, "Controla la carga de cocina")}
          {num("maxBurgersPerOrder", "Hamburguesas máx. por pedido", 1, 50)}
          {num("pendingTimeoutMin", "Caducidad sin pagar (min)", 5, 120)}
          <Field label="IVA (%)" hint="Hostelería: 10 %">
            <input className={inputCls} type="number" min={0} max={30} step={0.5} value={f.taxRateBp / 100} onChange={(e) => setF({ ...f, taxRateBp: Math.round(Number(e.target.value) * 100) })} />
          </Field>
        </div>
        <Field label="Avisar de cada pedido nuevo a (correo, opcional)">
          <input className={inputCls} type="email" value={f.notifyEmail} onChange={(e) => setF({ ...f, notifyEmail: e.target.value })} />
        </Field>
        <Btn variant="gold" disabled={busy}>
          Guardar
        </Btn>
      </form>
    </Card>
  );
}

function Smtp({ s, onSaved }: { s: S; onSaved: () => void }) {
  const toast = useToast();
  const { hasPass, fromEnv, ...rest } = s.smtp;
  const [f, setF] = useState({ ...rest, pass: "" });
  const [to, setTo] = useState("");
  const { save, busy } = useSave("smtp", onSaved);
  const test = async () => {
    try {
      await api("/api/admin/settings/smtp-test", { method: "POST", body: { to } });
      toast(`Correo de prueba enviado a ${to}`);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  return (
    <div className="space-y-4">
      <Card title="Servidor SMTP" actions={fromEnv && <span className="text-xs text-amber-700">Variables de entorno activas: tienen prioridad</span>}>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save({ ...f, pass: f.pass || undefined });
          }}
        >
          <Field label="Servidor" hint="Ej.: smtp.gmail.com, smtp.ionos.es, smtp-relay.brevo.com">
            <input className={inputCls} value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Puerto">
              <input className={inputCls} type="number" value={f.port} onChange={(e) => setF({ ...f, port: Number(e.target.value) })} />
            </Field>
            <Field label="Cifrado">
              <select className={inputCls} value={f.secure ? "ssl" : "tls"} onChange={(e) => setF({ ...f, secure: e.target.value === "ssl", port: e.target.value === "ssl" ? 465 : 587 })}>
                <option value="tls">STARTTLS (587)</option>
                <option value="ssl">SSL (465)</option>
              </select>
            </Field>
          </div>
          <Field label="Usuario">
            <input className={inputCls} value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Contraseña" hint={hasPass ? "Guardada cifrada. Déjala vacía para no cambiarla." : undefined}>
            <input className={inputCls} type="password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} autoComplete="new-password" placeholder={hasPass ? "••••••••" : ""} />
          </Field>
          <Field label="Nombre del remitente">
            <input className={inputCls} value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} />
          </Field>
          <Field label="Correo del remitente">
            <input className={inputCls} type="email" value={f.fromEmail} onChange={(e) => setF({ ...f, fromEmail: e.target.value })} />
          </Field>
          <Field label="Responder a (opcional)">
            <input className={inputCls} type="email" value={f.replyTo} onChange={(e) => setF({ ...f, replyTo: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Btn variant="gold" disabled={busy}>
              Guardar
            </Btn>
          </div>
        </form>
      </Card>
      <Card title="Probar envío">
        <div className="flex gap-2">
          <input className={inputCls} type="email" placeholder="tu@correo.com" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Correo de prueba" />
          <Btn onClick={test} disabled={!to}>
            Enviar prueba
          </Btn>
        </div>
        <p className="mt-2 text-xs text-muted">Correos automáticos: confirmado (con QR), en preparación, listo para recoger, entregado, cancelado y reembolso. Se reintentan solos si falla el servidor.</p>
      </Card>
    </div>
  );
}

function CopyUrl({ label, url }: { label: string; url: string }) {
  const toast = useToast();
  return (
    <div className="flex items-center gap-2 rounded-md bg-bg px-2.5 py-1.5 text-xs">
      <span className="text-muted">{label}:</span>
      <code className="min-w-0 flex-1 truncate">{url}</code>
      <button type="button" onClick={() => navigator.clipboard.writeText(url).then(() => toast("Copiado"))} aria-label="Copiar" className="text-muted hover:text-gold-ink">
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

function Payments({ s, onSaved }: { s: S; onSaved: () => void }) {
  const p = s.payments;
  const [f, setF] = useState({
    cash: { enabled: p.cash.enabled },
    stripe: { enabled: p.stripe.enabled, secretKey: "", webhookSecret: "" },
    paypal: { enabled: p.paypal.enabled, env: p.paypal.env, clientId: p.paypal.clientId, clientSecret: "", webhookId: p.paypal.webhookId },
    bizum: { enabled: p.bizum.enabled, env: p.bizum.env, merchantCode: p.bizum.merchantCode, terminal: p.bizum.terminal, secretKey: "" },
  });
  const { save, busy } = useSave("payments", onSaved);
  const up = <K extends keyof typeof f>(k: K, v: Partial<(typeof f)[K]>) => setF((x) => ({ ...x, [k]: { ...x[k], ...v } }));
  const state = (ready: boolean, env: boolean) => (
    <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-semibold", ready ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-500/15 text-zinc-500")}>
      {ready ? "Listo" : "Sin activar"}
      {env ? " · env" : ""}
    </span>
  );
  const secretHint = (has: boolean) => (has ? "Guardada cifrada. Vacío = no cambiar." : "Se guarda cifrada (AES-256).");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "" && /secret/i.test(k) ? undefined : v]));
        save({ cash: f.cash, stripe: clean(f.stripe), paypal: clean(f.paypal), bizum: clean(f.bizum) });
      }}
    >
      <Card title="Efectivo al recoger" actions={state(p.cash.enabled, false)}>
        <Toggle checked={f.cash.enabled} onChange={(v) => up("cash", { enabled: v })} label="Permitir pagar en el mostrador" />
      </Card>
      <Card title="Tarjeta (Stripe)" actions={state(p.stripe.ready, p.stripe.fromEnv)}>
        <div className="space-y-3">
          <Toggle checked={f.stripe.enabled} onChange={(v) => up("stripe", { enabled: v })} label="Activar Stripe Checkout (tarjeta, Apple Pay, Google Pay)" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Clave secreta (sk_live_… / sk_test_…)" hint={secretHint(p.stripe.hasSecretKey)}>
              <input className={inputCls} type="password" autoComplete="off" value={f.stripe.secretKey} onChange={(e) => up("stripe", { secretKey: e.target.value })} />
            </Field>
            <Field label="Secreto del webhook (whsec_…)" hint={secretHint(p.stripe.hasWebhookSecret)}>
              <input className={inputCls} type="password" autoComplete="off" value={f.stripe.webhookSecret} onChange={(e) => up("stripe", { webhookSecret: e.target.value })} />
            </Field>
          </div>
          <CopyUrl label="URL del webhook" url={p.stripe.webhookUrl} />
          <p className="text-[11px] text-muted">En Stripe → Desarrolladores → Webhooks, añade esa URL con los eventos checkout.session.completed, checkout.session.async_payment_succeeded y checkout.session.async_payment_failed.</p>
        </div>
      </Card>
      <Card title="Bizum (Redsys)" actions={state(p.bizum.ready, p.bizum.fromEnv)}>
        <div className="space-y-3">
          <Toggle checked={f.bizum.enabled} onChange={(v) => up("bizum", { enabled: v })} label="Activar Bizum a través del TPV virtual Redsys de tu banco" />
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Entorno">
              <select className={inputCls} value={f.bizum.env} onChange={(e) => up("bizum", { env: e.target.value as "test" | "live" })}>
                <option value="test">Pruebas</option>
                <option value="live">Real</option>
              </select>
            </Field>
            <Field label="Nº de comercio (FUC)">
              <input className={inputCls} inputMode="numeric" value={f.bizum.merchantCode} onChange={(e) => up("bizum", { merchantCode: e.target.value })} />
            </Field>
            <Field label="Terminal">
              <input className={inputCls} inputMode="numeric" value={f.bizum.terminal} onChange={(e) => up("bizum", { terminal: e.target.value })} />
            </Field>
            <Field label="Clave SHA-256" hint={secretHint(p.bizum.hasSecretKey)}>
              <input className={inputCls} type="password" autoComplete="off" value={f.bizum.secretKey} onChange={(e) => up("bizum", { secretKey: e.target.value })} />
            </Field>
          </div>
          <CopyUrl label="URL de notificación" url={p.bizum.notifyUrl} />
          <p className="text-[11px] text-muted">Pide a tu banco que active Bizum en el TPV. La notificación online se configura sola con cada pago.</p>
        </div>
      </Card>
      <Card title="PayPal" actions={state(p.paypal.ready, p.paypal.fromEnv)}>
        <div className="space-y-3">
          <Toggle checked={f.paypal.enabled} onChange={(v) => up("paypal", { enabled: v })} label="Activar PayPal" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Entorno">
              <select className={inputCls} value={f.paypal.env} onChange={(e) => up("paypal", { env: e.target.value as "sandbox" | "live" })}>
                <option value="sandbox">Sandbox (pruebas)</option>
                <option value="live">Real</option>
              </select>
            </Field>
            <Field label="Client ID">
              <input className={inputCls} value={f.paypal.clientId} onChange={(e) => up("paypal", { clientId: e.target.value })} />
            </Field>
            <Field label="Secret" hint={secretHint(p.paypal.hasClientSecret)}>
              <input className={inputCls} type="password" autoComplete="off" value={f.paypal.clientSecret} onChange={(e) => up("paypal", { clientSecret: e.target.value })} />
            </Field>
            <Field label="Webhook ID (opcional, recomendado)">
              <input className={inputCls} value={f.paypal.webhookId} onChange={(e) => up("paypal", { webhookId: e.target.value })} />
            </Field>
          </div>
          <CopyUrl label="URL del webhook" url={p.paypal.webhookUrl} />
          <p className="text-[11px] text-muted">Evento: PAYMENT.CAPTURE.COMPLETED.</p>
        </div>
      </Card>
      <Btn variant="gold" disabled={busy}>
        Guardar pagos
      </Btn>
    </form>
  );
}
