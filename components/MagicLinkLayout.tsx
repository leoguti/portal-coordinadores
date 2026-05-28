"use client";

/**
 * Layout común para las páginas `/m/<intent>/[token]`.
 * Mobile-first, sin sidebar, sin auth.
 */

import { ReactNode } from "react";

interface Props {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}

export default function MagicLinkLayout({ titulo, subtitulo, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#00d084] flex items-center justify-center text-white font-bold text-sm">
            CL
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{titulo}</h1>
            {subtitulo && (
              <p className="text-xs text-gray-500 truncate">{subtitulo}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-4 pb-48">{children}</main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 text-center text-xs text-gray-500 py-2 px-4 z-0">
        ¿Problemas?{" "}
        <a href="https://wa.me/573009999999" className="text-[#00d084] underline">
          Escribe a CampoLimpio
        </a>
      </footer>
    </div>
  );
}

export function FormCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
      {children}
    </div>
  );
}

export function Field({
  label,
  required,
  children,
  hint,
  error,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function StickyBottomButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="fixed bottom-10 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)] px-4 py-3 z-20">
      <div className="max-w-xl mx-auto">
        <button
          type="submit"
          onClick={onClick}
          disabled={disabled || loading}
          className="w-full bg-[#00d084] hover:bg-[#00b870] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? "Enviando..." : children}
        </button>
      </div>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
      <p className="text-red-700 text-sm">{message}</p>
      <p className="text-xs text-red-600 mt-2">
        Escríbenos por WhatsApp para recibir un nuevo link.
      </p>
    </div>
  );
}

export function SuccessPanel({ message }: { message: string }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
      <div className="text-4xl mb-2">✅</div>
      <p className="text-green-800 font-medium">{message}</p>
      <p className="text-xs text-green-700 mt-3">
        Ya puedes cerrar esta página. Te avisaremos por WhatsApp cuando tu solicitud sea aprobada.
      </p>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00d084]" />
    </div>
  );
}
