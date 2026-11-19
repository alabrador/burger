#!/usr/bin/env bash
# Restaura una copia cifrada en una base de datos.
#
#   RESTORE_DATABASE_URL=postgres://...  BACKUP_PASSPHRASE=...  scripts/backup/restore.sh copia.dump.gpg [--yes]
#
# ¡Borra y recrea las tablas de la app en la base de destino! Sin --yes pide confirmación.
# Recomendado: restaurar primero en una base NUEVA (rama de Neon o proyecto vacío),
# comprobarla con scripts/backup/verify.sh y después apuntar DATABASE_URL de Vercel a ella.
set -euo pipefail

file="${1:?Uso: restore.sh copia.dump.gpg [--yes]}"
: "${RESTORE_DATABASE_URL:?Falta RESTORE_DATABASE_URL (base de destino, conexión directa)}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"

if [ "${2:-}" != "--yes" ]; then
  host="$(sed -E 's#^[a-z]+://([^@]*@)?([^/:?]+).*#\2#' <<<"$RESTORE_DATABASE_URL")"
  read -r -p "Se van a SOBRESCRIBIR las tablas de la base en $host. Escribe RESTAURAR para seguir: " ok
  [ "$ok" = "RESTAURAR" ] || { echo "Cancelado"; exit 1; }
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
gpg --batch --yes --quiet --pinentry-mode loopback --decrypt \
  --passphrase-fd 3 --output "$tmp" "$file" 3<<<"$BACKUP_PASSPHRASE"

# --single-transaction: si algo falla no queda la base a medias.
pg_restore --clean --if-exists --no-owner --no-acl --single-transaction \
  --dbname="$RESTORE_DATABASE_URL" "$tmp"
echo "Restaurada $file"
