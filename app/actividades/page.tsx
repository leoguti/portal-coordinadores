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
      
      // Si es admin, aplicar filtro de coordinador
      if (isAdmin && selectedCoordinador) {
        data = data.filter(a => a.fields.Coordinador?.[0] === selectedCoordinador);
      }
      
      // Si NO es admin, filtrar solo actividades del coordinador actual
      if (!isAdmin && session?.user?.coordinatorRecordId) {
        data = data.filter(a => a.fields.Coordinador?.[0] === session.user.coordinatorRecordId);
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
  }, [actividades, isAdmin, selectedCoordinador, selectedAno, selectedMes, selectedMunicipio, selectedTipo, session?.user?.coordinatorRecordId]);

  // Filtrar actividades por coordinador, mes, año, municipio y tipo
  const actividadesFiltradas = React.useMemo(() => {
    let filtered = actividades;

    // Si es admin, aplicar filtro de coordinador
    if (isAdmin && selectedCoordinador) {
      filtered = filtered.filter(a => a.fields.Coordinador?.[0] === selectedCoordinador);
    }

    // Si NO es admin, filtrar solo actividades del coordinador actual
    if (!isAdmin && session?.user?.coordinatorRecordId) {
      filtered = filtered.filter(a => a.fields.Coordinador?.[0] === session.user.coordinatorRecordId);
    }

    // Filtro por mes
    if (selectedMes) {
      filtered = filtered.filter(a => String(a.fields.Mes) === selectedMes);
    }

    // Filtro por año
    if (selectedAno) {
      filtered = filtered.filter(a => String(a.fields.Año) === selectedAno);
    }

    // Filtro por municipio
    if (selectedMunicipio) {
      filtered = filtered.filter(a => 
        a.fields["mundep (from Municipio)"]?.[0] === selectedMunicipio
      );
    }

    // Filtro por tipo
    if (selectedTipo) {
      filtered = filtered.filter(a => a.fields.Tipo === selectedTipo);
    }

    return filtered;
  }, [actividades, selectedCoordinador, selectedMes, selectedAno, selectedMunicipio, selectedTipo, isAdmin, session?.user?.coordinatorRecordId]);

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
  }, [actividadesFiltradas]);

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

        {/* Filtros - Admin y Coordinadores */}
        {(opcionesFiltros.meses.length > 0 || opcionesFiltros.anos.length > 0) && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              🔍 Filtros de Búsqueda
            </h3>
            <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'md:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
              {/* Filtro por Coordinador - Solo admin */}
              {isAdmin && (
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
              )}

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
            {(selectedMes || selectedAno || selectedMunicipio || selectedTipo || (isAdmin && selectedCoordinador)) && (
              <button
                onClick={() => {
                  if (isAdmin) setSelectedCoordinador("");
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
          <div className="space-y-4">
            {/* Cuadro de Resumen General */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📊</span>
                <h3 className="text-lg font-semibold text-gray-900">Resumen General</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(estadisticasGenerales).map(([tipo, stats]) => (
                  <div key={tipo} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">{tipo}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {stats.count}
                      </span>
                    </div>
                    {stats.participantes > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-700 mt-2 pt-2 border-t border-gray-100">
                        <span>👥</span>
                        <span className="font-semibold">{stats.participantes.toLocaleString('es-CO')}</span>
                        <span className="text-gray-500 text-xs">participantes</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actividades por Mes */}
            {actividadesPorMes.map(([monthKey, actividadesDelMes]) => {
              const [year, month] = monthKey.split('-');
              const monthDate = new Date(parseInt(year), parseInt(month) - 1);
              const monthName = monthDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
              const isMonthExpanded = expandedMonths.has(monthKey);
              const totalActividades = actividadesDelMes.length;
              const resumenMes = getResumenMes(actividadesDelMes);

              return (
                <div key={monthKey} className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  {/* Month Header - Clickable */}
                  <button
                    onClick={() => toggleMonth(monthKey)}
                    className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <svg 
                          className={`w-5 h-5 text-gray-600 transform transition-transform flex-shrink-0 ${isMonthExpanded ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 capitalize text-left">
                            📅 {monthName}
                          </h2>
                          {/* Resumen compacto por tipo - En columna */}
                          <div className="flex flex-col gap-1.5 mt-2">
                            {Object.entries(resumenMes).map(([tipo, stats]) => (
                              <div key={tipo} className="flex items-center gap-2 text-xs">
                                <span className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-gray-300 min-w-[200px]">
                                  <span className="font-medium text-gray-700">{tipo}:</span>
                                  <span className="font-bold text-blue-600">{stats.count}</span>
                                  {stats.participantes > 0 && (
                                    <>
                                      <span className="text-gray-400">|</span>
                                      <span className="text-gray-600 flex items-center gap-1">
                                        <span>👥</span>
                                        <span className="font-semibold">{stats.participantes.toLocaleString('es-CO')}</span>
                                      </span>
                                    </>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-600 bg-gray-200 px-3 py-1 rounded-full flex-shrink-0">
                        {totalActividades}
                      </span>
                    </div>
                  </button>

                  {/* Month Content */}
                  {isMonthExpanded && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="w-12 px-6 py-3"></th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Actividad
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Registro
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Municipio
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fotos
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {actividadesDelMes.map((actividad) => {
                    const isExpanded = expandedRow === actividad.id;
                    const photoCount = actividad.fields.Fotografias?.length || 0;
                    const puedeModificar = actividad.fields.Fecha ? puedeModificarActividad(actividad.fields.Fecha) : true;
                    const fechaCreacion = new Date(actividad.createdTime).toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    });

                    return (
                      <React.Fragment key={actividad.id}>
                        {/* Main Row */}
                        <tr 
                          className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50' : ''}`}
                        >
                          {/* Expand Button */}
                          <td className="px-6 py-4">
                            <button
                              onClick={() => toggleRow(actividad.id)}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <svg 
                                className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </td>

                          {/* Fecha Actividad */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900">
                                {actividad.fields.Fecha ? new Date(actividad.fields.Fecha + 'T00:00:00').toLocaleDateString('es-CO', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }) : '-'}
                              </span>
                            </div>
                          </td>

                          {/* Fecha Registro */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500">{fechaCreacion}</span>
                          </td>

                          {/* Municipio */}
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate">
                              {actividad.fields["mundep (from Municipio)"]?.[0] || '-'}
                            </div>
                          </td>

                          {/* Tipo */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {actividad.fields.Tipo && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {actividad.fields.Tipo}
                              </span>
                            )}
                          </td>

                          {/* Fotos */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {photoCount > 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                📷 {photoCount}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Sin fotos</span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {puedeModificar ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                🔓 Abierta
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                                🔒 Cerrada
                              </span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <div className="flex items-center justify-center gap-2">
                              <Link
                                href={`/actividades/${actividad.id}`}
                                className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors"
                              >
                                Ver
                              </Link>
                              {puedeModificar && (
                                <Link
                                  href={`/actividades/${actividad.id}/editar`}
                                  className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors"
                                >
                                  Editar
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Row */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="px-6 py-4 bg-gray-50">
                              <div className="space-y-4">
                                {/* Nombre y Descripción */}
                                <div className="grid grid-cols-1 gap-4">
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Nombre de la Actividad</h4>
                                    <p className="text-sm text-gray-900">
                                      {actividad.fields["Nombre de la Actividad"] || "Sin nombre"}
                                    </p>
                                  </div>
                                  
                                  {actividad.fields.Descripcion && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Descripción</h4>
                                      <p className="text-sm text-gray-600 whitespace-pre-line">
                                        {actividad.fields.Descripcion}
                                      </p>
                                    </div>
                                  )}

                                  {/* Información adicional */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {actividad.fields["Cantidad de Participantes"] && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Participantes</h4>
                                        <p className="text-sm font-medium text-gray-900">
                                          {actividad.fields["Cantidad de Participantes"]}
                                        </p>
                                      </div>
                                    )}
                                    {actividad.fields.Cultivo && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Cultivo</h4>
                                        <p className="text-sm font-medium text-gray-900">
                                          {actividad.fields.Cultivo}
                                        </p>
                                      </div>
                                    )}
                                    {actividad.fields.Modalidad && actividad.fields.Modalidad.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Modalidad</h4>
                                        <p className="text-sm font-medium text-gray-900">
                                          {actividad.fields.Modalidad.join(', ')}
                                        </p>
                                      </div>
                                    )}
                                    {actividad.fields["Perfil de Asistentes"] && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Perfil Asistentes</h4>
                                        <p className="text-sm font-medium text-gray-900">
                                          {actividad.fields["Perfil de Asistentes"]}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Fotografías */}
                                {photoCount > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                      Fotografías ({photoCount})
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                      {actividad.fields.Fotografias?.map((foto, idx) => (
                                        <button
                                          key={foto.id}
                                          onClick={() => window.open(`/api/image-proxy?url=${encodeURIComponent(foto.url)}`, '_blank')}
                                          className="relative group overflow-hidden rounded-lg hover:shadow-lg transition-shadow"
                                        >
                                          <img
                                            src={`/api/image-proxy?url=${encodeURIComponent(foto.url)}`}
                                            alt={`Foto ${idx + 1}`}
                                            className="w-full h-48 object-cover"
                                          />
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-opacity flex items-center justify-center">
                                            <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                                              🔍
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
              );
            })}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
