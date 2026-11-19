#!/usr/bin/env bash
# Copia de seguridad cifrada de la base de datos.
#
#   BACKUP_DATABASE_URL=postgres://...  BACKUP_PASSPHRASE=...  scripts/backup/backup.sh [carpeta]
#
# Usa la conexión DIRECTA (sin pooler). Genera <carpeta>/creatuburger-AAAAMMDD-HHMMSS.dump.gpg:
# pg_dump en formato custom (comprimido, incluye las fotos de productos) cifrado con AES-256.
# Sin la frase de paso la copia no se puede leer: guárdala fuera de GitHub también.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?Falta BACKUP_DATABASE_URL (conexión directa a Postgres)}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE (frase para cifrar la copia)}"
if [ "${#BACKUP_PASSPHRASE}" -lt 20 ]; then
  echo "BACKUP_PASSPHRASE debe tener al menos 20 caracteres" >&2
  exit 1
fi

out_dir="${1:-backups}"
mkdir -p "$out_dir"
stamp="$(date -u +%Y%m%d-%H%M%S)"
file="$out_dir/creatuburger-$stamp.dump.gpg"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# --no-owner/--no-acl: la copia se puede restaurar en cualquier proveedor (Neon, Supabase, local).
pg_dump --format=custom --compress=9 --no-owner --no-acl --dbname="$BACKUP_DATABASE_URL" --file="$tmp"

# Comprobación mínima: el volcado tiene la tabla de pedidos.
pg_restore --list "$tmp" | grep -q "TABLE public orders" || { echo "La copia no contiene la tabla orders" >&2; exit 1; }

gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 \
  --passphrase-fd 3 --output "$file" "$tmp" 3<<<"$BACKUP_PASSPHRASE"

echo "Copia creada: $file ($(du -h "$file" | cut -f1))"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "file=$file" >>"$GITHUB_OUTPUT"; fi
