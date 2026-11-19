#!/usr/bin/env bash
# Comprueba que una base restaurada está sana: tablas, migraciones y recuento de filas.
#
#   RESTORE_DATABASE_URL=postgres://...  scripts/backup/verify.sh
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Falta RESTORE_DATABASE_URL}"
q() { psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "$1"; }

for t in orders order_items payments products categories staff_users settings; do
  q "select 1 from information_schema.tables where table_schema='public' and table_name='$t'" | grep -q 1 \
    || { echo "Falta la tabla $t" >&2; exit 1; }
done
migrations="$(q "select count(*) from drizzle.__drizzle_migrations")"
expected="$(ls "$(dirname "$0")/../../drizzle"/*.sql 2>/dev/null | wc -l)"
if [ "$expected" -gt 0 ] && [ "$migrations" -lt "$expected" ]; then
  echo "La copia tiene $migrations migraciones y el código $expected: se aplicarán en el próximo despliegue."
fi
products="$(q "select count(*) from products")"
[ "$products" -gt 0 ] || { echo "La tabla products está vacía" >&2; exit 1; }
owners="$(q "select count(*) from staff_users where role='owner'")"
[ "$owners" -gt 0 ] || { echo "No hay ningún usuario dueño" >&2; exit 1; }

echo "Restauración correcta:"
q "select 'pedidos', count(*)::text from orders union all select 'pagos', count(*)::text from payments
   union all select 'productos', count(*)::text from products union all select 'clientes', count(*)::text from customers
   union all select 'último pedido', coalesce(max(created_at)::text, '—') from orders" | sed 's/|/: /; s/^/  /'
