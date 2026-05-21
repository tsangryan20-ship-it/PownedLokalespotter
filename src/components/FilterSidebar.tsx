'use client';
import { FilterState, Province, Category, ArticleStatus, SortOption } from '@/types';

const PROVINCES: Province[] = [
  'Nationaal', 'Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Noord-Brabant',
  'Gelderland', 'Overijssel', 'Friesland', 'Groningen', 'Drenthe', 'Flevoland', 'Zeeland', 'Limburg',
];

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: '112-alarm', label: '112 Alarm', emoji: '🚨' },
  { value: 'conflict-ophef', label: 'Conflict/Ophef', emoji: '⚡' },
  { value: 'politiek', label: 'Politiek', emoji: '🏛️' },
  { value: 'viraal', label: 'Viraal', emoji: '📱' },
  { value: 'juice-entertainment', label: 'Juice/Entertainment', emoji: '🍵' },
  { value: 'algemeen', label: 'Algemeen', emoji: '📰' },
];

const STATUSES: { value: ArticleStatus | 'alle'; label: string; color: string }[] = [
  { value: 'alle', label: 'Alle items', color: '' },
  { value: 'nieuw', label: 'Nieuw', color: 'text-[#ccc]' },
  { value: 'favoriet', label: '⭐ Favorieten', color: 'text-yellow-400' },
  { value: 'ingepland', label: '📅 Ingepland', color: 'text-blue-400' },
  { value: 'doorgestuurd', label: '📤 Doorgestuurd', color: 'text-green-400' },
  { value: 'afgewezen', label: '✗ Afgewezen', color: 'text-red-500/60' },
];

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  stats: { total: number; analyzed: number; highScore: number; todayCount: number; byProvince: Record<string, number>; byCategory: Record<string, number> };
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

export function FilterSidebar({ filters, onChange, stats }: Props) {
  return (
    <aside className="w-56 shrink-0 space-y-3">
      {/* Stats */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/6 p-3">
        <p className="text-[9px] font-bold text-[#444] uppercase tracking-[0.15em] mb-2.5">Live Monitor</p>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Vandaag" value={stats.todayCount} color="text-[#e2148b]" />
          <MiniStat label="Totaal" value={stats.total} color="text-[#888]" />
          <MiniStat label="Geanalyseerd" value={stats.analyzed} color="text-[#9c2d8f]" />
          <MiniStat label="Must-have" value={stats.highScore} color="text-[#ff69b4]" />
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/6 p-3">
        <input type="text" placeholder="Zoeken…"
          value={filters.searchQuery}
          onChange={e => onChange({ ...filters, searchQuery: e.target.value })}
          className="w-full bg-[#111] text-[12px] text-[#ddd] placeholder-[#333] border border-white/6 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#e2148b]/40"
        />
      </div>

      {/* Min score */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/6 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-bold text-[#444] uppercase tracking-[0.15em]">Min Score</p>
          <span className="text-xs font-bold text-[#e2148b]">{filters.minScore}%</span>
        </div>
        <input type="range" min={0} max={90} step={10} value={filters.minScore}
          onChange={e => onChange({ ...filters, minScore: Number(e.target.value) })}
          className="w-full" />
        <div className="flex justify-between text-[9px] text-[#333] mt-0.5">
          <span>Alles</span><span>90+</span>
        </div>
      </div>

      {/* Sort */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/6 p-3">
        <p className="text-[9px] font-bold text-[#444] uppercase tracking-[0.15em] mb-2">Sorteren</p>
        <select
          value={filters.sortBy}
          onChange={e => onChange({ ...filters, sortBy: e.target.value as SortOption })}
          className="w-full bg-[#111] text-[11px] text-[#ccc] border border-white/8 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#e2148b]/40 cursor-pointer"
        >
          <option value="score">🔥 PowNed score</option>
          <option value="date">🕐 Nieuwste eerst</option>
          <option value="views_desc">👁 Meest bekeken</option>
          <option value="views_asc">👁 Minst bekeken</option>
          <option value="likes_desc">❤ Meest geliket</option>
          <option value="likes_asc">❤ Minst geliket</option>
        </select>
      </div>

      {/* Status */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/6 p-3">
        <p className="text-[9px] font-bold text-[#444] uppercase tracking-[0.15em] mb-2">Status</p>
        <div className="space-y-0.5">
          {STATUSES.map(({ value, label, color }) => (
            <button key={value} onClick={() => onChange({ ...filters, status: value })}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors ${
                filters.status === value ? 'bg-[#e2148b]/18 text-[#e2148b] font-medium' : `${color || 'text-[#555]'} hover:bg-white/4`
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/6 p-3">
        <p className="text-[9px] font-bold text-[#444] uppercase tracking-[0.15em] mb-2">Categorie</p>
        <div className="space-y-0.5">
          {CATEGORIES.map(({ value, label, emoji }) => {
            const count = stats.byCategory[value] || 0;
            return (
              <label key={value} className="flex items-center gap-2 cursor-pointer py-0.5 group">
                <input type="checkbox" checked={filters.categories.includes(value)}
                  onChange={() => onChange({ ...filters, categories: toggle(filters.categories, value) })}
                  className="rounded shrink-0" />
                <span className={`text-[11px] flex-1 transition-colors ${filters.categories.includes(value) ? 'text-[#ddd]' : 'text-[#555] group-hover:text-[#888]'}`}>
                  {emoji} {label}
                </span>
                {count > 0 && <span className="text-[9px] text-[#333]">{count}</span>}
              </label>
            );
          })}
        </div>
      </div>

      {/* Provinces */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/6 p-3">
        <p className="text-[9px] font-bold text-[#444] uppercase tracking-[0.15em] mb-2">Regio</p>
        <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
          {PROVINCES.map(p => {
            const count = stats.byProvince[p] || 0;
            return (
              <label key={p} className="flex items-center gap-2 cursor-pointer py-0.5 group">
                <input type="checkbox" checked={filters.provinces.includes(p)}
                  onChange={() => onChange({ ...filters, provinces: toggle(filters.provinces, p) })}
                  className="rounded shrink-0" />
                <span className={`text-[11px] flex-1 transition-colors ${filters.provinces.includes(p) ? 'text-[#ddd]' : 'text-[#555] group-hover:text-[#888]'}`}>
                  {p}
                </span>
                {count > 0 && <span className="text-[9px] text-[#333]">{count}</span>}
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center bg-[#111] rounded-lg p-2">
      <p className={`text-lg font-bold tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-[9px] text-[#333] mt-0.5">{label}</p>
    </div>
  );
}
