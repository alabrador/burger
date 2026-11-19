# Recuperación ante fallos

Qué hacer cuando algo se rompe en Crea tu Burger, y qué hay preparado para ello.

## Copias de la base de datos

Toda la información del negocio está en Postgres: pedidos, pagos, clientes, carta, fotos de productos, usuarios del admin y configuración. Redis solo guarda caché y límites, así que se puede perder sin consecuencias.

Hay varias redes de seguridad independientes:

1. **La del proveedor (Neon o Supabase).** Permite volver la base a un momento concreto de los últimos días (Neon: "Restore" / "Branches"; Supabase: "Database → Backups"). Es lo más rápido si el problema es un borrado o un error reciente.
2. **Copias diarias desde la propia web (principal).** La tarea diaria de Vercel (`/api/cron`) exporta todas las tablas, las comprime y las cifra con AES-256-GCM (clave derivada de `BACKUP_PASSPHRASE`). Después comprueba la copia: la vuelve a abrir y cuenta las filas. Si está bien, la guarda en **Vercel Blob** (privado) y borra las que caducan: se conservan 30 días, y las de los domingos 90. Si algo falla, llega un correo de aviso. En **Admin → Copias** se ven, se descargan y se puede hacer una al momento.
3. **Copias con GitHub Actions (opcional).** El workflow **Copia de seguridad** hace un `pg_dump` y un simulacro de restauración cada noche. Solo funciona si la cuenta de GitHub tiene Actions activo (es gratis en repositorios públicos, salvo que haya un bloqueo de facturación).

### Ponerlo en marcha (una vez)

En Vercel:

1. **Storage → Create → Blob**, con acceso **Private**, y conéctalo al proyecto. Así se crea `BLOB_READ_WRITE_TOKEN`.
2. **Settings → Environment Variables**: añade `BACKUP_PASSPHRASE`, una frase de 20 caracteres o más (por ejemplo, `openssl rand -base64 32`).
3. Vuelve a desplegar, entra en **Admin → Copias** y pulsa **Hacer copia ahora**.

Para GitHub Actions (opcional), añade en Settings → Secrets and variables → Actions `BACKUP_DATABASE_URL` (conexión **directa**, sin `-pooler`) y `BACKUP_PASSPHRASE`.

> **Guarda fuera de GitHub y de Vercel**, en un gestor de contraseñas: `BACKUP_PASSPHRASE`, `APP_ENCRYPTION_KEY` y `APP_SECRET`. Sin la frase de paso no se puede abrir ninguna copia. Sin `APP_ENCRYPTION_KEY`, las claves de las pasarelas de pago, el SMTP y los códigos de dos pasos guardados en la base no se pueden descifrar y habría que volver a introducirlos.

### Restaurar una copia

La forma segura es restaurar en una base **nueva** y luego apuntar la web a ella. Así la base dañada sigue intacta por si hace falta algo de ella.

**Copia de la web (.cbk, Admin → Copias → Descargar)**, desde un ordenador con Node y este repositorio:

```bash
# 1. Comprobar que la copia se abre y ver cuántas filas tiene (no toca ninguna base)
BACKUP_PASSPHRASE=... npx tsx scripts/backup/restore-app.mts copia.cbk --check
# 2. Restaurar en una base nueva: aplica las migraciones y carga los datos, todo o nada
BACKUP_PASSPHRASE=... RESTORE_DATABASE_URL=postgres://... npx tsx scripts/backup/restore-app.mts copia.cbk
```

Después, en Vercel → Settings → Environment Variables, cambia `DATABASE_URL` (con pooler) y `DATABASE_URL_DIRECT` a la base nueva y vuelve a desplegar.

**Copia de GitHub Actions (.dump.gpg):**

1. Crea una base vacía: en Neon, una rama nueva o un proyecto nuevo; en Supabase, un proyecto nuevo.
2. Añade el secreto `RESTORE_DATABASE_URL` en GitHub con la conexión directa a esa base nueva.
3. En **Actions → Restaurar copia → Run workflow**:
   - `copia`: déjalo vacío para usar la más reciente, o pon el nombre de una concreta.
   - `confirmar`: escribe `RESTAURAR`.
4. Al terminar, el resumen muestra los recuentos de pedidos, pagos y clientes. Compruébalos.
5. Cambia `DATABASE_URL` y `DATABASE_URL_DIRECT` en Vercel a la base nueva y vuelve a desplegar. Cambia también `BACKUP_DATABASE_URL` en GitHub.

La copia de GitHub (.dump.gpg) también se puede restaurar a mano desde un ordenador con Postgres 18:

```bash
BACKUP_PASSPHRASE=... RESTORE_DATABASE_URL=postgres://... scripts/backup/restore.sh copia.dump.gpg
RESTORE_DATABASE_URL=postgres://... scripts/backup/verify.sh
```

Los pedidos hechos entre la última copia y el fallo no estarán en ella. Se pueden reconstruir a partir de los pagos en Stripe y PayPal y de los correos de confirmación.

## Errores y avisos

