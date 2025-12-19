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

interface ActividadFields {
  "Nombre de la Actividad"?: string;
  Fecha?: string;
  Descripcion?: string;
  Tipo?: string;
  Coordinador?: string[]; // Linked record IDs
  "Name (from Coordinador)"?: string[];
  Municipio?: string[];
  "mundep (from Municipio)"?: string[];
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
  cultivo: string;
  municipio: string;
  modalidad?: string[];
  perfilAsistentes?: string[];
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
        Cultivo: params.cultivo,
        // TODO: Municipio should be linked record, for now using text
        "Municipio Texto": params.municipio,
        ...(params.modalidad && params.modalidad.length > 0 && { Modalidad: params.modalidad }),
        ...(params.perfilAsistentes && params.perfilAsistentes.length > 0 && { "Perfil de Asistentes": params.perfilAsistentes }),
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
