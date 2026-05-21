'use client';
import { useRouter } from 'next/navigation';

interface Props {
  activeTab: 'dashboard' | 'map' | 'audio';
  onTabChange: (tab: 'dashboard' | 'map' | 'audio') => void;
  onScrape: () => void;
  onAnalyze: () => void;
  scraping: boolean;
  analyzing: boolean;
  lastUpdated: Date | null;
  stats: { total: number; todayCount: number };
}

export function Header({ activeTab, onTabChange, onScrape, onAnalyze, scraping, analyzing, lastUpdated, stats }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  return (
    <header className="bg-[#0e0e0e] border-b border-white/5 sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-3 lg:px-5 py-0 flex items-stretch gap-0">
        {/* Logo */}
        <div className="flex items-center gap-2 lg:gap-3 pr-3 lg:pr-6 border-r border-white/5 py-2.5 lg:py-3 shrink-0">
          <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #e2148b, #9c2d8f)' }}>
            <span className="text-white font-black text-xs lg:text-sm leading-none">P</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-black leading-none gradient-text tracking-widest">POWNED</div>
            <div className="text-[8px] text-[#444] leading-none mt-0.5 tracking-[0.15em]">REDACTIE AGENT</div>
          </div>
          <div className="flex items-center gap-1 ml-0 lg:ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#e2148b] live-dot" />
            <span className="text-[9px] text-[#555] font-semibold tracking-widest hidden sm:inline">LIVE</span>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-stretch gap-0 px-1 lg:px-2">
          {([
            { id: 'dashboard', label: 'Dashboard', icon: '📰' },
            { id: 'map',       label: 'Kaart',     icon: '🗺️' },
            { id: 'audio',     label: 'Audio',     icon: '🎙️' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-4 text-[11px] lg:text-xs font-semibold border-b-2 transition-colors h-full ${
                activeTab === tab.id
                  ? 'border-[#e2148b] text-[#e2148b]'
                  : 'border-transparent text-[#555] hover:text-[#888]'
              }`}>
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Quick stats — desktop only */}
        <div className="hidden lg:flex items-center gap-4 border-r border-white/5 pr-5 mr-4">
          <QuickStat label="Vandaag" value={stats.todayCount} color="text-[#e2148b]" />
          <QuickStat label="Totaal" value={stats.total} color="text-[#555]" />
          {lastUpdated && (
            <span className="text-[10px] text-[#333]">
              {lastUpdated.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 lg:gap-1.5 py-2">
          <button onClick={onScrape} disabled={scraping}
            className={`px-2 lg:px-3 py-1.5 text-[11px] rounded-lg border font-medium transition-colors ${
              scraping ? 'bg-[#1a1a1a] text-[#444] border-white/5 cursor-wait' :
              'bg-[#1a1a1a] text-[#9c2d8f] border-[#9c2d8f]/25 hover:bg-[#9c2d8f]/12 hover:text-[#c86ad0]'
            }`}>
            <span className="hidden sm:inline">{scraping ? '⏳ Bezig...' : '🔍 Scrapen'}</span>
            <span className="sm:hidden">{scraping ? '⏳' : '🔍'}</span>
          </button>
          <button onClick={onAnalyze} disabled={analyzing}
            className={`px-2 lg:px-3 py-1.5 text-[11px] rounded-lg border font-medium transition-colors ${
              analyzing ? 'bg-[#1a1a1a] text-[#444] border-white/5 cursor-wait' :
              'text-[#e2148b] border-[#e2148b]/30 hover:bg-[#e2148b]/12'
            }`}
            style={analyzing ? {} : { background: 'linear-gradient(135deg, rgba(226,20,139,0.12), rgba(156,45,143,0.12))' }}>
            <span className="hidden sm:inline">{analyzing ? '🧠 Analyseren...' : '🧠 AI Analyse'}</span>
            <span className="sm:hidden">{analyzing ? '⏳' : '🧠'}</span>
          </button>
          <button onClick={handleLogout} title="Uitloggen"
            className="px-2 lg:px-2.5 py-1.5 text-[11px] rounded-lg border border-white/6 bg-[#1a1a1a] text-[#333] hover:text-[#666] transition-colors ml-0.5 lg:ml-1">
            ⏻
          </button>
        </div>
      </div>
    </header>
  );
}

function QuickStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-base font-bold tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-[9px] text-[#333] mt-0.5">{label}</p>
    </div>
  );
}
