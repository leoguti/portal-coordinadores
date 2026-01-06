"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import React from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import Link from "next/link";
import { puedeModificarActividad } from "@/lib/dateValidations";

interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
    full?: { url: string; width: number; height: number };
  };
}

interface Actividad {
  id: string;
  createdTime: string;
  fields: {
    "Nombre de la Actividad"?: string;
    Fecha?: string;
    Estado?: string;
    Descripcion?: string;
    Tipo?: string;
    "Cantidad de Participantes"?: number;
    Municipio?: string[];
    "mundep (from Municipio)"?: string[];
    Fotografias?: AirtableAttachment[];
    [key: string]: any;
  };
}

export default function ActividadesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [coordinadores, setCoordinadores] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCoordinador, setSelectedCoordinador] = useState<string>("");
  const [selectedMes, setSelectedMes] = useState<string>("");
  const [selectedAno, setSelectedAno] = useState<string>("");
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("");
  const [selectedTipo, setSelectedTipo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const isAdmin = session?.user?.rol === "Administrador";

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedMonths(newExpanded);
  };

  // Obtener opciones únicas basadas en los filtros aplicados (cascada inteligente)
  const opcionesFiltros = React.useMemo(() => {
    // Para cada tipo de opción, aplicar solo los filtros relevantes
    const calcularOpciones = (excluirFiltro: string) => {
      let data = actividades;
      
      if (isAdmin) {
        if (selectedCoordinador) {
          data = data.filter(a => a.fields.Coordinador?.[0] === selectedCoordinador);
        }
        
        // Aplicar filtros según qué estamos calculando
        if (excluirFiltro !== 'ano' && selectedAno) {
          data = data.filter(a => String(a.fields.Año) === selectedAno);
        }
        
        if (excluirFiltro !== 'mes' && selectedMes) {
          data = data.filter(a => String(a.fields.Mes) === selectedMes);
        }
        
        if (excluirFiltro !== 'municipio' && selectedMunicipio) {
          data = data.filter(a => a.fields["mundep (from Municipio)"]?.[0] === selectedMunicipio);
        }
        
        if (excluirFiltro !== 'tipo' && selectedTipo) {
          data = data.filter(a => a.fields.Tipo === selectedTipo);
        }
      }
      
      return data;
    };
    
    // Calcular años (solo coordinador afecta)
    const dataParaAnos = calcularOpciones('ano');
    const anos = new Set<string>();
    dataParaAnos.forEach(actividad => {
      if (actividad.fields.Año) {
        const anoValue = actividad.fields.Año;
        if (typeof anoValue === 'string' && anoValue.trim()) {
          anos.add(anoValue);
        } else if (typeof anoValue === 'number') {
          anos.add(String(anoValue));
        }
      }
    });
    
    // Calcular meses (coordinador + año afectan)
    const dataParaMeses = calcularOpciones('mes');
    const meses = new Set<string>();
    dataParaMeses.forEach(actividad => {
      if (actividad.fields.Mes) {
        const mesValue = actividad.fields.Mes;
        if (typeof mesValue === 'string' && mesValue.trim()) {
          meses.add(mesValue);
        }
      }
    });
    
    // Calcular municipios (coordinador + año + mes afectan)
    const dataParaMunicipios = calcularOpciones('municipio');
    const municipios = new Set<string>();
    dataParaMunicipios.forEach(actividad => {
      if (actividad.fields["mundep (from Municipio)"]?.[0]) {
        municipios.add(actividad.fields["mundep (from Municipio)"][0]);
      }
    });
    
    // Calcular tipos (coordinador + año + mes + municipio afectan)
    const dataParaTipos = calcularOpciones('tipo');
    const tipos = new Set<string>();
    dataParaTipos.forEach(actividad => {
      if (actividad.fields.Tipo) {
        tipos.add(actividad.fields.Tipo);
      }
    });

    return {
      meses: Array.from(meses).sort().reverse(),
      anos: Array.from(anos).sort().reverse(),
      municipios: Array.from(municipios).sort(),
      tipos: Array.from(tipos).sort(),
    };
  }, [actividades, isAdmin, selectedCoordinador, selectedAno, selectedMes, selectedMunicipio, selectedTipo]);

  // Filtrar actividades por coordinador, mes, año, municipio y tipo (admin)
  const actividadesFiltradas = React.useMemo(() => {
    let filtered = actividades;

    console.log('🔎 Filtrando actividades. Filtros:', { selectedCoordinador, selectedMes, selectedAno, selectedMunicipio, selectedTipo });

    if (isAdmin) {
      // Filtro por coordinador
      if (selectedCoordinador) {
        filtered = filtered.filter(a => a.fields.Coordinador?.[0] === selectedCoordinador);
        console.log('Después coordinador:', filtered.length);
      }

      // Filtro por mes
      if (selectedMes) {
        filtered = filtered.filter(a => String(a.fields.Mes) === selectedMes);
        console.log('Después mes:', filtered.length);
      }

      // Filtro por año
      if (selectedAno) {
        console.log('Aplicando filtro año:', selectedAno);
        const antes = filtered.length;
        filtered = filtered.filter(a => {
          const anoActividad = String(a.fields.Año);
          const coincide = anoActividad === selectedAno;
          if (!coincide && antes < 5) {
            console.log('Actividad NO coincide:', { id: a.id, año: anoActividad, buscado: selectedAno });
          }
          return coincide;
        });
        console.log('Después año:', filtered.length, 'de', antes);
      }

      // Filtro por municipio
      if (selectedMunicipio) {
        filtered = filtered.filter(a => 
          a.fields["mundep (from Municipio)"]?.[0] === selectedMunicipio
        );
        console.log('Después municipio:', filtered.length);
      }

      // Filtro por tipo
      if (selectedTipo) {
        filtered = filtered.filter(a => a.fields.Tipo === selectedTipo);
        console.log('Después tipo:', filtered.length);
      }
    }

    console.log('✅ Total actividades filtradas:', filtered.length);
    return filtered;
  }, [actividades, selectedCoordinador, selectedMes, selectedAno, selectedMunicipio, selectedTipo, isAdmin]);

  // Agrupar actividades por mes
  const actividadesPorMes = React.useMemo(() => {
    const grupos: { [key: string]: Actividad[] } = {};
    
    actividadesFiltradas.forEach(actividad => {
      if (actividad.fields.Fecha) {
        const fecha = new Date(actividad.fields.Fecha + 'T00:00:00');
        const monthKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        
        if (!grupos[monthKey]) {
          grupos[monthKey] = [];
        }
        grupos[monthKey].push(actividad);
      }
    });

    // Ordenar meses de más reciente a más antiguo
    return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]));
  }, [actividades]);

  // Calcular resumen de participantes por mes
  const getResumenMes = (actividadesDelMes: Actividad[]) => {
    const porTipo: { [tipo: string]: { count: number; participantes: number } } = {};
    
    actividadesDelMes.forEach(actividad => {
      const tipo = actividad.fields.Tipo || 'Sin tipo';
      if (!porTipo[tipo]) {
        porTipo[tipo] = { count: 0, participantes: 0 };
      }
      porTipo[tipo].count++;
      if (actividad.fields["Cantidad de Participantes"]) {
        porTipo[tipo].participantes += actividad.fields["Cantidad de Participantes"];
      }
    });

    return porTipo;
  };

  // Calcular estadísticas generales
  const estadisticasGenerales = React.useMemo(() => {
    const porTipo: { [tipo: string]: { count: number; participantes: number } } = {};
    
    actividadesFiltradas.forEach(actividad => {
      const tipo = actividad.fields.Tipo || 'Sin tipo';
      if (!porTipo[tipo]) {
        porTipo[tipo] = { count: 0, participantes: 0 };
      }
      porTipo[tipo].count++;
      if (actividad.fields["Cantidad de Participantes"]) {
        porTipo[tipo].participantes += actividad.fields["Cantidad de Participantes"];
      }
    });

    return porTipo;
  }, [actividadesFiltradas]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (status === "authenticated") {
      fetchActividades();
      if (isAdmin) {
        fetchCoordinadores();
      }
    }
  }, [status, isAdmin, router]);

  async function fetchActividades() {
    try {
      setLoading(true);
      const response = await fetch("/api/actividades");
      
      if (!response.ok) {
        throw new Error("Error al cargar actividades");
      }

      const data = await response.json();
      setActividades(data.actividades || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError("No se pudieron cargar las actividades");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCoordinadores() {
    try {
      const response = await fetch("/api/coordinadores");
      if (!response.ok) {
        throw new Error("Error al cargar coordinadores");
      }
      const data = await response.json();
      setCoordinadores(
        data.coordinadores.map((c: any) => ({
          id: c.id,
          name: c.name || "Sin nombre",
        }))
      );
    } catch (err) {
      console.error("Error fetching coordinadores:", err);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">Actividades</h1>
              {isAdmin && <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium text-sm">👑 Vista Admin</span>}
              {!isAdmin && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm">👤 Mis Actividades</span>}
            </div>
            <p className="text-gray-600">
              {isAdmin ? "Gestión de actividades de todos los coordinadores" : "Listado de actividades del coordinador"}
            </p>
          </div>
          <Link
            href="/actividades/nueva"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Nueva Actividad
          </Link>
        </div>

        {/* Filtros - Solo admin */}
        {isAdmin && (coordinadores.length > 0 || opcionesFiltros.meses.length > 0) && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              🔍 Filtros de Búsqueda
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Filtro por Coordinador */}
              <div>
                <label htmlFor="coordinador-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Coordinador
                </label>
                <select
                  id="coordinador-filter"
                  value={selectedCoordinador}
                  onChange={(e) => {
                    setSelectedCoordinador(e.target.value);
                    // Limpiar otros filtros al cambiar coordinador
                    setSelectedMes("");
                    setSelectedAno("");
                    setSelectedMunicipio("");
                    setSelectedTipo("");
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos ({actividades.length})</option>
                  {coordinadores.map((coord) => {
                    const countActividades = actividades.filter(a => a.fields.Coordinador?.[0] === coord.id).length;
                    return (
                      <option key={coord.id} value={coord.id}>
                        {coord.name} ({countActividades})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Filtro por Mes */}
              <div>
                <label htmlFor="mes-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Mes
                </label>
                <select
                  id="mes-filter"
                  value={selectedMes}
                  onChange={(e) => setSelectedMes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  {opcionesFiltros.meses.map((mes) => {
                    const count = actividades.filter(a => String(a.fields.Mes) === mes).length;
                    return (
                      <option key={mes} value={mes}>
                        {mes} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Filtro por Año */}
              <div>
                <label htmlFor="ano-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Año
                </label>
                <select
                  id="ano-filter"
                  value={selectedAno}
                  onChange={(e) => setSelectedAno(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  {opcionesFiltros.anos.map((ano) => {
                    const count = actividades.filter(a => a.fields.Año === ano).length;
                    return (
                      <option key={ano} value={ano}>
                        {ano} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Filtro por Municipio */}
              <div>
                <label htmlFor="municipio-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Municipio
                </label>
                <select
                  id="municipio-filter"
                  value={selectedMunicipio}
                  onChange={(e) => setSelectedMunicipio(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  {opcionesFiltros.municipios.map((municipio) => {
                    const count = actividades.filter(a => 
                      a.fields["mundep (from Municipio)"]?.[0] === municipio
                    ).length;
                    return (
                      <option key={municipio} value={municipio}>
                        {municipio} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Filtro por Tipo */}
              <div>
                <label htmlFor="tipo-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo
                </label>
                <select
                  id="tipo-filter"
                  value={selectedTipo}
                  onChange={(e) => setSelectedTipo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  {opcionesFiltros.tipos.map((tipo) => {
                    const count = actividades.filter(a => a.fields.Tipo === tipo).length;
                    return (
                      <option key={tipo} value={tipo}>
                        {tipo} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Botón para limpiar filtros */}
            {(selectedCoordinador || selectedMes || selectedAno || selectedMunicipio || selectedTipo) && (
              <button
                onClick={() => {
                  setSelectedCoordinador("");
                  setSelectedMes("");
                  setSelectedAno("");
                  setSelectedMunicipio("");
                  setSelectedTipo("");
                }}
                className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ✕ Limpiar todos los filtros
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando actividades...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {!loading && !error && actividadesFiltradas.length === 0 && actividades.length > 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No hay actividades para este coordinador
            </h2>
            <p className="text-gray-600">
              Selecciona otro coordinador o muestra todos
            </p>
          </div>
        )}

        {!loading && !error && actividades.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No hay actividades registradas
            </h2>
            <p className="text-gray-600 mb-6">
              Comienza creando tu primera actividad
            </p>
            <Link
              href="/actividades/nueva"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <span className="text-xl">+</span>
              Crear Primera Actividad
            </Link>
          </div>
        )}

        {!loading && !error && actividadesFiltradas.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">
              Actividades Filtradas: {actividadesFiltradas.length}
            </h2>
            <div className="space-y-2">
              {actividadesFiltradas.map((actividad) => (
                <div key={actividad.id} className="p-3 border border-gray-200 rounded">
                  <div className="font-semibold">{actividad.fields["Nombre de la Actividad"] || "Sin nombre"}</div>
                  <div className="text-sm text-gray-600">
                    📅 Fecha: {actividad.fields.Fecha || "N/A"} | 
                    Mes: {actividad.fields.Mes || "N/A"} | 
                    Año: {actividad.fields.Año || "N/A"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
