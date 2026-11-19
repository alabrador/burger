import type { Metadata } from "next";
import Link from "next/link";
import { contact, Holder, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos personales tratamos en Crea tu Burger, para qué y cuáles son tus derechos.",
  alternates: { canonical: "/privacidad" },
};

export default function Privacidad() {
  return (
    <LegalPage title="Política de privacidad" updated="19 de noviembre de 2026">
      {(i) => (
        <>
          <p>
            Esta política explica cómo tratamos tus datos personales cuando usas creatuburger.com, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley
            Orgánica 3/2018 (LOPDGDD).
          </p>

          <h2>1. Responsable del tratamiento</h2>
          <Holder i={i} />

          <h2>2. Qué datos tratamos</h2>
          <ul>
            <li>
              <strong>Datos del pedido:</strong> nombre, correo electrónico, teléfono, hora de recogida, hamburguesas elegidas, notas para cocina y código de
              descuento.
            </li>
            <li>
              <strong>Datos del pago:</strong> método, importe y estado. Los datos de la tarjeta los recoge directamente Stripe; nosotros nunca los vemos ni los
              guardamos.
            </li>
            <li>
              <strong>Datos técnicos:</strong> dirección IP y datos del navegador, que se usan para la seguridad del servicio y para evitar abusos.
            </li>
          </ul>

          <h2>3. Para qué los usamos y con qué base legal</h2>
          <ul>
            <li>
              <strong>Preparar y entregar tu pedido</strong>, cobrarlo, enviarte el QR de recogida y avisarte por correo de su estado. Base legal: la ejecución
              del contrato de compra (art. 6.1.b RGPD).
            </li>
            <li>
              <strong>Cumplir obligaciones legales</strong> contables y fiscales, y atender reclamaciones. Base legal: obligación legal (art. 6.1.c RGPD).
            </li>
            <li>
              <strong>Mantener la web segura</strong> y prevenir el fraude. Base legal: interés legítimo (art. 6.1.f RGPD).
            </li>
            <li>
              <strong>Enviarte ofertas por correo</strong>, solo si marcas la casilla al hacer el pedido. Base legal: tu consentimiento (art. 6.1.a RGPD), que
              puedes retirar en cualquier momento.
            </li>
          </ul>
          <p>No tomamos decisiones automatizadas ni elaboramos perfiles con tus datos.</p>

          <h2>4. Cuánto tiempo los guardamos</h2>
          <p>
            Los datos de los pedidos se conservan mientras puedan surgir responsabilidades y durante los plazos que exige la ley (por ejemplo, seis años para
            la documentación contable según el Código de Comercio). Los datos para ofertas, hasta que retires tu consentimiento. Los registros técnicos de
            seguridad se borran de forma automática en pocos días.
          </p>

          <h2>5. Con quién los compartimos</h2>
          <p>No vendemos tus datos. Solo los comparten, en la medida necesaria, los proveedores que nos ayudan a prestar el servicio:</p>
          <ul>
            <li>Pasarelas de pago, según el método que elijas: Stripe (tarjeta), PayPal y Redsys (Bizum).</li>
            <li>Alojamiento de la web y de la base de datos (Vercel y nuestros proveedores de base de datos).</li>
            <li>El servicio de correo electrónico con el que enviamos los avisos del pedido.</li>
            <li>Las administraciones públicas, juzgados o fuerzas de seguridad, cuando la ley nos obligue.</li>
          </ul>
          <p>
            Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo, por ejemplo en Estados Unidos. En ese caso lo hacen con
            garantías adecuadas, como el Marco de Privacidad de Datos UE-EE. UU. o las cláusulas contractuales tipo de la Comisión Europea.
          </p>

          <h2>6. Tus derechos</h2>
          <p>
            Puedes pedir el acceso a tus datos, su rectificación o supresión, la limitación u oposición a su tratamiento y la portabilidad, así como retirar
            tu consentimiento en cualquier momento, escribiendo a {contact(i)}. Indica qué derecho quieres ejercer y el correo con el que hiciste el pedido.
            Te responderemos en un plazo máximo de un mes.
          </p>
          <p>
            Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos en{" "}
            <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">
              aepd.es
            </a>
            .
          </p>

          <h2>7. Menores</h2>
          <p>Para hacer un pedido hay que ser mayor de 14 años. Si eres menor, pide a tus padres o tutores que lo hagan por ti.</p>

          <h2>8. Cookies</h2>
          <p>
            Las cookies y el almacenamiento del navegador que usamos se explican en la <Link href="/cookies">política de cookies</Link>.
          </p>
        </>
      )}
    </LegalPage>
  );
}
