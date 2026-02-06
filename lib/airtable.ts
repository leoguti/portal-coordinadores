"use server";

/**
 * Airtable Integration - Server-only
 * 
 * Provides utilities to interact with Airtable API
 * Used for validating coordinators during authentication
 */

interface AirtableRecord<T> {
  id: string;
  createdTime: string;
  fields: T;
}

interface AirtableResponse<T> {
  records: AirtableRecord<T>[];
  offset?: string;
}

interface CoordinadorFields {
  Name?: string;
  email?: string; // lowercase to match Airtable field name
  telefono?: string;
  Rol?: "Coordinador" | "Administrador" | "Desactivado";
  Actividades?: string[];
  Certificados?: string[];
  Kardex?: string[];
}

interface CatalogoServicioFields {
  Nombre?: string;
  Descripcion?: string;
  UnidadMedida?: string;
  Activo?: boolean;
  "Precio Unitario"?: number;
}

interface ActividadFields {
  "Nombre de la Actividad"?: string;
  Fecha?: string;
  Mes?: string; // Campo Mes en formato YYYY-MM
  Año?: string; // Campo Año
  Descripcion?: string;
  Tipo?: string;
  Coordinador?: string[]; // Linked record IDs
  "Name (from Coordinador)"?: string[];
  Municipio?: string[];
  "mundep (from Municipio)"?: string[];
  "CODIGOMUN Compilación (de Municipio)"?: number;
  "Cantidad de Participantes"?: number;
  Modalidad?: string[];
  Consecutivo?: number;
  Cultivo?: string;
  "Perfil de Asistentes"?: string;
  Departamento?: string[];
  Fotografias?: Array<{
    id: string;
    url: string;
    filename: string;
  }>;
  "Documentos Actividad"?: Array<{
    id: string;
    url: string;
    filename: string;
  }>;
}

interface KardexFields {
  idkardex?: number;
  fechakardex?: string;
  TipoMovimiento?: string; // "ENTRADA" | "SALIDA"
  Coordinador?: string[]; // Linked record IDs
  idcoordinador?: string[]; // Lookup field - coordinator record ID
  "Name (from Coordinador)"?: string[];
  EstadoPago?: string; // "Caja Menor" | "Sin Costo" | "Por Pagar" | "En Orden"
  MunicipioOrigen?: string[];
  "mundep (from MunicipioOrigen)"?: string[];
  CentrodeAcopio?: string[];
  NombreCentrodeAcopio?: string[];
  Reciclaje?: number;
  Incineracion?: number;
  Flexibles?: number;
  PlasticoContaminado?: number;
  Lonas?: number;
  Carton?: number;
  Metal?: number;
  Total?: number;
  Descripción?: string; // Computed field - read only
  gestor?: string[];
  nombregestor?: string[];
  AÑO?: string; // Year as string (e.g., "2025")
  MES?: string; // Year-Month format (e.g., "2025-02")
  soportebascula?: Array<{
    id: string;
    url: string;
    filename: string;
  }>;
  RegistroConciliacion?: string[]; // Linked to Kardex - vincula SALIDA con ENTRADA de conciliación
  Observaciones?: string; // Observaciones del registro
}

interface OrdenFields {
  NumeroOrden?: number; // Autonumber
  Coordinador?: string[]; // Linked record IDs
  NombreCoordinador?: string[]; // Lookup
  Beneficiario?: string[]; // Linked to Terceros
  RazonSocial?: string[]; // Lookup from Beneficiario
  Estado?: string; // "Borrador" | "Enviada" | "Facturada" | "Pagada" | "Rechazada"
  "Fecha de pedido"?: string;
  ItemsOrden?: string[]; // Linked record IDs
  Observaciones?: string;
  Total?: number; // Rollup: sum of ItemsOrden subtotals
  PDF?: Array<{
    id: string;
    url: string;
    filename: string;
    size: number;
    type: string;
  }>;
  Factura?: Array<{
    id: string;
    url: string;
    filename: string;
    size?: number;
    type?: string;
  }>;
}

interface TerceroFields {
  RazonSocial?: string;
  NIT?: string;
  Direccion?: string;
  Movil?: number;
  "Correo Electrónico"?: string;
  Municipio?: string[]; // Linked to MUNICIPIOS table
  "Municipio-Departamento"?: string[]; // Lookup field
  Tipo?: string;
  Ordenes?: string[]; // Linked to Ordenes
}

interface CentroAcopioFields {
  Nombre?: string;
  Municipio?: string[];
  "mundep (from Municipio)"?: string[];
  Tipo?: string;
  Autonumber?: number;
  Departamento?: string[];
  Coordinador?: string[]; // Linked record to Coordinadores
  SaldoInicialTotal?: number;
  SaldoInicial_Reciclaje?: number;
  SaldoInicial_Incineracion?: number;
  SaldoInicial_Flexibles?: number;
  SaldoInicial_PlasticoContaminado?: number;
  SaldoInicial_Lonas?: number;
  SaldoInicial_Carton?: number;
  SaldoInicial_Metal?: number;
}

export interface CentroAcopio {
  id: string;
  createdTime: string;
  fields: CentroAcopioFields;
}

interface ItemOrdenFields {
  Name?: string;
  TipoItem?: string; // "CON Kardex" | "SIN Kardex"
  OrdenServicio?: string[]; // Linked to Ordenes
  Kardex?: string[]; // Linked to Kardex
  CatalogoServicio?: string[]; // Linked to CatalogoServicios
  FormaCobro?: string; // "Por Flete" | "Por Kilo"
  Cantidad?: number;
  PrecioUnitario?: number;
  "Cálculo"?: number; // Formula field (Cantidad * PrecioUnitario)
}

export interface Coordinator {
  id: string;
  name?: string;
  email: string;
  rol?: "Coordinador" | "Administrador" | "Desactivado";
}

export interface Actividad {
  id: string;
  createdTime: string;
  fields: ActividadFields;
}

export interface Kardex {
  id: string;
  createdTime: string;
  fields: KardexFields;
}

export interface Orden {
  id: string;
  createdTime: string;
  fields: OrdenFields;
}

export interface Tercero {
  id: string;
  createdTime: string;
  fields: TerceroFields;
}

export interface ItemOrden {
  id: string;
  createdTime: string;
  fields: ItemOrdenFields;
}

export interface CatalogoServicio {
  id: string;
  createdTime: string;
  fields: CatalogoServicioFields;
}

// === Caja Menor Interfaces ===

interface GastoCajaMenorFields {
  NumeroGasto?: number;
  Fecha?: string;
  Coordinador?: string[];
  NombreCoordinador?: string[];
  Beneficiario?: string[];
  RazonSocial?: string[];
  NIT?: string[];
  Concepto?: string;
  Valor?: number;
  PorcentajeRetencion?: number;
  ValorRetencion?: number;
  ValorNeto?: number;
  Factura?: Array<{ id: string; url: string; filename: string }>;
  Estado?: string; // "Pendiente" | "Aprobado" | "Rechazado" | "Reembolsado"
  ObservacionesAdmin?: string;
  MesLegalizacion?: string;
  Reembolso?: string[]; // Linked to ReembolsosCajaMenor
  Kardex?: string[]; // Linked to Kardex records (optional)
}

export interface GastoCajaMenor {
  id: string;
  createdTime: string;
  fields: GastoCajaMenorFields;
}

interface ReembolsoCajaMenorFields {
  NumeroReembolso?: number;
  Coordinador?: string[];
  NombreCoordinador?: string[];
  Fecha?: string;
  Monto?: number; // Monto libre del reembolso
  Observaciones?: string;
}

export interface ReembolsoCajaMenor {
  id: string;
  createdTime: string;
  fields: ReembolsoCajaMenorFields;
}

// Interfaces for creating new records
export interface CreateOrdenParams {
  coordinatorRecordId: string;
  beneficiarioRecordId: string;
  fechaPedido: string; // YYYY-MM-DD
  observaciones?: string;
  items: CreateItemOrdenParams[];
  estado?: "Borrador" | "Enviada"; // Optional, defaults to "Borrador"
}

export interface CreateItemOrdenParams {
  kardexRecordId?: string; // Optional: for Kardex items
  catalogoRecordId?: string; // Optional: for Catalog items
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
}

/**
 * Get coordinator by email from Airtable
 * Case-insensitive email comparison
 * With retry logic for timeout errors
 * 
 * @param email - Email address to search for
 * @returns Coordinator object or null if not found
 */
