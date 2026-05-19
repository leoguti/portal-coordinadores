import { redirect } from "next/navigation";

/**
 * Compatibilidad: /admin/certificados-historicos fue consolidado dentro
 * de /certificados como tab "Histórico (años anteriores)". El endpoint
 * /api/admin/certificados-historicos sigue diferenciando por rol
 * (Coordinador ve los suyos; Admin/Supervisor ven todos), así que un
 * solo punto de entrada funciona para todos los roles.
 */
export default function AdminCertificadosHistoricosRedirect(): never {
  redirect("/certificados?tab=historico");
}
