"use client";

import { useState, useEffect, useRef } from "react";

interface Municipio {
  id: string;
  mundep: string;
}

interface MunicipioSearchProps {
  value: Municipio | null;
  onChange: (municipio: Municipio | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Magic-link token para autenticar sin sesión NextAuth (páginas /m/*). */
  magicLinkToken?: string;
}

export default function MunicipioSearch({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "Escribe para buscar...",
  magicLinkToken,
}: MunicipioSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // El usuario escribió texto pero NO eligió de la lista y salió del campo —
  // el texto solo no selecciona nada (hallazgo prueba 2026-07-08: "Bogotá"
  // escrito quedaba visible pero el formulario no pasaba, sin explicación).
  const [sinSeleccion, setSinSeleccion] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `/api/municipios?search=${encodeURIComponent(search)}${magicLinkToken ? `&token=${encodeURIComponent(magicLinkToken)}` : ""}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setResults(data.municipios || []);
          setShowDropdown(true);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        console.error("Error searching municipios:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, magicLinkToken]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          selectMunicipio(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  const selectMunicipio = (municipio: Municipio) => {
    onChange(municipio);
    setSearch("");
    setResults([]);
    setShowDropdown(false);
    setSinSeleccion(false);
  };

  const clearSelection = () => {
    onChange(null);
    setSearch("");
    inputRef.current?.focus();
  };

  // If a value is selected, show it
  if (value) {
    return (
      <div className="relative">
        <div className="flex items-center border border-gray-300 rounded-lg px-4 py-2 bg-blue-50">
          <span className="flex-1 text-gray-900">{value.mundep}</span>
          {!disabled && (
            <button
              type="button"
              onClick={clearSelection}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (sinSeleccion) setSinSeleccion(false);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => search.length >= 2 && results.length > 0 && setShowDropdown(true)}
          onBlur={() => {
            // Con retraso: si el blur fue por click en una opción de la lista,
            // selectMunicipio limpia el estado antes de que esto evalúe.
            setTimeout(() => {
              setSinSeleccion((prev) => prev || Boolean(inputRef.current?.value?.trim()));
            }, 250);
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:border-transparent disabled:bg-gray-50 ${
            sinSeleccion && search.trim()
              ? "border-amber-500 focus:ring-amber-500 bg-amber-50"
              : "border-gray-300 focus:ring-blue-500"
          }`}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.map((municipio, index) => (
            <button
              key={municipio.id}
              type="button"
              onClick={() => selectMunicipio(municipio)}
              className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${
                index === highlightedIndex ? "bg-blue-100" : ""
              }`}
            >
              {municipio.mundep}
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showDropdown && search.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-gray-500 text-sm">
          No se encontraron municipios
        </div>
      )}

      {/* Aviso: escribió pero no eligió de la lista */}
      {sinSeleccion && search.trim().length > 0 && (
        <p className="text-xs font-medium text-amber-700 mt-1">
          ⚠️ Escribir el nombre no basta: toca el municipio en la lista para seleccionarlo.
        </p>
      )}

      {/* Helper text */}
      {search.length > 0 && search.length < 2 && (
        <p className="text-xs text-gray-500 mt-1">Escribe al menos 2 caracteres para buscar</p>
      )}
    </div>
  );
}
