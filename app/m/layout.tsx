import type { Metadata } from "next";

/**
 * Layout específico para las páginas magic-link `/m/*` que ven los
 * agricultores. Sobrescribe los meta tags del layout root (que dice "Portal
 * Coordinadores - CampoLimpio") para que el preview de WhatsApp muestre algo
 * con sentido para el agricultor.
 */
export const metadata: Metadata = {
  title: "CampoLimpio",
  description:
    "Programa de manejo de envases vacíos de plaguicidas",
  openGraph: {
    title: "CampoLimpio",
    description: "Programa de manejo de envases vacíos de plaguicidas",
    siteName: "CampoLimpio",
    type: "website",
  },
  icons: {
    icon: "/favicon-campolimpio.png",
    apple: "/favicon-campolimpio.png",
  },
};

export default function MLayout({ children }: { children: React.ReactNode }) {
  return children;
}
