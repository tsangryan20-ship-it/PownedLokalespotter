'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Article } from '@/types';

interface Props { articles: Article[]; }

// ── Exact source coordinates ───────────────────────────────────────────────────
// Precise Dutch city centres — no guessing, no approximation.
// These are used when an article hasn't been AI-geocoded yet.
const SOURCE_COORDS: Record<string, { lat: number; lng: number; city: string }> = {
  // National / Amsterdam
  telegraaf:        { lat: 52.3676, lng: 4.9041, city: 'Amsterdam' },
  volkskrant:       { lat: 52.3680, lng: 4.9040, city: 'Amsterdam' },
  trouw:            { lat: 52.3675, lng: 4.9038, city: 'Amsterdam' },
  nunl:             { lat: 52.3700, lng: 4.9060, city: 'Amsterdam' },
  crimesite:        { lat: 52.3660, lng: 4.9020, city: 'Amsterdam' },
  // Hilversum (broadcast cluster)
  rtl:              { lat: 52.2292, lng: 5.1689, city: 'Hilversum' },
  nos:              { lat: 52.2300, lng: 5.1700, city: 'Hilversum' },
  hartvannederland: { lat: 52.2285, lng: 5.1680, city: 'Hilversum' },
  // Den Haag (government / official)
  ad:               { lat: 51.9225, lng: 4.4792, city: 'Rotterdam' }, // AD is Rotterdam-based
  politie:          { lat: 52.0705, lng: 4.3007, city: 'Den Haag' },
  rechtspraak:      { lat: 52.0710, lng: 4.3020, city: 'Den Haag' },
  regio15:          { lat: 52.0700, lng: 4.3000, city: 'Den Haag' },
  omroepwest:       { lat: 52.0695, lng: 4.2995, city: 'Den Haag' },
  // Rotterdam
  rijnmond:         { lat: 51.9225, lng: 4.4792, city: 'Rotterdam' },
  // Noord-Holland
  nhnieuws:         { lat: 52.6324, lng: 4.7534, city: 'Alkmaar' },
  at5:              { lat: 52.3676, lng: 4.9041, city: 'Amsterdam' },
  gooieneemlander:  { lat: 52.2292, lng: 5.1700, city: 'Hilversum' },
  // Utrecht
  rtvutrecht:       { lat: 52.0907, lng: 5.1214, city: 'Utrecht' },
  // Noord-Brabant
  omroepbrabant:    { lat: 51.5719, lng: 5.0913, city: 'Tilburg' },
  bndestem:         { lat: 51.5895, lng: 4.7760, city: 'Breda' },
  // Gelderland / Overijssel
  destentor:        { lat: 52.2112, lng: 5.9699, city: 'Apeldoorn' },
  // Zeeland
  pzc:              { lat: 51.4988, lng: 3.6136, city: 'Middelburg' },
  // Groningen
  rtvnoord:         { lat: 53.2194, lng: 6.5665, city: 'Groningen' },
  // Limburg
  l1limburg:        { lat: 50.8514, lng: 5.6910, city: 'Maastricht' },
  // 112 / National safety — spread across Netherlands
  alarm112:         { lat: 52.3704, lng: 4.8952, city: 'Amsterdam' },
  alarm112nl:       { lat: 51.9225, lng: 4.4792, city: 'Rotterdam' },
};

/**
 * Tiny deterministic spread — prevents exact pixel stacking on the map
 * while keeping markers visibly at the correct city.
 * Max offset: ±0.002° ≈ ±220m lat, ±140m lng — imperceptible at national zoom.
 */
function microJitter(id: string): number {
  // djb2 hash — always produces the same value for the same string
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  // Use modulo to stay in 0-999 range, then normalise to ±0.5, scale to ±0.002
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.004;
}

function resolveCoords(a: Article): { lat: number; lng: number } | null {
  // 1. AI-geocoded coordinates — exact, use directly
  if (a.lat && a.lng) return { lat: a.lat, lng: a.lng };
  // 2. Source fallback — exact city centre + micro-spread
  const src = SOURCE_COORDS[a.source_id];
  if (src) {
    return {
      lat: src.lat + microJitter(a.id),
      lng: src.lng + microJitter(a.id + '_lng'),
    };
  }
  return null;
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#e2148b';
  if (score >= 70) return '#b8189a';
  if (score >= 50) return '#8b2a9e';
  if (score >= 30) return '#5a2d82';
  return '#2d1a4a';
}

