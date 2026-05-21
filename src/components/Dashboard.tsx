'use client';
import { useState, useEffect, useCallback } from 'react';
import { Article, FilterState, ArticleStatus, DashboardStats, SortOption } from '@/types';
import { ArticleCardGrid } from './ArticleCardGrid';
import { FilterSidebar } from './FilterSidebar';

const DEFAULT_FILTERS: FilterState = {
  provinces: [], categories: [], minScore: 0, searchQuery: '', status: 'alle', sortBy: 'score',
};

const DEFAULT_STATS: DashboardStats = {
  total: 0, analyzed: 0, highScore: 0, todayCount: 0, byProvince: {}, byCategory: {},
};

interface Props {
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onScrape: () => void;
  onAnalyze: () => void;
  scraping: boolean;
  analyzing: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'score',      label: '🔥 PowNed score' },
  { value: 'date',       label: '🕐 Nieuwste eerst' },
  { value: 'views_desc', label: '👁 Meest bekeken' },
  { value: 'views_asc',  label: '👁 Minst bekeken' },
  { value: 'likes_desc', label: '❤ Meest geliket' },
  { value: 'likes_asc',  label: '❤ Minst geliket' },
];

export function Dashboard({ notify, onScrape, onAnalyze, scraping, analyzing }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.provinces.length) params.set('provinces', filters.provinces.join(','));
    if (filters.categories.length) params.set('categories', filters.categories.join(','));
    if (filters.minScore > 0) params.set('minScore', String(filters.minScore));
    if (filters.status !== 'alle') params.set('status', filters.status);
    if (filters.searchQuery) params.set('search', filters.searchQuery);
    params.set('sortBy', filters.sortBy);
    params.set('limit', '300');

    try {
      const res = await fetch(`/api/articles?${params}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch { notify('Fout bij laden', 'error'); }
    finally { setLoading(false); }
  }, [filters, notify]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/articles?stats=true');
      setStats(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);
  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, [fetchStats]);

  useEffect(() => {
    const handler = async () => { await fetchArticles(); await fetchStats(); };
    window.addEventListener('powned:refresh', handler);
    return () => window.removeEventListener('powned:refresh', handler);
  }, [fetchArticles, fetchStats]);

  const handleStatusChange = (id: string, status: ArticleStatus) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  // Split: must-have analyzed, other analyzed, unanalyzed — all shown in grid
  const mustHave   = articles.filter(a => a.analyzed === 1 && a.powned_score >= 90 && a.status !== 'afgewezen');
  const analyzed   = articles.filter(a => a.analyzed === 1 && !(a.powned_score >= 90 && a.status !== 'afgewezen'));
  const unanalyzed = articles.filter(a => a.analyzed !== 1);
  const hasFilters = filters.provinces.length || filters.categories.length || filters.minScore > 0 || filters.searchQuery;

  return (
    <div className="flex-1 max-w-screen-2xl mx-auto w-full px-5 py-4 flex gap-5">
      <FilterSidebar filters={filters} onChange={setFilters} stats={stats} />

      <main className="flex-1 min-w-0">
        {/* ── Feed header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-bold text-[#888] shrink-0">
              Nieuwsfeed
              {articles.length > 0 && <span className="text-[#333] font-normal ml-1">({articles.length})</span>}
            </h2>
            {!loading && articles.length > 0 && (
              <span className="text-[10px] text-[#333] hidden sm:block truncate">
                {mustHave.length} must-have · {analyzed.filter(a => a.status !== 'afgewezen').length} geanalyseerd
                {unanalyzed.length > 0 && ` · ${unanalyzed.length} nieuw`}
              </span>
            )}
            {hasFilters && (
              <button onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-[10px] text-[#e2148b] hover:underline shrink-0">
                × Wis filters
              </button>
            )}
          </div>

          {/* Sort dropdown — top-right */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-[#333] hidden sm:block">Sorteren:</span>
            <select
              value={filters.sortBy}
              onChange={e => setFilters(f => ({ ...f, sortBy: e.target.value as SortOption }))}
              className="bg-[#1a1a1a] text-[11px] text-[#ccc] border border-white/10 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#e2148b]/40 cursor-pointer transition-colors hover:border-white/20"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl shimmer" style={{ height: '420px' }} />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <EmptyState onScrape={onScrape} onAnalyze={onAnalyze} scraping={scraping} analyzing={analyzing} />
        ) : (
          <div>
            {/* Must-have section */}
            {mustHave.length > 0 && (
              <section className="mb-8">
                <SectionDivider label={`🔥 Must-have (${mustHave.length})`} accent />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-4">
                  {mustHave.map(a => (
                    <ArticleCardGrid key={a.id} article={a} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </section>
            )}

            {/* Analyzed (non-must-have) */}
            {analyzed.filter(a => a.status !== 'afgewezen').length > 0 && (
              <section className="mb-8">
                {mustHave.length > 0 && (
                  <SectionDivider label={`Overige geanalyseerd (${analyzed.filter(a => a.status !== 'afgewezen').length})`} />
                )}
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 ${mustHave.length > 0 ? 'mt-4' : ''}`}>
                  {analyzed.filter(a => a.status !== 'afgewezen').map(a => (
                    <ArticleCardGrid key={a.id} article={a} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </section>
            )}

            {/* Unanalyzed — shown directly in the grid, no separate list */}
            {unanalyzed.length > 0 && (
              <section className="mb-8">
                <SectionDivider label={`Nieuw binnengehaald (${unanalyzed.length})`} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-4">
                  {unanalyzed.map(a => (
                    <ArticleCardGrid key={a.id} article={a} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </section>
            )}

            {/* Afgewezen — compact list at the very bottom */}
            {analyzed.filter(a => a.status === 'afgewezen').length > 0 && (
              <section className="mb-6">
                <SectionDivider label={`Afgewezen (${analyzed.filter(a => a.status === 'afgewezen').length})`} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-4 opacity-30">
                  {analyzed.filter(a => a.status === 'afgewezen').map(a => (
                    <ArticleCardGrid key={a.id} article={a} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SectionDivider({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1"
        style={{ background: accent ? 'linear-gradient(90deg, #e2148b40, transparent)' : 'rgba(255,255,255,0.04)' }} />
      <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${accent ? 'text-[#e2148b]' : 'text-[#2a2a2a]'}`}>
        {label}
      </span>
      <div className="h-px flex-1"
        style={{ background: accent ? 'linear-gradient(270deg, #e2148b40, transparent)' : 'rgba(255,255,255,0.04)' }} />
    </div>
  );
}

function EmptyState({ onScrape, onAnalyze, scraping, analyzing }: {
  onScrape: () => void; onAnalyze: () => void; scraping: boolean; analyzing: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #e2148b15, #9c2d8f15)', border: '1px solid #e2148b20' }}>
        <span className="text-2xl">📰</span>
      </div>
      <h3 className="text-base font-bold text-[#444] mb-1">Nieuwsfeed leeg</h3>
      <p className="text-[12px] text-[#333] max-w-xs mb-6">
        Scrape de bronnen om direct nieuws te zien. AI-analyse is optioneel voor scores.
      </p>
      <div className="flex gap-3">
        <button onClick={onScrape} disabled={scraping}
          className={`px-4 py-2 text-[12px] rounded-xl border font-medium transition-colors ${
            scraping ? 'bg-[#1a1a1a] text-[#444] border-white/5 cursor-wait' :
            'bg-[#1a1a1a] text-[#9c2d8f] border-[#9c2d8f]/25 hover:bg-[#9c2d8f]/12 hover:text-[#c86ad0]'
          }`}>
          {scraping ? '⏳ Bezig...' : '🔍 Scrape bronnen'}
        </button>
        <button onClick={onAnalyze} disabled={analyzing}
          className={`px-4 py-2 text-[12px] rounded-xl font-medium text-white transition-colors ${analyzing ? 'opacity-50 cursor-wait' : ''}`}
          style={{ background: analyzing ? '#333' : 'linear-gradient(135deg, #e2148b, #9c2d8f)' }}>
          {analyzing ? '🧠 Analyseren...' : '🧠 AI Analyse'}
        </button>
      </div>
    </div>
  );
}
