"use client";

import { useEffect, useState } from "react";

interface Cultivo {
  id: string;
  nombre: string;
}

interface Props {
  value: Cultivo[];
  onChange: (v: Cultivo[]) => void;
  magicLinkToken?: string;
  placeholder?: string;
}

export default function CultivosMultiSelect({
  value,
  onChange,
  magicLinkToken,
  placeholder = "Busca cultivos…",
}: Props) {
  const [all, setAll] = useState<Cultivo[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const url = `/api/cultivos${magicLinkToken ? `?token=${encodeURIComponent(magicLinkToken)}` : ""}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : { cultivos: [] }))
      .then((d) => setAll(d.cultivos || []))
      .catch(() => setAll([]));
  }, [magicLinkToken]);

  const selectedIds = new Set(value.map((v) => v.id));
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = search
    ? all
        .filter(
          (c) =>
            !selectedIds.has(c.id) && norm(c.nombre).includes(norm(search))
        )
        .slice(0, 12)
    : all.filter((c) => !selectedIds.has(c.id)).slice(0, 8);

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {value.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 bg-[#00d084]/10 text-[#00865a] px-2 py-1 rounded-full text-xs"
            >
              {c.nombre}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.id !== c.id))}
                className="hover:text-red-600"
                aria-label={`Quitar ${c.nombre}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
      />
      {open && filtered.length > 0 && (
        <div className="border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto bg-white">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange([...value, c]);
                setSearch("");
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
