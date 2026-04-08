"use client";

import { useEffect, useState, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getCentrosAcopio, getCentrosCoordinador, getAllKardex, type CentroAcopio, type Kardex } from "@/lib/airtable";
import { isAdminOrSupervisor, isAdmin } from "@/lib/roles";

interface SaldoCentroPorMes {
  centroId: string;
  centroNombre: string;
  municipio: string;
  entradasMes: number;      // Solo del mes seleccionado
  salidasMes: number;       // Solo del mes seleccionado
  saldoAcumulado: number;   // Histórico hasta fin del mes
  materiales: {
    reciclaje: number;
    incineracion: number;
    plasticoContaminado: number;
    flexibles: number;
    lonas: number;
    carton: number;
    metal: number;
  };
}

export default function SaldosCentrosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [centros, setCentros] = useState<CentroAcopio[]>([]);
  const [allKardex, setAllKardex] = useState<Kardex[]>([]);
  const [saldos, setSaldos] = useState<SaldoCentroPorMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [datosYaCargados, setDatosYaCargados] = useState(false);
  
  // Selector de período
  const [mesSeleccionado, setMesSeleccionado] = useState<string>("");
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);
  const canWrite = isAdmin(session?.user?.rol);
  const coordinatorRecordId = session?.user?.coordinatorRecordId;

  useEffect(() => {
    async function cargarDatos() {
      // Solo cargar si no se han cargado antes
      if (datosYaCargados) return;

      try {
        setLoading(true);
        setError(null);

        // Cargar centros según rol: admin ve todos, coordinador solo los suyos
        const centrosPromise = canViewAll
          ? getCentrosAcopio()
          : coordinatorRecordId
            ? getCentrosCoordinador(coordinatorRecordId)
            : Promise.resolve([]);

        const [centrosData, kardexData] = await Promise.all([
          centrosPromise,
          getAllKardex(),
        ]);

        setCentros(centrosData);
        setAllKardex(kardexData);

        // Obtener meses disponibles (últimos 12 meses con datos)
        const mesesSet = new Set<string>();
        kardexData.forEach((k) => {
          const mes = k.fields.MES;
          if (mes && typeof mes === 'string' && mes.includes('-')) {
            mesesSet.add(mes);
          }
        });

        const mesesArray = Array.from(mesesSet).sort().reverse(); // Más reciente primero
        const ultimos12Meses = mesesArray.slice(0, 12);
        
        console.log('Meses disponibles:', ultimos12Meses);
        
        setMesesDisponibles(ultimos12Meses);

        // Seleccionar el mes más reciente por defecto
        if (ultimos12Meses.length > 0 && !mesSeleccionado) {
          console.log('Seleccionando mes por defecto:', ultimos12Meses[0]);
          setMesSeleccionado(ultimos12Meses[0]);
        }

        setLoading(false);
        setDatosYaCargados(true); // Marcar como cargados
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Error al cargar los datos. Por favor intenta de nuevo.");
        setLoading(false);
      }
    }

    if (session && !datosYaCargados) {
      cargarDatos();
    }
  }, [session, datosYaCargados, mesSeleccionado, canViewAll, coordinatorRecordId]);

  // Recalcular saldos cuando cambia el mes seleccionado
  useEffect(() => {
    if (!mesSeleccionado || centros.length === 0 || allKardex.length === 0) {
      return;
    }

    calcularSaldosPorMes(mesSeleccionado);
  }, [mesSeleccionado, centros, allKardex]);

  const calcularSaldosPorMes = (mes: string) => {
    // Calcular fecha fin del mes seleccionado
    const [anio, mesNum] = mes.split('-');
    const ultimoDiaMes = new Date(parseInt(anio), parseInt(mesNum), 0).getDate();
    const fechaFinMes = `${anio}-${mesNum}-${ultimoDiaMes.toString().padStart(2, '0')}`;

    const saldosPorCentro = centros.map((centro) => {
      const centroId = centro.id;

      // Filtrar kardex de este centro
      const kardexCentro = allKardex.filter((k) =>
        k.fields.CentrodeAcopio?.includes(centroId)
      );

      // ENTRADAS Y SALIDAS: Solo del mes seleccionado
      const kardexDelMes = kardexCentro.filter((k) => k.fields.MES === mes);
      const entradasDelMes = kardexDelMes.filter((k) => k.fields.TipoMovimiento === "ENTRADA");
      const salidasDelMes = kardexDelMes.filter((k) => k.fields.TipoMovimiento === "SALIDA");

      const totalEntradasMes = entradasDelMes.reduce(
        (sum, k) => sum + Math.abs(k.fields.Total || 0),
        0
      );
      const totalSalidasMes = salidasDelMes.reduce(
        (sum, k) => sum + Math.abs(k.fields.Total || 0),
        0
      );

      // SALDO: Acumulado histórico hasta fin del mes seleccionado
      const kardexHastaFinMes = kardexCentro.filter((k) => {
        const fecha = k.fields.fechakardex;
        if (!fecha) return false;
        return fecha <= fechaFinMes;
      });

      const entradasAcumuladas = kardexHastaFinMes.filter(
        (k) => k.fields.TipoMovimiento === "ENTRADA"
      );
      const salidasAcumuladas = kardexHastaFinMes.filter(
        (k) => k.fields.TipoMovimiento === "SALIDA"
      );

      const totalEntradasAcum = entradasAcumuladas.reduce(
        (sum, k) => sum + Math.abs(k.fields.Total || 0),
        0
      );
      const totalSalidasAcum = salidasAcumuladas.reduce(
        (sum, k) => sum + Math.abs(k.fields.Total || 0),
        0
      );

      // SALDO ACUMULADO = SaldoInicial + (Entradas - Salidas)
      const saldoInicialCentro = centro.fields.SaldoInicialTotal || 0;
      const saldoAcumulado = saldoInicialCentro + totalEntradasAcum - totalSalidasAcum;

      // Calcular por material (solo movimientos del mes seleccionado)
      const materiales = {
        reciclaje: 0,
        incineracion: 0,
        plasticoContaminado: 0,
        flexibles: 0,
        lonas: 0,
        carton: 0,
        metal: 0,
      };

      kardexDelMes.forEach((k) => {
        const factor = k.fields.TipoMovimiento === "ENTRADA" ? 1 : -1;
        materiales.reciclaje += (k.fields.Reciclaje || 0) * factor;
        materiales.incineracion += (k.fields.Incineracion || 0) * factor;
        materiales.plasticoContaminado += (k.fields.PlasticoContaminado || 0) * factor;
        materiales.flexibles += (k.fields.Flexibles || 0) * factor;
        materiales.lonas += (k.fields.Lonas || 0) * factor;
        materiales.carton += (k.fields.Carton || 0) * factor;
        materiales.metal += (k.fields.Metal || 0) * factor;
      });

      return {
        centroId,
        centroNombre: centro.fields.Nombre || "Sin nombre",
        municipio: centro.fields["mundep (from Municipio)"]?.[0] || "Sin municipio",
        entradasMes: totalEntradasMes,
        salidasMes: totalSalidasMes,
        saldoAcumulado,
        materiales,
      };
    });

    // Filtrar centros sin movimientos (todos los valores en cero)
    const centrosConMovimientos = saldosPorCentro.filter(
      (s) => s.entradasMes !== 0 || s.salidasMes !== 0 || s.saldoAcumulado !== 0
    );

    // Ordenar por saldo descendente
    centrosConMovimientos.sort((a, b) => b.saldoAcumulado - a.saldoAcumulado);

    setSaldos(centrosConMovimientos);
  };

  // Función para verificar si el mes está cerrado (5 días después de fin de mes)
  const esMesCerrado = (mesStr: string): boolean => {
    if (!mesStr || typeof mesStr !== 'string' || !mesStr.includes('-')) {
      return false;
    }

    const [anio, mesNum] = mesStr.split('-');
    if (!anio || !mesNum) {
      return false;
    }

    const ultimoDiaMes = new Date(parseInt(anio), parseInt(mesNum), 0);

    // Fecha de cierre = último día del mes + 5 días
    const fechaCierre = new Date(ultimoDiaMes);
    fechaCierre.setDate(fechaCierre.getDate() + 5);
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    return hoy > fechaCierre;
  };
  
  const formatKg = (kg: number) => {
    return new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(kg);
  };

  const formatMesLabel = (mesStr: string): string => {
    if (!mesStr || typeof mesStr !== 'string' || !mesStr.includes('-')) {
      return 'N/A';
    }
    const [anio, mes] = mesStr.split('-');
    const fecha = new Date(parseInt(anio), parseInt(mes) - 1, 1);
    return fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' });
  };

  if (status === "loading" || loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  // Si el coordinador no tiene centros asignados
  if (!loading && !canViewAll && centros.length === 0) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              ⚖️ Saldos por Centro de Acopio
            </h1>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 text-lg">
              No tienes centros de acopio asignados.
            </p>
            <p className="text-yellow-700 text-sm mt-2">
              Contacta al administrador para que te asigne un centro de acopio.
            </p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Si no hay meses disponibles, mostrar mensaje
  if (!loading && mesesDisponibles.length === 0) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              ⚖️ Saldos por Centro de Acopio
            </h1>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 text-lg">
              No hay datos de kardex disponibles para mostrar.
            </p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const mesCerrado = mesSeleccionado ? esMesCerrado(mesSeleccionado) : false;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            ⚖️ Saldos por Centro de Acopio
          </h1>
          <p className="text-gray-600 mt-1">
            {canViewAll
              ? "Balance mensual de inventario por centro con saldo acumulado histórico"
              : "Balance mensual de inventario de tus centros asignados"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Selector de Período */}
        <div className="mb-6 bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Período:
            </label>
            <select
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
            >
              {mesesDisponibles.map((mes) => (
                <option key={mes} value={mes}>
                  {formatMesLabel(mes)}
                </option>
              ))}
            </select>
            
            {/* Badge de estado del período */}
            {mesSeleccionado && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  mesCerrado
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {mesCerrado ? "✅ Cerrado" : "🔓 Abierto"}
              </span>
            )}
          </div>
        </div>

        {/* Resumen Global del Mes Seleccionado */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-sm text-gray-600 mb-1">Centros con Movimientos</div>
            <div className="text-2xl font-bold text-gray-900">{saldos.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-sm text-gray-600 mb-1">Entradas del Mes</div>
            <div className="text-2xl font-bold text-green-600">
              {formatKg(saldos.reduce((sum, s) => sum + s.entradasMes, 0))} kg
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-sm text-gray-600 mb-1">Salidas del Mes</div>
            <div className="text-2xl font-bold text-red-600">
              {formatKg(saldos.reduce((sum, s) => sum + s.salidasMes, 0))} kg
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="text-sm text-gray-600 mb-1">Saldo Acumulado</div>
            <div className="text-2xl font-bold text-purple-600">
              {formatKg(saldos.reduce((sum, s) => sum + s.saldoAcumulado, 0))} kg
            </div>
          </div>
        </div>

        {/* Tabla de Saldos por Centro */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Centro de Acopio
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Municipio
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Entradas Mes
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Salidas Mes
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Saldo Acumulado
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody>
              {saldos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No hay datos para el período seleccionado
                  </td>
                </tr>
              ) : (
                saldos.map((saldo, index) => (
                  <Fragment key={saldo.centroId}>
                    <tr
                      className={`border-b border-gray-200 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-blue-50 transition-colors`}
                    >
                      {/* Centro */}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {saldo.centroNombre}
                      </td>

                      {/* Municipio */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {saldo.municipio}
                      </td>

                      {/* Entradas del Mes */}
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-mono text-green-600">
                          +{formatKg(saldo.entradasMes)}
                        </div>
                      </td>

                      {/* Salidas del Mes */}
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-mono text-red-600">
                          -{formatKg(saldo.salidasMes)}
                        </div>
                      </td>

                      {/* Saldo Acumulado */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-mono font-bold ${
                            saldo.saldoAcumulado >= 0 ? "text-[#00d084]" : "text-red-600"
                          }`}
                        >
                          {formatKg(saldo.saldoAcumulado)}
                        </span>
                      </td>

                      {/* Botón Expandir */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            setExpandido(expandido === saldo.centroId ? null : saldo.centroId)
                          }
                          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                        >
                          {expandido === saldo.centroId ? "Ocultar" : "Ver"}
                        </button>
                      </td>
                    </tr>

                    {/* Fila expandida con detalle de materiales */}
                    {expandido === saldo.centroId && (
                      <tr className="bg-blue-50 border-b border-gray-200">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="text-sm font-semibold text-gray-700 mb-2">
                            Desglose por Material (del mes seleccionado):
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white p-2 rounded border">
                              <div className="text-xs text-gray-600">Reciclaje</div>
                              <div className={`text-sm font-mono font-bold ${saldo.materiales.reciclaje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatKg(saldo.materiales.reciclaje)} kg
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <div className="text-xs text-gray-600">Incineración</div>
                              <div className={`text-sm font-mono font-bold ${saldo.materiales.incineracion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatKg(saldo.materiales.incineracion)} kg
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <div className="text-xs text-gray-600">Plástico Cont.</div>
                              <div className={`text-sm font-mono font-bold ${saldo.materiales.plasticoContaminado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatKg(saldo.materiales.plasticoContaminado)} kg
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <div className="text-xs text-gray-600">Flexibles</div>
                              <div className={`text-sm font-mono font-bold ${saldo.materiales.flexibles >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatKg(saldo.materiales.flexibles)} kg
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <div className="text-xs text-gray-600">Lonas</div>
                              <div className={`text-sm font-mono font-bold ${saldo.materiales.lonas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatKg(saldo.materiales.lonas)} kg
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <div className="text-xs text-gray-600">Cartón</div>
                              <div className={`text-sm font-mono font-bold ${saldo.materiales.carton >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatKg(saldo.materiales.carton)} kg
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <div className="text-xs text-gray-600">Metal</div>
                              <div className={`text-sm font-mono font-bold ${saldo.materiales.metal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatKg(saldo.materiales.metal)} kg
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

