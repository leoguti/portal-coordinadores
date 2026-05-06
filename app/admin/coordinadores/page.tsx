"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdmin } from "@/lib/roles";

interface Item {
  id: string;
  name: string;
  email: string;
  rol: string;
  telefono: string;
  puntosLogisticosCount: number;
}

const rolBadge: Record<string, string> = {
  Administrador: "bg-purple-100 text-purple-800",
  Supervisor: "bg-blue-100 text-blue-800",
  Coordinador: "bg-green-100 text-green-800",
  Desactivado: "bg-gray-200 text-gray-600",
};

export default function AdminCoordinadoresPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>("activos");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!isAdmin(session?.user?.rol)) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/coordinadores");
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [status, session]);

  const filtered = useMemo(() => {
    let out = items;
    if (filtroRol === "activos") {
      out = out.filter((i) => i.rol !== "Desactivado");
    } else if (filtroRol === "desactivados") {
      out = out.filter((i) => i.rol === "Desactivado");
    } else if (filtroRol !== "todos") {
      out = out.filter((i) => i.rol === filtroRol);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter(
        (i) =>
          i.name.toLowerCase().includes(needle) ||
          i.email.toLowerCase().includes(needle)
      );
    }
    return out;
  }, [items, q, filtroRol]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084]" />
      </div>
    );
  }
  if (!session) return null;

  if (!isAdmin(session.user?.rol)) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 rounded-lg border border-red-200 p-6 text-center text-red-700">
            Acceso restringido a administradores.
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Administración de Coordinadores
          </h1>
          <p className="text-sm text-gray-500">
            Edita datos básicos, metas mensuales y puntos logísticos vinculados.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="flex-1 min-w-[240px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00d084] focus:border-[#00d084]"
          />
          <select
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="activos">Activos (todos los roles)</option>
            <option value="todos">Todos</option>
            <option value="Coordinador">Sólo Coordinador</option>
            <option value="Administrador">Sólo Administrador</option>
            <option value="Supervisor">Sólo Supervisor</option>
            <option value="desactivados">Desactivados</option>
          </select>
          <span className="text-xs text-gray-500">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left p-3 font-semibold text-gray-600">Email</th>
                <th className="text-left p-3 font-semibold text-gray-600">Rol</th>
                <th className="text-right p-3 font-semibold text-gray-600">Puntos</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">{i.name}</td>
                    <td className="p-3 text-gray-600">{i.email}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          rolBadge[i.rol] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {i.rol}
                      </span>
                    </td>
                    <td className="p-3 text-right text-gray-700">
                      {i.puntosLogisticosCount}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/coordinadores/${i.id}`}
                        className="text-[#00d084] hover:text-[#00b872] font-medium text-xs"
                      >
                        Editar →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
