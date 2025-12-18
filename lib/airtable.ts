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

export interface Coordinator {
  id: string;
  name?: string;
  email: string;
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
