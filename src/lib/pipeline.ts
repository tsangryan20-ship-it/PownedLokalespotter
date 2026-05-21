/**
 * Shared scrape + analyze pipeline.
 * Called directly by instrumentation (cron) and by the API route handlers.
 * No HTTP round-trips: all logic lives here.
 */
import { scrapeRssFeed } from '@/lib/scraper';
import { generateArticleId } from '@/lib/scraper';
import {
  insertArticle,
  getUnanalyzedArticles,
  updateArticleAnalysis,
  getRecentFeedback,
} from '@/lib/db';
import { analyzeBatch } from '@/lib/ai/analyzer';
import type { FeedbackExample } from '@/lib/ai/prompts';
import sourcesRaw from '../../data/sources.json';

interface SourceConfig {
  id: string;
  name: string;
  rssUrls?: string[];
}

const SOURCES = sourcesRaw as SourceConfig[];

// ── Scrape ────────────────────────────────────────────────────────────────────

export async function runScrapeAll(sourceId?: string): Promise<{
  totalNew: number;
  results: { source: string; new: number; total: number }[];
}> {
  const sources = sourceId ? SOURCES.filter(s => s.id === sourceId) : SOURCES;
  let totalNew = 0;
  const results: { source: string; new: number; total: number }[] = [];

  for (const source of sources) {
    if (!source.rssUrls?.length) continue;
    let sourceNew = 0;
    let sourceTotal = 0;

    for (const feedUrl of source.rssUrls) {
      const items = await scrapeRssFeed(source.id, source.name, feedUrl);
      sourceTotal += items.length;

      for (const item of items) {
        const id = generateArticleId(item.url);
        const inserted = insertArticle({
          id,
          source_id: item.source_id,
          source_name: item.source_name,
          title: item.title,
          summary: item.description,
          url: item.url,
          published_at: item.published_at,
          scraped_at: new Date().toISOString(),
          image_url: item.image_url,
          views: item.views ?? 0,
          likes: item.likes ?? 0,
        });
        if (inserted) sourceNew++;
      }
    }

    totalNew += sourceNew;
    results.push({ source: source.name, new: sourceNew, total: sourceTotal });
  }

  return { totalNew, results };
}

// ── Analyze ───────────────────────────────────────────────────────────────────

export async function runAnalyzeAll(batchSize = 10): Promise<{ analyzed: number }> {
  const articles = getUnanalyzedArticles(batchSize);
  if (articles.length === 0) return { analyzed: 0 };

  const rawFeedback = getRecentFeedback(20);
  const feedbackExamples: FeedbackExample[] = rawFeedback.map(f => ({
    article_title: f.article_title,
    feedback_type: f.feedback_type,
    reason: f.reason,
    score_at_time: f.score_at_time,
  }));

  const analyses = await analyzeBatch(
    articles.map(a => ({ id: a.id, title: a.title, summary: a.summary ?? '', url: a.url })),
    feedbackExamples
  );

  let analyzed = 0;
  for (const [id, analysis] of analyses) {
    updateArticleAnalysis(id, {
      powned_score: analysis.score,
      powned_summary: analysis.summary,
      powned_angle: analysis.angle,
      categories: analysis.categories as string[],
      provinces: analysis.provinces as string[],
      tags: analysis.tags,
      lat: analysis.lat ?? null,
      lng: analysis.lng ?? null,
      city: analysis.city ?? null,
    });
    analyzed++;
  }

  return { analyzed };
}

// ── Full pipeline (scrape → analyze) ─────────────────────────────────────────

export async function runFullPipeline(): Promise<{
  totalNew: number;
  analyzed: number;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  console.log(`[pipeline] Starting full run at ${timestamp}`);

  const { totalNew } = await runScrapeAll();
  console.log(`[pipeline] Scraped ${totalNew} new articles`);

  // Analyze in batches until all unanalyzed articles are processed (max 50 per run to stay within quota)
  let analyzed = 0;
  const maxBatches = 5;
  for (let i = 0; i < maxBatches; i++) {
    const { analyzed: batchAnalyzed } = await runAnalyzeAll(10);
    analyzed += batchAnalyzed;
    if (batchAnalyzed === 0) break;
    // Small pause between batches to respect rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[pipeline] Analyzed ${analyzed} articles. Run complete.`);
  return { totalNew, analyzed, timestamp };
}

// ── Scheduler (called from instrumentation.ts) ────────────────────────────────

let lastRun: Date | null = null;
const MIN_INTERVAL_MS = 3 * 60 * 60 * 1000; // don't run more than once per 3 hours

export function schedulePipeline() {
  const INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours

  async function maybeRun() {
    const now = new Date();
    if (lastRun && now.getTime() - lastRun.getTime() < MIN_INTERVAL_MS) {
      console.log('[pipeline] Skipping scheduled run — ran too recently');
      return;
    }
    lastRun = now;
    try {
      await runFullPipeline();
    } catch (err) {
      console.error('[pipeline] Scheduled run failed:', err);
    }
  }

  // First run: 2 minutes after server startup (let server stabilize)
  const startupDelay = parseInt(process.env.CRON_STARTUP_DELAY_MS ?? '120000', 10);
  setTimeout(maybeRun, startupDelay);

  // Subsequent runs every 4 hours
  setInterval(maybeRun, INTERVAL_MS);

  console.log(
    `[pipeline] Scheduler registered — first run in ${startupDelay / 1000}s, then every ${INTERVAL_MS / 3600000}h`
  );
}
