import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * POST /api/upload
 * 
 * Sube una imagen a Airtable usando el endpoint de upload directo
 * 
 * Body: { recordId, fieldName, file (base64), filename, contentType }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return NextResponse.json(
      { error: "Airtable not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { recordId, fieldName, file, filename, contentType } = body;

    if (!recordId || !fieldName || !file || !filename || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields: recordId, fieldName, file, filename, contentType" },
        { status: 400 }
      );
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
        file, // base64 encoded
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
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
