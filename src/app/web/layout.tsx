import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { CONTACT, WEB_BASE, whatsappUrl } from "@/lib/web/format";
import { WhatsappFab } from "./_components/whatsapp-fab";
import { Header } from "./_components/header";
import "./web.css";

const font = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--jw-font", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Juliana Profitos Propiedades | Venta y alquiler en Quilmes", template: "%s | Juliana Profitos Propiedades" },
  description: "Departamentos, casas, locales y terrenos en venta y alquiler en Quilmes y zona sur. Ventas, alquileres y tasaciones en Av. Mitre 913, Quilmes.",
  // No indexar hasta que el dominio apunte a esta web.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#000000", viewportFit: "cover", width: "device-width", initialScale: 1 };

const TYPES = ["Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Galpón", "Cochera"];

export default function WebLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`jw ${font.variable}`}>
      <a href="#contenido" className="jw-skip">Saltar al contenido</a>
      <Header />
      <main id="contenido">{children}</main>
      <footer className="jw-footer" id="contacto">
        <div className="jw-footer-grid">
          <div className="jw-footer-brand">
            <Image src="/web/logo.png" alt="Juliana Profitos Propiedades" width={74} height={44} />
            <p>Ventas, alquileres y tasaciones en Quilmes y zona sur.</p>
          </div>
          <div>
            <h2>Contacto</h2>
            <ul>
              <li><a href={CONTACT.phoneHref}>{CONTACT.phoneDisplay}</a></li>
              <li><a href={whatsappUrl("Hola, quiero hacer una consulta.")} target="_blank" rel="noreferrer">WhatsApp</a></li>
              <li><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
              <li>{CONTACT.address}</li>
              <li><a href={CONTACT.instagram} target="_blank" rel="noreferrer">Instagram</a></li>
            </ul>
          </div>
          <div>
            <h2>Propiedades</h2>
            <ul className="jw-footer-types">
              {TYPES.map((type) => (
                <li key={type}><Link href={`${WEB_BASE}/propiedades?tipo=${encodeURIComponent(type)}`}>{type}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <p className="jw-legal">
          Todas las medidas enunciadas son meramente orientativas, las medidas exactas serán las que se expresen en el respectivo título de propiedad de cada inmueble. Todas las fotos, imágenes y videos son meramente ilustrativos y no contractuales. Los precios enunciados son meramente orientativos y no contractuales.
        </p>
        <p className="jw-copy">© {new Date().getFullYear()} Juliana Profitos Propiedades · {CONTACT.license} · CUIT {CONTACT.cuit}</p>
      </footer>
      <WhatsappFab />
    </div>
  );
}
