"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";

// Importar el mapa dinámicamente (Leaflet necesita window)
const MapaColombia = dynamic(() => import("@/components/MapaColombia"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando mapa...</p>
      </div>
    </div>
  ),
});

interface MunicipioActividades {
  codigo: string;
  municipio: string;
  departamento: string;
  cantidad: number;
}

// Interfaz que coincide con la respuesta de Airtable
interface ActividadAirtable {
  id: string;
  fields: {
    "Nombre de la Actividad"?: string;
    "mundep (from Municipio)"?: string[];
    "CODIGOMUN Compilación (de Municipio)"?: number;
    Departamento?: string[];
  };
}

export default function MapaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [actividadesPorMunicipio, setActividadesPorMunicipio] = useState<MunicipioActividades[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, municipios: 0 });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Cargar actividades del usuario
  useEffect(() => {
    async function loadActividades() {
      try {
        const response = await fetch("/api/actividades");
        if (!response.ok) throw new Error("Error cargando actividades");
        
        const data = await response.json();
        const actividades: ActividadAirtable[] = data.actividades || [];

        // Agrupar por municipio (código DIVIPOLA)
        const porMunicipio = new Map<string, MunicipioActividades>();
        
        actividades.forEach((act: ActividadAirtable) => {
          // Obtener el código DIVIPOLA del campo lookup
          const codigoRaw = act.fields["CODIGOMUN Compilación (de Municipio)"];
          if (!codigoRaw) return;
          
          // Convertir de formato decimal (25.486) a string de 5 dígitos (25486)
          // El código viene como número decimal donde la parte entera es el depto
          // y la parte decimal es el municipio, ej: 5.147 = 05147 (Carepa, Antioquia)
          const codigoStr = String(codigoRaw).replace(".", "");
          const codigo = codigoStr.padStart(5, "0"); // Asegurar 5 dígitos
          
          const mundep = act.fields["mundep (from Municipio)"]?.[0] || "";
          const departamento = act.fields.Departamento?.[0] || "";
          
          // Extraer nombre del municipio de mundep (formato: "MUNICIPIO - DEPARTAMENTO")
          const municipioNombre = mundep.split(" - ")[0] || "Sin nombre";
          
          const existing = porMunicipio.get(codigo);
          if (existing) {
            existing.cantidad++;
          } else {
            porMunicipio.set(codigo, {
              codigo,
              municipio: municipioNombre,
              departamento,
              cantidad: 1,
            });
          }
        });

        const resultado = Array.from(porMunicipio.values());
        setActividadesPorMunicipio(resultado);
        setStats({
          total: actividades.length,
          municipios: resultado.length,
        });
        setLoading(false);
      } catch (error) {
        console.error("Error:", error);
        setLoading(false);
      }
    }

    if (status === "authenticated") {
      loadActividades();
    }
  }, [status]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Mapa de Mis Actividades
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {session.user?.email} - Visualización geográfica
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              ← Volver al Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total de actividades</p>
            <p className="text-2xl font-bold text-green-700">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Municipios con presencia</p>
            <p className="text-2xl font-bold text-blue-700">{stats.municipios}</p>
          </div>
        </div>

        {/* Mapa */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <MapaColombia actividadesPorMunicipio={actividadesPorMunicipio} />
        </div>

        {/* Lista de municipios */}
        {actividadesPorMunicipio.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Detalle por municipio
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {actividadesPorMunicipio
                .sort((a, b) => b.cantidad - a.cantidad)
                .map((m) => (
                  <div
                    key={m.codigo}
                    className="border rounded-lg p-3 hover:bg-gray-50"
                  >
                    <p className="font-medium text-gray-900">{m.municipio}</p>
                    <p className="text-sm text-gray-500">{m.departamento}</p>
                    <p className="text-sm font-semibold text-green-600 mt-1">
                      {m.cantidad} {m.cantidad === 1 ? "actividad" : "actividades"}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">💡 Cómo usar el mapa</h3>
          <ul className="mt-2 text-sm text-blue-800 space-y-1">
            <li>• <strong>Zoom:</strong> Usa la rueda del mouse o los botones +/-</li>
            <li>• <strong>Mover:</strong> Arrastra el mapa con el mouse</li>
            <li>• <strong>Ver info:</strong> Pasa el cursor sobre un municipio coloreado</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
