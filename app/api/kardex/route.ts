import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { 
  listKardexForCoordinatorPaginated, 
  createKardex, 
  getAllKardexPaginated
} from "@/lib/airtable";

/**
 * GET /api/kardex
 * Get kardex records with pagination
 * - Coordinador: Solo sus propios kardex
 * - Administrador: Todos los kardex (opcionalmente filtrar por ?coordinatorId=xxx)
 * 
 * Query params:
 * - pageSize: Number of records per page (default 50, max 100)
 * - offset: Airtable offset for pagination
 * - coordinatorId: (Admin only) Filter by coordinator
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

    const isAdmin = session.user.rol === "Administrador";
    const { searchParams } = new URL(request.url);
    const filterCoordinatorId = searchParams.get("coordinatorId");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);
    const offset = searchParams.get("offset") || undefined;

    let result;

    if (isAdmin) {
      // Administrador: ver todos o filtrar por coordinador específico
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
      isAdmin 
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

    // Validar restricción de fecha (misma lógica que eliminación)
    const fechaKardex = body.fechakardex;
    const fechaMovimiento = new Date(fechaKardex + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaActual = hoy.getDate();

    // No permitir fechas futuras
    if (fechaMovimiento > hoy) {
      return NextResponse.json(
        { error: "No se pueden crear movimientos con fecha futura" },
        { status: 400 }
      );
    }

    let puedeCrear = false;
    let finMesPermitido = hoy;
    
    if (diaActual > 7) {
      // Después del día 7: solo mes actual
      const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      puedeCrear = fechaMovimiento >= inicioMesActual && fechaMovimiento <= hoy;
      finMesPermitido = inicioMesActual;
    } else {
      // Días 1-7: mes anterior y actual
      const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      puedeCrear = fechaMovimiento >= inicioMesAnterior && fechaMovimiento <= hoy;
      finMesPermitido = inicioMesAnterior;
    }

    if (!puedeCrear) {
      return NextResponse.json(
        { 
          error: diaActual > 7
            ? "Solo se pueden crear movimientos con fecha del mes actual después del día 7"
            : "Solo se pueden crear movimientos con fecha del mes actual y anterior durante los primeros 7 días del mes"
        },
        { status: 400 }
      );
    }

    console.log("🔍 [API KARDEX] body.fotoBascula:", body.fotoBascula);
    
    // Validaciones de reglas de negocio
    const isSalida = body.TipoMovimiento === "SALIDA";
    
    // 1. Municipio obligatorio
    if (!body.MunicipioOrigen) {
      return NextResponse.json(
        { error: "El municipio es obligatorio" },
        { status: 400 }
      );
    }
    
    // 2. Al menos un material con valor > 0
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
    
    // 3. ENTRADA: Centro de Acopio obligatorio
    if (!isSalida && !body.CentroAcopio) {
      return NextResponse.json(
        { error: "Para ENTRADAS, el Centro de Acopio es obligatorio" },
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
    
    // Create kardex record
    const newKardex = await createKardex(session.user.coordinatorRecordId, {
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
    });
    
    console.log("🔍 [API KARDEX] newKardex creado:", newKardex ? "✅" : "❌");

    if (!newKardex) {
      return NextResponse.json(
        { error: "Error al crear movimiento de kardex" },
        { status: 500 }
      );
    }

    return NextResponse.json({ kardex: newKardex }, { status: 201 });
  } catch (error) {
    console.error("Error creating kardex:", error);
    return NextResponse.json(
      { error: "Error al crear movimiento de kardex" },
      { status: 500 }
    );
  }
}
