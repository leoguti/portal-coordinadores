import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

const WHATSAPP_NUMBER = "573234688397";

// GET /api/actividades/qr?actividadId=recXXX
export async function GET(req: NextRequest) {
  const actividadId = req.nextUrl.searchParams.get("actividadId");
  if (!actividadId) {
    return NextResponse.json({ error: "actividadId requerido" }, { status: 400 });
  }

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=EVAL-${actividadId}`;

  const qrDataUrl = await QRCode.toDataURL(waUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#042726", light: "#ffffff" },
  });

  // Retornar JSON con la data URL y el link de WhatsApp
  return NextResponse.json({ qr: qrDataUrl, waUrl });
}