export async function getCoordinatorByEmail(
  email: string
): Promise<Coordinator | null> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return null;
  }

  // Normalize email for comparison (lowercase, trim)
  const normalizedEmail = email.toLowerCase().trim();

  // Build Airtable API URL with filter
  // Using LOWER() formula for case-insensitive comparison
  // Exclude users with Rol="Desactivado" directly in the query
  const filterFormula = `AND(LOWER({email})="${normalizedEmail}",{Rol}!="Desactivado")`;
  const url = `https://api.airtable.com/v0/${baseId}/Coordinadores?filterByFormula=${encodeURIComponent(
    filterFormula
  )}&maxRecords=1`;

  // Retry logic
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching coordinator (attempt ${attempt}/${maxRetries}): ${email}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(
          `Airtable API error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const data: AirtableResponse<CoordinadorFields> = await response.json();

      // Return first match or null
      if (data.records && data.records.length > 0) {
        const record = data.records[0];
        const rol = record.fields.Rol;
        
        // 🚫 Bloquear acceso si el rol es "Desactivado"
        if (rol === "Desactivado") {
          console.log(`⛔ Acceso denegado: Usuario desactivado - ${email}`);
          return null;
        }
        
        console.log(`✅ Coordinator found: ${record.fields.Name} (${rol || 'no role'})`);
        return {
          id: record.id,
          name: record.fields.Name,
          email: record.fields.email || email,
          rol: record.fields.Rol,
        };
      }

      console.log(`❌ No coordinator found for: ${email}`);
      return null;
    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      // If it's the last attempt, return null
      if (attempt === maxRetries) {
        console.error("Max retries reached, giving up");
        return null;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  return null;
}

/**
 * List activities for a specific coordinator
 * Filters by the Coordinador linked record field
 * 
 * @param coordinatorRecordId - Airtable record ID of the coordinator
 * @returns Array of activities or empty array if none found
 */
export async function listActividadesForCoordinator(
  coordinatorRecordId: string
): Promise<Actividad[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    // Step 1: Get coordinator record to retrieve activity IDs
    console.log(`Fetching coordinator: ${coordinatorRecordId}`);
    const coordinatorUrl = `https://api.airtable.com/v0/${baseId}/Coordinadores/${coordinatorRecordId}`;
    
    const coordinatorResponse = await fetch(coordinatorUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!coordinatorResponse.ok) {
      const errorText = await coordinatorResponse.text();
      console.error(
        `Airtable API error fetching coordinator: ${coordinatorResponse.status}`,
        errorText
      );
      return [];
    }

    const coordinatorData: AirtableRecord<CoordinadorFields> = await coordinatorResponse.json();
    const activityIds = coordinatorData.fields.Actividades || [];

    if (activityIds.length === 0) {
      console.log("No activities found for this coordinator");
      return [];
    }

    console.log(`Found ${activityIds.length} activity IDs for coordinator`);

    // Step 2: Build OR formula to filter activities by IDs
    const filterFormula = `OR(${activityIds.map(id => `RECORD_ID()="${id}"`).join(",")})`;
    const activitiesUrl = `https://api.airtable.com/v0/${baseId}/Actividades?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Fecha&sort[0][direction]=desc`;

    const response = await fetch(activitiesUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error fetching activities: ${response.status}`,
        errorText
      );
      return [];
    }

    const data: AirtableResponse<ActividadFields> = await response.json();
    
    console.log(`Successfully fetched ${data.records?.length || 0} activities for coordinator ${coordinatorRecordId}`);

    return data.records || [];
  } catch (error) {
    console.error("Error fetching activities from Airtable:", error);
    return [];
  }
}

/**
 * Create a new activity in Airtable
 * Links the activity to the specified coordinator
 * 
 * @param params - Activity creation parameters
 * @returns Created activity record
 */
export async function createActividad(params: {
  coordinatorRecordId: string;
  name: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  cultivo?: string;
  municipioId?: string;
  modalidad?: string[];
  perfilAsistentes?: string; // singleSelect en Airtable
  cantidadParticipantes?: number;
  observaciones?: string;
}): Promise<Actividad> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Airtable credentials not configured");
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Actividades`;

    const payload = {
      fields: {
        "Nombre de la Actividad": params.name,
        Fecha: params.fecha,
        Descripcion: params.descripcion,
        Tipo: params.tipo,
        ...(params.cultivo && { Cultivo: params.cultivo }),
        ...(params.municipioId && { Municipio: [params.municipioId] }), // Linked record - array of IDs
        ...(params.modalidad && params.modalidad.length > 0 && { Modalidad: params.modalidad }),
        ...(params.perfilAsistentes && { "Perfil de Asistentes": params.perfilAsistentes }),
        ...(params.cantidadParticipantes && { "Cantidad de Participantes": params.cantidadParticipantes }),
        ...(params.observaciones && { Observaciones: params.observaciones }),
        Coordinador: [params.coordinatorRecordId], // Linked record array
      },
    };

    console.log("Creating activity:", payload);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error creating activity: ${response.status}`,
        errorText
      );
      throw new Error(`Failed to create activity: ${response.status}`);
    }

    const data: AirtableRecord<ActividadFields> = await response.json();
    
    console.log(`Successfully created activity: ${data.id}`);

    return data;
  } catch (error) {
    console.error("Error creating activity in Airtable:", error);
    throw error;
  }
}

/**
 * TEMPORAL: List ALL activities from Airtable (sin filtrar por coordinador)
 * Para visualización del mapa nacional
 */
export async function listAllActividades(): Promise<Actividad[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    const allActividades: Actividad[] = [];
    let offset: string | undefined;

    // Paginar para obtener TODAS las actividades
    do {
      const url = `https://api.airtable.com/v0/${baseId}/Actividades?sort[0][field]=Fecha&sort[0][direction]=desc${offset ? `&offset=${offset}` : ""}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        console.error(`Airtable API error: ${response.status}`);
        break;
      }

      const data: AirtableResponse<ActividadFields> = await response.json();
      allActividades.push(...(data.records || []));
      offset = data.offset;
      
      console.log(`Fetched ${data.records?.length || 0} activities, total: ${allActividades.length}`);
    } while (offset);

    console.log(`Total activities fetched: ${allActividades.length}`);
    return allActividades;
  } catch (error) {
    console.error("Error fetching all activities:", error);
    return [];
  }
}

/**
 * Get Kardex records with EstadoPago = "Por Pagar" for a specific coordinator
 * These are the Kardex that need to be included in a service order
 *
 * @param coordinatorRecordId - Airtable record ID of the coordinator
 * @returns Array of Kardex records with "Por Pagar" status
 */
export async function getKardexPorPagar(
  coordinatorRecordId: string
): Promise<Kardex[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    // Build filter formula:
    // 1. EstadoPago = "Por Pagar"
    // 2. idcoordinador contains the coordinator record ID
    const filterFormula = `AND(
      {EstadoPago} = "Por Pagar",
      FIND("${coordinatorRecordId}", ARRAYJOIN({idcoordinador}))
    )`;

    const url = `https://api.airtable.com/v0/${baseId}/Kardex?filterByFormula=${encodeURIComponent(
      filterFormula
    )}&sort[0][field]=fechakardex&sort[0][direction]=desc`;

    console.log(`Fetching Kardex "Por Pagar" for coordinator: ${coordinatorRecordId}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error fetching Kardex: ${response.status}`,
        errorText
      );
      return [];
    }

    const data: AirtableResponse<KardexFields> = await response.json();

    console.log(`Successfully fetched ${data.records?.length || 0} Kardex "Por Pagar"`);

    return data.records || [];
  } catch (error) {
    console.error("Error fetching Kardex from Airtable:", error);
    return [];
  }
}

/**
 * Get Kardex records with EstadoPago = "Caja Menor" that are NOT yet linked to any GastoCajaMenor
 * Used to populate the optional Kardex selector when creating a new gasto de caja menor
 *
 * @param coordinatorRecordId - Airtable record ID of the coordinator
 * @returns Array of available Kardex records
 */
export async function getKardexCajaMenorDisponibles(
  coordinatorRecordId: string
): Promise<Kardex[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    const filterFormula = `AND(
      {EstadoPago} = "Caja Menor",
      FIND("${coordinatorRecordId}", ARRAYJOIN({idcoordinador})),
      {GastosCajaMenor} = BLANK()
    )`;

    const url = `https://api.airtable.com/v0/${baseId}/Kardex?filterByFormula=${encodeURIComponent(
      filterFormula
    )}&sort[0][field]=fechakardex&sort[0][direction]=desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error fetching Kardex Caja Menor: ${response.status}`,
        errorText
      );
      return [];
    }

    const data: AirtableResponse<KardexFields> = await response.json();
    return data.records || [];
  } catch (error) {
    console.error("Error fetching Kardex Caja Menor disponibles:", error);
    return [];
  }
}

/**
 * Get all service orders (Ordenes) for a specific coordinator
 * Orders are sorted by date (most recent first)
 *
 * @param coordinatorRecordId - Airtable record ID of the coordinator
 * @returns Array of Orden records for the coordinator
 */
