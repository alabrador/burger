import "server-only";
import { eur } from "../money";
import type { Settings } from "../settings";
import { qrImageUrl, trackUrl } from "../tokens";

export type MailOrder = {
  code: string;
  customerName: string;
  totalCents: number;
  taxCents: number;
  discountCents: number;
  paymentMethod: string;
  pickupAt: Date | null;
  items: { quantity: number; title: string; description: string; totalCents: number }[];
};

export type Template = "confirmed" | "preparing" | "ready" | "collected" | "cancelled" | "refunded" | "staff_new_order";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const METHOD: Record<string, string> = { stripe: "Tarjeta", paypal: "PayPal", bizum: "Bizum", cash: "Efectivo al recoger" };

const COPY: Record<Template, { subject: (c: string) => string; title: string; body: string; qr?: boolean }> = {
  confirmed: {
    subject: (c) => `Pedido ${c} confirmado`,
    title: "¡Pedido confirmado!",
    body: "Hemos recibido tu pedido. Te avisaremos cuando empecemos a prepararlo y cuando esté listo. Enseña este QR en el mostrador para recogerlo.",
    qr: true,
  },
  preparing: {
    subject: (c) => `Tu pedido ${c} ya está en la plancha`,
    title: "Estamos preparando tu pedido",
    body: "Tu hamburguesa ya está en la plancha. En unos minutos estará lista.",
  },
  ready: {
    subject: (c) => `Tu pedido ${c} está listo para recoger`,
    title: "¡Listo para recoger!",
    body: "Tu pedido te espera en el mostrador. Enseña este QR o di tu código.",
    qr: true,
  },
  collected: {
    subject: (c) => `Gracias por tu pedido ${c}`,
    title: "¡Que aproveche!",
    body: "Has recogido tu pedido. Gracias por elegirnos, esperamos verte pronto.",
  },
  cancelled: {
    subject: (c) => `Pedido ${c} cancelado`,
    title: "Pedido cancelado",
    body: "Tu pedido se ha cancelado. Si ya lo habías pagado, te devolveremos el importe en tu método de pago.",
  },
  refunded: {
    subject: (c) => `Reembolso del pedido ${c}`,
    title: "Reembolso realizado",
    body: "Hemos devuelto el importe de tu pedido. Puede tardar unos días en aparecer según tu banco.",
  },
  staff_new_order: {
    subject: (c) => `Nuevo pedido ${c}`,
    title: "Nuevo pedido",
    body: "Ha entrado un pedido nuevo en el panel.",
  },
};

export function render(t: Template, o: MailOrder, store: Settings["store"]) {
  const c = COPY[t];
  const pickup = o.pickupAt
    ? o.pickupAt.toLocaleString("es-ES", { timeZone: store.timezone, weekday: "long", hour: "2-digit", minute: "2-digit" })
    : "Lo antes posible";
  const link = trackUrl(o.code);
  const rows = o.items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;vertical-align:top"><b>${i.quantity}× ${esc(i.title)}</b><br><span style="color:#777;font-size:13px">${esc(i.description)}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;vertical-align:top">${eur(i.totalCents)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700&display=swap" rel="stylesheet"><meta name="viewport" content="width=device-width"><title>${esc(c.subject(o.code))}</title></head>
<body style="margin:0;background:#f4efe9;font-family:Inter,Arial,Helvetica,sans-serif;color:#1b1208">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:#120d0b;padding:18px 24px;color:#ffc21a;font-size:24px;font-family:Anton,Impact,Arial Narrow,sans-serif;letter-spacing:0.5px;text-transform:uppercase">${esc(store.name)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:28px;font-weight:400;font-family:Anton,Impact,Arial Narrow,sans-serif;letter-spacing:0.5px">${c.title}</h1>
<p style="margin:0 0 16px;color:#444;line-height:1.5">Hola ${esc(o.customerName.split(" ")[0])}, ${c.body.charAt(0).toLowerCase() + c.body.slice(1)}</p>
<table role="presentation" width="100%" style="background:#fff7e0;border-radius:10px;padding:14px;margin-bottom:16px"><tr>
<td><div style="font-size:12px;color:#7a5b00;text-transform:uppercase;letter-spacing:1px">Código de recogida</div><div style="font-size:28px;font-weight:bold;letter-spacing:3px">${o.code}</div><div style="font-size:13px;color:#555;margin-top:4px">Recogida: ${esc(pickup)}</div></td>
${c.qr ? `<td align="right" width="132"><img src="${qrImageUrl(o.code)}" width="120" height="120" alt="QR del pedido ${o.code}" style="display:block;border:0"></td>` : ""}
</tr></table>
<table role="presentation" width="100%" style="font-size:14px">${rows}
${o.discountCents ? `<tr><td style="padding:6px 0">Descuento</td><td style="text-align:right">−${eur(o.discountCents)}</td></tr>` : ""}
<tr><td style="padding:10px 0 0;font-weight:bold">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:bold">${eur(o.totalCents)}</td></tr>
<tr><td style="color:#777;font-size:12px">IVA incluido · ${METHOD[o.paymentMethod] ?? o.paymentMethod}</td><td style="text-align:right;color:#777;font-size:12px">${eur(o.taxCents)}</td></tr>
</table>
<p style="margin:22px 0 0;text-align:center"><a href="${link}" style="background:#ffc21a;color:#1b1208;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">Ver estado del pedido</a></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#faf7f4;color:#888;font-size:12px;line-height:1.5">${esc(store.legalName || store.name)}${store.taxId ? ` · ${esc(store.taxId)}` : ""}<br>${esc([store.address, store.postalCode, store.city].filter(Boolean).join(", "))}${store.phone ? ` · ${esc(store.phone)}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    c.title,
    "",
    c.body,
    "",
    `Código: ${o.code}`,
    `Recogida: ${pickup}`,
    ...o.items.map((i) => `${i.quantity}× ${i.title} (${i.description}) ${eur(i.totalCents)}`),
    `Total: ${eur(o.totalCents)} (IVA incluido)`,
    "",
    `Estado del pedido: ${link}`,
  ].join("\n");
  return { subject: c.subject(o.code), html, text };
}
