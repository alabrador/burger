# Recuperación ante fallos

Qué hacer cuando algo se rompe en Crea tu Burger, y qué hay preparado para ello.

## Copias de la base de datos

Toda la información del negocio está en Postgres: pedidos, pagos, clientes, carta, fotos de productos, usuarios del admin y configuración. Redis solo guarda caché y límites, así que se puede perder sin consecuencias.

Hay dos redes de seguridad independientes:

1. **La del proveedor (Neon o Supabase).** Permite volver la base a un momento concreto de los últimos días (Neon: "Restore" / "Branches"; Supabase: "Database → Backups"). Es lo más rápido si el problema es un borrado o un error reciente.
2. **Copias propias diarias** en GitHub Actions (workflow **Copia de seguridad**). Sirven aunque se pierda la cuenta del proveedor o haya que cambiar de proveedor.
   - Cada noche a las 03:30 UTC se hace un `pg_dump` completo, cifrado con AES-256.
   - Se guarda como artefacto del workflow: 30 días las diarias y 90 días las de los domingos.
   - Justo después se hace un **simulacro**: la copia se restaura en un Postgres vacío y se comprueba que tiene tablas, productos y un usuario dueño. El resumen del workflow muestra cuántos pedidos, pagos y clientes contiene.
   - Si la copia o el simulacro fallan, GitHub manda un correo de fallo.

### Ponerlo en marcha (una vez)

En GitHub → el repositorio → **Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | Valor |
| --- | --- |
| `BACKUP_DATABASE_URL` | La conexión **directa** a la base de producción (en Neon, la que no lleva `-pooler`; es la misma que `DATABASE_URL_DIRECT`). |
| `BACKUP_PASSPHRASE` | Una frase larga (20 caracteres o más) para cifrar las copias. Genera una con `openssl rand -base64 32`. |

Después, en **Actions → Copia de seguridad → Run workflow**, lanza la primera copia y comprueba que los dos pasos salen en verde.

> **Guarda fuera de GitHub y de Vercel**, en un gestor de contraseñas: `BACKUP_PASSPHRASE`, `APP_ENCRYPTION_KEY` y `APP_SECRET`. Sin la frase de paso no se puede abrir ninguna copia. Sin `APP_ENCRYPTION_KEY`, las claves de las pasarelas de pago, el SMTP y los códigos de dos pasos guardados en la base no se pueden descifrar y habría que volver a introducirlos.

### Restaurar una copia

La forma segura es restaurar en una base **nueva** y luego apuntar la web a ella. Así la base dañada sigue intacta por si hace falta algo de ella.

1. Crea una base vacía: en Neon, una rama nueva o un proyecto nuevo; en Supabase, un proyecto nuevo.
2. Añade el secreto `RESTORE_DATABASE_URL` en GitHub con la conexión directa a esa base nueva.
3. En **Actions → Restaurar copia → Run workflow**:
   - `copia`: déjalo vacío para usar la más reciente, o pon el nombre de una concreta (se ve en cada ejecución de "Copia de seguridad", por ejemplo `copia-20261119-123456789`).
   - `confirmar`: escribe `RESTAURAR`.
4. Al terminar, el resumen muestra los recuentos de pedidos, pagos y clientes. Compruébalos.
5. En Vercel → Settings → Environment Variables, cambia `DATABASE_URL` (con pooler) y `DATABASE_URL_DIRECT` a la base nueva y vuelve a desplegar. El despliegue aplica las migraciones que falten.
6. Cambia también `BACKUP_DATABASE_URL` en GitHub para que las copias sigan saliendo de la base buena.

Desde un ordenador con Postgres 18 también se puede hacer a mano:

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