export async function getOrdenesCoordinador(
  coordinatorRecordId: string
): Promise<Orden[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    // Fetch orders sorted by NumeroOrden descending (newest first: #5, #4, #3...)
    const url = `https://api.airtable.com/v0/${baseId}/Ordenes?sort[0][field]=NumeroOrden&sort[0][direction]=desc`;

    console.log(`Fetching Ordenes for coordinator: ${coordinatorRecordId}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error fetching Ordenes: ${response.status}`,
        errorText
      );
      return [];
    }

    const data: AirtableResponse<OrdenFields> = await response.json();

    // Filter client-side by coordinator
    const filteredOrders = data.records.filter((orden) => {
      const coordinadores = orden.fields.Coordinador || [];
      return coordinadores.includes(coordinatorRecordId);
    });

    console.log(`Successfully fetched ${filteredOrders.length} Ordenes for coordinator`);

    return filteredOrders;
  } catch (error) {
    console.error("Error fetching Ordenes from Airtable:", error);
    return [];
  }
}

/**
 * Get a single Orden de Servicio by ID with all its details
 * @param ordenId - Airtable record ID of the orden
 * @returns Orden record or null if not found
 */
export async function getOrdenById(ordenId: string): Promise<Orden | null> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return null;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Ordenes/${ordenId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Error fetching Orden ${ordenId}: ${response.status}`);
      return null;
    }

    const orden: Orden = await response.json();
    return orden;
  } catch (error) {
    console.error(`Error fetching Orden ${ordenId}:`, error);
    return null;
  }
}

/**
 * Create a new Orden de Servicio with its items and generate PDF
 * This function:
 * 1. Creates the Orden record
 * 2. Creates ItemsOrden records for each item
 * 3. Updates Kardex status from "Por Pagar" to "En Orden"
 * 4. Generates PDF and uploads to Airtable
 *
 * @param params - Order creation parameters
 * @param coordinatorData - Coordinator info for PDF (name, email)
 * @param beneficiarioData - Beneficiary info for PDF
 * @returns Created Orden record with NumeroOrden and PDF
 */
export async function createOrdenServicio(
  params: CreateOrdenParams,
  coordinatorData?: { name: string; email: string },
  beneficiarioData?: { razonSocial: string; nit: string; direccion: string; email?: string }
): Promise<Orden> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Airtable credentials not configured");
  }

  try {
    console.log("Creating Orden de Servicio...");

    // Step 1: Create the Orden record
    const ordenUrl = `https://api.airtable.com/v0/${baseId}/Ordenes`;

    const ordenPayload = {
      fields: {
        Coordinador: [params.coordinatorRecordId],
        Beneficiario: [params.beneficiarioRecordId],
        "Fecha de pedido": params.fechaPedido,
        Estado: params.estado || "Borrador", // Use provided estado or default to "Borrador"
        ...(params.observaciones && { Observaciones: params.observaciones }),
      },
    };

    console.log("Creating Orden record:", ordenPayload);

    const ordenResponse = await fetch(ordenUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ordenPayload),
    });

    if (!ordenResponse.ok) {
      const errorText = await ordenResponse.text();
      console.error(`Error creating Orden: ${ordenResponse.status}`, errorText);
      throw new Error(`Failed to create Orden: ${ordenResponse.status}`);
    }

    const ordenData: AirtableRecord<OrdenFields> = await ordenResponse.json();
    console.log(`Orden created successfully: ${ordenData.id} (Número: ${ordenData.fields.NumeroOrden})`);

    // Step 2: Create ItemsOrden records
    const itemsUrl = `https://api.airtable.com/v0/${baseId}/ItemsOrden`;

    for (const item of params.items) {
      const tipoItem = item.kardexRecordId ? "CON Kardex" : "SIN Kardex";
      
      const itemPayload: any = {
        fields: {
          OrdenServicio: [ordenData.id],
          TipoItem: tipoItem,
          FormaCobro: item.formaCobro,
          Cantidad: item.cantidad,
          PrecioUnitario: item.precioUnitario,
          // Note: Cálculo (Subtotal) is a formula field, calculated automatically
        },
      };

      // Add Kardex or Servicio link based on type
      if (item.kardexRecordId) {
        itemPayload.fields.Kardex = [item.kardexRecordId];
      } else if (item.catalogoRecordId) {
        itemPayload.fields.CatalogoServicio = [item.catalogoRecordId];
      }

      console.log("Creating ItemOrden:", itemPayload);

      const itemResponse = await fetch(itemsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemPayload),
      });

      if (!itemResponse.ok) {
        const errorText = await itemResponse.text();
        console.error(`Error creating ItemOrden: ${itemResponse.status}`, errorText);
        // Continue with other items even if one fails
      } else {
        const itemType = item.kardexRecordId ? `Kardex ${item.kardexRecordId}` : `Servicio ${item.catalogoRecordId}`;
        console.log(`ItemOrden created for ${itemType}`);
      }
    }

    // Step 3: Update Kardex status from "Por Pagar" to "En Orden" (only for Kardex items)
    const kardexUrl = `https://api.airtable.com/v0/${baseId}/Kardex`;

    for (const item of params.items) {
      if (!item.kardexRecordId) continue; // Skip catalog items

      const kardexPayload = {
        fields: {
          EstadoPago: "En Orden",
        },
      };

      const kardexResponse = await fetch(`${kardexUrl}/${item.kardexRecordId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(kardexPayload),
      });

      if (!kardexResponse.ok) {
        const errorText = await kardexResponse.text();
        console.error(`Error updating Kardex ${item.kardexRecordId}: ${kardexResponse.status}`, errorText);
        // Continue with other Kardex even if one fails
      } else {
        console.log(`Kardex ${item.kardexRecordId} updated to "En Orden"`);
      }
    }

    console.log(`Orden de Servicio #${ordenData.fields.NumeroOrden} created successfully with ${params.items.length} items`);

    // Step 4: Generate PDF and upload to Airtable
    console.log("Checking PDF generation requirements...", {
      hasCoordinatorData: !!coordinatorData,
      hasBeneficiarioData: !!beneficiarioData,
      coordinatorData,
      beneficiarioData,
    });

    if (coordinatorData && beneficiarioData) {
      try {
        console.log("Generating PDF for Orden...");
        
        const { generateOrdenServicioPDF, uploadPDFToAirtable } = await import("@/lib/generatePDF");
        
        // Fetch detailed data for Kardex items
        const kardexIds = params.items
          .filter(item => item.kardexRecordId)
          .map(item => item.kardexRecordId!);
        
        const kardexData = kardexIds.length > 0 
          ? await getKardexByIds(kardexIds)
          : [];
        
        // Fetch detailed data for Catalog items
        const catalogoIds = params.items
          .filter(item => item.catalogoRecordId)
          .map(item => item.catalogoRecordId!);
        
        const catalogoData: CatalogoServicio[] = [];
        if (catalogoIds.length > 0) {
          const allCatalogo = await getCatalogoServicios();
          catalogoData.push(...allCatalogo.filter(c => catalogoIds.includes(c.id)));
        }
        
        // Prepare items data for PDF with detailed descriptions
        const pdfItems = params.items.map((item, index) => {
          if (item.kardexRecordId) {
            // Find Kardex data
            const kardex = kardexData.find(k => k.id === item.kardexRecordId);
            const idkardex = kardex?.fields.idkardex || "N/A";
            const fecha = kardex?.fields.fechakardex || "";
            const municipio = kardex?.fields["mundep (from MunicipioOrigen)"]?.[0] || "N/A";
            const centro = kardex?.fields.NombreCentrodeAcopio?.[0] || "N/A";
            const total = kardex?.fields.Total || 0;
            
            return {
              id: `item-${index}`,
              tipo: "KARDEX" as const,
              descripcion: `Kardex #${idkardex} - ${municipio} - ${centro} - ${Math.abs(total)} kg`,
              kardexId: item.kardexRecordId,
              formaCobro: item.formaCobro,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.cantidad * item.precioUnitario,
            };
          } else {
            // Find Catalog data
            const catalogo = catalogoData.find(c => c.id === item.catalogoRecordId);
            const nombre = catalogo?.fields.Nombre || "Servicio";
            const descripcion = catalogo?.fields.Descripcion || "";
            
            return {
              id: `item-${index}`,
              tipo: "CATALOGO" as const,
              descripcion: `${nombre}${descripcion ? ` - ${descripcion}` : ""}`,
              catalogoId: item.catalogoRecordId,
              formaCobro: item.formaCobro,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.cantidad * item.precioUnitario,
            };
          }
        });

        const totalCalculated = pdfItems.reduce((sum, item) => sum + item.subtotal, 0);

        // Generate PDF buffer
        const pdfBuffer = await generateOrdenServicioPDF({
          numeroOrden: ordenData.fields.NumeroOrden || 0,
          coordinador: {
            nombre: coordinatorData.name,
            email: coordinatorData.email,
          },
          beneficiario: beneficiarioData,
          fechaPedido: params.fechaPedido,
          estado: params.estado || "Borrador",
          items: pdfItems,
          total: totalCalculated,
          observaciones: params.observaciones,
        });

        // Upload PDF to Vercel Blob
        console.log("Uploading PDF to Vercel Blob...");
        const { put, del } = await import("@vercel/blob");
        
        const filename = `Orden_${ordenData.fields.NumeroOrden}.pdf`;
        const blob = await put(filename, pdfBuffer, {
          access: "public",
          contentType: "application/pdf",
        });
        
        console.log(`PDF uploaded to Vercel Blob: ${blob.url}`);
        
        // Update Airtable with PDF URL
        const pdfAttachment = [{ url: blob.url }];

        const updateResponse = await fetch(`${ordenUrl}/${ordenData.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              PDF: pdfAttachment,
            },
          }),
        });

        if (updateResponse.ok) {
          console.log(`PDF URL sent to Airtable for Orden #${ordenData.fields.NumeroOrden}`);
          
          // Send email to beneficiary with PDF attachment
          console.log("Sending email to beneficiary...");
          try {
            const { sendOrdenEmail } = await import("@/lib/sendEmail");
            const emailSent = await sendOrdenEmail({
              to: beneficiarioData.email || "",
              cc: [coordinatorData.email],
              numeroOrden: ordenData.fields.NumeroOrden || 0,
              beneficiario: {
                razonSocial: beneficiarioData.razonSocial,
                nit: beneficiarioData.nit,
              },
              coordinador: {
                nombre: coordinatorData.name,
                email: coordinatorData.email,
              },
              fechaPedido: params.fechaPedido,
              total: totalCalculated,
              pdfBuffer,
            });
            
            if (emailSent) {
              console.log(`✅ Email sent successfully to ${beneficiarioData.email}`);
            } else {
              console.warn(`⚠️ Email could not be sent to ${beneficiarioData.email}`);
            }
          } catch (emailError) {
            console.error("Error sending email:", emailError);
            // Continue even if email fails - orden was created successfully
          }
          
          // Wait a moment for Airtable to download the file
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Delete from Vercel Blob (Airtable has it now)
          await del(blob.url);
          console.log(`PDF deleted from Vercel Blob: ${filename}`);
          
          const updatedOrden = await updateResponse.json();
          return updatedOrden;
        } else {
          const errorText = await updateResponse.text();
          console.error("Failed to upload PDF to Airtable:", errorText);
          // Clean up blob even if Airtable update failed
          await del(blob.url);
        }
      } catch (pdfError) {
        console.error("Error generating/uploading PDF:", pdfError);
        // Continue without PDF - orden was created successfully
      }
    }

    return ordenData;
  } catch (error) {
    console.error("Error creating Orden de Servicio:", error);
    throw error;
  }
}

