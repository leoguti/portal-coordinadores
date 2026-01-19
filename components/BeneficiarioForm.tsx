"use client";

import { useState } from "react";
import MunicipioSearch from "./MunicipioSearch";

interface BeneficiarioData {
  id: string;
  razonSocial: string;
  nit?: string;
  direccion?: string;
  movil?: number;
  correo?: string;
  municipioId?: string;
  municipioDepartamento?: string;
}

interface BeneficiarioFormProps {
  beneficiario: BeneficiarioData;
  onUpdate: (data: Partial<BeneficiarioData>) => void;
}

export default function BeneficiarioForm({
  beneficiario,
  onUpdate,
}: BeneficiarioFormProps) {
  const [direccion, setDireccion] = useState(beneficiario.direccion || "");
  const [movil, setMovil] = useState(beneficiario.movil?.toString() || "");
  const [correo, setCorreo] = useState(beneficiario.correo || "");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(
    beneficiario.municipioId && beneficiario.municipioDepartamento
      ? { id: beneficiario.municipioId, mundep: beneficiario.municipioDepartamento }
      : null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleBlur = (field: string) => {
    const newErrors: Record<string, string> = {};

    // Validar dirección
    if (field === "direccion" && direccion.length < 8) {
      newErrors.direccion = "La dirección debe tener al menos 8 caracteres";
    }

    // Validar móvil
    if (field === "movil") {
      const movilNum = parseInt(movil);
      if (!movil || isNaN(movilNum) || movil.length < 7) {
        newErrors.movil = "Ingresa un número de teléfono válido";
      }
    }

    // Validar correo
    if (field === "correo" && !validateEmail(correo)) {
      newErrors.correo = "Ingresa un correo electrónico válido";
    }

    setErrors({ ...errors, ...newErrors });

    // Si no hay errores, actualizar
    if (Object.keys(newErrors).length === 0) {
      const updates: Partial<BeneficiarioData> = {};
      if (field === "direccion") updates.direccion = direccion;
      if (field === "movil") updates.movil = parseInt(movil);
      if (field === "correo") updates.correo = correo;
      onUpdate(updates);
    }
  };

  const handleMunicipioChange = (mun: { id: string; mundep: string } | null) => {
    setMunicipio(mun);
    if (mun) {
      onUpdate({
        municipioId: mun.id,
        municipioDepartamento: mun.mundep,
      });
    }
  };

  // Verificar campos faltantes
  const camposFaltantes: string[] = [];
  if (!beneficiario.direccion || beneficiario.direccion.length < 8) camposFaltantes.push("Dirección");
  if (!beneficiario.movil) camposFaltantes.push("Teléfono");
  if (!beneficiario.correo || !validateEmail(beneficiario.correo)) camposFaltantes.push("Correo");
  if (!beneficiario.municipioId) camposFaltantes.push("Municipio");

  return (
    <div className="mb-6 p-4 bg-white rounded-lg border-2 border-gray-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 text-lg">{beneficiario.razonSocial}</h3>
        {camposFaltantes.length > 0 && (
          <span className="text-xs text-orange-600 font-semibold bg-orange-50 px-2 py-1 rounded">
            ⚠️ Faltan {camposFaltantes.length} campos
          </span>
        )}
      </div>

      {beneficiario.nit && (
        <p className="text-sm text-gray-600 mb-4">
          <strong>NIT:</strong> {beneficiario.nit}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dirección */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección *
            {beneficiario.direccion && beneficiario.direccion.length >= 8 && (
              <span className="ml-2 text-green-600">✓</span>
            )}
          </label>
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            onBlur={() => handleBlur("direccion")}
            placeholder="Ej: Calle 123 # 45-67"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent ${
              errors.direccion ? "border-red-500" : "border-gray-300"
            }`}
            required
          />
          {errors.direccion && (
            <p className="text-xs text-red-600 mt-1">{errors.direccion}</p>
          )}
        </div>

        {/* Teléfono / Móvil */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono / Móvil *
            {beneficiario.movil && (
              <span className="ml-2 text-green-600">✓</span>
            )}
          </label>
          <input
            type="tel"
            value={movil}
            onChange={(e) => setMovil(e.target.value.replace(/\D/g, ""))}
            onBlur={() => handleBlur("movil")}
            placeholder="Ej: 3001234567"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent ${
              errors.movil ? "border-red-500" : "border-gray-300"
            }`}
            required
          />
          {errors.movil && (
            <p className="text-xs text-red-600 mt-1">{errors.movil}</p>
          )}
        </div>

        {/* Correo Electrónico */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Correo Electrónico *
            {beneficiario.correo && validateEmail(beneficiario.correo) && (
              <span className="ml-2 text-green-600">✓</span>
            )}
          </label>
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            onBlur={() => handleBlur("correo")}
            placeholder="ejemplo@correo.com"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent ${
              errors.correo ? "border-red-500" : "border-gray-300"
            }`}
            required
          />
          {errors.correo && (
            <p className="text-xs text-red-600 mt-1">{errors.correo}</p>
          )}
        </div>

        {/* Municipio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Municipio *
            {beneficiario.municipioId && (
              <span className="ml-2 text-green-600">✓</span>
            )}
          </label>
          <MunicipioSearch
            value={municipio}
            onChange={handleMunicipioChange}
            placeholder="Buscar municipio..."
            required
          />
        </div>
      </div>

      {camposFaltantes.length > 0 && (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800">
            <strong>⚠️ Información Faltante:</strong> Por favor completa los campos marcados con * antes de crear la orden.
          </p>
        </div>
      )}
    </div>
  );
}
