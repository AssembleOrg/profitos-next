import type { Metadata, Viewport } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Juliana Profitos | Propiedades",
  description: "Tu patrimonio, nuestra prioridad.",
};

export const viewport: Viewport = {
  themeColor: "#0d0f12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${montserrat.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--color-surface-elevated)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "var(--color-text)",
            },
          }}
        />
      </body>
    </html>
  );
}
