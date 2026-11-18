"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Loader2, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type StripePay = { type: "stripe"; clientSecret: string; publishableKey: string; returnUrl: string; amountCents: number };

const eur = (c: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(c / 100);
const loaders = new Map<string, Promise<Stripe | null>>();
const getStripe = (pk: string) => {
  if (!loaders.has(pk)) loaders.set(pk, loadStripe(pk, { locale: "es" }));
  return loaders.get(pk)!;
};

/** Formulario de tarjeta de Stripe dentro de la web (los datos van cifrados directo a Stripe). */
const appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#ffc21a",
    colorBackground: "#120d0b",
    colorText: "#f6efe9",
    colorTextSecondary: "#b9aaa2",
    colorDanger: "#ff6b5e",
    borderRadius: "10px",
    fontFamily: "Inter, system-ui, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #3a2c27", boxShadow: "none" },
    ".Input:focus": { border: "1px solid rgba(255,194,26,.7)", boxShadow: "0 0 0 3px rgba(255,194,26,.2)" },
    ".Tab": { border: "1px solid #3a2c27" },
    ".Tab--selected": { borderColor: "#ffc21a" },
  },
} as const;

export default function StripeCard({ pay }: { pay: StripePay }) {
  const stripe = useMemo(() => getStripe(pay.publishableKey), [pay.publishableKey]);
  return (
    <Elements stripe={stripe} options={{ clientSecret: pay.clientSecret, locale: "es", appearance }}>
      <CardForm pay={pay} />
    </Elements>
  );
}

/** Cobra con la tarjeta del formulario: prepare() crea el cobro en el servidor y devuelve su client_secret. */
export type CardPay = (prepare: () => Promise<{ clientSecret: string }>) => Promise<{ paymentIntentId: string }>;

/**
 * Formulario de tarjeta que aparece al elegir "Tarjeta" en el checkout, antes de crear nada.
 * Rellena payRef con la función que cobra; el pedido solo se crea cuando el cobro se completa.
 */
export function CardBox({
  pk,
  amountCents,
  payRef,
  onReady,
}: {
  pk: string;
  amountCents: number;
  payRef: React.RefObject<CardPay | null>;
  onReady?: (ok: boolean) => void;
}) {
  const stripe = useMemo(() => getStripe(pk), [pk]);
  return (
    <Elements
      stripe={stripe}
      options={{ mode: "payment", amount: Math.max(50, amountCents), currency: "eur", paymentMethodTypes: ["card"], locale: "es", appearance }}
    >
      <CardFields payRef={payRef} onReady={onReady} />
    </Elements>
  );
}

function CardFields({ payRef, onReady }: { payRef: React.RefObject<CardPay | null>; onReady?: (ok: boolean) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!stripe || !elements) return;
    payRef.current = async (prepare) => {
      const v = await elements.submit(); // valida número, caducidad y CVC antes de crear nada
      if (v.error) throw new Error(v.error.message || "Revisa los datos de la tarjeta");
      const { clientSecret } = await prepare();
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: { return_url: location.href },
        redirect: "if_required",
      });
      if (error) throw new Error(error.message || "La tarjeta no se pudo cobrar");
      if (!paymentIntent || paymentIntent.status !== "succeeded") throw new Error("El pago no se completó. Inténtalo de nuevo.");
      return { paymentIntentId: paymentIntent.id };
    };
    return () => {
      payRef.current = null;
    };
  }, [stripe, elements, payRef]);
  return (
    <div className="min-h-[150px] rounded-xl border border-line bg-bg/60 p-3">
      {!ready && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Cargando formulario de pago seguro…
        </p>
      )}
      <PaymentElement
        options={{ layout: "tabs" }}
        onReady={() => (setReady(true), onReady?.(true))}
        onLoadError={() => onReady?.(false)}
      />
    </div>
  );
}

function CardForm({ pay }: { pay: StripePay }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr("");
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: pay.returnUrl },
      redirect: "if_required",
    });
    if (error) {
      setErr(error.message || "No se pudo completar el pago");
      setBusy(false);
      return;
    }
    if (paymentIntent && ["succeeded", "processing", "requires_capture"].includes(paymentIntent.status)) location.href = pay.returnUrl;
    else setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="min-h-[180px]">
        {!ready && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Cargando pago seguro…
          </p>
        )}
        <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs" }} />
      </div>
      {err && <p className="rounded-lg bg-red/15 px-3 py-2 text-sm text-red-200">{err}</p>}
      <button
        disabled={!stripe || !ready || busy}
        className="cta-gold flex h-11 w-full items-center justify-center gap-2 rounded-xl font-display text-sm font-extrabold text-[#1b1208] disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
        Pagar {eur(pay.amountCents)}
      </button>
      <p className="text-center text-[11px] text-muted">Pago cifrado y procesado por Stripe. No guardamos los datos de tu tarjeta.</p>
    </form>
  );
}
