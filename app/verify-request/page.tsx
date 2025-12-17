/**
 * Verify Request Page
 * 
 * This page is shown after the user submits their email
 * Tells them to check their inbox for the magic link
 */
export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-2">Revisa tu correo</h1>
          
          <p className="text-gray-600 mb-6">
            Te enviamos un enlace de acceso a tu correo electrónico.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              Haz clic en el enlace del correo para iniciar sesión.
              El enlace es válido por 24 horas.
            </p>
          </div>

          <a
            href="/login"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Volver al inicio de sesión
          </a>
        </div>
      </div>
    </div>
  );
}
