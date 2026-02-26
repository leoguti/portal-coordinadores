"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

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
    } catch {
      setMessage("Ocurrió un error. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const messageType = message.includes("Error") ||
    message.includes("error") ||
    message.includes("no está autorizado") ||
    message.includes("No se proporcionó")
      ? "error"
      : message.includes("Revisa tu correo")
        ? "success"
        : "warning";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Panel izquierdo - Branding (solo desktop) */}
      <div
        style={{
          width: "50%",
          backgroundColor: "#042726",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem",
          position: "relative",
          overflow: "hidden",
        }}
        className="hidden lg:flex"
      >
        {/* Efecto de luz decorativo */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.08 }}>
          <div
            style={{
              position: "absolute",
              top: "5rem",
              left: "2rem",
              width: "16rem",
              height: "16rem",
              borderRadius: "50%",
              backgroundColor: "#00d084",
              filter: "blur(80px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "5rem",
              right: "2rem",
              width: "20rem",
              height: "20rem",
              borderRadius: "50%",
              backgroundColor: "#00d084",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div style={{ position: "relative", zIndex: 10, textAlign: "center" }}>
          <img
            src="/logo-campolimpio-white.png"
            alt="CampoLimpio"
            style={{ height: "6rem", margin: "0 auto 2rem" }}
          />
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              color: "#FFFFFF",
              marginBottom: "0.75rem",
              lineHeight: 1.2,
            }}
          >
            Portal CampoLimpio
          </h1>
          <p
            style={{
              fontSize: "1.2rem",
              fontWeight: 500,
              color: "#6ee7b7",
              marginBottom: "2rem",
            }}
          >
            Gestión integral de operaciones en campo
          </p>
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              textAlign: "left",
              maxWidth: "22rem",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {[
              "Trazabilidad completa de materiales",
              "Control financiero centralizado",
              "Operación en tiempo real desde campo",
              "Cobertura nacional",
            ].map((text) => (
              <div
                key={text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: "0.95rem",
                }}
              >
                <span
                  style={{
                    width: "0.5rem",
                    height: "0.5rem",
                    backgroundColor: "#00d084",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          backgroundColor: "#f9fafb",
        }}
      >
        <div style={{ width: "100%", maxWidth: "28rem" }}>
          {/* Logo solo visible en móvil */}
          <div className="flex justify-center mb-6 lg:hidden">
            <img
              src="/logo-campolimpio-white.png"
              alt="CampoLimpio"
              style={{
                height: "4rem",
                backgroundColor: "#042726",
                borderRadius: "0.5rem",
                padding: "0.5rem",
              }}
            />
          </div>

          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "0.75rem",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
              padding: "2rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#111827",
                textAlign: "center",
                marginBottom: "0.25rem",
              }}
            >
              Bienvenido
            </h2>
            <p
              style={{
                color: "#6b7280",
                textAlign: "center",
                marginBottom: "2rem",
              }}
            >
              Ingresa con tu correo electrónico
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: "0.5rem",
                  }}
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
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  backgroundColor: "#042726",
                  color: "#fff",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  fontWeight: 500,
                  fontSize: "1rem",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {isLoading ? "Enviando..." : "Ingresar"}
              </button>
            </form>

            {message && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  ...(messageType === "error"
                    ? { backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }
                    : messageType === "success"
                      ? { backgroundColor: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }
                      : { backgroundColor: "#fefce8", color: "#a16207", border: "1px solid #fde68a" }),
                }}
              >
                {message}
              </div>
            )}

            <p
              style={{
                marginTop: "1.5rem",
                textAlign: "center",
                fontSize: "0.875rem",
                color: "#9ca3af",
              }}
            >
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
    <Suspense
      fallback={
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
          Cargando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
