// Prueba de extremo a extremo de la API (contra un servidor en marcha).
//   BASE=http://localhost:3100 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/api-test.mjs
const BASE = process.env.BASE || "http://localhost:3100";
let ipn = 1;
const ip = () => `10.0.${Math.floor(ipn / 250)}.${ipn++ % 250}`;
let pass = 0, fail = 0;
const ok = (c, m, extra) => (c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗", m, extra ?? "")));
async function req(method, path, body, headers = {}) {
  const r = await fetch(BASE + path, { method, headers: { "x-real-ip": ip(), ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  let j = null;
  const t = await r.text();
  try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j, h: r.headers };
}
const line = { protein: "angus", items: { cheddar: 2, bacon: 1, lettuce: 1 }, drink: "coca_zero", quantity: 2 };
const customer = { name: "Ana Prueba", email: `ana+${Date.now()}@example.com`, phone: "600 123 456" };

console.log("Público");
let r = await req("POST", "/api/orders/quote", { lines: [line] });
// 12,90 + 0 + 2*1,50 + 2 + 0,50 + 2,50 = 20,90 → ×2 = 41,80
ok(r.s === 200 && r.j.totalCents === 4180, "presupuesto calculado en servidor (41,80 €)", r.j);
r = await req("POST", "/api/orders/quote", { lines: [{ ...line, items: { cheddar: 9 } }] });
ok(r.s === 422, "rechaza cantidades fuera de rango");
r = await req("POST", "/api/orders/quote", { lines: [{ ...line, protein: "wagyu" }] });
ok(r.s === 422, "rechaza productos inexistentes");
r = await req("POST", "/api/orders/quote", { lines: [{ ...line, priceCents: 1 }] });
ok(r.s === 200 && r.j.totalCents === 4180, "ignora precios enviados por el cliente");
r = await req("POST", "/api/orders", { lines: [line], customer: { ...customer, email: "no-es-correo" }, pickup: "asap", paymentMethod: "cash", acceptTerms: true });
ok(r.s === 422 && r.j.code === "validation", "valida el correo");
r = await req("POST", "/api/orders", "x".repeat(70000));
ok(r.s === 413, "rechaza cuerpos enormes");

const idem = crypto.randomUUID();
const order = { lines: [line], customer, pickup: "asap", paymentMethod: "cash", acceptTerms: true, notes: "<script>alert(1)</script>" };
r = await req("POST", "/api/orders", order, { "idempotency-key": idem });
ok(r.s === 201 && r.j.status === "confirmed" && r.j.totalCents === 4180, "crea pedido en efectivo", r.j);
const { code, token } = r.j;
r = await req("POST", "/api/orders", order, { "idempotency-key": idem });
ok(r.s === 200 && r.j.code === code, "idempotencia: el reintento devuelve el mismo pedido");
r = await req("GET", `/api/orders/${code}?t=${token}`);
ok(r.s === 200 && r.j.status === "confirmed" && r.j.qr?.startsWith("CB1:"), "seguimiento con token");
const qr = r.j.qr;
r = await req("GET", `/api/orders/${code}?t=AAAAAAAAAAAAAAAAAAAAAA`);
ok(r.s === 404, "seguimiento con token falso → 404");
r = await fetch(`${BASE}/api/orders/${code}/qr?t=${token}`);
ok(r.status === 200 && r.headers.get("content-type") === "image/png", "QR en PNG");

console.log("Admin");
r = await req("GET", "/api/admin/me");
ok(r.s === 401, "API admin sin sesión → 401");
r = await fetch(BASE + "/admin/pedidos", { redirect: "manual" });
ok(r.status === 307 && r.headers.get("location")?.includes("/admin/login"), "/admin sin sesión redirige al login");
r = await req("POST", "/api/admin/auth/login", { email: process.env.ADMIN_EMAIL, password: "mala-clave-123" });
ok(r.s === 401, "contraseña incorrecta → 401");
r = await req("POST", "/api/admin/auth/login", { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
ok(r.s === 200, "login correcto");
const cookie = r.h.get("set-cookie")?.split(";")[0];
ok(/HttpOnly/i.test(r.h.get("set-cookie")) && /SameSite=strict/i.test(r.h.get("set-cookie")), "cookie HttpOnly + SameSite=Strict");
const A = { cookie, origin: BASE };
r = await req("GET", "/api/admin/me", null, A);
const csrf = r.j.csrf;
ok(r.s === 200 && r.j.role === "owner", "sesión válida (dueño)");
const C = { ...A, "x-csrf-token": csrf };

r = await req("POST", "/api/admin/orders/scan", { qr }, A);
ok(r.s === 403, "sin token CSRF → 403");
r = await req("POST", "/api/admin/orders/scan", { qr }, { ...C, origin: "https://evil.example" });
ok(r.s === 403, "origen ajeno → 403");
r = await req("POST", "/api/admin/orders/scan", { qr: qr.slice(0, -2) + "xx" }, C);
ok(r.s === 422, "QR manipulado → rechazado");
r = await req("POST", "/api/admin/orders/scan", { qr }, C);
ok(r.s === 200 && r.j.code === code, "escaneo del QR encuentra el pedido");
const id = r.j.id;
r = await req("GET", `/api/admin/orders/${id}`, null, A);
ok(r.s === 200 && r.j.items[0].description.includes("Cheddar"), "detalle del pedido");
r = await req("PATCH", `/api/admin/orders/${id}`, { status: "collected" }, C);
ok(r.s === 409, "no se puede entregar sin pasar por listo");
r = await req("PATCH", `/api/admin/orders/${id}`, { status: "preparing" }, C);
ok(r.s === 200, "→ en preparación");
r = await req("PATCH", `/api/admin/orders/${id}`, { status: "ready" }, C);
ok(r.s === 200, "→ listo");
r = await req("PATCH", `/api/admin/orders/${id}`, { status: "collected" }, C);
ok(r.s === 409 && r.j.code === "cash_unpaid", "efectivo: hay que cobrar antes de entregar");
r = await req("PATCH", `/api/admin/orders/${id}`, { status: "collected", cashPaid: true }, C);
ok(r.s === 200, "→ entregado y cobrado");
r = await req("GET", `/api/orders/${code}?t=${token}`);
ok(r.j.status === "collected" && r.j.paymentStatus === "paid" && r.j.qr === null, "seguimiento: entregado, sin QR");

r = await req("POST", "/api/admin/coupons", { code: `TEST${Date.now() % 100000}`, type: "percent", value: 10, maxUses: 1 }, C);
ok(r.s === 201, "crea cupón 10 % de un solo uso");
const cp = r.j.code;
r = await req("POST", "/api/orders/quote", { lines: [line], coupon: cp });
ok(r.j.discountCents === 418 && r.j.totalCents === 3762, "cupón aplicado (−4,18 €)", r.j);
r = await req("POST", "/api/orders", { ...order, coupon: cp, customer: { ...customer, email: "b@example.com" } });
ok(r.s === 201 && r.j.totalCents === 3762, "pedido con cupón");
r = await req("POST", "/api/orders", { ...order, coupon: cp, customer: { ...customer, email: "c@example.com" } });
ok(r.s === 422, "cupón agotado al segundo uso");

r = await req("PATCH", "/api/admin/products/bacon", { soldOut: true }, C);
ok(r.s === 200, "marca tocino agotado");
r = await req("POST", "/api/orders/quote", { lines: [line] });
ok(r.s === 409 && r.j.code === "sold_out", "producto agotado no se puede pedir");
await req("PATCH", "/api/admin/products/bacon", { soldOut: false }, C);
r = await req("PATCH", "/api/admin/products/cheddar", { priceCents: 175 }, C);
r = await req("POST", "/api/orders/quote", { lines: [{ ...line, quantity: 1 }] });
ok(r.j.totalCents === 2090 + 50, "cambio de precio se aplica al momento (caché invalidada)", r.j.totalCents);
await req("PATCH", "/api/admin/products/cheddar", { priceCents: 150 }, C);

for (const p of ["dashboard?range=today", "orders?status=active", "customers", "payments", "audit", "kitchen", "settings", "users"]) {
  r = await req("GET", `/api/admin/${p}`, null, A);
  ok(r.s === 200, `GET /api/admin/${p}`);
}
r = await req("GET", "/api/admin/settings", null, A);
ok(!JSON.stringify(r.j).includes("Enc\""), "la configuración no devuelve secretos");
r = await fetch(`${BASE}/api/admin/orders/export`, { headers: A });
ok(r.status === 200 && (await r.text()).includes("codigo;fecha"), "exportación CSV");

console.log("Bizum (Redsys) y Stripe");
const secret = Buffer.from("123456789012345678901234").toString("base64");
r = await req("PUT", "/api/admin/settings", { section: "payments", value: { cash: { enabled: true }, stripe: { enabled: true, secretKey: "sk_test_fake", webhookSecret: "whsec_test123" }, paypal: { enabled: false, env: "sandbox", clientId: "", webhookId: "" }, bizum: { enabled: true, env: "test", merchantCode: "999008881", terminal: "1", secretKey: secret } } }, C);
ok(r.s === 200, "guarda pasarelas (secretos cifrados)", r.j);
r = await req("POST", "/api/orders", { ...order, paymentMethod: "bizum", customer: { ...customer, email: "biz@example.com" } });
ok(r.s === 201 && r.j.payment.type === "form" && r.j.payment.url.includes("redsys"), "Bizum: formulario firmado para Redsys");
const bz = r.j;
const params = JSON.parse(Buffer.from(bz.payment.fields.Ds_MerchantParameters, "base64").toString());
ok(params.DS_MERCHANT_PAYMETHODS === "z" && params.DS_MERCHANT_AMOUNT === String(bz.totalCents) && params.DS_MERCHANT_CURRENCY === "978", "Bizum en euros con importe correcto");
// Simulamos la notificación de Redsys con la misma firma
const { createCipheriv, createHmac } = await import("node:crypto");
const signR = (order, b64) => {
  const c = createCipheriv("des-ede3-cbc", Buffer.from(secret, "base64"), Buffer.alloc(8, 0));
  c.setAutoPadding(false);
  const d = Buffer.from(order);
  const k = Buffer.concat([c.update(Buffer.concat([d, Buffer.alloc((8 - (d.length % 8)) % 8)])), c.final()]);
  return createHmac("sha256", k).update(b64).digest("base64url");
};
const notif = Buffer.from(JSON.stringify({ Ds_Order: params.DS_MERCHANT_ORDER, Ds_Amount: params.DS_MERCHANT_AMOUNT, Ds_Response: "0000", Ds_Currency: "978" })).toString("base64url");
let f = new URLSearchParams({ Ds_SignatureVersion: "HMAC_SHA256_V1", Ds_MerchantParameters: notif, Ds_Signature: "firmafalsa" });
r = await fetch(BASE + "/api/payments/redsys/notify", { method: "POST", body: f });
ok(r.status === 400, "notificación Redsys con firma falsa → rechazada");
f = new URLSearchParams({ Ds_SignatureVersion: "HMAC_SHA256_V1", Ds_MerchantParameters: notif, Ds_Signature: signR(params.DS_MERCHANT_ORDER, notif) });
r = await fetch(BASE + "/api/payments/redsys/notify", { method: "POST", body: f });
ok(r.status === 200, "notificación Redsys válida");
r = await req("GET", `/api/orders/${bz.code}?t=${bz.token}`);
ok(r.j.status === "confirmed" && r.j.paymentStatus === "paid", "Bizum: pedido pagado y confirmado");

const { default: Stripe } = await import("stripe");
r = await req("POST", "/api/orders", { ...order, paymentMethod: "stripe", customer: { ...customer, email: "st@example.com" } });
ok(r.s === 502, "Stripe con clave falsa: error controlado y pedido cancelado");
const evBody = (orderId, amount) =>
  JSON.stringify({ id: `evt_${Date.now()}`, object: "event", type: "checkout.session.completed", data: { object: { id: "cs_test_1", object: "checkout.session", payment_status: "paid", payment_intent: `pi_${Date.now()}`, amount_total: amount, metadata: { orderId } } } });
r = await req("POST", "/api/orders", { ...order, paymentMethod: "cash", customer: { ...customer, email: "st2@example.com" } });
// reutilizamos un pedido existente para probar la firma del webhook
const det = await req("POST", "/api/admin/orders/scan", { code: r.j.code }, C);
const payload = evBody(det.j.id, 1);
const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test123" });
r = await fetch(BASE + "/api/payments/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": "t=1,v1=bad" } });
ok(r.status === 400, "webhook Stripe con firma falsa → 400");
r = await fetch(BASE + "/api/payments/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": sig } });
ok(r.status === 200, "webhook Stripe firmado aceptado (importe erróneo queda registrado sin confirmar)", r.status);
await req("PUT", "/api/admin/settings", { section: "payments", value: { cash: { enabled: true }, stripe: { enabled: false }, paypal: { enabled: false, env: "sandbox", clientId: "", webhookId: "" }, bizum: { enabled: false, env: "test", merchantCode: "", terminal: "1" } } }, C);

console.log("Límites");
let last = 0;
for (let i = 0; i < 10; i++) last = (await req("POST", "/api/orders", { ...order, customer: { ...customer, email: "rl@example.com" } }, { "x-real-ip": "10.9.9.9" })).s;
ok(last === 429, "límite de pedidos por IP/correo → 429");

r = await req("POST", "/api/admin/auth/logout", {}, C);
r = await req("GET", "/api/admin/me", null, A);
ok(r.s === 401, "logout invalida la sesión");
console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
