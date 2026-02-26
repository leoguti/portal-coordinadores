export default function Home() {
  return (
    <div className="min-h-screen bg-[#042726] flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-[#00d084] blur-3xl"></div>
          <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full bg-[#00d084] blur-3xl"></div>
        </div>

        <div className="relative z-10 text-center max-w-4xl">
          <img
            src="/logo-campolimpio-white.png"
            alt="CampoLimpio"
            className="h-28 mx-auto mb-10"
          />
          <h1 className="text-5xl font-bold text-white mb-4">
            Portal CampoLimpio
          </h1>
          <p className="text-2xl text-[#00d084] font-medium mb-6">
            Gestión integral de operaciones en campo
          </p>
          <p className="text-lg text-white/70 mb-12 max-w-2xl mx-auto">
            Plataforma digital para el registro, trazabilidad y control de las operaciones
            de recolección de envases y residuos de agroquímicos en todo el país.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 max-w-3xl mx-auto">
            <div className="bg-white/10 rounded-xl p-5 backdrop-blur-sm">
              <div className="text-3xl font-bold text-[#00d084] mb-1">100%</div>
              <div className="text-sm text-white/70">En la nube</div>
            </div>
            <div className="bg-white/10 rounded-xl p-5 backdrop-blur-sm">
              <div className="text-3xl font-bold text-[#00d084] mb-1">24/7</div>
              <div className="text-sm text-white/70">Tiempo real</div>
            </div>
            <div className="bg-white/10 rounded-xl p-5 backdrop-blur-sm">
              <div className="text-3xl font-bold text-[#00d084] mb-1">80K+</div>
              <div className="text-sm text-white/70">Certificados</div>
            </div>
            <div className="bg-white/10 rounded-xl p-5 backdrop-blur-sm">
              <div className="text-3xl font-bold text-[#00d084] mb-1">Nacional</div>
              <div className="text-sm text-white/70">Cobertura</div>
            </div>
          </div>

          <a
            href="/login"
            className="inline-block px-8 py-4 bg-[#00d084] text-[#042726] rounded-lg hover:bg-[#00b872] transition font-bold text-lg"
          >
            Ingresar al Portal
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-white/40 text-sm">
        CampoLimpio Colombia
      </div>
    </div>
  );
}
