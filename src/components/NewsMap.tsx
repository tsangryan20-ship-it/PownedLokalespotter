'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Article } from '@/types';

interface Props { articles: Article[]; }

function getScoreColor(score: number): string {
  if (score >= 90) return '#e2148b';
  if (score >= 70) return '#b8189a';
  if (score >= 50) return '#8b2a9e';
  if (score >= 30) return '#5a2d82';
  return '#2d1a4a';
}

function getScoreRadius(score: number): number {
  if (score >= 90) return 22;
  if (score >= 70) return 18;
  if (score >= 50) return 14;
  return 10;
}

function formatViews(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function NewsMap({ articles }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const articlesWithCoords = useMemo(
    () => articles.filter(a => a.lat && a.lng && a.status !== 'afgewezen'),
    [articles]
  );

  // Stable key based on article IDs + scores so markers refresh when data changes
  const markersKey = useMemo(
    () => articlesWithCoords.map(a => `${a.id}:${a.powned_score}`).join('|'),
    [articlesWithCoords]
  );

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then(L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [52.2, 5.3],
        zoom: 8,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      ).addTo(map);

      L.control.attribution({ prefix: false, position: 'bottomright' })
        .addAttribution('© CartoDB © OSM')
        .addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstanceRef.current as any).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Re-render markers whenever articles change or map becomes ready
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    import('leaflet').then(L => {
      const map = mapInstanceRef.current as ReturnType<typeof L.map>;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markersRef.current.forEach(m => (m as any).remove());
      markersRef.current = [];

      for (const article of articlesWithCoords) {
        const color = getScoreColor(article.powned_score);
        const radius = getScoreRadius(article.powned_score);
        const isHigh = article.powned_score >= 90;

        const marker = L.circleMarker([article.lat!, article.lng!], {
          radius,
          fillColor: color,
          color: isHigh ? '#ff69b4' : color,
          weight: isHigh ? 2 : 1,
          opacity: isHigh ? 0.9 : 0.7,
          fillOpacity: isHigh ? 0.85 : 0.65,
        });

        marker.on('click', () => setSelectedArticle(article));

        const viewsStr = article.views ? `<span style="color:#666">👁 ${formatViews(article.views)}</span>` : '';
        marker.bindTooltip(
          `<div style="background:#1a1a1a;border:1px solid ${color};border-radius:8px;padding:8px 10px;max-width:240px;font-family:system-ui,sans-serif">
            <div style="font-weight:700;font-size:11px;color:${color};margin-bottom:4px">${article.powned_score}% — ${article.city || (article.provinces?.[0] ?? '')}</div>
            <div style="font-size:11px;color:#ddd;line-height:1.4;margin-bottom:4px">${article.title.slice(0, 90)}${article.title.length > 90 ? '…' : ''}</div>
            <div style="font-size:10px;color:#555;display:flex;gap:8px;align-items:center">
              <span>${article.source_name}</span>${viewsStr}
            </div>
          </div>`,
          { permanent: false, direction: 'top', offset: [0, -radius - 4], className: 'powned-tooltip', opacity: 1 }
        );

        marker.addTo(map);
        markersRef.current.push(marker);
      }
    });
  // markersKey is the stable dep that changes only when articles actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, markersKey]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0" style={{ height: 'calc(100vh - 120px)' }}>
      <div ref={mapRef} className="flex-1 w-full" style={{ height: '100%', background: '#0d0d0d' }} />

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      {/* Legend */}
      <div className="absolute top-4 left-4 z-[1000] bg-[#111]/90 backdrop-blur border border-white/10 rounded-xl p-4 w-48">
        <p className="text-[9px] font-bold text-[#444] uppercase tracking-widest mb-3">PowNed Score</p>
        {[
          { label: '90–100  Must-have', color: '#e2148b', size: 22 },
          { label: '70–89  Sterk', color: '#b8189a', size: 18 },
          { label: '50–69  Potentieel', color: '#8b2a9e', size: 14 },
          { label: '0–49  Laag', color: '#3d1a5c', size: 10 },
        ].map(({ label, color, size }) => (
          <div key={label} className="flex items-center gap-2.5 mb-2">
            <div className="rounded-full shrink-0" style={{ width: size, height: size, background: color, opacity: 0.85 }} />
            <span className="text-[10px] text-[#777]">{label}</span>
          </div>
        ))}
        <div className="border-t border-white/8 mt-3 pt-2 flex items-center justify-between">
          <p className="text-[10px] text-[#444]">{articlesWithCoords.length} items</p>
          <p className="text-[9px] text-[#333]">klik voor details</p>
        </div>
      </div>

      {/* Selected article panel */}
      {selectedArticle && (
        <div className="absolute bottom-6 left-4 right-4 z-[1000] max-w-xl mx-auto">
          <div className="bg-[#111]/96 backdrop-blur border border-[#e2148b]/30 rounded-xl p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                    style={{ background: getScoreColor(selectedArticle.powned_score) }}>
                    {selectedArticle.powned_score}%
                  </span>
                  <span className="text-[11px] font-semibold text-[#e2148b]">{selectedArticle.source_name}</span>
                  {selectedArticle.city && <span className="text-[11px] text-[#555]">📍 {selectedArticle.city}</span>}
                </div>
                <h3 className="font-semibold text-sm text-[#f0f0f0] leading-snug mb-1.5">{selectedArticle.title}</h3>
                {selectedArticle.powned_summary && (
                  <p className="text-[11px] text-[#777] leading-relaxed mb-2">{selectedArticle.powned_summary}</p>
                )}
                {selectedArticle.powned_angle && (
                  <p className="text-[11px] text-[#9c2d8f] leading-relaxed mb-2 italic">💡 {selectedArticle.powned_angle}</p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  {(selectedArticle.views ?? 0) > 0 && (
                    <span className="text-[10px] text-[#555]">👁 {selectedArticle.views?.toLocaleString('nl-NL')}</span>
                  )}
                  {(selectedArticle.likes ?? 0) > 0 && (
                    <span className="text-[10px] text-[#555]">❤ {selectedArticle.likes?.toLocaleString('nl-NL')}</span>
                  )}
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                    style={{ background: 'linear-gradient(135deg, rgba(226,20,139,0.2), rgba(156,45,143,0.2))', color: '#e2148b', border: '1px solid rgba(226,20,139,0.3)' }}
                  >
                    → Bekijk artikel
                  </a>
                </div>
              </div>
              {selectedArticle.image_url && (
                <img src={selectedArticle.image_url} alt="" className="w-24 h-18 object-cover rounded-lg shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <button onClick={() => setSelectedArticle(null)}
                className="shrink-0 w-6 h-6 rounded-full bg-white/6 hover:bg-white/12 text-[#666] hover:text-[#bbb] transition-colors flex items-center justify-center text-xs">
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {articlesWithCoords.length === 0 && mapReady && (
        <div className="absolute inset-0 flex items-center justify-center z-[999] pointer-events-none">
          <div className="bg-[#111]/90 rounded-xl p-6 text-center border border-white/8">
            <p className="text-2xl mb-2">🗺️</p>
            <p className="text-sm font-semibold text-[#555]">Geen items met locatiedata</p>
            <p className="text-[11px] text-[#333] mt-1">Scrape bronnen en run AI Analyse om locaties te bepalen</p>
          </div>
        </div>
      )}

      <style>{`
        .leaflet-container { background: #0d0d0d; }
        .powned-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
        .powned-tooltip::before { display: none !important; }
        .leaflet-tooltip { padding: 0 !important; }
      `}</style>
    </div>
  );
}