/**
 * Get all Terceros (beneficiaries/providers)
 * Used for selecting beneficiary in order creation
 *
 * @returns Array of Tercero records sorted by RazonSocial
 */
export async function listTerceros(): Promise<Tercero[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Terceros?sort[0][field]=RazonSocial&sort[0][direction]=asc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error fetching Terceros: ${response.status}`,
        errorText
      );
      return [];
    }

    const data: AirtableResponse<TerceroFields> = await response.json();

    console.log(`Successfully fetched ${data.records?.length || 0} Terceros`);

    return data.records || [];
  } catch (error) {
    console.error("Error fetching Terceros from Airtable:", error);
    return [];
  }
}

/**
 * Get ItemsOrden for a specific Orden
 */
export async function getItemsOrden(ordenId: string): Promise<ItemOrden[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    console.log(`[getItemsOrden] Fetching items for orden ${ordenId}`);

    // Fetch all records with pagination and filter client-side
    // (Airtable doesn't support filtering by linked record ID directly)
    const allRecords: ItemOrden[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(`https://api.airtable.com/v0/${baseId}/ItemsOrden`);
      if (offset) {
        url.searchParams.set("offset", offset);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Airtable API error fetching ItemsOrden: ${response.status}`,
          errorText
        );
        return [];
      }

      const data: AirtableResponse<ItemOrdenFields> & { offset?: string } = await response.json();
      allRecords.push(...data.records);
      offset = data.offset;

    } while (offset);

    // Filter client-side by OrdenServicio linked record
    const filteredItems = allRecords.filter((item) => {
      const ordenServicio = item.fields.OrdenServicio || [];
      return ordenServicio.includes(ordenId);
    });

    console.log(`[getItemsOrden] Found ${filteredItems.length} items for orden ${ordenId} (total records: ${allRecords.length})`);

    return filteredItems;
  } catch (error) {
    console.error("Error fetching ItemsOrden from Airtable:", error);
    return [];
  }
}

/**
 * Get Kardex by IDs
 */
export async function getKardexByIds(kardexIds: string[]): Promise<Kardex[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId || kardexIds.length === 0) {
    return [];
  }

  try {
    // Build OR formula for multiple IDs
    const orConditions = kardexIds.map(id => `RECORD_ID()="${id}"`).join(",");
    const filterFormula = `OR(${orConditions})`;
    
    const url = `https://api.airtable.com/v0/${baseId}/Kardex?filterByFormula=${encodeURIComponent(
      filterFormula
    )}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data: AirtableResponse<KardexFields> = await response.json();
    return data.records || [];
  } catch (error) {
    console.error("Error fetching Kardex by IDs:", error);
    return [];
  }
}

/**
 * Get CatalogoServicio by IDs
 */
export async function getCatalogoByIds(catalogoIds: string[]): Promise<CatalogoServicio[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const TABLE_ID_CATALOGO = process.env.AIRTABLE_TABLE_ID_CATALOGOSERVICIOS || "tblIrrr5gmebTtMH8";

  if (!apiKey || !baseId || catalogoIds.length === 0) {
    return [];
  }

  try {
    const orConditions = catalogoIds.map(id => `RECORD_ID()="${id}"`).join(",");
    const filterFormula = `OR(${orConditions})`;

    const url = `https://api.airtable.com/v0/${baseId}/${TABLE_ID_CATALOGO}?filterByFormula=${encodeURIComponent(
      filterFormula
    )}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data: AirtableResponse<CatalogoServicioFields> = await response.json();
    return data.records || [];
  } catch (error) {
    console.error("Error fetching CatalogoServicio by IDs:", error);
    return [];
  }
}

/**
 * Get Tercero by ID
 */
export async function getTerceroById(terceroId: string): Promise<Tercero | null> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return null;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Terceros/${terceroId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data: Tercero = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching Tercero:", error);
    return null;
  }
}

/**
 * Update Tercero (beneficiary) information
 * Used to update contact details when creating orders
 */
export async function updateTercero(
  terceroId: string,
  data: {
    direccion?: string;
    movil?: number;
    correoElectronico?: string;
    municipioId?: string;
  }
): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || "appniHwKiUMS0imXD";

  if (!apiKey) {
    console.error("AIRTABLE_API_KEY not configured");
    return false;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Terceros/${terceroId}`;

    const fields: Record<string, any> = {};
    
    if (data.direccion !== undefined) fields.Direccion = data.direccion;
    if (data.movil !== undefined) fields.Movil = data.movil;
    if (data.correoElectronico !== undefined) fields["Correo Electrónico"] = data.correoElectronico;
    if (data.municipioId !== undefined) fields.Municipio = [data.municipioId];

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error updating Tercero: ${response.status}`, errorText);
      return false;
    }

    console.log(`Tercero ${terceroId} updated successfully`);
    return true;
  } catch (error) {
    console.error("Error updating Tercero:", error);
    return false;
  }
}

/**
 * Get active services from CatalogoServicios
 */
export async function getCatalogoServicios(): Promise<CatalogoServicio[]> {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TABLE_ID_CATALOGO = process.env.AIRTABLE_TABLE_ID_CATALOGOSERVICIOS || "tblIrrr5gmebTtMH8";

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    throw new Error("Missing Airtable credentials");
  }

  try {
    // Filter for active services only
    const filterFormula = "AND({Activo} = 1)";
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID_CATALOGO}?filterByFormula=${encodeURIComponent(filterFormula)}&sort%5B0%5D%5Bfield%5D=Nombre&sort%5B0%5D%5Bdirection%5D=asc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CatalogoServicios: ${response.statusText}`);
    }

    const data: AirtableResponse<CatalogoServicioFields> = await response.json();
    return data.records.map((record) => ({
      id: record.id,
      createdTime: record.createdTime,
      fields: record.fields,
    }));
  } catch (error) {
    console.error("Error fetching CatalogoServicios:", error);
    throw error;
  }
}

/**
 * Get all Centros de Acopio
 */
export async function getCentrosAcopio(): Promise<CentroAcopio[]> {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    throw new Error("Missing Airtable credentials");
  }

  try {
    const filterFormula = encodeURIComponent("{Tipo}='Centro de Acopio'");
    const url = `https://api.airtable.com/v0/${BASE_ID}/Puntos%20Logisticos?filterByFormula=${filterFormula}&sort[0][field]=Nombre&sort[0][direction]=asc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Centros de Acopio: ${response.statusText}`);
    }

    const data: AirtableResponse<CentroAcopioFields> = await response.json();
    return data.records || [];
  } catch (error) {
    console.error("Error fetching Centros de Acopio:", error);
    throw error;
  }
}

