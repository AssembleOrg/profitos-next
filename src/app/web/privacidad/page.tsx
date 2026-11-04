import type { Metadata } from "next";
import { CONTACT } from "@/lib/web/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Privacidad" };

export default function WebPrivacy() {
  return (
    <div className="jw-wrap jw-legalpage">
      <h1>Privacidad</h1>
      <p>Juliana Profitos Propiedades (CUIT {CONTACT.cuit}, {CONTACT.address}) es responsable de los datos de esta web.</p>
      <h2>Qué guardamos</h2>
      <ul>
        <li>Actividad en la web: búsquedas, propiedades vistas, tiempo en cada una, favoritas y consultas.</li>
        <li>Datos técnicos generales: tipo de dispositivo, navegador y de qué sitio llegaste. No guardamos tu dirección IP.</li>
        <li>Si ingresás con Google: nombre, email y foto. Si nos lo das, tu teléfono.</li>
      </ul>
      <h2>Para qué</h2>
      <p>Para mejorar la web, entender qué propiedades interesan y que el equipo pueda ayudarte con tu búsqueda. Si ingresás con Google, tu actividad queda asociada a tu cuenta, incluida la anterior a ingresar desde ese navegador.</p>
      <p>Solo te enviamos novedades por email si marcaste esa opción. No vendemos tus datos.</p>
      <h2>Tus derechos</h2>
      <p>Podés pedir acceder a tus datos, corregirlos o eliminarlos escribiendo a <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. La Agencia de Acceso a la Información Pública es el órgano de control de la Ley 25.326.</p>
    </div>
  );
}
