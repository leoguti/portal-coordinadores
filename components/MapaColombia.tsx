"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON, Path, PathOptions, StyleFunction, LatLngBounds } from "leaflet";

// Importar CSS de Leaflet estáticamente
import "leaflet/dist/leaflet.css";

interface MunicipioActividades {
  codigo: string;
  municipio: string;
  departamento: string;
  cantidad: number;
  /** Desglose opcional por tipo de actividad (para el popup ejecutivo). */
  porTipo?: Record<string, number>;
}

interface MapaColombiaProps {
  actividadesPorMunicipio: MunicipioActividades[];
  /** Título de la leyenda (por defecto "Mis actividades"). */
  leyendaTitulo?: string;
  /**
   * Modo ejecutivo: encuadra a Colombia (incl. San Andrés), atenúa el resto del
   * mundo con una máscara y dibuja la silueta del país. Por defecto false.
   */
  focusColombia?: boolean;
  /**
   * Binario: en vez del degradado por volumen, solo distingue municipios CON
   * actividades (un color) de los que NO tienen. El detalle se ve en el popup.
   */
  binario?: boolean;
  /**
   * Los valores de `cantidad` son porcentajes (% del total): el popup muestra
   * "X% del total nacional" y la leyenda usa decimales.
   */
  esPorcentaje?: boolean;
  /**
   * Código DIVIPOLA de un municipio a enfocar: el mapa vuela hasta él, lo
   * resalta y muestra su tarjeta. null/undefined = vista general.
   */
  municipioFoco?: string | null;
}

// Escala de colores verdes (de claro a oscuro)
const COLOR_SCALE = [
  "#DCFCE7", // green-100
  "#86EFAC", // green-300
  "#22C55E", // green-500
  "#16A34A", // green-600
  "#166534", // green-800
];


