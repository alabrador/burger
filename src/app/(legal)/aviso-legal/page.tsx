import type { Metadata } from "next";
import Link from "next/link";
import { contact, Holder, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: "Datos del titular de creatuburger.com y condiciones de uso de la web.",
  alternates: { canonical: "/aviso-legal" },
};

export default function AvisoLegal() {
  return (
    <LegalPage title="Aviso legal" updated="19 de noviembre de 2026">
      {(i) => (
        <>
          <h2>1. Titular de la web</h2>
          <p>
            En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), estos son los
            datos del titular de creatuburger.com:
          </p>
          <Holder i={i} />

          <h2>2. Objeto</h2>
          <p>
            Esta web permite diseñar una hamburguesa con un configurador en 3D, hacer el pedido, pagarlo y recogerlo en el local. Las condiciones de compra
            están en las <Link href="/condiciones">condiciones de venta</Link>.
          </p>

          <h2>3. Uso de la web</h2>
          <p>
            Al navegar por la web aceptas usarla de buena fe y conforme a la ley. No está permitido usarla para fines ilícitos, intentar acceder a zonas
            restringidas, sobrecargar el servicio ni introducir programas dañinos. Podemos suspender el acceso a quien incumpla estas normas.
          </p>

          <h2>4. Propiedad intelectual e industrial</h2>
          <p>
            Los textos, el diseño, el logotipo «Crea tu Burger», los modelos 3D de los ingredientes, las imágenes y el código de la web pertenecen a{" "}
            {i.legalName} o se usan con permiso de sus autores. No se pueden copiar, distribuir ni transformar sin autorización, salvo para uso personal y
            privado. Las marcas de terceros que se citan (por ejemplo, las de los medios de pago) pertenecen a sus dueños.
          </p>

          <h2>5. Responsabilidad</h2>
          <p>
            Trabajamos para que la información de la web sea correcta y esté disponible, pero no podemos garantizar que no haya interrupciones o errores. Las
            imágenes 3D son orientativas: la hamburguesa real puede variar en forma y tamaño. Los enlaces a webs de terceros (pasarelas de pago) se ofrecen
            por comodidad y no somos responsables de su contenido.
          </p>

          <h2>6. Protección de datos y cookies</h2>
          <p>
            Cómo tratamos tus datos personales se explica en la <Link href="/privacidad">política de privacidad</Link>, y las cookies que usamos, en la{" "}
            <Link href="/cookies">política de cookies</Link>.
          </p>

          <h2>7. Ley aplicable</h2>
          <p>
            Este aviso legal se rige por la ley española. Para cualquier duda o reclamación puedes escribirnos a {contact(i)}. Si eres consumidor, serán
            competentes los juzgados de tu domicilio.
          </p>
        </>
      )}
    </LegalPage>
  );
}
