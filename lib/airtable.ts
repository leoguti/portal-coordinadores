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
  Email?: string;
  Actividades?: string[];
  Certificados?: string[];
  Kardex?: string[];
}

interface CatalogoServicioFields {
  Nombre?: string;
  Descripcion?: string;
  UnidadMedida?: string;
  Activo?: boolean;
}

interface ActividadFields {
  "Nombre de la Actividad"?: string;
  Fecha?: string;
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
  Descripción?: string;
  Observaciones?: string;
  gestor?: string[];
  nombregestor?: string[];
}

interface OrdenFields {
  NumeroOrden?: number; // Autonumber
  Coordinador?: string[]; // Linked record IDs
  NombreCoordinador?: string[]; // Lookup
  Beneficiario?: string[]; // Linked to Terceros
  RazonSocial?: string[]; // Lookup from Beneficiario
  Estado?: string; // "Borrador" | "Enviada" | "Aprobada" | "Pagada" | "Rechazada"
  "Fecha de pedido"?: string;
  ItemsOrden?: string[]; // Linked record IDs
  Observaciones?: string;
  Total?: number; // Rollup: sum of ItemsOrden subtotals
}

interface TerceroFields {
  RazonSocial?: string;
  NIT?: string;
  Direccion?: string;
  Movil?: string;
  "Correo Electrónico"?: string;
  Tipo?: string;
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

  try {
    // Normalize email for comparison (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Build Airtable API URL with filter
    // Using LOWER() formula for case-insensitive comparison
    const filterFormula = `LOWER({Email})="${normalizedEmail}"`;
    const url = `https://api.airtable.com/v0/${baseId}/Coordinadores?filterByFormula=${encodeURIComponent(
      filterFormula
    )}&maxRecords=1`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Don't cache in production to ensure fresh data
      cache: "no-store",
    });

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
      return {
        id: record.id,
        name: record.fields.Name,
        email: record.fields.Email || email,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching coordinator from Airtable:", error);
    return null;
  }
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
    // Fetch orders sorted by NumeroOrden descending (most recent first)
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
 * Create a new Orden de Servicio with its items
 * This function:
 * 1. Creates the Orden record
 * 2. Creates ItemsOrden records for each Kardex
 * 3. Updates Kardex status from "Por Pagar" to "En Orden"
 *
 * @param params - Order creation parameters
 * @returns Created Orden record with NumeroOrden
 */
export async function createOrdenServicio(
  params: CreateOrdenParams
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
        itemPayload.fields.Servicio = [item.catalogoRecordId];
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
 * Get a single Orden by ID with all its details
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
      const errorText = await response.text();
      console.error(
        `Airtable API error fetching Orden: ${response.status}`,
        errorText
      );
      return null;
    }

    const data: Orden = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching Orden from Airtable:", error);
    return null;
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
    // Get all ItemsOrden and filter client-side (same pattern as getOrdenesCoordinador)
    const url = `https://api.airtable.com/v0/${baseId}/ItemsOrden`;

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
        `Airtable API error fetching ItemsOrden: ${response.status}`,
        errorText
      );
      return [];
    }

    const data: AirtableResponse<ItemOrdenFields> = await response.json();
    
    // Filter client-side by OrdenServicio
    const filteredItems = data.records.filter((item) => {
      const ordenServicio = item.fields.OrdenServicio || [];
      return ordenServicio.includes(ordenId);
    });

    console.log(`Found ${filteredItems.length} items for orden ${ordenId}`);

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
