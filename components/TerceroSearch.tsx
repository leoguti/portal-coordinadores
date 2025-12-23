"use client";

import { useState, useEffect, useRef } from "react";

interface Tercero {
  id: string;
  razonSocial: string;
  nit?: string;
}

interface TerceroSearchProps {
  value: Tercero | null;
  onChange: (tercero: Tercero | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function TerceroSearch({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "Escribe para buscar tercero...",
}: TerceroSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Tercero[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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
        const response = await fetch(`/api/terceros?search=${encodeURIComponent(search)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.terceros || []);
          setShowDropdown(true);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        console.error("Error searching terceros:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

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
          selectTercero(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  const selectTercero = (tercero: Tercero) => {
    onChange(tercero);
    setSearch("");
    setResults([]);
    setShowDropdown(false);
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
        <div className="flex items-center border border-gray-300 rounded-lg px-4 py-2 bg-[#e6f9f3]">
          <div className="flex-1">
            <span className="text-gray-900 font-medium">{value.razonSocial}</span>
            {value.nit && (
              <span className="text-gray-500 text-sm ml-2">NIT: {value.nit}</span>
            )}
          </div>
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
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => search.length >= 2 && results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent disabled:bg-gray-50"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
          </div>
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.map((tercero, index) => (
            <button
              key={tercero.id}
              type="button"
              onClick={() => selectTercero(tercero)}
              className={`w-full text-left px-4 py-2 hover:bg-[#e6f9f3] ${
                index === highlightedIndex ? "bg-[#ccf2e8]" : ""
              }`}
            >
              <div className="font-medium">{tercero.razonSocial}</div>
              {tercero.nit && (
                <div className="text-sm text-gray-500">NIT: {tercero.nit}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showDropdown && search.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-gray-500 text-sm">
          No se encontraron terceros
        </div>
      )}

      {/* Helper text */}
      {search.length > 0 && search.length < 2 && (
        <p className="text-xs text-gray-500 mt-1">Escribe al menos 2 caracteres para buscar</p>
      )}
    </div>
  );
}
