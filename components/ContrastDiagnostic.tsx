"use client";

import { useEffect, useState } from "react";

interface DiagnosticInfo {
  colorScheme: string;
  userAgent: string;
  screen: string;
  zoom: string;
  bgColor: string;
  color: string;
  platform: string;
  language: string;
  cookiesEnabled: boolean;
  onLine: boolean;
}

export default function ContrastDiagnostic() {
  const [info, setInfo] = useState<DiagnosticInfo | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const bodyStyles = getComputedStyle(document.body);

    setInfo({
      colorScheme: darkMode ? "DARK ⚠️" : "LIGHT ✅",
      userAgent: navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      zoom: `${Math.round(window.devicePixelRatio * 100)}%`,
      bgColor: bodyStyles.backgroundColor,
      color: bodyStyles.color,
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    });
  }, []);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 text-sm font-semibold z-50"
        title="Mostrar información de diagnóstico"
      >
        🔍 Diagnóstico
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-purple-600 rounded-lg shadow-2xl p-4 max-w-md z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900">
          🔍 Diagnóstico de Contraste
        </h3>
        <button
          onClick={() => setShow(false)}
          className="text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          ✕
        </button>
      </div>

      {info && (
        <div className="space-y-2 text-sm">
          <div className="bg-gray-50 p-2 rounded">
            <strong className="text-gray-900">Color Scheme:</strong>{" "}
            <span className="font-mono text-gray-800">{info.colorScheme}</span>
          </div>

          <div className="bg-gray-50 p-2 rounded">
            <strong className="text-gray-900">Platform:</strong>{" "}
            <span className="font-mono text-gray-800">{info.platform}</span>
          </div>

          <div className="bg-gray-50 p-2 rounded">
            <strong className="text-gray-900">Screen:</strong>{" "}
            <span className="font-mono text-gray-800">{info.screen}</span>
          </div>

          <div className="bg-gray-50 p-2 rounded">
            <strong className="text-gray-900">Zoom:</strong>{" "}
            <span className="font-mono text-gray-800">{info.zoom}</span>
          </div>

          <div className="bg-gray-50 p-2 rounded">
            <strong className="text-gray-900">Background:</strong>{" "}
            <span className="font-mono text-gray-800">{info.bgColor}</span>
          </div>

          <div className="bg-gray-50 p-2 rounded">
            <strong className="text-gray-900">Text Color:</strong>{" "}
            <span className="font-mono text-gray-800">{info.color}</span>
          </div>

          <div className="bg-gray-50 p-2 rounded">
            <strong className="text-gray-900">Language:</strong>{" "}
            <span className="font-mono text-gray-800">{info.language}</span>
          </div>

          <div className="bg-gray-50 p-2 rounded">
            <strong className="text-gray-900">Online:</strong>{" "}
            <span className="font-mono text-gray-800">
              {info.onLine ? "✅" : "❌"}
            </span>
          </div>

          <div className="bg-gray-50 p-2 rounded break-words">
            <strong className="text-gray-900">User Agent:</strong>
            <div className="font-mono text-xs text-gray-700 mt-1">
              {info.userAgent}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={() => {
            if (info) {
              navigator.clipboard.writeText(
                JSON.stringify(info, null, 2)
              );
              alert("✅ Información copiada al portapapeles");
            }
          }}
          className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-semibold text-sm"
        >
          📋 Copiar Info
        </button>
      </div>

      <div className="mt-2 text-xs text-gray-600 text-center">
        Comparte esta información con soporte técnico
      </div>
    </div>
  );
}
