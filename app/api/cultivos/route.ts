import { NextResponse } from "next/server";
import { isAuthorizedOrMagicLink } from "@/lib/magicLinkAuth";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

let cache: { id: string; nombre: string }[] | null = null;

export async function GET(request: Request) {
  if (!(await isAuthorizedOrMagicLink(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (cache) return NextResponse.json({ cultivos: cache });

  const records: { id: string; nombre: string }[] = [];
  let offset = "";
  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CULTIVOS?fields[]=nombre&sort[0][field]=nombre&sort[0][direction]=asc&pageSize=100${offset ? "&offset=" + offset : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      cache: "no-store",
    });
    const data = await res.json();
    for (const r of data.records) {
      const nombre = String(r.fields?.nombre || "").trim();
      if (nombre) records.push({ id: r.id, nombre });
    }
    offset = data.offset || "";
  } while (offset);

  cache = records;
  return NextResponse.json({ cultivos: records });
}
