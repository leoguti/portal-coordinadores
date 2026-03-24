import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

const WHATSAPP_NUMBER = "573234688397";

// GET /api/actividades/qr?actividadId=recXXX
// GET /api/actividades/qr?actividadId=recXXX&format=png  → devuelve imagen PNG directo
export async function GET(req: NextRequest) {
  const actividadId = req.nextUrl.searchParams.get("actividadId");
  const format = req.nextUrl.searchParams.get("format");

  if (!actividadId) {
    return NextResponse.json({ error: "actividadId requerido" }, { status: 400 });
  }

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=EVAL-${actividadId}`;

  if (format === "png") {
    const buffer = await QRCode.toBuffer(waUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#042726", light: "#ffffff" },
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const qrDataUrl = await QRCode.toDataURL(waUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#042726", light: "#ffffff" },
  });

  return NextResponse.json({ qr: qrDataUrl, waUrl });
}
