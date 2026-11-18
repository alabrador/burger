export type DayHours = { open: string; close: string }[];

function partsIn(tz: string, d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { wd, min: Number(p.hour) * 60 + Number(p.minute) };
}
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** ¿Está abierto en ese instante? hours[0] = domingo. Admite tramos que cruzan medianoche. */
export function isOpenAt(store: { timezone: string; hours: DayHours[] }, d: Date): boolean {
  const { wd, min } = partsIn(store.timezone, d);
  for (const r of store.hours[wd] ?? []) {
    const o = toMin(r.open);
    const c = toMin(r.close);
    if (c > o ? min >= o && min < c : min >= o) return true;
  }
  const prev = store.hours[(wd + 6) % 7] ?? [];
  return prev.some((r) => toMin(r.close) <= toMin(r.open) && min < toMin(r.close));
}

/** Próximas horas de recogida disponibles (alineadas a la franja) dentro del horario. */
export function pickupSlots(store: { timezone: string; hours: DayHours[] }, prepMin: number, slotMin: number, count = 24, from = Date.now()) {
  const step = slotMin * 60_000;
  let t = Math.ceil((from + prepMin * 60_000) / step) * step;
  const out: Date[] = [];
  for (let i = 0; i < (48 * 60) / slotMin && out.length < count; i++, t += step) if (isOpenAt(store, new Date(t))) out.push(new Date(t));
  return out;
}
