import "server-only";
import { createCipheriv, createHmac, randomInt } from "node:crypto";
import { safeEqual } from "../crypto";

/**
 * Bizum a través de Redsys (TPV virtual de los bancos españoles).
 * Firma HMAC_SHA256_V1: clave derivada con 3DES-CBC del número de pedido.
 */
export const REDSYS_URL = {
  test: { form: "https://sis-t.redsys.es:25443/sis/realizarPago", rest: "https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST" },
  live: { form: "https://sis.redsys.es/sis/realizarPago", rest: "https://sis.redsys.es/sis/rest/trataPeticionREST" },
};

function deriveKey(secretB64: string, order: string) {
  const key = Buffer.from(secretB64, "base64");
  const c = createCipheriv("des-ede3-cbc", key, Buffer.alloc(8, 0));
  c.setAutoPadding(false);
  const data = Buffer.from(order, "utf8");
  const padded = Buffer.concat([data, Buffer.alloc((8 - (data.length % 8)) % 8, 0)]);
  return Buffer.concat([c.update(padded), c.final()]);
}

export function redsysSign(secretB64: string, order: string, paramsB64: string) {
  return createHmac("sha256", deriveKey(secretB64, order)).update(paramsB64).digest("base64");
}

/** Número de pedido Redsys: 12 caracteres, los 4 primeros numéricos. */
export const redsysOrderNumber = () => `${String(Date.now() % 10_000).padStart(4, "0")}${randomInt(36 ** 7).toString(36).toUpperCase().padStart(8, "0")}`.slice(0, 12);

export function redsysForm(
  c: { env: "test" | "live"; merchantCode: string; terminal: string; secretKey: string },
  p: { order: string; amountCents: number; notifyUrl: string; okUrl: string; koUrl: string; description: string },
) {
  const params = {
    DS_MERCHANT_AMOUNT: String(p.amountCents),
    DS_MERCHANT_ORDER: p.order,
    DS_MERCHANT_MERCHANTCODE: c.merchantCode,
    DS_MERCHANT_CURRENCY: "978",
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: c.terminal,
    DS_MERCHANT_MERCHANTURL: p.notifyUrl,
    DS_MERCHANT_URLOK: p.okUrl,
    DS_MERCHANT_URLKO: p.koUrl,
    DS_MERCHANT_PAYMETHODS: "z", // Bizum
    DS_MERCHANT_PRODUCTDESCRIPTION: p.description.slice(0, 125),
    DS_MERCHANT_CONSUMERLANGUAGE: "1",
  };
  const b64 = Buffer.from(JSON.stringify(params)).toString("base64");
  return {
    url: REDSYS_URL[c.env].form,
    fields: { Ds_SignatureVersion: "HMAC_SHA256_V1", Ds_MerchantParameters: b64, Ds_Signature: redsysSign(c.secretKey, p.order, b64) },
  };
}

const norm = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");

/** Valida la notificación de Redsys y devuelve los datos si la firma es correcta. */
export function redsysVerify(secretKey: string, paramsB64: string, signature: string) {
  const json = JSON.parse(Buffer.from(norm(paramsB64), "base64").toString("utf8")) as Record<string, string>;
  const order = json.Ds_Order || json.DS_ORDER;
  if (!order) return null;
  const expected = redsysSign(secretKey, order, paramsB64);
  if (!safeEqual(norm(expected), norm(signature))) return null;
  const code = Number(json.Ds_Response ?? json.DS_RESPONSE ?? 9999);
  return { order, ok: code >= 0 && code <= 99, response: String(code), amountCents: Number(json.Ds_Amount), raw: json };
}

export async function redsysRefund(
  c: { env: "test" | "live"; merchantCode: string; terminal: string; secretKey: string },
  order: string,
  amountCents: number,
) {
  const params = {
    DS_MERCHANT_AMOUNT: String(amountCents),
    DS_MERCHANT_ORDER: order,
    DS_MERCHANT_MERCHANTCODE: c.merchantCode,
    DS_MERCHANT_CURRENCY: "978",
    DS_MERCHANT_TRANSACTIONTYPE: "3",
    DS_MERCHANT_TERMINAL: c.terminal,
  };
  const b64 = Buffer.from(JSON.stringify(params)).toString("base64");
  const r = await fetch(REDSYS_URL[c.env].rest, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Ds_SignatureVersion: "HMAC_SHA256_V1", Ds_MerchantParameters: b64, Ds_Signature: redsysSign(c.secretKey, order, b64) }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json()) as { Ds_MerchantParameters?: string; Ds_Signature?: string; errorCode?: string };
  if (!j.Ds_MerchantParameters || !j.Ds_Signature) throw new Error(`Redsys reembolso: ${j.errorCode ?? r.status}`);
  const v = redsysVerify(c.secretKey, j.Ds_MerchantParameters, j.Ds_Signature);
  if (!v || Number(v.response) !== 900) throw new Error(`Redsys reembolso rechazado (${v?.response ?? "firma"})`);
  return `${order}-R${amountCents}`;
}
