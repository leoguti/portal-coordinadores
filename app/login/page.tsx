"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Login Page - Email Magic Link Authentication
 * 
 * Simple form to send a magic link to the user's email
 * No password required - authentication via email link
 * Validates email against Airtable Coordinadores table
 */

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Check for error from URL params
  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "NotCoordinator") {
      setMessage(
        "Este correo no está autorizado como coordinador. Por favor contacta al administrador."
      );
    } else if (error === "NoEmail") {
      setMessage("No se proporcionó un correo electrónico válido.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      // Send magic link email
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setMessage("Error al enviar el enlace. Intenta de nuevo.");
      } else {
        setMessage("¡Revisa tu correo! Te enviamos un enlace mágico.");
      }
    } catch (error) {
      setMessage("Ocurrió un error. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#042726] flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-[#00d084] blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-[#00d084] blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center">
          <img src="/logo-campolimpio-white.png" alt="CampoLimpio" className="h-24 mx-auto mb-8" />
          <h1 className="text-4xl font-bold text-[#4fffb0] mb-4">Portal CampoLimpio</h1>
          <p className="text-xl text-[#b0ffd9] font-medium mb-6">Gestión integral de operaciones en campo</p>
          <div className="mt-8 space-y-3 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-3 text-white/80">
              <span className="w-2 h-2 bg-[#00d084] rounded-full flex-shrink-0"></span>
              <span>Trazabilidad completa de materiales</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="w-2 h-2 bg-[#00d084] rounded-full flex-shrink-0"></span>
              <span>Control financiero centralizado</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="w-2 h-2 bg-[#00d084] rounded-full flex-shrink-0"></span>
              <span>Operación en tiempo real desde campo</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="w-2 h-2 bg-[#00d084] rounded-full flex-shrink-0"></span>
              <span>Cobertura nacional</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Logo solo visible en móvil */}
          <div className="flex justify-center mb-6 lg:hidden">
            <img src="/logo-campolimpio-white.png" alt="CampoLimpio" className="h-16 bg-[#042726] rounded-lg p-2" />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-1">
              Bienvenido
            </h2>
            <p className="text-gray-500 text-center mb-8">
              Ingresa con tu correo electrónico
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Correo Electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#042726] focus:border-transparent outline-none text-base"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#042726] text-white py-3 px-4 rounded-lg hover:bg-[#063d3b] transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
              >
                {isLoading ? "Enviando..." : "Ingresar"}
              </button>
            </form>

            {message && (
              <div
                className={`mt-4 p-3 rounded-lg text-sm ${
                  message.includes("Error") ||
                  message.includes("error") ||
                  message.includes("no está autorizado") ||
                  message.includes("No se proporcionó")
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : message.includes("Revisa tu correo")
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                }`}
              >
                {message}
              </div>
            )}

            <p className="mt-6 text-center text-sm text-gray-400">
              Te enviaremos un enlace de acceso seguro a tu correo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