function formatViews(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function NewsMap({ articles }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const articlesOnMap = useMemo(() => {
    return articles
      .filter(a => a.status !== 'afgewezen')
      .map(a => {
        const coords = resolveCoords(a);
        if (!coords) return null;
        return { ...a, lat: coords.lat, lng: coords.lng };
      })
      .filter(Boolean) as (Article & { lat: number; lng: number })[];
  }, [articles]);

  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: articlesOnMap.map(a => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
      properties: {
        id:           a.id,
        title:        a.title,
        source_name:  a.source_name,
        powned_score: a.analyzed === 1 ? a.powned_score : -1,
        city:         a.city ?? SOURCE_COORDS[a.source_id]?.city ?? '',
        views:        a.views ?? 0,
        analyzed:     a.analyzed,
      },
    })),
  }), [articlesOnMap]);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    if (!document.getElementById('maplibre-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (!mapContainer.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'carto-dark': {
              type: 'raster',
              tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
              tileSize: 256,
              attribution: '© CARTO © OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', paint: { 'raster-opacity': 1 } }],
        },
        center: [5.3, 52.2],
        zoom: 7,
        pitch: 25,
        bearing: -8,
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        map.addSource('articles', { type: 'geojson', data: geojson });

        // Glow halo
        map.addLayer({
          id: 'article-glow',
          type: 'circle',
          source: 'articles',
          paint: {
            'circle-radius': ['interpolate', ['linear'],
              ['case', ['>=', ['get', 'powned_score'], 0], ['get', 'powned_score'], 30],
              0, 14, 100, 44],
            'circle-color': ['case',
              ['>=', ['get', 'powned_score'], 90], '#e2148b',
              ['>=', ['get', 'powned_score'], 70], '#b8189a',
              ['>=', ['get', 'powned_score'], 50], '#8b2a9e',
              ['>=', ['get', 'powned_score'],  0], '#5a2d82',
              '#2a1a40'],
            'circle-opacity': 0.18,
            'circle-blur': 1.6,
          },
        });

        // Main circle
        map.addLayer({
          id: 'article-circles',
          type: 'circle',
          source: 'articles',
          paint: {
            'circle-radius': ['interpolate', ['linear'],
              ['case', ['>=', ['get', 'powned_score'], 0], ['get', 'powned_score'], 30],
              0, 7, 100, 22],
            'circle-color': ['case',
              ['>=', ['get', 'powned_score'], 90], '#e2148b',
              ['>=', ['get', 'powned_score'], 70], '#b8189a',
              ['>=', ['get', 'powned_score'], 50], '#8b2a9e',
              ['>=', ['get', 'powned_score'],  0], '#5a2d82',
              '#3a2060'],
            'circle-opacity': 0.9,
            'circle-stroke-width': ['interpolate', ['linear'],
              ['case', ['>=', ['get', 'powned_score'], 0], ['get', 'powned_score'], 0],
              0, 1, 100, 2.5],
            'circle-stroke-color': ['case',
              ['>=', ['get', 'powned_score'], 90], 'rgba(255,105,180,0.8)',
              ['>=', ['get', 'powned_score'], 70], 'rgba(226,20,139,0.4)',
              'rgba(255,255,255,0.08)'],
          },
        });

        // Score label for top articles
        map.addLayer({
          id: 'article-labels',
          type: 'symbol',
          source: 'articles',
          filter: ['>=', ['get', 'powned_score'], 80],
          layout: {
            'text-field': ['get', 'powned_score'],
            'text-size': 9,
            'text-offset': [0, -2.5],
            'text-anchor': 'bottom',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#fff',
            'text-halo-color': 'rgba(226,20,139,0.8)',
            'text-halo-width': 1,
          },
        });

        map.on('click', 'article-circles', e => {
          if (!e.features?.length) return;
          const id = e.features[0].properties.id;
          const found = articlesOnMap.find(a => a.id === id);
          if (found) {
            setSelectedArticle(found);
            map.easeTo({ center: [found.lng, found.lat], zoom: Math.max(map.getZoom(), 10), duration: 600 });
          }
        });

        map.on('mouseenter', 'article-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'article-circles', () => { map.getCanvas().style.cursor = ''; });

        setMapReady(true);
      });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const src = mapRef.current.getSource('articles');
    if (src) src.setData(geojson);
  }, [mapReady, geojson]);

  return (
    <div className="relative flex-1" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Map wrapper — keeps `absolute inset-0` away from MapLibre's CSS override */}
      <div className="absolute inset-0">
        <div ref={mapContainer} className="w-full h-full" style={{ background: '#0d0d0d' }} />
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-[#111]/92 backdrop-blur border border-white/10 rounded-xl p-4 w-56">
        <p className="text-[9px] font-bold text-[#444] uppercase tracking-widest mb-3">PowNed Score · Legenda</p>
        {[
          { label: '90–100  Must-have',  color: '#e2148b', size: 22 },
          { label: '70–89   Sterk',      color: '#b8189a', size: 17 },
          { label: '50–69   Potentieel', color: '#8b2a9e', size: 13 },
          { label: '0–49    Laag',       color: '#5a2d82', size: 9  },
          { label: 'Nieuw   (geen AI)',  color: '#3a2060', size: 7  },
        ].map(({ label, color, size }) => (
          <div key={label} className="flex items-center gap-2.5 mb-2">
            <div className="rounded-full shrink-0"
              style={{ width: size, height: size, background: color, boxShadow: `0 0 ${size / 2}px ${color}66` }} />
            <span className="text-[10px] text-[#777]">{label}</span>
          </div>
        ))}
        <div className="border-t border-white/8 mt-3 pt-2 flex items-center justify-between">
          <span className="text-[10px] text-[#444]">{articlesOnMap.length} items op kaart</span>
          <span className="text-[9px] text-[#333]">klik voor details</span>
        </div>
      </div>

      {/* Article popup — MSN-style, works for analyzed + unanalyzed */}
      {selectedArticle && (
        <div className="absolute bottom-6 left-4 right-4 z-10 max-w-2xl mx-auto">
          <div className="bg-[#111]/96 backdrop-blur border border-[#e2148b]/30 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-start gap-0">
              {selectedArticle.image_url && (
                <div className="shrink-0 w-36 self-stretch overflow-hidden">
                  <img src={selectedArticle.image_url} alt=""
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                </div>
              )}
              <div className="flex-1 min-w-0 p-4">
                <div className="flex items-start gap-2 mb-2 flex-wrap">
                  {selectedArticle.analyzed === 1 ? (
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full text-white shrink-0"
                      style={{ background: getScoreColor(selectedArticle.powned_score) }}>
                      {selectedArticle.powned_score >= 90 ? '🔥 ' : ''}{selectedArticle.powned_score}%
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0"
                      style={{ background: 'rgba(255,255,255,0.08)', color: '#888', border: '1px solid rgba(255,255,255,0.12)' }}>
                      Nieuw
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-[#e2148b]">{selectedArticle.source_name}</span>
                  {(selectedArticle.city || SOURCE_COORDS[selectedArticle.source_id]?.city) && (
                    <span className="text-[11px] text-[#555]">
                      📍 {selectedArticle.city ?? SOURCE_COORDS[selectedArticle.source_id]?.city}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-sm text-[#f0f0f0] leading-snug mb-1.5 line-clamp-2">
                  {selectedArticle.title}
                </h3>
                {(selectedArticle.powned_summary || selectedArticle.summary) && (
                  <p className="text-[11px] text-[#777] leading-relaxed mb-1.5 line-clamp-2">
                    {selectedArticle.powned_summary || selectedArticle.summary}
                  </p>
                )}
                {selectedArticle.powned_angle && (
                  <p className="text-[11px] text-[#9c2d8f] italic mb-2.5 line-clamp-1">
                    💡 {selectedArticle.powned_angle}
                  </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  {(selectedArticle.views ?? 0) > 0 && (
                    <span className="text-[10px] text-[#555]">👁 {formatViews(selectedArticle.views)}</span>
                  )}
                  {(selectedArticle.likes ?? 0) > 0 && (
                    <span className="text-[10px] text-[#555]">❤ {formatViews(selectedArticle.likes)}</span>
                  )}
                  <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: 'linear-gradient(135deg, #e2148b, #9c2d8f)' }}>
                    Bekijk Bron →
                  </a>
                </div>
              </div>
              <button onClick={() => setSelectedArticle(null)}
                className="shrink-0 mt-3 mr-3 w-6 h-6 rounded-full bg-white/6 hover:bg-white/14 text-[#666] hover:text-[#ccc] transition-colors flex items-center justify-center text-xs">
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {articlesOnMap.length === 0 && mapReady && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-[#111]/90 rounded-xl p-6 text-center border border-white/8">
            <p className="text-2xl mb-2">🗺️</p>
            <p className="text-sm font-semibold text-[#555]">Geen items op kaart</p>
            <p className="text-[11px] text-[#333] mt-1">Scrape bronnen om artikelen op de kaart te zien</p>
          </div>
        </div>
      )}
    </div>
  );
}
