'use client';
import { Article, ArticleStatus } from '@/types';
import { CategoryTag } from './CategoryTag';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useState } from 'react';

interface Props {
  article: Article;
  onStatusChange: (id: string, status: ArticleStatus) => void;
  rank?: number;
}

function formatCount(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function getScoreTier(score: number) {
  if (score >= 90) return { label: 'MUST-HAVE', color: '#e2148b', glow: true };
  if (score >= 70) return { label: 'STERK',     color: '#b8189a', glow: false };
  if (score >= 50) return { label: 'POTENTIEEL', color: '#7a2d8a', glow: false };
  return              { label: 'LAAG',          color: '#3a1a52', glow: false };
}

export function ArticleCardGrid({ article, onStatusChange, rank }: Props) {
  const [loading, setLoading] = useState(false);

  const isAnalyzed  = article.analyzed === 1;
  const isAfgewezen = article.status === 'afgewezen';
  const isMustHave  = isAnalyzed && article.powned_score >= 90;
  const timeAgo     = formatDistanceToNow(new Date(article.published_at), { addSuffix: true, locale: nl });

  // Description: prefer AI summary, fallback to original scrape summary
  const description = isAnalyzed && article.powned_summary
    ? article.powned_summary
    : article.summary || null;

  const scoreTier = isAnalyzed ? getScoreTier(article.powned_score) : null;

  const handleStatus = async (status: ArticleStatus) => {
    setLoading(true);
    try {
      await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onStatusChange(article.id, status);
    } finally { setLoading(false); }
  };

  return (
    <div className={`group flex flex-col rounded-2xl overflow-hidden transition-all duration-200 ${
      isAfgewezen
        ? 'opacity-25 border border-white/4 bg-[#111]'
        : isMustHave
          ? 'border border-[#e2148b]/35 bg-[#161616] hover:border-[#e2148b]/65 hover:shadow-[0_4px_32px_rgba(226,20,139,0.14)] hover:-translate-y-0.5'
          : 'border border-white/8 bg-[#161616] hover:border-white/18 hover:bg-[#1a1a1a] hover:-translate-y-0.5'
    }`}>

      {/* ── Image ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#0f0f0f]" style={{ aspectRatio: '16/9' }}>
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
            onError={e => {
              const el = e.target as HTMLImageElement;
              el.style.display = 'none';
              el.parentElement!.style.background = 'linear-gradient(135deg, #1a0820 0%, #0d0d20 100%)';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1a0820, #0d0d20)' }}>
            <span className="text-4xl opacity-10">📰</span>
          </div>
        )}

        {/* Top accent bar for must-have */}
        {isMustHave && (
          <div className="absolute top-0 inset-x-0 h-0.5"
            style={{ background: 'linear-gradient(90deg, #e2148b, #9c2d8f 60%, transparent)' }} />
        )}

        {/* Rank badge — top-left */}
        {rank !== undefined && (
          <div className="absolute top-3 left-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-lg"
              style={rank <= 3
                ? { background: 'linear-gradient(135deg, #e2148b, #9c2d8f)', color: '#fff' }
                : { background: 'rgba(0,0,0,0.72)', color: '#777', border: '1px solid rgba(255,255,255,0.1)' }}>
              #{rank}
            </div>
          </div>
        )}

        {/* Bottom overlay: score badge OR "Nieuw" pill + time */}
        <div className="absolute bottom-0 inset-x-0 px-3 pb-3 pt-10"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)' }}>
          <div className="flex items-center justify-between">
            {isAnalyzed && scoreTier ? (
              <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                style={{
                  background: `${scoreTier.color}22`,
                  border: `1px solid ${scoreTier.color}55`,
                  boxShadow: scoreTier.glow ? `0 0 12px ${scoreTier.color}44` : 'none',
                }}>
                <span className="text-[12px] font-black" style={{ color: scoreTier.color }}>
                  {article.powned_score >= 90 ? '🔥 ' : article.powned_score >= 70 ? '⭐ ' : ''}
                  {article.powned_score}%
                </span>
                <span className="text-[9px] font-bold tracking-wider opacity-80" style={{ color: scoreTier.color }}>
                  {scoreTier.label}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span className="text-[10px] font-bold text-[#888]">Nieuw</span>
              </div>
            )}
            <span className="text-[10px] text-white/40">{timeAgo}</span>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 gap-2.5">

        {/* Source name + status chip */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: isMustHave ? '#e2148b' : '#9c2d8f' }}>
            {article.source_name}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
            article.status === 'favoriet'     ? 'bg-yellow-400/12 text-yellow-400' :
            article.status === 'ingepland'    ? 'bg-blue-400/12 text-blue-400' :
            article.status === 'doorgestuurd' ? 'bg-green-400/12 text-green-400' : 'hidden'
          }`}>
            {article.status === 'favoriet' ? '⭐' : article.status === 'ingepland' ? '📅' : article.status === 'doorgestuurd' ? '📤' : ''}
          </span>
        </div>

        {/* Title */}
        <h3 className={`font-black leading-snug line-clamp-3 ${
          isAfgewezen ? 'line-through text-[#444]' : 'text-[#f2f2f2]'
        }`} style={{ fontSize: '14px', letterSpacing: '-0.01em' }}>
          {article.title}
        </h3>

        {/* Description: AI summary or original scrape summary */}
        {description && (
          <p className="text-[11.5px] text-[#666] leading-relaxed line-clamp-3">
            {description}
          </p>
        )}

        {/* PowNed angle — only if AI analyzed */}
        {isAnalyzed && article.powned_angle && (
          <p className="text-[11px] italic line-clamp-2" style={{ color: '#a040b0' }}>
            💡 {article.powned_angle}
          </p>
        )}

        {/* Tags + location */}
        {(article.city || article.categories.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {article.city && <span className="text-[10px] text-[#555]">📍 {article.city}</span>}
            {article.categories.slice(0, 2).map(c => <CategoryTag key={c} category={c} />)}
          </div>
        )}

        <div className="flex-1" />

        {/* ── Metrics + actions ─────────────────────────────────── */}
        <div className="pt-3 border-t border-white/6 space-y-2.5">

          {/* Metrics row */}
          {((article.views ?? 0) > 0 || (article.likes ?? 0) > 0) && (
            <div className="flex items-center gap-4">
              {(article.views ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-[#555]">
                  <span className="text-[10px]">👁</span>
                  <span className="font-medium text-[#777]">{formatCount(article.views)}</span>
                  <span className="text-[#333]">bekeken</span>
                </span>
              )}
              {(article.likes ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-[#555]">
                  <span className="text-[10px]">❤</span>
                  <span className="font-medium text-[#777]">{formatCount(article.likes)}</span>
                  <span className="text-[#333]">likes</span>
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex-1 py-2 text-[11px] font-bold text-center rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #e2148b 0%, #9c2d8f 100%)' }}>
              Bekijk Bron →
            </a>
            {!isAfgewezen && (
              <>
                <button disabled={loading}
                  onClick={() => handleStatus(article.status === 'favoriet' ? 'nieuw' : 'favoriet')}
                  title="Favoriet"
                  className={`w-8 h-8 rounded-xl border text-sm transition-colors ${
                    article.status === 'favoriet'
                      ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400'
                      : 'bg-white/4 border-white/8 text-[#444] hover:text-yellow-400 hover:border-yellow-400/30'
                  }`}>⭐</button>
                <button disabled={loading}
                  onClick={() => handleStatus(article.status === 'ingepland' ? 'nieuw' : 'ingepland')}
                  title="Inplannen"
                  className={`w-8 h-8 rounded-xl border text-sm transition-colors ${
                    article.status === 'ingepland'
                      ? 'bg-blue-400/15 border-blue-400/40 text-blue-400'
                      : 'bg-white/4 border-white/8 text-[#444] hover:text-blue-400 hover:border-blue-400/30'
                  }`}>📅</button>
                <button disabled={loading}
                  onClick={() => handleStatus('afgewezen')}
                  title="Afwijzen"
                  className="w-8 h-8 rounded-xl border bg-white/4 border-white/8 text-[#444] hover:text-red-400 hover:border-red-400/30 transition-colors text-sm">
                  ✕
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
