import type { Metadata } from "next";
import Link from "next/link";
import { contact, Holder, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Condiciones de venta",
  description: "Cómo funcionan los pedidos, los pagos, la recogida y las cancelaciones en Crea tu Burger.",
  alternates: { canonical: "/condiciones" },
};

export default function Condiciones() {
  return (
    <LegalPage title="Condiciones de venta" updated="19 de noviembre de 2026">
      {(i) => (
        <>
          <p>
            Estas condiciones regulan los pedidos que haces en creatuburger.com. Al confirmar un pedido declaras que las has leído y que las aceptas. Se
            rigen por la ley española, en particular por el Real Decreto Legislativo 1/2007 (Ley General para la Defensa de los Consumidores y Usuarios) y la
            LSSI-CE.
          </p>

          <h2>1. Vendedor</h2>
          <Holder i={i} />

          <h2>2. Productos</h2>
          <p>
            Vendemos hamburguesas preparadas al momento según los ingredientes que eliges en el configurador, con pan brioche y papas fritas incluidas, y
            bebida opcional. La imagen 3D es una representación orientativa del pedido: la hamburguesa real puede variar en forma y tamaño. La información de
            alérgenos está en la <Link href="/alergenos">tabla de alérgenos</Link> y en el carrito, junto a cada hamburguesa.
          </p>

          <h2>3. Precios</h2>
          <p>
            Los precios están en euros e incluyen el IVA. El precio final se calcula en el momento del pago con los precios vigentes y aparece antes de
            confirmar el pedido, con el descuento aplicado si usas un código válido. La recogida en el local no tiene coste añadido.
          </p>

          <h2>4. Cómo se hace un pedido</h2>
          <ul>
            <li>Crea tu hamburguesa, elige la cantidad y pulsa «Agregar al carrito». Puedes añadir hasta 10 hamburguesas por pedido.</li>
            <li>Desde el carrito pulsa «Pagar», indica tus datos de contacto, la hora de recogida y el método de pago.</li>
            <li>
              Cuando el pago se completa (o confirmas el pedido si pagas en el local) recibirás un correo con el número de pedido y el QR para recogerlo.
              Ese correo es la confirmación del contrato.
            </li>
            <li>Puedes seguir el estado del pedido en la página de seguimiento que te enlazamos en el correo.</li>
          </ul>

          <h2>5. Pago</h2>
          <p>
            Aceptamos los métodos que se muestran al pagar: tarjeta (procesada por Stripe), Bizum (a través de Redsys), PayPal y, cuando está disponible, pago
            en el local. Los pagos online se procesan en entornos seguros de cada pasarela y no guardamos los datos de tu tarjeta. Si pides la factura,
            escríbenos a {contact(i)} con el número de pedido.
          </p>

          <h2>6. Recogida</h2>
          <p>
            Los pedidos se recogen en el local, en la franja horaria que elijas o lo antes posible. Muestra el QR o di tu número de pedido. Si un pedido no se
            recoge el mismo día dentro del horario del local, por ser comida preparada no podremos guardarlo ni reembolsarlo.
          </p>

          <h2>7. Desistimiento, cancelaciones y reembolsos</h2>
          <p>
            Conforme al artículo 103 de la Ley General para la Defensa de los Consumidores y Usuarios, <strong>no hay derecho de desistimiento</strong> en
            productos que se preparan según las indicaciones del cliente o que pueden caducar con rapidez, como es el caso de nuestras hamburguesas.
          </p>
          <p>
            Aun así, si necesitas cancelar un pedido, llámanos o escríbenos cuanto antes: si aún no hemos empezado a prepararlo, lo cancelaremos y te
            devolveremos el importe por el mismo medio de pago. Si no podemos preparar tu pedido (por ejemplo, porque se ha agotado un ingrediente), te lo
            diremos y te devolveremos el dinero íntegro.
          </p>

          <h2>8. Reclamaciones</h2>
          <p>
            Si algo no ha ido bien con tu pedido, cuéntanoslo en {contact(i)}
            {i.phone ? <> o en el {i.phone}</> : null}. Tenemos hojas de reclamaciones a tu disposición en el local. Si eres consumidor, puedes acudir también
            a los servicios de consumo de tu comunidad autónoma.
          </p>

          <h2>9. Tus datos</h2>
          <p>
            Usamos tus datos solo para gestionar el pedido, como se explica en la <Link href="/privacidad">política de privacidad</Link>.
          </p>
        </>
      )}
    </LegalPage>
  );
}