/**
 * Obtener Centros de Acopio asignados a un coordinador específico
 * Obtiene todos los centros y filtra por el campo Coordinador (linked record)
 *
 * @param coordinatorRecordId - ID del registro Airtable del coordinador
 * @returns Array de CentroAcopio asignados a este coordinador
 */
export async function getCentrosCoordinador(
  coordinatorRecordId: string
): Promise<CentroAcopio[]> {
  try {
    console.log(`Obteniendo Centros de Acopio para coordinador: ${coordinatorRecordId}`);

    // Obtener todos los centros y filtrar por coordinador
    const allCentros = await getCentrosAcopio();

    const filtered = allCentros.filter((centro) => {
      const coordinadores = centro.fields.Coordinador || [];
      return coordinadores.includes(coordinatorRecordId);
    });

    console.log(`Encontrados ${filtered.length} centros para coordinador ${coordinatorRecordId} (de ${allCentros.length} totales)`);
    return filtered;
  } catch (error) {
    console.error("Error obteniendo Centros de Acopio para coordinador:", error);
    throw error;
  }
}

/**
 * Get all Kardex for calculating balances
 * Handles pagination to get ALL records
 */
export async function getAllKardex(): Promise<Kardex[]> {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    throw new Error("Missing Airtable credentials");
  }

  try {
    const allKardex: Kardex[] = [];
    let offset: string | undefined;

    // Paginate through all records
    do {
      const url = `https://api.airtable.com/v0/${BASE_ID}/Kardex?sort[0][field]=fechakardex&sort[0][direction]=desc${offset ? `&offset=${offset}` : ""}`;

      console.log(`Fetching Kardex page... (current total: ${allKardex.length})`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Kardex: ${response.statusText}`);
      }

      const data: AirtableResponse<KardexFields> = await response.json();
      allKardex.push(...(data.records || []));
      offset = data.offset;

      console.log(`Fetched ${data.records?.length || 0} records, total: ${allKardex.length}`);
    } while (offset);

    console.log(`✅ Total Kardex fetched: ${allKardex.length}`);
    return allKardex;
  } catch (error) {
    console.error("Error fetching all Kardex:", error);
    throw error;
  }
}

/**
 * Get paginated Kardex records (for all coordinators)
 * 
 * @param pageSize - Number of records per page (default 100)
 * @param offset - Airtable offset for pagination
 * @returns Object with records and next offset
 */
export async function getAllKardexPaginated(
  pageSize: number = 100,
  offset?: string
): Promise<{ records: Kardex[]; offset?: string; hasMore: boolean }> {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    throw new Error("Missing Airtable credentials");
  }

  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/Kardex?sort[0][field]=fechakardex&sort[0][direction]=desc&pageSize=${pageSize}${offset ? `&offset=${offset}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Kardex: ${response.statusText}`);
    }

    const data: AirtableResponse<KardexFields> = await response.json();
    
    return {
      records: data.records || [],
      offset: data.offset,
      hasMore: !!data.offset,
    };
  } catch (error) {
    console.error("Error fetching paginated Kardex:", error);
    throw error;
  }
}

/**
 * Get total count of Kardex records (all coordinators)
 */
export async function getKardexTotalCount(): Promise<number> {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return 0;
  }

  try {
    // Get first page just to count - Airtable doesn't have a count endpoint
    // We'll use maxRecords=1 and pageSize=1 to minimize data transfer
    const url = `https://api.airtable.com/v0/${BASE_ID}/Kardex?maxRecords=1&fields=idkardex`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return 0;
    }

    // Since Airtable doesn't provide total count, we need to iterate through all pages
    // For performance, we'll fetch all IDs only (minimal fields)
    let count = 0;
    let offset: string | undefined;
    
    do {
      const countUrl = `https://api.airtable.com/v0/${BASE_ID}/Kardex?fields=idkardex${offset ? `&offset=${offset}` : ""}`;
      const countResponse = await fetch(countUrl, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!countResponse.ok) break;

      const data: AirtableResponse<KardexFields> = await countResponse.json();
      count += data.records?.length || 0;
      offset = data.offset;
    } while (offset);

    return count;
  } catch (error) {
    console.error("Error counting Kardex:", error);
    return 0;
  }
}

/**
 * Get total count of Kardex records for a specific coordinator
 */
export async function getKardexCountForCoordinator(coordinatorRecordId: string): Promise<number> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return 0;
  }

  try {
    const filterFormula = `FIND("${coordinatorRecordId}", ARRAYJOIN({idcoordinador}))`;
    let count = 0;
    let offset: string | undefined;
    
    do {
      const url = `https://api.airtable.com/v0/${baseId}/Kardex?filterByFormula=${encodeURIComponent(
        filterFormula
      )}&fields=idkardex${offset ? `&offset=${offset}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) break;

      const data: AirtableResponse<KardexFields> = await response.json();
      count += data.records?.length || 0;
      offset = data.offset;
    } while (offset);

    return count;
  } catch (error) {
    console.error("Error counting Kardex for coordinator:", error);
    return 0;
  }
}

/**
 * Get all Kardex records for a specific coordinator
 * Sorted by date descending (most recent first)
 *
 * @param coordinatorRecordId - Airtable record ID of the coordinator
 * @returns Array of all Kardex records for the coordinator
 */
export async function listKardexForCoordinator(
  coordinatorRecordId: string
): Promise<Kardex[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    // Filter by coordinator using idcoordinador lookup field
    const filterFormula = `FIND("${coordinatorRecordId}", ARRAYJOIN({idcoordinador}))`;

    const url = `https://api.airtable.com/v0/${baseId}/Kardex?filterByFormula=${encodeURIComponent(
      filterFormula
    )}&sort[0][field]=fechakardex&sort[0][direction]=desc`;

    console.log(`Fetching all Kardex for coordinator: ${coordinatorRecordId}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error fetching Kardex: ${response.status}`,
        errorText
      );
      return [];
    }

    const data: AirtableResponse<KardexFields> = await response.json();

    console.log(`Successfully fetched ${data.records?.length || 0} Kardex records`);

    return data.records || [];
  } catch (error) {
    console.error("Error fetching Kardex from Airtable:", error);
    return [];
  }
}

/**
 * Get paginated Kardex records for a specific coordinator
 * 
 * @param coordinatorRecordId - Airtable record ID of the coordinator
 * @param pageSize - Number of records per page (default 100)
 * @param offset - Airtable offset for pagination
 * @returns Object with records and next offset
 */
