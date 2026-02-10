"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import WizardProgress from "@/components/wizard-orden/WizardProgress";
import PasoKardex from "@/components/wizard-orden/PasoKardex";
import PasoCatalogo from "@/components/wizard-orden/PasoCatalogo";
import PasoBeneficiario from "@/components/wizard-orden/PasoBeneficiario";
import PasoRevision, {
  type ItemOrden,
} from "@/components/wizard-orden/PasoRevision";
import {
  getKardexPorPagar,
  getCatalogoServicios,
  createOrdenServicio,
  updateTercero,
  type Kardex,
  type CatalogoServicio,
  type CreateItemOrdenParams,
} from "@/lib/airtable";

interface TerceroSeleccionado {
  id: string;
  razonSocial: string;
  nit?: string;
  direccion?: string;
  movil?: number;
  correo?: string;
  municipioId?: string;
  municipioDepartamento?: string;
}

interface ItemCatalogo {
  catalogo: CatalogoServicio;
  cantidad: number;
  precioUnitario: number;
}

export default function NuevaOrdenV2Page() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Wizard state
  const [pasoActual, setPasoActual] = useState(1);
  const [pasosCompletados, setPasosCompletados] = useState<Set<number>>(
    new Set()
  );

  // Data
  const [kardexDisponibles, setKardexDisponibles] = useState<Kardex[]>([]);
  const [catalogoDisponibles, setCatalogoDisponibles] = useState<
    CatalogoServicio[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wizard form data
  const [kardexSeleccionados, setKardexSeleccionados] = useState<Kardex[]>([]);
  const [itemsCatalogo, setItemsCatalogo] = useState<ItemCatalogo[]>([]);
  const [beneficiario, setBeneficiario] =
    useState<TerceroSeleccionado | null>(null);
  const [fechaPedido, setFechaPedido] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [observaciones, setObservaciones] = useState("");
  const [itemsOrden, setItemsOrden] = useState<ItemOrden[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!session?.user?.coordinatorRecordId) return;

      try {
        setLoading(true);
        setError(null);
        const [kardexData, catalogoData] = await Promise.all([
          getKardexPorPagar(session.user.coordinatorRecordId),
          getCatalogoServicios(),
        ]);
        setKardexDisponibles(kardexData);
        setCatalogoDisponibles(catalogoData);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Error al cargar los datos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session?.user?.coordinatorRecordId]);

  // Build itemsOrden from kardex + catalogo selections
  const buildItemsOrden = useCallback((): ItemOrden[] => {
    const items: ItemOrden[] = [];

    // Kardex items
    kardexSeleccionados.forEach((kardex) => {
      const municipio =
        kardex.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio";
      const fecha = kardex.fields.fechakardex || "Sin fecha";
      const kg = Math.abs(kardex.fields.Total || 0);
      const numero = kardex.fields.idkardex || "S/N";
      const tipo = kardex.fields.TipoMovimiento || "";

      items.push({
        id: `kardex-${kardex.id}`,
        tipo: "KARDEX",
        kardexId: kardex.id,
        descripcion: `Kardex #${numero} - ${municipio} - ${fecha} (${kg.toFixed(2)} kg)`,
        formaCobro: "Por Kilo",
        cantidad: kg,
        precioUnitario: 0,
        kardexData: kardex,
        tipoMovimiento: tipo as "ENTRADA" | "SALIDA",
        concepto: "",
      });
    });

    // Catalogo items
    itemsCatalogo.forEach((item) => {
      items.push({
        id: `catalogo-${item.catalogo.id}`,
        tipo: "CATALOGO",
        catalogoId: item.catalogo.id,
        descripcion: item.catalogo.fields.Nombre || "Sin nombre",
        formaCobro: "Por Flete",
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
      });
    });

    return items;
  }, [kardexSeleccionados, itemsCatalogo]);

  // Navigate steps
  const irAPaso = (paso: number) => {
    // When entering paso 4, build items from selections
    if (paso === 4) {
      // Preserve existing itemsOrden edits if possible
      const nuevosItems = buildItemsOrden();
      const itemsExistentes = new Map(itemsOrden.map((i) => [i.id, i]));

      const itemsFinales = nuevosItems.map((nuevoItem) => {
        const existente = itemsExistentes.get(nuevoItem.id);
        if (existente) {
          // Keep user edits (precioUnitario, formaCobro, cantidad, concepto)
          return {
            ...nuevoItem,
            precioUnitario: existente.precioUnitario,
            formaCobro: existente.formaCobro,
            cantidad:
              existente.tipo === "CATALOGO"
                ? existente.cantidad
                : nuevoItem.formaCobro === existente.formaCobro
                ? existente.cantidad
                : nuevoItem.cantidad,
            concepto: existente.concepto,
          };
        }
        return nuevoItem;
      });

      setItemsOrden(itemsFinales);
    }

    setPasoActual(paso);
  };

  const completarPaso = (paso: number) => {
    setPasosCompletados((prev) => new Set([...prev, paso]));
  };

  // Step 1 handlers
  const handleKardexContinuar = () => {
    completarPaso(1);
    irAPaso(2);
  };

  const handleKardexSaltar = () => {
    setKardexSeleccionados([]);
    completarPaso(1);
    irAPaso(2);
  };

  // Step 2 handlers
  const handleCatalogoContinuar = () => {
    completarPaso(2);
    irAPaso(3);
  };

  const handleCatalogoSaltar = () => {
    completarPaso(2);
    irAPaso(3);
  };

  // Step 3 handler
  const handleBeneficiarioContinuar = () => {
    completarPaso(3);
    irAPaso(4);
  };

  // Submit
  const handleSubmit = async () => {
    setError(null);

    if (!session?.user?.coordinatorRecordId) {
      setError("No se pudo identificar el coordinador");
      return;
    }

    if (itemsOrden.length === 0) {
      setError("Debes agregar al menos un item a la orden");
      return;
    }

    if (!beneficiario) {
      setError("Debes seleccionar un beneficiario");
      return;
    }

    // Validate beneficiary fields
    const validateEmail = (email: string): boolean => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    };

    const camposFaltantes: string[] = [];
    if (!beneficiario.direccion || beneficiario.direccion.length < 8)
      camposFaltantes.push("Direccion (min 8 caracteres)");
    if (!beneficiario.movil) camposFaltantes.push("Telefono/Movil");
    if (!beneficiario.correo || !validateEmail(beneficiario.correo))
      camposFaltantes.push("Correo Electronico valido");
    if (!beneficiario.municipioId) camposFaltantes.push("Municipio");

    if (camposFaltantes.length > 0) {
      setError(
        `Completa los siguientes campos del beneficiario: ${camposFaltantes.join(", ")}`
      );
      return;
    }

    const itemsSinPrecio = itemsOrden.filter(
      (item) => !item.precioUnitario || item.precioUnitario <= 0
    );
    if (itemsSinPrecio.length > 0) {
      setError(
        `Todos los items deben tener precio unitario. Revisa ${itemsSinPrecio.length} item(s) sin precio.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Update tercero
      const terceroActualizado = await updateTercero(beneficiario.id, {
        direccion: beneficiario.direccion,
        movil: beneficiario.movil,
        correoElectronico: beneficiario.correo,
        municipioId: beneficiario.municipioId,
      });

      if (!terceroActualizado) {
        console.warn(
          "No se pudo actualizar el tercero, pero continuamos con la orden"
        );
      }

      const items: CreateItemOrdenParams[] = itemsOrden.map((item) => {
        if (item.tipo === "KARDEX") {
          return {
            kardexRecordId: item.kardexId!,
            formaCobro: item.formaCobro,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            concepto: item.concepto || undefined,
          };
        } else {
          return {
            catalogoRecordId: item.catalogoId!,
            formaCobro: item.formaCobro,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          };
        }
      });

      await createOrdenServicio(
        {
          coordinatorRecordId: session.user.coordinatorRecordId,
          beneficiarioRecordId: beneficiario.id,
          fechaPedido,
          observaciones: observaciones.trim() || undefined,
          items,
          estado: "Enviada",
        },
        {
          name: session.user.name || "Coordinador",
          email: session.user.email || "",
        },
        {
          razonSocial: beneficiario.razonSocial,
          nit: beneficiario.nit || "N/A",
          direccion: beneficiario.direccion || "N/A",
        }
      );

      router.push("/ordenes-servicio");
    } catch (err) {
      console.error("Error creating order:", err);
      setError(
        "Error al crear la orden. Por favor verifica los datos e intenta de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const pasoTitulos: Record<number, string> = {
    1: "Seleccionar Kardex",
    2: "Items del Catalogo",
    3: "Beneficiario y Detalles",
    4: "Revision y Confirmacion",
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link
              href="/ordenes-servicio"
              className="hover:text-[#00d084] transition-colors"
            >
              Ordenes de Servicio
            </Link>
            <span>&rsaquo;</span>
            <span>Nueva Orden (v2)</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Nueva Orden de Servicio
          </h1>
        </div>

        {/* Wizard Progress */}
        <WizardProgress
          pasoActual={pasoActual}
          onPasoClick={(paso) => irAPaso(paso)}
          pasosCompletados={pasosCompletados}
        />

        {/* Step content */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Paso {pasoActual}: {pasoTitulos[pasoActual]}
          </h2>

          {error && pasoActual !== 4 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {pasoActual === 1 && (
            <PasoKardex
              kardexDisponibles={kardexDisponibles}
              kardexSeleccionados={kardexSeleccionados}
              onSeleccionChange={setKardexSeleccionados}
              onContinuar={handleKardexContinuar}
              onSaltar={handleKardexSaltar}
            />
          )}

          {pasoActual === 2 && (
            <PasoCatalogo
              catalogoDisponibles={catalogoDisponibles}
              kardexSeleccionados={kardexSeleccionados}
              itemsCatalogo={itemsCatalogo}
              onItemsChange={setItemsCatalogo}
              onContinuar={handleCatalogoContinuar}
              onSaltar={handleCatalogoSaltar}
              onAtras={() => irAPaso(1)}
            />
          )}

          {pasoActual === 3 && (
            <PasoBeneficiario
              beneficiario={beneficiario}
              onBeneficiarioChange={setBeneficiario}
              fechaPedido={fechaPedido}
              onFechaPedidoChange={setFechaPedido}
              observaciones={observaciones}
              onObservacionesChange={setObservaciones}
              onContinuar={handleBeneficiarioContinuar}
              onAtras={() => irAPaso(2)}
            />
          )}

          {pasoActual === 4 && (
            <PasoRevision
              kardexSeleccionados={kardexSeleccionados}
              itemsCatalogo={itemsCatalogo}
              beneficiario={beneficiario}
              fechaPedido={fechaPedido}
              observaciones={observaciones}
              itemsOrden={itemsOrden}
              onItemsOrdenChange={setItemsOrden}
              onSubmit={handleSubmit}
              onAtras={() => irAPaso(3)}
              submitting={submitting}
              error={error}
            />
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
