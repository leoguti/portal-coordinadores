import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

let cache: { id: string; nombre: string }[] | null = null;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
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
      records.push({ id: r.id, nombre: r.fields.nombre });
    }
    offset = data.offset || "";
  } while (offset);

  cache = records;
  return NextResponse.json({ cultivos: records });
}