- **Admin → Errores** muestra los fallos de la web, los pagos, los webhooks y los correos. Cada causa aparece una sola vez, con el número de veces que ha ocurrido. Al marcar un error como resuelto desaparece de la lista; si vuelve a ocurrir, se reabre solo. El menú muestra en rojo cuántos errores quedan pendientes.
- **Aviso por correo** al instante cuando falla algo importante: un cobro que no se puede confirmar o reembolsar, un importe que no coincide, un webhook con firma no válida, un correo descartado tras los reintentos o un error 500. Se envía como mucho un correo por causa cada hora y 20 al día. El correo se elige en Admin → Configuración → "Avisar de errores a" (si está vacío, se usa el de avisos de pedidos o el del local). Para que lleguen hace falta el SMTP configurado.
- **Los errores del navegador** (pantalla "Algo se ha quemado en la plancha") se registran, pero no generan correo.
- Los mensajes se guardan sin contraseñas, claves ni correos completos.

### Aviso si la web se cae

Si se cae la base de datos o la web entera, la propia web no puede avisar. Para eso hay que usar un monitor externo gratuito:

1. Crea una cuenta en [UptimeRobot](https://uptimerobot.com) o [Better Stack](https://betterstack.com/uptime).
2. Añade un monitor HTTP(s) a `https://creatuburger.com/api/health` cada 5 minutos.
3. Ponle tu correo o el móvil (app) para los avisos.

`/api/health` responde 200 si la base de datos y Redis funcionan, y 503 si alguno falla.

## Conciliación de pagos

Cada noche (con la tarea diaria `/api/cron`) y cuando pulsas **Admin → Pagos → Comprobar cobros ahora**, se cruza lo cobrado con los pedidos de los últimos 3 días:

- **Se corrige sola:** un cobro de Stripe completado cuyo pedido no figuraba como pagado (el aviso de Stripe no llegó). El pedido se marca como pagado tras comprobar que el importe coincide.
- **Te avisa por correo** y lo muestra en Errores para que lo revises:
  - Cobros de Stripe sin pedido: reembólsalos en Stripe o crea el pedido a mano.
  - Pedidos marcados como pagados sin ningún cobro registrado (no se aplica a efectivo).
  - Cobros en pedidos que no figuran como pagados, por ejemplo con un importe distinto: revísalos y reembolsa.

Los cobros de menos de 30 minutos no se tocan, porque pueden estar terminando de procesarse.

## Si algo se cae

| Qué falla | Qué pasa | Qué hacer |
| --- | --- | --- |
| **Un despliegue rompe la web** | La versión nueva da errores. | En Vercel → Deployments, abre el último despliegue bueno y pulsa **Instant Rollback**. Vuelve en segundos. |
| **La base de datos** | La web y el configurador 3D siguen funcionando con la última carta y precios conocidos, y el carrito se conserva. Al pedir, el cliente ve "Estamos teniendo un problema técnico. Tu carrito sigue guardado". Te llega un correo de aviso y `/api/health` responde 503. | Mira el estado del proveedor. Si la base se ha perdido o dañado, restaura como se explica arriba. |
| **Redis** | La web sigue funcionando: cada servidor usa su memoria para la caché, las sesiones, los códigos de acceso y los límites de intentos (que siguen aplicándose). `/api/health` responde `redis: false` (con código 200). | Revisa Upstash. No hace falta restaurar nada: al volver Redis todo se normaliza solo. |
| **El correo (SMTP)** | Los correos se quedan en cola y se reintentan solos. | Revisa el SMTP en Admin → Configuración → "Probar". Al arreglarlo, la cola se envía. |
| **Una pasarela de pago** | Ese método falla y el cliente puede elegir otro. Te llega un aviso. | Desactívala en Admin → Configuración → Pagos hasta que vuelva. |
| **Cualquier problema en el local** (cocina saturada, avería…) | — | Botón **Pausar pedidos** en el Dashboard: la web deja de aceptar pedidos al momento con el mensaje de "pedidos en pausa" de Configuración. El mismo botón los reanuda. Pueden usarlo dueño, administrador y encargado. |
| **Se filtra una clave** | — | Ver "Cambiar claves" abajo. |
| **Olvidas la contraseña del admin** | — | Pon en Vercel `ADMIN_EMAIL` y una `ADMIN_PASSWORD` nueva y vuelve a desplegar: la contraseña de ese dueño se restablece y se desbloquea. Después borra `ADMIN_PASSWORD`. |
| **Pierdes el móvil de los dos pasos** | — | Otro dueño o administrador puede quitártelos en Admin → Usuarios. Si eres el único, añade en Vercel `ADMIN_RESET_2FA=1` (junto a `ADMIN_EMAIL`), vuelve a desplegar, entra, borra la variable y vuelve a activar los dos pasos en "Mi cuenta". |

## Cambiar claves

- **Pasarelas y SMTP:** genera claves nuevas en Stripe, PayPal, Redsys o el proveedor de correo, y ponlas en Admin → Configuración. Revoca las antiguas.
- **`APP_SECRET`:** cámbialo en Vercel y vuelve a desplegar. Se cierran todas las sesiones y dejan de valer los QR y enlaces de pedidos anteriores.
- **`CRON_SECRET`:** cámbialo en Vercel y vuelve a desplegar.
- **`APP_ENCRYPTION_KEY`:** no la cambies sin más, porque lo cifrado con la clave antigua deja de leerse. Si se filtra, cámbiala y vuelve a introducir en el admin las claves de pasarelas y SMTP, y que cada usuario del admin vuelva a activar los dos pasos.
- **Base de datos:** cambia la contraseña en el proveedor y actualiza `DATABASE_URL`, `DATABASE_URL_DIRECT` (Vercel) y `BACKUP_DATABASE_URL` (GitHub).
- **`BACKUP_PASSPHRASE`:** las copias nuevas usan la nueva; guarda la antigua mientras queden copias antiguas (90 días).
