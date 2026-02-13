import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  listKardexForCoordinatorPaginated,
  createKardex,
  createKardexWithConciliacion,
  deleteKardexWithConciliacion,
  getAllKardexPaginated
} from "@/lib/airtable";
import { puedeModificarFecha, getMensajeErrorFecha } from "@/lib/dateValidations";
import { isAdminOrSupervisor } from "@/lib/roles";

/**
 * GET /api/kardex
 * Get kardex records with pagination
 * - Coordinador: Solo sus propios kardex
 * - Administrador/Supervisor: Todos los kardex (opcionalmente filtrar por ?coordinatorId=xxx)
 *
 * Query params:
 * - pageSize: Number of records per page (default 50, max 100)
 * - offset: Airtable offset for pagination
 * - coordinatorId: (Admin/Supervisor only) Filter by coordinator
 */
export async function GET(request: Request) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const canViewAll = isAdminOrSupervisor(session.user.rol);
    const { searchParams } = new URL(request.url);
    const filterCoordinatorId = searchParams.get("coordinatorId");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);
    const offset = searchParams.get("offset") || undefined;

    let result;

    if (canViewAll) {
      // Administrador/Supervisor: ver todos o filtrar por coordinador específico
      if (filterCoordinatorId) {
        result = await listKardexForCoordinatorPaginated(filterCoordinatorId, pageSize, offset);
      } else {
        result = await getAllKardexPaginated(pageSize, offset);
      }
    } else {
      // Coordinador: solo sus propios kardex
      result = await listKardexForCoordinatorPaginated(session.user.coordinatorRecordId, pageSize, offset);
    }

    return NextResponse.json({
      kardex: result.records,
      offset: result.offset,
      hasMore: result.hasMore,
      isAdmin: canViewAll
    });
  } catch (error) {
    console.error("Error fetching kardex:", error);
    return NextResponse.json(
      { error: "Error al obtener movimientos de kardex" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kardex
 * Create a new kardex record for the authenticated coordinator
 */
export async function POST(request: Request) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.fechakardex || !body.TipoMovimiento || !body.EstadoPago) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Validar restricción de fecha (regla de 7 días)
    if (!puedeModificarFecha(body.fechakardex)) {
      return NextResponse.json(
        { error: getMensajeErrorFecha() },
        { status: 400 }
      );
    }

    console.log("🔍 [API KARDEX] body.fotoBascula:", {
      count: body.fotoBascula?.length || 0,
      files: body.fotoBascula?.map((f: any) => f.name) || []
    });
    
    // Validaciones de reglas de negocio
    const isSalida = body.TipoMovimiento === "SALIDA";
    
    // 1. Al menos un material con valor > 0
    const totalKilos = (
      (body.Reciclaje || 0) +
      (body.Incineracion || 0) +
      (body.Flexibles || 0) +
      (body.PlasticoContaminado || 0) +
      (body.Lonas || 0) +
      (body.Carton || 0) +
      (body.Metal || 0)
    );
    
    if (totalKilos === 0) {
      return NextResponse.json(
        { error: "Debes registrar al menos un material con kilos > 0" },
        { status: 400 }
      );
    }
    
    // 2. ENTRADA: Centro de Acopio obligatorio
    if (!isSalida && !body.CentroAcopio) {
      return NextResponse.json(
        { error: "Para ENTRADAS, el Centro de Acopio es obligatorio" },
        { status: 400 }
      );
    }
    
    // 3. ENTRADA: Municipio obligatorio
    if (!isSalida && !body.MunicipioOrigen) {
      return NextResponse.json(
        { error: "Para ENTRADAS, el municipio es obligatorio" },
        { status: 400 }
      );
    }
    
    // 4. SALIDA: Gestor obligatorio
    if (isSalida && !body.Gestor) {
      return NextResponse.json(
        { error: "Para SALIDAS, el Gestor es obligatorio" },
        { status: 400 }
      );
    }

    // 5. SALIDA: Foto de báscula obligatoria
    if (isSalida && (!body.fotoBascula || body.fotoBascula.length === 0)) {
      return NextResponse.json(
        { error: "Para SALIDAS, la foto de báscula es obligatoria" },
        { status: 400 }
      );
    }

    // Determinar tipo de origen (para conciliación)
    // Frontend envía "municipio" o "centro", necesitamos mapear a formato esperado
    let origenTipo: "Municipio" | "Centro de Acopio";
    if (body.origenTipo) {
      origenTipo = body.origenTipo === "municipio" ? "Municipio" : "Centro de Acopio";
    } else {
      // Fallback: si no viene origenTipo, inferir de CentroAcopio
      origenTipo = body.CentroAcopio ? "Centro de Acopio" : "Municipio";
    }
    
    console.log("🔍 [API KARDEX] Detectando origen:", {
      bodyOrigenTipo: body.origenTipo,
      hasCentroAcopio: !!body.CentroAcopio,
      origenTipoFinal: origenTipo,
      tipoMovimiento: body.TipoMovimiento
    });
    
    // Create kardex record con o sin conciliación
    const result = await createKardexWithConciliacion(
      session.user.coordinatorRecordId,
      {
        fechakardex: body.fechakardex,
        TipoMovimiento: body.TipoMovimiento,
        EstadoPago: body.EstadoPago,
        MunicipioOrigen: body.MunicipioOrigen,
        CentroAcopio: body.CentroAcopio,
        Gestor: body.Gestor,
        Reciclaje: body.Reciclaje,
        Incineracion: body.Incineracion,
        Flexibles: body.Flexibles,
        PlasticoContaminado: body.PlasticoContaminado,
        Lonas: body.Lonas,
        Carton: body.Carton,
        Metal: body.Metal,
        fotoBascula: body.fotoBascula, // Pass photo if provided
      },
      origenTipo
    );
    
    console.log("🔍 [API KARDEX] Resultado creación:", {
      salida: result.salida ? "✅" : "❌",
      conciliacion: result.conciliacion ? "✅ (creada)" : "⚪ (no requerida)"
    });

    if (!result.salida) {
      return NextResponse.json(
        { error: "Error al crear movimiento de kardex" },
        { status: 500 }
      );
    }

    // Retornar ambos registros si hay conciliación
    return NextResponse.json({ 
      kardex: result.salida,
      conciliacion: result.conciliacion,
      message: result.conciliacion 
        ? "SALIDA creada con ENTRADA de conciliación automática"
        : "Movimiento creado exitosamente"
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating kardex:", error);
    return NextResponse.json(
      { error: "Error al crear movimiento de kardex" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kardex/[id]
 * Delete a kardex record (and its linked conciliación if exists)
 * 
 * This endpoint is actually at /api/kardex/[id]/route.ts
 * But we can also implement a simple version here using query params
 * 
 * For now, the actual DELETE is in /app/api/kardex/[id]/route.ts
 */