export async function listKardexForCoordinatorPaginated(
  coordinatorRecordId: string,
  pageSize: number = 100,
  offset?: string
): Promise<{ records: Kardex[]; offset?: string; hasMore: boolean }> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return { records: [], hasMore: false };
  }

  try {
    const filterFormula = `FIND("${coordinatorRecordId}", ARRAYJOIN({idcoordinador}))`;

    const url = `https://api.airtable.com/v0/${baseId}/Kardex?filterByFormula=${encodeURIComponent(
      filterFormula
    )}&sort[0][field]=fechakardex&sort[0][direction]=desc&pageSize=${pageSize}${offset ? `&offset=${offset}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error fetching Kardex: ${response.status}`,
        errorText
      );
      return { records: [], hasMore: false };
    }

    const data: AirtableResponse<KardexFields> = await response.json();

    return {
      records: data.records || [],
      offset: data.offset,
      hasMore: !!data.offset,
    };
  } catch (error) {
    console.error("Error fetching paginated Kardex:", error);
    return { records: [], hasMore: false };
  }
}

/**
 * Create a new Kardex record
 */
export async function createKardex(
  coordinatorRecordId: string,
  kardexData: {
    fechakardex: string;
    TipoMovimiento: string;
    EstadoPago: string;
    MunicipioOrigen?: string;
    CentroAcopio?: string;
    Gestor?: string;
    Reciclaje?: number;
    Incineracion?: number;
    Flexibles?: number;
    PlasticoContaminado?: number;
    Lonas?: number;
    Carton?: number;
    Metal?: number;
    fotoBascula?: { url: string; name: string }[]; // Photos/PDFs from web upload (array)
  }
): Promise<AirtableRecord<KardexFields> | null> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return null;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Kardex`;

    const fields: any = {
      Coordinador: [coordinatorRecordId],
      fechakardex: kardexData.fechakardex,
      TipoMovimiento: kardexData.TipoMovimiento,
      EstadoPago: kardexData.EstadoPago,
      Reciclaje: kardexData.Reciclaje || 0,
      Incineracion: kardexData.Incineracion || 0,
      Flexibles: kardexData.Flexibles || 0,
      PlasticoContaminado: kardexData.PlasticoContaminado || 0,
      Lonas: kardexData.Lonas || 0,
      Carton: kardexData.Carton || 0,
      Metal: kardexData.Metal || 0,
      // Descripción is a computed field, cannot be set
    };

    // Add optional linked records
    if (kardexData.MunicipioOrigen) {
      fields.MunicipioOrigen = [kardexData.MunicipioOrigen];
    }
    if (kardexData.CentroAcopio) {
      fields.CentrodeAcopio = [kardexData.CentroAcopio];
    }
    if (kardexData.Gestor) {
      fields.gestor = [kardexData.Gestor];
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Airtable API error creating Kardex: ${response.status}`,
        errorText
      );
      return null;
    }

    const data: AirtableRecord<KardexFields> = await response.json();
    console.log(`Successfully created Kardex record with ID: ${data.id}`);
    
    // Upload photos/PDFs to Airtable if provided
    if (kardexData.fotoBascula && kardexData.fotoBascula.length > 0) {
      try {
        console.log(`Uploading ${kardexData.fotoBascula.length} archivo(s) de báscula to Vercel Blob...`);
        const { put, del } = await import("@vercel/blob");

        const uploadedBlobs: { url: string; blobUrl: string }[] = [];

        // Upload each file to Vercel Blob
        for (let i = 0; i < kardexData.fotoBascula.length; i++) {
          const foto = kardexData.fotoBascula[i];

          // 1. Fetch the file data from the data URL
          const fetchResponse = await fetch(foto.url);
          const buffer = await fetchResponse.arrayBuffer();

          // 2. Determine content type and extension from filename
          const extension = foto.name.split('.').pop()?.toLowerCase() || 'jpg';
          const isPdf = extension === 'pdf';
          const contentType = isPdf ? 'application/pdf' : 'image/jpeg';

          // 3. Upload to Vercel Blob
          const filename = `kardex_${data.id}_${Date.now()}_${i}.${extension}`;
          const blob = await put(filename, buffer, {
            access: "public",
            contentType,
          });

          console.log(`Archivo ${i + 1} uploaded to Vercel Blob: ${blob.url}`);
          uploadedBlobs.push({ url: blob.url, blobUrl: blob.url });
        }

        // 4. Update Airtable with all photo URLs
        const fotoAttachments = uploadedBlobs.map(b => ({ url: b.url }));

        const updateResponse = await fetch(`${url}/${data.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              soportebascula: fotoAttachments,
            },
          }),
        });

        if (updateResponse.ok) {
          console.log(`${uploadedBlobs.length} archivo(s) URL sent to Airtable for Kardex ${data.id}`);

          // 5. Wait for Airtable to download the files, then delete from Vercel Blob
          // Esperar 3 segundos por cada archivo para dar tiempo a Airtable
          const waitTime = Math.max(3000, uploadedBlobs.length * 3000);
          console.log(`Waiting ${waitTime}ms for Airtable to download ${uploadedBlobs.length} file(s)...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

          for (const blob of uploadedBlobs) {
            await del(blob.blobUrl);
            console.log(`Archivo deleted from Vercel Blob: ${blob.blobUrl}`);
          }

          const updatedData = await updateResponse.json();
          return updatedData;
        } else {
          const errorText = await updateResponse.text();
          console.error("Failed to upload archivos to Airtable:", errorText);
          // Clean up blobs even if Airtable update failed
          for (const blob of uploadedBlobs) {
            await del(blob.blobUrl);
          }
        }
      } catch (fotoError) {
        console.error("Error uploading archivos:", fotoError);
        // Continue - kardex was created successfully, just without photos
      }
    }
    
    return data;
  } catch (error) {
    console.error("Error creating Kardex in Airtable:", error);
    return null;
  }
}

/**
 * Create a SALIDA Kardex with automatic ENTRADA de conciliación
 * When creating a SALIDA from municipio (not from centro de acopio),
 * automatically creates an ENTRADA de conciliación to balance inventory.
 * 
 * @param coordinatorRecordId - Airtable record ID of coordinator
 * @param kardexData - Data for the SALIDA
 * @param origenTipo - Type of origin: "Municipio" or "Centro de Acopio"
 * @returns Object with both SALIDA and CONCILIACION records (or just SALIDA if no conciliacion needed)
 */
export async function createKardexWithConciliacion(
  coordinatorRecordId: string,
  kardexData: {
    fechakardex: string;
    TipoMovimiento: string;
    EstadoPago: string;
    MunicipioOrigen?: string;
    CentroAcopio?: string;
    Gestor?: string;
    Reciclaje?: number;
    Incineracion?: number;
    Flexibles?: number;
    PlasticoContaminado?: number;
    Lonas?: number;
    Carton?: number;
    Metal?: number;
    fotoBascula?: { url: string; name: string }[];
  },
  origenTipo: "Municipio" | "Centro de Acopio"
): Promise<{
  salida: AirtableRecord<KardexFields> | null;
  conciliacion: AirtableRecord<KardexFields> | null;
}> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return { salida: null, conciliacion: null };
  }

  // Verificar si necesita conciliación
  const needsConciliacion =
    kardexData.TipoMovimiento === "SALIDA" && origenTipo === "Municipio";

  console.log("🔍 [AIRTABLE] Verificando necesidad de conciliación:", {
    tipoMovimiento: kardexData.TipoMovimiento,
    origenTipo: origenTipo,
    needsConciliacion: needsConciliacion,
  });

  // 1. Crear SALIDA
  console.log(`Creating SALIDA kardex${needsConciliacion ? " with conciliación" : ""}...`);
  const salida = await createKardex(coordinatorRecordId, kardexData);

  if (!salida) {
    console.error("Failed to create SALIDA kardex");
    return { salida: null, conciliacion: null };
  }

  // Si no necesita conciliación, retornar solo la salida
  if (!needsConciliacion) {
    return { salida, conciliacion: null };
  }

  // 2. Crear ENTRADA de conciliación
  try {
    console.log("Creating ENTRADA de conciliación...");

    const conciliacionData = {
      fechakardex: kardexData.fechakardex,
      TipoMovimiento: "ENTRADA",
      EstadoPago: "Sin Costo",
      MunicipioOrigen: kardexData.MunicipioOrigen,
      Reciclaje: kardexData.Reciclaje || 0,
      Incineracion: kardexData.Incineracion || 0,
      Flexibles: kardexData.Flexibles || 0,
      PlasticoContaminado: kardexData.PlasticoContaminado || 0,
      Lonas: kardexData.Lonas || 0,
      Carton: kardexData.Carton || 0,
      Metal: kardexData.Metal || 0,
      // NO incluir: gestor, CentroAcopio, fotoBascula
    };

    const url = `https://api.airtable.com/v0/${baseId}/Kardex`;
    const fields: any = {
      Coordinador: [coordinatorRecordId],
      fechakardex: conciliacionData.fechakardex,
      TipoMovimiento: conciliacionData.TipoMovimiento,
      EstadoPago: conciliacionData.EstadoPago,
      Reciclaje: conciliacionData.Reciclaje,
      Incineracion: conciliacionData.Incineracion,
      Flexibles: conciliacionData.Flexibles,
      PlasticoContaminado: conciliacionData.PlasticoContaminado,
      Lonas: conciliacionData.Lonas,
      Carton: conciliacionData.Carton,
      Metal: conciliacionData.Metal,
      Observaciones: "Entrada automática de conciliación",
      RegistroConciliacion: [salida.id], // Vincular a la SALIDA
    };

    if (conciliacionData.MunicipioOrigen) {
      fields.MunicipioOrigen = [conciliacionData.MunicipioOrigen];
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Error creating ENTRADA de conciliación: ${response.status}`,
        errorText
      );
      return { salida, conciliacion: null };
    }

    const conciliacion: AirtableRecord<KardexFields> = await response.json();
    console.log(`ENTRADA de conciliación created: ${conciliacion.id}`);

    // 3. Actualizar SALIDA para vincular con CONCILIACIÓN
    const updateResponse = await fetch(`${url}/${salida.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          RegistroConciliacion: [conciliacion.id],
        },
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(
        `Error linking SALIDA to conciliación: ${updateResponse.status}`,
        errorText
      );
      // Continuar - la conciliación existe, solo faltó el vínculo inverso
    } else {
      console.log(`SALIDA ${salida.id} linked to conciliación ${conciliacion.id}`);
    }

    return { salida, conciliacion };
  } catch (error) {
    console.error("Error creating conciliación:", error);
    return { salida, conciliacion: null };
  }
}

/**
 * Delete a Kardex record and its linked conciliación (if exists)
 * If the kardex has a RegistroConciliacion field, it will also delete the linked record
 * 
 * @param kardexId - Airtable record ID of the kardex to delete
 * @returns true if successful, false otherwise
 */
