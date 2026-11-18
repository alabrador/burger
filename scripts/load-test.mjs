// Prueba de carga: muchos pedidos simultáneos contra la misma franja.
//   BASE=http://localhost:3100 N=300 C=60 node scripts/load-test.mjs
const BASE = process.env.BASE || "http://localhost:3100";
const N = Number(process.env.N || 300);
const C = Number(process.env.C || 60);
const line = { protein: "crispy", items: { cheddar: 1, lettuce: 1, house: 1 }, drink: null, quantity: 1 };
const stats = {};
const lat = [];
let i = 0;
async function worker() {
  while (i < N) {
    const k = i++;
    const t = performance.now();
    const r = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": `172.16.${k >> 8}.${k & 255}`, "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ lines: [line], customer: { name: `Carga ${k}`, email: `carga${k}-${Date.now()}@example.com` }, pickup: process.env.PICKUP || "asap", paymentMethod: "cash", acceptTerms: true }),
    }).catch(() => null);
    lat.push(performance.now() - t);
    const j = r ? await r.json().catch(() => ({})) : {};
    const key = r ? `${r.status}${j.code && r.status >= 400 ? " " + j.code : ""}` : "network";
    stats[key] = (stats[key] || 0) + 1;
  }
}
const t0 = performance.now();
await Promise.all(Array.from({ length: C }, worker));
const s = (performance.now() - t0) / 1000;
lat.sort((a, b) => a - b);
const p = (q) => lat[Math.floor(q * (lat.length - 1))].toFixed(0);
console.log({ pedidos: N, concurrencia: C, segundos: s.toFixed(1), rps: (N / s).toFixed(0), p50: p(0.5) + "ms", p95: p(0.95) + "ms", p99: p(0.99) + "ms", resultados: stats });
