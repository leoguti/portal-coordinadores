import { redirect } from "next/navigation";

/**
 * Compatibilidad: /certificados/listar fue consolidado en /certificados
 * (la home de Certificados ahora muestra el listado + botón "Generar
 * nuevo certificado"). Esta ruta queda como redirección permanente para
 * no romper bookmarks ni enlaces antiguos.
 */
export default function CertificadosListarRedirect(): never {
  redirect("/certificados");
}
