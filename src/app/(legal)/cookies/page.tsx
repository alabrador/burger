import type { Metadata } from "next";
import Link from "next/link";
import { contact, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Qué cookies y qué almacenamiento del navegador usa Crea tu Burger.",
  alternates: { canonical: "/cookies" },
};

const ROWS = [
  ["cb:carrito", "Crea tu Burger", "Almacenamiento local", "Guarda las hamburguesas de tu carrito.", "Hasta que vacíes el carrito o borres los datos del navegador"],
  ["cb:cliente", "Crea tu Burger", "Almacenamiento local", "Recuerda tu nombre, correo y teléfono para el próximo pedido, solo en tu dispositivo.", "Hasta que borres los datos del navegador"],
  ["cb:cookies", "Crea tu Burger", "Almacenamiento local", "Recuerda que ya has visto el aviso de cookies.", "Hasta que borres los datos del navegador"],
  ["__Host-cb_cliente", "Crea tu Burger", "Cookie", "Mantiene abierta tu sesión si tienes cuenta de cliente.", "30 días o hasta que cierres sesión"],
  ["__stripe_mid, __stripe_sid", "Stripe", "Cookie", "Prevención del fraude en el pago con tarjeta. Solo se instalan si eliges pagar con tarjeta.", "1 año y 30 minutos"],
  ["__Host-cb_admin", "Crea tu Burger", "Cookie", "Sesión y seguridad del panel del restaurante. Solo para el personal del local.", "Hasta cerrar sesión o por inactividad"],
] as const;

const HEAD = ["Nombre", "De quién", "Tipo", "Para qué", "Duración"];

export default function Cookies() {
  return (
    <LegalPage title="Política de cookies" updated="19 de noviembre de 2026">
      {(i) => (
        <>
          <p>
            Las cookies son pequeños archivos que una web guarda en tu navegador. El almacenamiento local funciona de forma parecida. Esta página explica cuáles
            usa creatuburger.com, conforme al artículo 22.2 de la LSSI-CE.
          </p>

          <h2>1. Solo usamos cookies técnicas</h2>
          <p>
            <strong>No usamos cookies de analítica, de publicidad ni de redes sociales</strong>, y no te rastreamos entre webs. Todo lo que guardamos es
            necesario para que la web funcione (el carrito, el pago, tu sesión de cliente o el acceso al panel). Por eso la ley no exige pedirte el consentimiento, pero te
            informamos de ello en el aviso que aparece la primera vez que entras.
          </p>

          <h2>2. Lista de cookies y almacenamiento</h2>
          <div className="overflow-x-auto">
            <table className="legal-table legal-stack">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>De quién</th>
                  <th>Tipo</th>
                  <th>Para qué</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c, n) => (
                      <td key={n} data-label={HEAD[n]}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Si pagas con PayPal o con Bizum, pasas a la web de PayPal o de tu banco (Redsys), que aplican sus propias políticas de cookies.
          </p>

          <h2>3. Cómo borrarlas o bloquearlas</h2>
          <p>
            Puedes borrar las cookies y el almacenamiento local desde la configuración de tu navegador (Chrome, Safari, Firefox o Edge, en el apartado de
            privacidad). Si las bloqueas, el carrito no se guardará y es posible que el pago con tarjeta no funcione.
          </p>

          <h2>4. Cambios y contacto</h2>
          <p>
            Si algún día añadimos cookies que no sean técnicas, actualizaremos esta página y te pediremos permiso antes de usarlas. Para cualquier duda,
            escríbenos a {contact(i)}. Más información en la <Link href="/privacidad">política de privacidad</Link>.
          </p>
        </>
      )}
    </LegalPage>
  );
}
