import { redirect } from "next/navigation";

/**
 * Compatibilidad: /certificados-historicos fue consolidado dentro de
 * /certificados como tab "Histórico (años anteriores)". Esta ruta queda
 * como redirect permanente para no romper bookmarks ni enlaces antiguos.
 */
export default function CertificadosHistoricosRedirect(): never {
  redirect("/certificados?tab=historico");
}