export async function deleteKardexWithConciliacion(kardexId: string): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    console.log(`Deleting Kardex ${kardexId} with conciliación check...`);

    // 1. Get the kardex record to check if it has a conciliación
    const kardexList = await getKardexByIds([kardexId]);
    
    if (kardexList.length === 0) {
      console.error(`Kardex ${kardexId} not found`);
      return false;
    }

    const kardex = kardexList[0];
    const conciliacionIds = kardex.fields.RegistroConciliacion;

    // 2. If has linked conciliación, delete it first
    if (conciliacionIds && conciliacionIds.length > 0) {
      const conciliacionId = conciliacionIds[0];
      console.log(`Found linked conciliación: ${conciliacionId}`);

      const conciliacionUrl = `https://api.airtable.com/v0/${baseId}/Kardex/${conciliacionId}`;
      
      const conciliacionResponse = await fetch(conciliacionUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (conciliacionResponse.ok) {
        console.log(`✅ Conciliación ${conciliacionId} deleted successfully`);
      } else {
        const errorText = await conciliacionResponse.text();
        console.error(`⚠️ Error deleting conciliación ${conciliacionId}:`, errorText);
        // Continue anyway to delete the main kardex
      }
    } else {
      console.log("No conciliación linked to this kardex");
    }

    // 3. Delete the main kardex record
    const kardexUrl = `https://api.airtable.com/v0/${baseId}/Kardex/${kardexId}`;
    
    const kardexResponse = await fetch(kardexUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!kardexResponse.ok) {
      const errorText = await kardexResponse.text();
      console.error(`Error deleting Kardex ${kardexId}:`, errorText);
      return false;
    }

    console.log(`✅ Kardex ${kardexId} deleted successfully`);
    return true;

  } catch (error) {
    console.error(`Error in deleteKardexWithConciliacion for ${kardexId}:`, error);
    return false;
  }
}

/**
 * Delete an Orden de Servicio and all related data
 * This function:
 * 1. Fetches all ItemsOrden for the orden
 * 2. For each item with Kardex, updates Kardex status back to "Por Pagar"
 * 3. Deletes all ItemsOrden records
 * 4. Deletes the Orden record
 * 
 * @param ordenId - Airtable record ID of the orden to delete
 * @returns true if successful, false otherwise
 */
export async function deleteOrdenServicio(ordenId: string): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    console.log(`Starting deletion of Orden ${ordenId}...`);

    // Step 1: Get all ItemsOrden for this orden
    const items = await getItemsOrden(ordenId);
    console.log(`Found ${items.length} items to process`);

    // Step 2: Update Kardex status back to "Por Pagar" for items with Kardex
    for (const item of items) {
      if (item.fields.Kardex && item.fields.Kardex.length > 0) {
        const kardexId = item.fields.Kardex[0];
        console.log(`Updating Kardex ${kardexId} to "Por Pagar"`);

        const kardexUrl = `https://api.airtable.com/v0/${baseId}/Kardex/${kardexId}`;
        
        const kardexResponse = await fetch(kardexUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              EstadoPago: "Por Pagar",
            },
          }),
        });

        if (kardexResponse.ok) {
          console.log(`Kardex ${kardexId} updated to "Por Pagar"`);
        } else {
          const errorText = await kardexResponse.text();
          console.error(`Error updating Kardex ${kardexId}:`, errorText);
        }
      }
    }

    // Step 3: Delete all ItemsOrden records
    const itemsUrl = `https://api.airtable.com/v0/${baseId}/ItemsOrden`;
    
    for (const item of items) {
      console.log(`Deleting ItemOrden ${item.id}`);
      
      const deleteItemResponse = await fetch(`${itemsUrl}/${item.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (deleteItemResponse.ok) {
        console.log(`ItemOrden ${item.id} deleted`);
      } else {
        const errorText = await deleteItemResponse.text();
        console.error(`Error deleting ItemOrden ${item.id}:`, errorText);
      }
    }

    // Step 4: Delete the Orden record
    console.log(`Deleting Orden ${ordenId}`);
    
    const ordenUrl = `https://api.airtable.com/v0/${baseId}/Ordenes/${ordenId}`;
    
    const deleteOrdenResponse = await fetch(ordenUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!deleteOrdenResponse.ok) {
      const errorText = await deleteOrdenResponse.text();
      console.error(`Error deleting Orden ${ordenId}:`, errorText);
      return false;
    }

    console.log(`Orden ${ordenId} deleted successfully`);
    return true;

  } catch (error) {
    console.error(`Error deleting Orden ${ordenId}:`, error);
    return false;
  }
}

/**
 * Update the Estado of an Orden de Servicio
 * @param ordenId - Airtable record ID of the orden
 * @param nuevoEstado - New estado value
 * @returns true if successful
 */
export async function updateEstadoOrden(
  ordenId: string,
  nuevoEstado: string
): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Ordenes/${ordenId}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          Estado: nuevoEstado,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error updating estado of Orden ${ordenId}:`, errorText);
      return false;
    }

    console.log(`Orden ${ordenId} estado updated to "${nuevoEstado}"`);
    return true;
  } catch (error) {
    console.error(`Error updating estado of Orden ${ordenId}:`, error);
    return false;
  }
}

/**
 * Upload a factura (invoice) to an Orden and set estado to "Facturada"
 * Uses Vercel Blob for temporary storage, then sends URL to Airtable
 * @param ordenId - Airtable record ID of the orden
 * @param facturaBuffer - PDF file as Buffer
 * @param filename - Original filename
 * @returns true if successful
 */
export async function uploadFacturaOrden(
  ordenId: string,
  facturaBuffer: Buffer,
  filename: string
): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    // Upload to Vercel Blob
    const { put, del } = await import("@vercel/blob");
    const blobFilename = `factura_${ordenId}_${Date.now()}_${filename}`;
    const blob = await put(blobFilename, facturaBuffer, {
      access: "public",
      contentType: "application/pdf",
    });

    console.log(`Factura uploaded to Vercel Blob: ${blob.url}`);

    // Update Airtable: set Factura attachment + change Estado to "Facturada"
    const url = `https://api.airtable.com/v0/${baseId}/Ordenes/${ordenId}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          Factura: [{ url: blob.url }],
          Estado: "Facturada",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error uploading factura to Orden ${ordenId}:`, errorText);
      await del(blob.url);
      return false;
    }

    console.log(`Factura uploaded and Orden ${ordenId} set to "Facturada"`);

    // Wait for Airtable to download, then clean up blob
    await new Promise(resolve => setTimeout(resolve, 3000));
    await del(blob.url);
    console.log(`Factura deleted from Vercel Blob: ${blobFilename}`);

    return true;
  } catch (error) {
    console.error(`Error uploading factura for Orden ${ordenId}:`, error);
    return false;
  }
}

/**
 * Get ALL Ordenes de Servicio (for admin view)
 * Paginates through all records
 * @returns Array of all Orden records sorted by NumeroOrden desc
 */
export async function getAllOrdenes(): Promise<Orden[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    const allOrdenes: Orden[] = [];
    let offset: string | undefined;

    do {
      const url = `https://api.airtable.com/v0/${baseId}/Ordenes?sort[0][field]=NumeroOrden&sort[0][direction]=desc${offset ? `&offset=${offset}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Airtable API error fetching all Ordenes: ${response.status}`, errorText);
        break;
      }

      const data: AirtableResponse<OrdenFields> = await response.json();
      allOrdenes.push(...(data.records || []));
      offset = data.offset;

      console.log(`Fetched ${data.records?.length || 0} ordenes, total: ${allOrdenes.length}`);
    } while (offset);

    console.log(`Total ordenes fetched: ${allOrdenes.length}`);
    return allOrdenes;
  } catch (error) {
    console.error("Error fetching all Ordenes:", error);
    return [];
  }
}

// ============================================================
// === CAJA MENOR FUNCTIONS ===
// ============================================================

/**
 * Get gastos de caja menor for a specific coordinator
 * Sorted by Fecha descending
 */
export async function getGastosCajaMenorCoordinador(
  coordinatorRecordId: string
): Promise<GastoCajaMenor[]> {
  // ARRAYJOIN({Coordinador}) retorna nombres, no record IDs.
  // Usamos el mismo patron que getOrdenesCoordinador: fetch all + filter JS.
  const allGastos = await getAllGastosCajaMenor();
  const filtered = allGastos.filter((gasto) => {
    const coordinadores = gasto.fields.Coordinador || [];
    return coordinadores.includes(coordinatorRecordId);
  });
  console.log(`Filtered ${filtered.length} gastos caja menor for coordinator (of ${allGastos.length} total)`);
  return filtered;
}

/**
 * Get ALL gastos de caja menor (admin view)
 * Paginates through all records
 */
