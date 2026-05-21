import { NextResponse } from 'next/server';
import { getUnanalyzedArticles, updateArticleAnalysis, getRecentFeedback } from '@/lib/db';
import { analyzeBatch } from '@/lib/ai/analyzer';
import { FeedbackExample } from '@/lib/ai/prompts';

export async function POST() {
  try {
    const articles = getUnanalyzedArticles(10);

    if (articles.length === 0) {
      return NextResponse.json({ message: 'Geen artikelen te analyseren', analyzed: 0 });
    }

    // Load recent editorial feedback for dynamic few-shot prompting
    const rawFeedback = getRecentFeedback(20);
    const feedbackExamples: FeedbackExample[] = rawFeedback.map(f => ({
      article_title: f.article_title,
      feedback_type: f.feedback_type,
      reason: f.reason,
      score_at_time: f.score_at_time,
    }));

    const analyses = await analyzeBatch(
      articles.map(a => ({ id: a.id, title: a.title, summary: a.summary, url: a.url })),
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

    return NextResponse.json({ success: true, analyzed, total: articles.length });
  } catch (err) {
    const apiErr = err as { status?: number };
    if (apiErr.status === 429) {
      return NextResponse.json(
        { error: 'Google AI quota bereikt. Probeer morgen opnieuw of upgrade via aistudio.google.com.', code: 'quota_exceeded' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
