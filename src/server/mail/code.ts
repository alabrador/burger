import "server-only";
import type { Settings } from "../settings";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Correo con el código de verificación de 6 cifras (registro o inicio de sesión). */
export function renderCode(code: string, purpose: "register" | "login", name: string, store: Settings["store"]) {
  const subject = `${code} es tu código de ${store.name}`;
  const intro =
    purpose === "register"
      ? "Usa este código para confirmar tu correo y crear tu cuenta."
      : "Usa este código para terminar de iniciar sesión.";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f4efe9;font-family:Arial,Helvetica,sans-serif;color:#1b1208">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:#120d0b;padding:18px 24px;color:#ffc21a;font-size:20px;font-weight:bold">${esc(store.name)}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px;color:#444;line-height:1.5">Hola${name ? ` ${esc(name.split(" ")[0])}` : ""}, ${intro}</p>
<div style="margin:18px 0;padding:16px;background:#fff7e0;border-radius:10px;text-align:center;font-size:34px;font-weight:bold;letter-spacing:10px">${code}</div>
<p style="margin:0;color:#777;font-size:13px;line-height:1.5">Caduca en 10 minutos. Si no has sido tú, ignora este correo: nadie puede entrar en tu cuenta sin este código.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${intro}\n\nCódigo: ${code}\n\nCaduca en 10 minutos. Si no has sido tú, ignora este correo.`;
  return { subject, html, text };
}
