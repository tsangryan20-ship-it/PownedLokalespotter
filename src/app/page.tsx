'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { TopNewsToday } from '@/components/TopNewsToday';
import { AudioMonitor } from '@/components/AudioMonitor';
import { Article } from '@/types';

const NewsMap = dynamic(() => import('@/components/NewsMap').then(m => m.NewsMap), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#e2148b]/30 border-t-[#e2148b] animate-spin mx-auto mb-3" />
        <p className="text-sm text-[#444]">Kaart laden…</p>
      </div>
    </div>
  ),
});

type Tab = 'dashboard' | 'topnews' | 'map' | 'audio';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [scraping, setScraping] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState({ total: 0, todayCount: 0 });
  const [mapArticles, setMapArticles] = useState<Article[]>([]);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const notify = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/articles?stats=true');
      const data = await res.json();
      setStats({ total: data.total, todayCount: data.todayCount });
      setLastUpdated(new Date());
    } catch { /* silent */ }
  }, []);

  const loadMapArticles = useCallback(async () => {
    try {
      // Fetch ALL articles (not just analyzed) — NewsMap resolves coords via source fallback
      const res = await fetch('/api/articles?limit=500&sortBy=score');
      const data = await res.json();
      setMapArticles(data.articles || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    refreshStats();
    const id = setInterval(refreshStats, 30000);
    return () => clearInterval(id);
  }, [refreshStats]);

  useEffect(() => {
    if (activeTab === 'map') loadMapArticles();
  }, [activeTab, loadMapArticles]);

  const dispatchRefresh = () => window.dispatchEvent(new Event('powned:refresh'));

  const handleScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json();
      notify(`✅ ${data.totalNew} nieuwe artikelen gevonden`, 'success');
      await refreshStats();
      dispatchRefresh();
    } catch { notify('Scraping mislukt', 'error'); }
    finally { setScraping(false); }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', { method: 'POST' });
      const data = await res.json();
      if (res.status === 429 || data.code === 'quota_exceeded') {
        notify('⏳ Quota bereikt — probeer morgen opnieuw of check aistudio.google.com', 'error');
      } else if (data.error) {
        notify(`❌ ${data.error}`, 'error');
      } else {
        notify(`🧠 ${data.analyzed} artikelen geanalyseerd`, 'success');
        await refreshStats();
        dispatchRefresh();
        if (activeTab === 'map') loadMapArticles();
      }
    } catch { notify('Analyse mislukt', 'error'); }
    finally { setAnalyzing(false); }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0d0d0d]">
      <Header
        activeTab={activeTab} onTabChange={setActiveTab}
        onScrape={handleScrape} onAnalyze={handleAnalyze}
        scraping={scraping} analyzing={analyzing}
        lastUpdated={lastUpdated} stats={stats}
      />

      {/* Toast */}
      {notification && (
        <div className={`fixed top-14 right-4 z-50 px-4 py-2.5 rounded-xl text-[12px] font-medium shadow-xl border transition-all animate-pulse ${
          notification.type === 'success' ? 'bg-green-900/80 text-green-300 border-green-700/40' :
          notification.type === 'error'   ? 'bg-red-900/80 text-red-300 border-red-700/40' :
          'bg-[#1a1a1a] text-[#ccc] border-white/8'
        }`} style={{ animationIterationCount: 1 }}>
          {notification.msg}
        </div>
      )}

      {/* Tab content — all tabs mounted but hidden to preserve state */}
      <div className="flex-1 flex flex-col">
        <div className={activeTab === 'dashboard' ? 'flex-1 flex flex-col' : 'hidden'}>
          <Dashboard
            notify={notify}
            onScrape={handleScrape} onAnalyze={handleAnalyze}
            scraping={scraping} analyzing={analyzing}
          />
        </div>
        <div className={activeTab === 'topnews' ? 'flex-1 flex flex-col' : 'hidden'}>
          <TopNewsToday
            notify={notify}
            onScrape={handleScrape} onAnalyze={handleAnalyze}
            scraping={scraping} analyzing={analyzing}
          />
        </div>
        {activeTab === 'map' && <NewsMap articles={mapArticles} />}
        {activeTab === 'audio' && <AudioMonitor />}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/4 py-2.5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#2a2a2a]">PowNed Redactie Agent</span>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-[#e2148b]/40 live-dot" />
            <span className="text-[9px] text-[#2a2a2a]">System Live</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#222]">Engineered & Crafted by</span>
          <div className="flex items-center gap-1.5 group">
            <div className="w-4 h-4 rounded flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: 'linear-gradient(135deg, #FF4D00, #FE3D25)' }}>
              <span className="text-white font-black text-[8px] leading-none">N</span>
            </div>
            <span className="text-[10px] font-bold" style={{ color: '#FF4D00' }}>Note It Agency</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
