import { sql } from "drizzle-orm";
import { admin } from "@/server/admin";
import { db } from "@/server/db";
import { json } from "@/server/http";
import { cached } from "@/server/redis";
import { getSettings } from "@/server/settings";

const RANGES = { today: 0, "7d": 6, "30d": 29 } as const;

export const GET = admin("dashboard", async (req) => {
  const r = (req.nextUrl.searchParams.get("range") || "today") as keyof typeof RANGES;
  const days = RANGES[r] ?? 0;
  const tz = (await getSettings()).store.timezone;
  // Caché corta: con carga alta el dashboard no golpea la BD en cada refresco.
  const data = await cached(`dash:${r}`, 15, async () => {
    const from = sql`(date_trunc('day', now() at time zone ${tz}) - make_interval(days => ${days})) at time zone ${tz}`;
    const valid = sql`status <> 'cancelled' and status <> 'pending_payment'`;
    const [k] = await db().execute<{ orders: number; revenue: number; refunds: number; avg: number; cancelled: number; customers: number }>(sql`
      select
        count(*) filter (where ${valid})::int as orders,
        coalesce(sum(total_cents) filter (where ${valid}), 0)::int as revenue,
        (select coalesce(sum(refunded_cents),0) from payments p where p.updated_at >= ${from})::int as refunds,
        coalesce(avg(total_cents) filter (where ${valid}), 0)::int as avg,
        count(*) filter (where status = 'cancelled')::int as cancelled,
        (select count(*) from customers c where c.created_at >= ${from})::int as customers
      from orders where created_at >= ${from}`);
    const live = await db().execute<{ status: string; n: number }>(sql`
      select status, count(*)::int as n from orders where status in ('pending_payment','confirmed','preparing','ready') group by status`);
    // Serie continua (horas de hoy o días del periodo), con ceros donde no hubo ventas.
    const series = await db().execute<{ bucket: string; orders: number; revenue: number }>(
      days === 0
        ? sql`with s as (
                select to_char(created_at at time zone ${tz}, 'HH24') as b, count(*)::int as n, sum(total_cents)::int as r
                from orders where created_at >= ${from} and ${valid} group by 1)
              select lpad(h::text, 2, '0') as bucket, coalesce(s.n, 0) as orders, coalesce(s.r, 0) as revenue
              from generate_series(least(11, coalesce((select min(b)::int from s), 11)), greatest(23, coalesce((select max(b)::int from s), 23))) h
              left join s on s.b = lpad(h::text, 2, '0') order by h`
        : sql`with s as (
                select (created_at at time zone ${tz})::date as d, count(*)::int as n, sum(total_cents)::int as r
                from orders where created_at >= ${from} and ${valid} group by 1)
              select to_char(g::date, 'YYYY-MM-DD') as bucket, coalesce(s.n, 0) as orders, coalesce(s.r, 0) as revenue
              from generate_series((now() at time zone ${tz})::date - ${days}::int, (now() at time zone ${tz})::date, interval '1 day') g
              left join s on s.d = g::date order by g`,
    );
    const methods = await db().execute<{ method: string; n: number; revenue: number }>(sql`
      select payment_method as method, count(*)::int as n, sum(total_cents)::int as revenue
      from orders where created_at >= ${from} and ${valid} group by 1 order by 2 desc`);
    const proteins = await db().execute<{ id: string; n: number }>(sql`
      select i.config->>'protein' as id, sum(i.quantity)::int as n
      from order_items i join orders o on o.id = i.order_id
      where o.created_at >= ${from} and o.status not in ('cancelled','pending_payment') group by 1 order by 2 desc`);
    const ingredients = await db().execute<{ id: string; n: number }>(sql`
      select k.key as id, sum(i.quantity * (k.value)::int)::int as n
      from order_items i join orders o on o.id = i.order_id, jsonb_each_text(i.config->'items') k
      where o.created_at >= ${from} and o.status not in ('cancelled','pending_payment') group by 1 order by 2 desc limit 8`);
    const prep = await db().execute<{ minutes: number }>(sql`
      select coalesce(round(avg(extract(epoch from (ready_at - coalesce(paid_at, created_at))) / 60)), 0)::int as minutes
      from orders where ready_at is not null and created_at >= ${from}`);
    return { range: r, kpi: k, live: [...live], series: [...series], methods: [...methods], proteins: [...proteins], ingredients: [...ingredients], prepMinutes: prep[0]?.minutes ?? 0 };
  });
  return json(data);
});