export async function getAllGastosCajaMenor(): Promise<GastoCajaMenor[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    const allGastos: GastoCajaMenor[] = [];
    let offset: string | undefined;

    do {
      const url = `https://api.airtable.com/v0/${baseId}/GastosCajaMenor?sort[0][field]=Fecha&sort[0][direction]=desc${offset ? `&offset=${offset}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error fetching all GastosCajaMenor: ${response.status}`, errorText);
        break;
      }

      const data: AirtableResponse<GastoCajaMenorFields> = await response.json();
      allGastos.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    console.log(`Total gastos caja menor fetched: ${allGastos.length}`);
    return allGastos;
  } catch (error) {
    console.error("Error fetching all GastosCajaMenor:", error);
    return [];
  }
}

/**
 * Get a single gasto de caja menor by ID
 */
export async function getGastoCajaMenorById(
  gastoId: string
): Promise<GastoCajaMenor | null> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return null;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/GastosCajaMenor/${gastoId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Error fetching gasto ${gastoId}: ${response.status}`);
      return null;
    }

    const data: GastoCajaMenor = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching gasto ${gastoId}:`, error);
    return null;
  }
}

/**
 * Create a new gasto de caja menor
 */
export async function createGastoCajaMenor(data: {
  coordinatorRecordId: string;
  fecha: string;
  beneficiarioId: string;
  concepto: string;
  valor: number;
  porcentajeRetencion: number;
  facturaUrl?: string;
  kardexIds?: string[];
}): Promise<GastoCajaMenor | null> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return null;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/GastosCajaMenor`;

    const fields: Record<string, unknown> = {
      Coordinador: [data.coordinatorRecordId],
      Fecha: data.fecha,
      Beneficiario: [data.beneficiarioId],
      Concepto: data.concepto,
      Valor: data.valor,
      PorcentajeRetencion: data.porcentajeRetencion / 100,
      Estado: "Pendiente",
    };

    if (data.facturaUrl) {
      fields.Factura = [{ url: data.facturaUrl }];
    }

    if (data.kardexIds && data.kardexIds.length > 0) {
      fields.Kardex = data.kardexIds;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error creating gasto: ${response.status}`, errorText);
      return null;
    }

    const gasto: GastoCajaMenor = await response.json();
    console.log(`Gasto caja menor created: ${gasto.id}`);
    return gasto;
  } catch (error) {
    console.error("Error creating gasto caja menor:", error);
    return null;
  }
}

/**
 * Update estado of a gasto (admin approve/reject)
 */
export async function updateEstadoGasto(
  gastoId: string,
  estado: "Aprobado" | "Rechazado" | "Reembolsado",
  observaciones?: string
): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/GastosCajaMenor/${gastoId}`;

    const fields: Record<string, unknown> = { Estado: estado };
    if (observaciones !== undefined) {
      fields.ObservacionesAdmin = observaciones;
    }

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error updating estado gasto ${gastoId}: ${response.status}`, errorText);
      return false;
    }

    console.log(`Gasto ${gastoId} updated to "${estado}"`);
    return true;
  } catch (error) {
    console.error(`Error updating estado gasto ${gastoId}:`, error);
    return false;
  }
}

/**
 * Update a gasto de caja menor (coordinator corrects rejected expense)
 */
export async function updateGastoCajaMenor(
  gastoId: string,
  data: {
    fecha?: string;
    beneficiarioId?: string;
    concepto?: string;
    valor?: number;
    porcentajeRetencion?: number;
    facturaUrl?: string;
  }
): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/GastosCajaMenor/${gastoId}`;

    const fields: Record<string, unknown> = {
      Estado: "Pendiente", // Reset to Pendiente on resubmission
    };

    if (data.fecha) fields.Fecha = data.fecha;
    if (data.beneficiarioId) fields.Beneficiario = [data.beneficiarioId];
    if (data.concepto) fields.Concepto = data.concepto;
    if (data.valor !== undefined) fields.Valor = data.valor;
    if (data.porcentajeRetencion !== undefined) fields.PorcentajeRetencion = data.porcentajeRetencion / 100;
    if (data.facturaUrl) fields.Factura = [{ url: data.facturaUrl }];

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error updating gasto ${gastoId}: ${response.status}`, errorText);
      return false;
    }

    console.log(`Gasto ${gastoId} updated and resubmitted`);
    return true;
  } catch (error) {
    console.error(`Error updating gasto ${gastoId}:`, error);
    return false;
  }
}

/**
 * Delete a gasto de caja menor
 * Only allowed if Estado=Pendiente and within 7-day rule
 */
export async function deleteGastoCajaMenor(gastoId: string): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/GastosCajaMenor/${gastoId}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error deleting gasto ${gastoId}: ${response.status}`, errorText);
      return false;
    }

    console.log(`Gasto ${gastoId} deleted`);
    return true;
  } catch (error) {
    console.error(`Error deleting gasto ${gastoId}:`, error);
    return false;
  }
}

/**
 * Get saldo inicial de caja menor de un coordinador
 */
export async function getSaldoInicialCajaMenor(
  coordinadorId: string
): Promise<number> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return 0;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Coordinadores/${coordinadorId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Error fetching coordinador: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    return data.fields?.SaldoInicialCajaMenor || 0;
  } catch (error) {
    console.error("Error fetching saldo inicial:", error);
    return 0;
  }
}

/**
 * Update saldo inicial de caja menor de un coordinador
 */
export async function updateSaldoInicialCajaMenor(
  coordinadorId: string,
  monto: number
): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Coordinadores/${coordinadorId}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { SaldoInicialCajaMenor: monto } }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error updating saldo inicial: ${response.status}`, errorText);
      return false;
    }

    console.log(`Saldo inicial actualizado a ${monto} para coordinador ${coordinadorId}`);
    return true;
  } catch (error) {
    console.error("Error updating saldo inicial:", error);
    return false;
  }
}

/**
 * Get todos los coordinadores con su saldo inicial de caja menor
 */
export async function getCoordinadoresConSaldoInicial(): Promise<
  Array<{ id: string; nombre: string; saldoInicial: number }>
> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    // Filtrar solo coordinadores activos (no desactivados)
    const filterFormula = `{Rol}!="Desactivado"`;
    const url = `https://api.airtable.com/v0/${baseId}/Coordinadores?filterByFormula=${encodeURIComponent(filterFormula)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Error fetching coordinadores: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map((record: { id: string; fields: { Name?: string; SaldoInicialCajaMenor?: number } }) => ({
      id: record.id,
      nombre: record.fields.Name || "Sin nombre",
      saldoInicial: record.fields.SaldoInicialCajaMenor || 0,
    }));
  } catch (error) {
    console.error("Error fetching coordinadores con saldo inicial:", error);
    return [];
  }
}

/**
 * Create a reembolso de caja menor (monto libre, sin vinculacion a gastos)
 */
export async function createReembolsoCajaMenor(params: {
  coordinadorId: string;
  monto: number;
  fecha?: string;
  observaciones?: string;
}): Promise<ReembolsoCajaMenor> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Credenciales de Airtable no configuradas");
  }

  const url = `https://api.airtable.com/v0/${baseId}/ReembolsosCajaMenor`;
  const fields: Record<string, unknown> = {
    Coordinador: [params.coordinadorId],
    Fecha: params.fecha || new Date().toISOString().split("T")[0],
    Monto: params.monto,
  };
  if (params.observaciones) {
    fields.Observaciones = params.observaciones;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error creating reembolso: ${response.status}`, errorText);
    let detail = `Error de Airtable (${response.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // usar detail por defecto
    }
    throw new Error(detail);
  }

  const reembolso: ReembolsoCajaMenor = await response.json();
  console.log(`Reembolso created: ${reembolso.id} - Monto: ${params.monto}`);

  return reembolso;
}

/**
 * Get reembolsos de caja menor, optionally filtered by coordinator
 */
export async function getReembolsosCajaMenor(
  coordinadorId?: string
): Promise<ReembolsoCajaMenor[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return [];
  }

  try {
    const allReembolsos: ReembolsoCajaMenor[] = [];
    let offset: string | undefined;

    do {
      let url = `https://api.airtable.com/v0/${baseId}/ReembolsosCajaMenor?sort[0][field]=Fecha&sort[0][direction]=desc`;
      if (offset) url += `&offset=${offset}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error fetching reembolsos: ${response.status}`, errorText);
        break;
      }

      const data: AirtableResponse<ReembolsoCajaMenorFields> = await response.json();
      allReembolsos.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    if (coordinadorId) {
      return allReembolsos.filter((r) =>
        r.fields.Coordinador?.includes(coordinadorId)
      );
    }

    return allReembolsos;
  } catch (error) {
    console.error("Error fetching reembolsos caja menor:", error);
    return [];
  }
}

/**
 * Get a single reembolso by ID
 */
export async function getReembolsoCajaMenorById(
  reembolsoId: string
): Promise<ReembolsoCajaMenor | null> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return null;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/ReembolsosCajaMenor/${reembolsoId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Error fetching reembolso ${reembolsoId}: ${response.status}`);
      return null;
    }

    const data: ReembolsoCajaMenor = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching reembolso ${reembolsoId}:`, error);
    return null;
  }
}

/**
 * Elimina un reembolso de caja menor
 */
export async function deleteReembolsoCajaMenor(
  reembolsoId: string
): Promise<boolean> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Airtable credentials not configured");
    return false;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/ReembolsosCajaMenor/${reembolsoId}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Error deleting reembolso ${reembolsoId}: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error deleting reembolso ${reembolsoId}:`, error);
    return false;
  }
}
