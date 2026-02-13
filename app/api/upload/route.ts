import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * POST /api/upload
 *
 * Sube un archivo a Airtable usando el endpoint de upload directo.
 * Acepta FormData (para archivos grandes) o JSON (retrocompatibilidad).
 *
 * FormData: file (File), recordId, fieldName
 * JSON: { recordId, fieldName, file (base64), filename, contentType }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return NextResponse.json({ error: "Airtable not configured" }, { status: 500 });
  }

  try {
    let recordId: string;
    let fieldName: string;
    let base64: string;
    let filename: string;
    let contentType: string;

    const ct = request.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      // FormData — archivo binario, sin overhead de base64
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      recordId = formData.get("recordId") as string;
      fieldName = formData.get("fieldName") as string;

      if (!file || !recordId || !fieldName) {
        return NextResponse.json(
          { error: "Missing required fields: file, recordId, fieldName" },
          { status: 400 }
        );
      }

      filename = file.name;
      contentType = file.type;
      const buffer = await file.arrayBuffer();
      base64 = Buffer.from(buffer).toString("base64");
    } else {
      // JSON — retrocompatibilidad con archivos pequeños
      const body = await request.json();
      recordId = body.recordId;
      fieldName = body.fieldName;
      base64 = body.file;
      filename = body.filename;
      contentType = body.contentType;

      if (!recordId || !fieldName || !base64 || !filename || !contentType) {
        return NextResponse.json(
          { error: "Missing required fields: recordId, fieldName, file, filename, contentType" },
          { status: 400 }
        );
      }
    }

    // Airtable upload endpoint
    const url = `https://content.airtable.com/v0/${baseId}/${recordId}/${encodeURIComponent(fieldName)}/uploadAttachment`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType,
        file: base64,
        filename,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Airtable upload error: ${response.status}`, errorText);
      return NextResponse.json(
        { error: `Upload failed: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
