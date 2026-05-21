import { NextRequest, NextResponse } from 'next/server';
import { scrapeRssFeed } from '@/lib/scraper';
import { insertArticle } from '@/lib/db';
import { generateArticleId } from '@/lib/scraper';
import sourcesData from '../../../../data/sources.json';

interface SourceConfig {
  id: string;
  name: string;
  rssUrls?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { sourceId?: string };
    const sources = body.sourceId
      ? (sourcesData as SourceConfig[]).filter(s => s.id === body.sourceId)
      : (sourcesData as SourceConfig[]);

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

    return NextResponse.json({ success: true, totalNew, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    sources: (sourcesData as SourceConfig[]).map(s => ({
      id: s.id,
      name: s.name,
      hasRss: (s.rssUrls?.length ?? 0) > 0,
    })),
  });
}
