'use client';
import { useState, useEffect, useCallback } from 'react';
import { Article, FilterState, ArticleStatus, DashboardStats } from '@/types';
import { ArticleCard } from './ArticleCard';
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

export function Dashboard({ notify, onScrape, onAnalyze, scraping, analyzing }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

  // Close mobile drawer when filter changes on mobile
  const handleFilterChange = (f: FilterState) => {
    setFilters(f);
  };

  const handleStatusChange = (id: string, status: ArticleStatus) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const analyzed = articles.filter(a => a.analyzed === 1);
  const unanalyzed = articles.filter(a => a.analyzed !== 1);
  const mustHave = analyzed.filter(a => a.powned_score >= 90 && a.status !== 'afgewezen');
  const rest = analyzed.filter(a => !(a.powned_score >= 90 && a.status !== 'afgewezen'));
  const hasFilters = filters.provinces.length || filters.categories.length || filters.minScore > 0 || filters.searchQuery;

  const activeFilterCount = filters.provinces.length + filters.categories.length +
    (filters.minScore > 0 ? 1 : 0) + (filters.searchQuery ? 1 : 0) +
    (filters.status !== 'alle' ? 1 : 0);

  return (
    <div className="flex-1 max-w-screen-2xl mx-auto w-full px-3 lg:px-5 py-4 flex gap-5">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <FilterSidebar filters={filters} onChange={handleFilterChange} stats={stats} />
      </div>

      {/* Mobile filter drawer */}
      {showMobileFilters && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-40 lg:hidden"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="fixed inset-y-0 left-0 w-80 max-w-[88vw] z-50 overflow-y-auto bg-[#0d0d0d] border-r border-white/8 lg:hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 sticky top-0 bg-[#0d0d0d]">
              <span className="text-xs font-bold text-[#888] tracking-wider">Filters & Instellingen</span>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-[#666] hover:text-[#aaa] transition-colors text-base leading-none">
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <FilterSidebar filters={filters} onChange={f => { handleFilterChange(f); }} stats={stats} />
            </div>
          </div>
        </>
      )}

      <main className="flex-1 min-w-0">
        {/* Feed header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setShowMobileFilters(true)}
              className="lg:hidden relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/8 bg-[#1a1a1a] text-[#666] hover:text-[#aaa] text-[11px] transition-colors">
              ⚙ Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#e2148b] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <h2 className="text-sm font-bold text-[#888]">
              Nieuwsfeed
              {articles.length > 0 && <span className="text-[#333] font-normal ml-1">({articles.length})</span>}
            </h2>
            {hasFilters ? (
              <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-[10px] text-[#e2148b] hover:underline hidden sm:inline">
                × Wis filters
              </button>
            ) : null}
          </div>
          {!loading && articles.length > 0 && (
            <span className="text-[10px] text-[#333] hidden sm:inline">
              {mustHave.length} must-have · {rest.filter(a => a.status !== 'afgewezen').length} overige
              {unanalyzed.length > 0 && ` · ${unanalyzed.length} wacht op analyse`}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}
          </div>
        ) : articles.length === 0 ? (
          <EmptyState onScrape={onScrape} onAnalyze={onAnalyze} scraping={scraping} analyzing={analyzing} />
        ) : (
          <div className="space-y-2">
            {mustHave.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #e2148b40, transparent)' }} />
                  <span className="text-[9px] font-bold text-[#e2148b] uppercase tracking-[0.15em]">
                    🔥 Must-have ({mustHave.length})
                  </span>
                  <div className="h-px flex-1" style={{ background: 'linear-gradient(270deg, #e2148b40, transparent)' }} />
                </div>
                {mustHave.map(a => <ArticleCard key={a.id} article={a} onStatusChange={handleStatusChange} />)}
              </>
            )}

            {rest.length > 0 && (
              <>
                {mustHave.length > 0 && (
                  <div className="flex items-center gap-2 my-2">
                    <div className="h-px flex-1 bg-white/4" />
                    <span className="text-[9px] text-[#2a2a2a] uppercase tracking-[0.12em]">Overige items</span>
                    <div className="h-px flex-1 bg-white/4" />
                  </div>
                )}
                {rest.map(a => <ArticleCard key={a.id} article={a} onStatusChange={handleStatusChange} />)}
              </>
            )}

            {unanalyzed.length > 0 && (
              <>
                <div className="flex items-center gap-2 my-2">
                  <div className="h-px flex-1 bg-white/4" />
                  <span className="text-[9px] text-[#2a2a2a] uppercase tracking-[0.12em]">
                    ⏳ Te analyseren ({unanalyzed.length})
                  </span>
                  <div className="h-px flex-1 bg-white/4" />
                </div>
                {unanalyzed.map(a => <ArticleCard key={a.id} article={a} onStatusChange={handleStatusChange} />)}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onScrape, onAnalyze, scraping, analyzing }: { onScrape: () => void; onAnalyze: () => void; scraping: boolean; analyzing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 lg:py-20 text-center px-4">
      <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #e2148b15, #9c2d8f15)', border: '1px solid #e2148b20' }}>
        <span className="text-xl">📰</span>
      </div>
      <h3 className="text-base font-bold text-[#444] mb-1">Nieuwsfeed leeg</h3>
      <p className="text-[12px] text-[#333] max-w-xs mb-5">
        Scrape de nieuwsbronnen om actuele artikelen op te halen en analyseer ze vervolgens met AI.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onScrape} disabled={scraping}
          className={`px-4 py-2.5 text-[12px] rounded-xl border font-medium transition-colors ${
            scraping ? 'bg-[#1a1a1a] text-[#444] border-white/5 cursor-wait' :
            'bg-[#1a1a1a] text-[#9c2d8f] border-[#9c2d8f]/25 hover:bg-[#9c2d8f]/12 hover:text-[#c86ad0]'
          }`}>
          {scraping ? '⏳ Bezig...' : '🔍 Scrape bronnen'}
        </button>
        <button onClick={onAnalyze} disabled={analyzing}
          className={`px-4 py-2.5 text-[12px] rounded-xl font-medium text-white transition-colors ${analyzing ? 'opacity-50 cursor-wait' : ''}`}
          style={{ background: analyzing ? '#333' : 'linear-gradient(135deg, #e2148b, #9c2d8f)' }}>
          {analyzing ? '🧠 Analyseren...' : '🧠 AI Analyse'}
        </button>
      </div>
    </div>
  );
}
