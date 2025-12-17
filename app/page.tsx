export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 max-w-2xl">
        <h1 className="text-4xl font-bold text-center">
          Portal Coordinadores
        </h1>
        <p className="text-lg text-center text-gray-600">
          Bienvenido al Portal de Coordinadores. Esta es la página de inicio del proyecto.
        </p>
        <div className="flex gap-4 mt-4">
          <a
            href="#"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Comenzar
          </a>
          <a
            href="#"
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Documentación
          </a>
        </div>
      </main>
    </div>
  );
}