export default function MapaColombia({ actividadesPorMunicipio, leyendaTitulo = "Mis actividades", focusColombia = false, binario = false, esPorcentaje = false, municipioFoco = null }: MapaColombiaProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMunicipio, setHoveredMunicipio] = useState<MunicipioActividades | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const geojsonLayerRef = useRef<LeafletGeoJSON | null>(null);
  const initializingRef = useRef(false);
  // Vista inicial (para volver al quitar el foco) y capa enfocada actual
  const initialBoundsRef = useRef<LatLngBounds | null>(null);
  const focoLayerRef = useRef<(Path & { feature?: Feature<Geometry, { PRECIND_ID: string }> }) | null>(null);

  // Marcar como montado solo en cliente
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Crear mapa de actividades por código DIVIPOLA - memoizado
  const actividadesMap = useMemo(() => {
    const map = new Map<string, MunicipioActividades>();
    actividadesPorMunicipio.forEach(m => {
      map.set(m.codigo, m);
    });
    return map;
  }, [actividadesPorMunicipio]);

  // Escala dinámica: asigna cada valor a uno de los 5 rangos (buckets).
  // - esPorcentaje: QUINTILES (cada rango agrupa ~la misma cantidad de
  //   municipios) — con distribuciones sesgadas el mapa diferencia mejor.
  // - conteos (/mapa): rangos lineales, como siempre.
  const { legendRanges, bucketOf } = useMemo(() => {
    const counts = actividadesPorMunicipio.map((m) => m.cantidad).filter((c) => c > 0);
    if (counts.length === 0) {
      return {
        legendRanges: [] as Array<{ color: string; label: string; n: number }>,
        bucketOf: (_: number) => 0,
      };
    }

    const min = Math.min(...counts);
    const max = Math.max(...counts);

    // Con porcentajes usamos 1 decimal; con conteos, enteros
    const fmtVal = (n: number) =>
      esPorcentaje ? `${(Math.round(n * 10) / 10).toLocaleString("es-CO")}%` : String(Math.round(n));

    let bucketFn: (v: number) => number;
    if (esPorcentaje) {
      const sorted = [...counts].sort((a, b) => a - b);
      const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
      const th = [q(0.2), q(0.4), q(0.6), q(0.8)];
      bucketFn = (v: number) => {
        for (let i = 0; i < th.length; i++) {
          if (v <= th[i]) return i;
        }
        return COLOR_SCALE.length - 1;
      };
    } else {
      const range = max - min || 1;
      bucketFn = (v: number) =>
        Math.min(Math.floor(((v - min) / range) * COLOR_SCALE.length), COLOR_SCALE.length - 1);
    }

    // Etiquetas con el min/max REAL de cada rango + cuántos municipios caen ahí
    const stats = COLOR_SCALE.map(() => ({ min: Infinity, max: -Infinity, n: 0 }));
    counts.forEach((v) => {
      const s = stats[bucketFn(v)];
      s.min = Math.min(s.min, v);
      s.max = Math.max(s.max, v);
      s.n++;
    });
    const ranges = COLOR_SCALE.map((color, i) => {
      const s = stats[i];
      if (s.n === 0) return { color, label: "—", n: 0 };
      const from = fmtVal(s.min);
      const to = fmtVal(s.max);
      return { color, label: from === to ? from : `${from} - ${to}`, n: s.n };
    });

    return { legendRanges: ranges, bucketOf: bucketFn };
  }, [actividadesPorMunicipio, esPorcentaje]);

  // Rango seleccionado en la leyenda (null = todos)
  const [rangoSel, setRangoSel] = useState<number | null>(null);

  // Al cambiar los datos (dataset/filtro/periodo), quitar el filtro de rango
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRangoSel(null);
  }, [actividadesMap]);

  // Función para obtener color según cantidad
  const getColor = (count: number): string => COLOR_SCALE[bucketOf(count)];

  // Estilo por municipio. Vive en el cuerpo (no en el efecto) para que el
  // filtro por rango de la leyenda re-estile la capa SIN recrear el mapa.
  const styleFeature = (feature: Feature<Geometry, { PRECIND_ID: string }> | undefined): PathOptions => {
    if (!feature) return {};
    const codigo = feature.properties?.PRECIND_ID;
    const data = actividadesMap.get(codigo);
    const count = data?.cantidad || 0;

    // Sin actividades
    if (count === 0) {
      // Modo ejecutivo (focusColombia) o binario: velo blanco suave (SIN
      // borde) que ilumina la silueta de Colombia sobre el mapa base gris.
      if (focusColombia || binario) {
        return {
          fillColor: "#ffffff",
          fillOpacity: focusColombia ? 0.7 : 0,
          weight: 0,
          opacity: 0,
          color: "#ffffff",
        };
      }
      // Modo normal: transparente con borde leve.
      return {
        fillColor: "transparent",
        fillOpacity: 0,
        weight: 0.3,
        opacity: 0.5,
        color: "#9CA3AF", // gray-400
      };
    }

    // Filtro por rango de la leyenda: los municipios fuera del rango se apagan
    if (!binario && rangoSel !== null && bucketOf(count) !== rangoSel) {
      return {
        fillColor: "#ffffff",
        fillOpacity: focusColombia ? 0.55 : 0.15,
        weight: 0.4,
        opacity: 0.4,
        color: "#cbd5e1", // slate-300
      };
    }

    // Con actividades: color de relleno
    return {
      // Binario: un solo verde; si no, degradado por volumen
      fillColor: binario ? "#16a34a" : getColor(count),
      weight: 1,
      opacity: 1,
      color: "#166534", // green-800 border
      fillOpacity: focusColombia ? 0.9 : 0.8,
    };
  };
  // Ref siempre apuntando al estilo vigente (lo usan mouseout y el re-estilado)
  const styleFnRef = useRef(styleFeature);
  styleFnRef.current = styleFeature;

  // Re-estilar la capa cuando cambia el rango seleccionado
  useEffect(() => {
    const layer = geojsonLayerRef.current;
    if (layer) {
      layer.setStyle(((f: Feature<Geometry, { PRECIND_ID: string }> | undefined) =>
        styleFnRef.current(f)) as StyleFunction);
    }
  }, [rangoSel]);

  // Enfocar un municipio (Top 5, etc.): volar hasta él, resaltarlo y mostrar
  // su tarjeta. Al quitar el foco, volver a la vista inicial.
  useEffect(() => {
    const map = mapRef.current;
    const gl = geojsonLayerRef.current;
    if (!map || !gl) return;

    // Restaurar el municipio previamente enfocado
    if (focoLayerRef.current) {
      focoLayerRef.current.setStyle(styleFnRef.current(focoLayerRef.current.feature));
      focoLayerRef.current = null;
    }

    if (!municipioFoco) {
      if (initialBoundsRef.current) {
        map.flyToBounds(initialBoundsRef.current, { padding: [10, 10] });
      }
      setHoveredMunicipio(null);
      return;
    }

    let found: (Path & { feature?: Feature<Geometry, { PRECIND_ID: string }>; getBounds?: () => LatLngBounds }) | null = null;
    gl.eachLayer((l) => {
      const layerConFeature = l as Path & { feature?: Feature<Geometry, { PRECIND_ID: string }> };
      if (layerConFeature.feature?.properties?.PRECIND_ID === municipioFoco) {
        found = layerConFeature;
      }
    });
    if (!found || !(found as { getBounds?: unknown }).getBounds) return;

    const capa = found as Path & { feature?: Feature<Geometry, { PRECIND_ID: string }>; getBounds: () => LatLngBounds; bringToFront: () => void };
    focoLayerRef.current = capa;
    map.flyToBounds(capa.getBounds(), { maxZoom: 9, padding: [60, 60] });
    capa.setStyle({ weight: 3, color: "#1F2937", fillOpacity: 0.95 });
    capa.bringToFront();
    setHoveredMunicipio(actividadesMap.get(municipioFoco) || null);
  }, [municipioFoco, actividadesMap]);

  // Cargar GeoJSON
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/geo/colombia-mapa.json.geojson");
        if (!response.ok) throw new Error("Error cargando mapa");
        const geojson = await response.json() as FeatureCollection;
        console.log("GeoJSON loaded:", geojson.features.length, "municipios");
        setGeoData(geojson);
        setLoading(false);
      } catch (err) {
        console.error("Error:", err);
        setError(err instanceof Error ? err.message : "Error");
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Inicializar mapa
  useEffect(() => {
    // Esperar a que todo esté listo
    if (loading || !geoData || !mapContainerRef.current) return;
    
    // Si ya existe el mapa, no volver a crear
    if (mapRef.current) return;

    let isMounted = true;
    let map: LeafletMap | null = null;

    // Pequeño delay para asegurar que el DOM esté completamente montado
    const timer = setTimeout(async () => {
      // Verificar que seguimos montados
      if (!isMounted || !mapContainerRef.current) return;

      const L = await import("leaflet");
      
      // Verificar de nuevo después del import async
      if (!isMounted || !mapContainerRef.current) return;
        
      // Fix para el icono de Leaflet
      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      try {
        map = L.map(mapContainerRef.current, {
          center: [4.5709, -74.2973],
          zoom: 6,
          zoomControl: true,
        });
        
        // Verificar que seguimos montados después de crear el mapa
        if (!isMounted) {
          map.remove();
          return;
        }
        
        mapRef.current = map;

        // Bounds fijos de Colombia incluyendo el archipiélago de San Andrés
        const COLOMBIA_BOUNDS = L.latLngBounds([[-4.4, -82.2], [13.7, -66.7]]);

        if (focusColombia) {
          // Mapa base suave en escala de grises (CartoDB Positron): da contexto
          // geográfico sin el verde del mapa estándar, para que resalten los datos.
          L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: "&copy; OpenStreetMap &copy; CARTO",
            subdomains: "abcd",
            maxZoom: 19,
          }).addTo(map);
          // Velo oscuro sobre todo el mapa: oscurece el exterior. Los municipios
          // se dibujan ENCIMA y mantienen Colombia iluminada.
          L.rectangle(L.latLngBounds([[-85, -180], [85, 180]]), {
            stroke: false,
            fillColor: "#334155", // slate-700
            fillOpacity: 0.3,
            interactive: false,
          }).addTo(map);
        } else {
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap",
          }).addTo(map);
        }

        // Agregar GeoJSON con estilos y eventos (estilo vigente vía ref, para
        // que el filtro por rango de la leyenda aplique sin recrear el mapa)
        const geojsonLayer = L.geoJSON(geoData, {
          style: ((f: Feature<Geometry, { PRECIND_ID: string }> | undefined) =>
            styleFnRef.current(f)) as L.StyleFunction,
          onEachFeature: (feature, layer) => {
            const props = feature.properties as {
              PRECIND_ID: string;
              MUNICIPIO: string;
              DEPTO: string;
            };
            const codigo = props.PRECIND_ID;
            const data = actividadesMap.get(codigo);

            // En modo ejecutivo/binario, los municipios SIN datos no reaccionan
            // al hover (evita que queden "marcados" con borde).
            if ((binario || focusColombia) && !data) return;

            layer.on({
              mouseover: (e) => {
                const target = e.target as Path;
                target.setStyle({
                  weight: 2,
                  color: "#1F2937",
                  fillOpacity: 0.9,
                });
                target.bringToFront();
                
                setHoveredMunicipio(data || {
                  codigo,
                  municipio: props.MUNICIPIO,
                  departamento: props.DEPTO,
                  cantidad: 0,
                });
              },
              mouseout: (e) => {
                // Restaurar el estilo VIGENTE (respeta el filtro de rango
                // activo; resetStyle volvería al estilo de creación)
                (e.target as Path).setStyle(
                  styleFnRef.current(feature as Feature<Geometry, { PRECIND_ID: string }>)
                );
                setHoveredMunicipio(null);
              },
            });
          },
        }).addTo(map);

        geojsonLayerRef.current = geojsonLayer;

        if (focusColombia) {
          // Encuadre fijo a Colombia (incl. San Andrés); no re-zoom al filtrar
          map.fitBounds(COLOMBIA_BOUNDS, { padding: [10, 10] });
          map.setMaxBounds(COLOMBIA_BOUNDS.pad(0.25));
          initialBoundsRef.current = COLOMBIA_BOUNDS;
        } else {
          // Calcular bounds de municipios CON actividades y hacer zoom
          const boundsGroup = L.featureGroup();
          geoData.features.forEach((feature) => {
            const codigo = (feature.properties as { PRECIND_ID: string }).PRECIND_ID;
            if (actividadesMap.has(codigo)) {
              // Crear una capa temporal solo para calcular bounds
              const layer = L.geoJSON(feature);
              boundsGroup.addLayer(layer);
            }
          });

          // Si hay municipios con actividades, ajustar zoom a ellos
          if (boundsGroup.getLayers().length > 0) {
            const bounds = boundsGroup.getBounds();
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
            initialBoundsRef.current = bounds;
          }
        }
        
        // Forzar recálculo del tamaño después de montar
        setTimeout(() => {
          if (isMounted && map) {
            map.invalidateSize();
          }
        }, 100);
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // Ignorar errores de limpieza
        }
        mapRef.current = null;
      }
    };
  }, [loading, geoData, actividadesMap]);

  if (loading) {
    return (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[600px] bg-red-50 rounded-lg flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Tooltip flotante */}
      {hoveredMunicipio && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
          <h3 className="font-bold text-gray-900">{hoveredMunicipio.municipio}</h3>
          <p className="text-sm text-gray-600">{hoveredMunicipio.departamento}</p>
          <div className="mt-2 pt-2 border-t">
            <p className="text-lg font-semibold text-green-700">
              {esPorcentaje
                ? `${hoveredMunicipio.cantidad.toLocaleString("es-CO")}% del total nacional`
                : `${hoveredMunicipio.cantidad} ${hoveredMunicipio.cantidad === 1 ? "actividad" : "actividades"}`}
            </p>
            {hoveredMunicipio.porTipo && Object.keys(hoveredMunicipio.porTipo).length > 0 && (
              <div className="mt-2 space-y-0.5">
                {Object.entries(hoveredMunicipio.porTipo)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tipo, n]) => (
                    <div key={tipo} className="flex justify-between gap-3 text-xs text-gray-600">
                      <span>{tipo}</span>
                      <span className="font-semibold text-gray-900">{n}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2 text-sm">{leyendaTitulo}</h4>
        {binario ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-green-800"
                style={{ backgroundColor: "#16a34a" }}
              />
              <span className="text-xs text-gray-600">Con actividades</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
              <span className="text-xs text-gray-600">Sin actividades</span>
            </div>
          </div>
        ) : legendRanges.length > 0 ? (
          <div className="space-y-0.5">
            <p className="text-[10px] text-gray-400 mb-1">Click en un rango para filtrar</p>
            {legendRanges.map(({ color, label, n }, i) => (
              <button
                key={color}
                onClick={() => setRangoSel(rangoSel === i ? null : i)}
                disabled={n === 0}
                className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-left transition-colors ${
                  rangoSel === i
                    ? "bg-green-50 ring-1 ring-green-400"
                    : rangoSel !== null
                      ? "opacity-40 hover:opacity-100 hover:bg-gray-50"
                      : "hover:bg-gray-50"
                } ${n === 0 ? "opacity-30 cursor-default" : "cursor-pointer"}`}
              >
                <div
                  className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">{label}</span>
                <span className="text-[10px] text-gray-400 ml-auto pl-2">{n}</span>
              </button>
            ))}
            {rangoSel !== null && (
              <button
                onClick={() => setRangoSel(null)}
                className="w-full text-center text-[11px] font-medium text-green-700 hover:text-green-900 pt-1"
              >
                ✕ Ver todos
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Sin datos</p>
        )}
      </div>

      {/* Mapa */}
      <div
        ref={mapContainerRef}
        className="w-full h-[600px] rounded-lg"
        style={focusColombia ? { backgroundColor: "#f1f5f9" } : undefined}
      />
    </div>
  );
}
