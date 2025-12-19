"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON, Path } from "leaflet";

// Importar CSS de Leaflet estáticamente
import "leaflet/dist/leaflet.css";

interface MunicipioActividades {
  codigo: string;
  municipio: string;
  departamento: string;
  cantidad: number;
}

interface MapaColombiaProps {
  actividadesPorMunicipio: MunicipioActividades[];
}

// Escala de colores verdes (de claro a oscuro)
const COLOR_SCALE = [
  "#DCFCE7", // green-100
  "#86EFAC", // green-300
  "#22C55E", // green-500
  "#16A34A", // green-600
  "#166534", // green-800
];

// Función para obtener color basado en valor normalizado (0-1)
const getColorByNormalizedValue = (normalized: number): string => {
  const index = Math.min(Math.floor(normalized * COLOR_SCALE.length), COLOR_SCALE.length - 1);
  return COLOR_SCALE[index];
};

export default function MapaColombia({ actividadesPorMunicipio }: MapaColombiaProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMunicipio, setHoveredMunicipio] = useState<MunicipioActividades | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const geojsonLayerRef = useRef<LeafletGeoJSON | null>(null);

  // Crear mapa de actividades por código DIVIPOLA - memoizado
  const actividadesMap = useMemo(() => {
    const map = new Map<string, MunicipioActividades>();
    actividadesPorMunicipio.forEach(m => {
      map.set(m.codigo, m);
    });
    return map;
  }, [actividadesPorMunicipio]);

  // Calcular min/max para escala dinámica
  const { minCount, maxCount, legendRanges } = useMemo(() => {
    if (actividadesPorMunicipio.length === 0) {
      return { minCount: 0, maxCount: 1, legendRanges: [] };
    }
    
    const counts = actividadesPorMunicipio.map(m => m.cantidad);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    
    // Crear rangos para la leyenda
    const range = max - min || 1;
    const step = range / COLOR_SCALE.length;
    
    const ranges = COLOR_SCALE.map((color, i) => {
      const from = Math.round(min + step * i);
      const to = i === COLOR_SCALE.length - 1 ? max : Math.round(min + step * (i + 1) - 1);
      return {
        color,
        label: from === to ? `${from}` : `${from} - ${to}`,
      };
    });
    
    return { minCount: min, maxCount: max, legendRanges: ranges };
  }, [actividadesPorMunicipio]);

  // Función para obtener color según cantidad
  const getColor = (count: number): string => {
    if (maxCount === minCount) return COLOR_SCALE[COLOR_SCALE.length - 1];
    const normalized = (count - minCount) / (maxCount - minCount);
    return getColorByNormalizedValue(normalized);
  };

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

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);

        // Función de estilo
        const style = (feature: Feature<Geometry, { PRECIND_ID: string }> | undefined) => {
          if (!feature) return {};
          const codigo = feature.properties?.PRECIND_ID;
          const data = actividadesMap.get(codigo);
          const count = data?.cantidad || 0;

          // Sin actividades: transparente, solo borde
          if (count === 0) {
            return {
              fillColor: "transparent",
              fillOpacity: 0,
              weight: 0.3,
              opacity: 0.5,
              color: "#9CA3AF", // gray-400
            };
          }

          // Con actividades: color de relleno
          return {
            fillColor: getColor(count),
            weight: 1,
            opacity: 1,
            color: "#166534", // green-800 border
            fillOpacity: 0.8,
          };
        };

        // Agregar GeoJSON con estilos y eventos
        const geojsonLayer = L.geoJSON(geoData, {
          style: style as L.StyleFunction,
          onEachFeature: (feature, layer) => {
            const props = feature.properties as {
              PRECIND_ID: string;
              MUNICIPIO: string;
              DEPTO: string;
            };
            const codigo = props.PRECIND_ID;
            const data = actividadesMap.get(codigo);

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
                geojsonLayer.resetStyle(e.target as Path);
                setHoveredMunicipio(null);
              },
            });
          },
        }).addTo(map);

        geojsonLayerRef.current = geojsonLayer;

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
              {hoveredMunicipio.cantidad} {hoveredMunicipio.cantidad === 1 ? "actividad" : "actividades"}
            </p>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2 text-sm">Mis actividades</h4>
        {legendRanges.length > 0 ? (
          <div className="space-y-1">
            {legendRanges.map(({ color, label }) => (
              <div key={color} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Sin datos</p>
        )}
      </div>

      {/* Mapa */}
      <div ref={mapContainerRef} className="w-full h-[600px] rounded-lg" />
    </div>
  );
}
