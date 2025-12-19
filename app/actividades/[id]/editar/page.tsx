"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import ActividadForm, { ActividadFormData } from "@/components/ActividadForm";
import Link from "next/link";

interface Actividad {
  id: string;
  fields: {
    "Nombre de la Actividad"?: string;
    Fecha?: string;
    Descripcion?: string;
    Tipo?: string;
    Modalidad?: string[];
    "Perfil de Asistentes"?: string;
    Cultivo?: string;
    Municipio?: string[];
    "mundep (from Municipio)"?: string[];
    "Cantidad de Participantes"?: number;
    Observaciones?: string;
  };
}

export default function EditarActividadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const actividadId = params.id as string;

  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (status === "authenticated" && actividadId) {
      fetchActividad();
    }
  }, [status, actividadId, router]);

  async function fetchActividad() {
    try {
      setLoading(true);
      const response = await fetch(`/api/actividades/${actividadId}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al cargar actividad");
      }

      const data = await response.json();
      setActividad(data.actividad);
    } catch (err) {
      console.error("Error fetching activity:", err);
      setError(err instanceof Error ? err.message : "No se pudo cargar la actividad");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(data: ActividadFormData) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/actividades/${actividadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          fecha: data.fecha,
          descripcion: data.descripcion,
          tipo: data.tipo,
          modalidad: data.modalidad,
          perfilAsistentes: data.perfilAsistentes || undefined,
          cultivo: data.cultivo || undefined,
          municipioId: data.municipio?.id,
          cantidadParticipantes: data.cantidadParticipantes ? parseInt(data.cantidadParticipantes) : undefined,
          observaciones: data.observaciones || undefined,
        }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || "Error al actualizar");
      }

      // Redirigir al detalle de la actividad
      router.push(`/actividades/${actividadId}`);
    } catch (err) {
      console.error("Error updating activity:", err);
      setError(err instanceof Error ? err.message : "Error al actualizar la actividad");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error && !actividad) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
          <Link href="/actividades" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            ← Volver a Actividades
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!actividad) return null;

  // Preparar datos iniciales para el formulario
  const initialData: Partial<ActividadFormData> = {
    name: actividad.fields["Nombre de la Actividad"] || "",
    fecha: actividad.fields.Fecha || "",
    descripcion: actividad.fields.Descripcion || "",
    tipo: actividad.fields.Tipo || "",
    modalidad: actividad.fields.Modalidad || [],
    perfilAsistentes: actividad.fields["Perfil de Asistentes"] || "",
    cultivo: actividad.fields.Cultivo || "",
    municipio: actividad.fields.Municipio?.[0] && actividad.fields["mundep (from Municipio)"]?.[0]
      ? { id: actividad.fields.Municipio[0], mundep: actividad.fields["mundep (from Municipio)"][0] }
      : null,
    cantidadParticipantes: actividad.fields["Cantidad de Participantes"]?.toString() || "",
    observaciones: actividad.fields.Observaciones || "",
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href={`/actividades/${actividadId}`} className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Volver al detalle
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Editar Actividad</h1>
          <p className="text-gray-600">Modificar información de la actividad</p>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <ActividadForm
            initialData={initialData}
            onSubmit={handleSubmit}
            submitLabel="Guardar Cambios"
            loading={saving}
            error={error}
            showImageUpload={false}
          />
          
          <div className="mt-4">
            <Link
              href={`/actividades/${actividadId}`}
              className="block w-full text-center px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
