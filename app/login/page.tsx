"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Login Page - Email Magic Link Authentication
 * 
 * Simple form to send a magic link to the user's email
 * No password required - authentication via email link
 * Validates email against Airtable Coordinadores table
 */
export default function LoginPage() {
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
    <div className="flex min-h-screen items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center mb-2">
            Portal Coordinadores
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Ingresa con tu correo electrónico
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? "Enviando..." : "Enviar enlace mágico"}
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

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Te enviaremos un enlace de acceso a tu correo.</p>
            <p>Solo coordinadores autorizados pueden acceder.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
