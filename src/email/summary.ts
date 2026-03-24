import type { DailyRunSummary } from '../domain/experience.js';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderDailySummaryEmail(summary: DailyRunSummary): RenderedEmail {
  const subject = `SoCal discovery summary for ${summary.finishedAt.slice(0, 10)}`;
  const categoryLines = summary.results.map((result) => {
    const highlights = result.inserted
      .slice(0, 3)
      .map((candidate) => `${candidate.name} (${candidate.region})`)
      .join('; ');
    return [
      `${result.category}: inserted ${result.inserted.length}, duplicates ${result.skippedDuplicates.length}, rejected ${result.rejected.length}, discovered ${result.discoveredCount}`,
      `Requests: ${formatRequestMetrics(result.requestMetrics)}`,
      highlights ? `Highlights: ${highlights}` : 'Highlights: none',
      result.warnings.length > 0 ? `Warnings: ${result.warnings.join(' | ')}` : 'Warnings: none',
    ].join('\n');
  });

  const warningLines = summary.warnings.length > 0 ? summary.warnings.join('\n') : 'None';
  const text = [
    `Run started: ${summary.startedAt}`,
    `Run finished: ${summary.finishedAt}`,
    `Dry run: ${summary.dryRun}`,
    `Total requests: ${formatRequestMetrics(summary.requestMetrics)}`,
    '',
    ...categoryLines,
    '',
    `Global warnings:\n${warningLines}`,
  ].join('\n');

  const html = [
    `<h1>SoCal discovery summary</h1>`,
    `<p><strong>Run started:</strong> ${summary.startedAt}<br /><strong>Run finished:</strong> ${summary.finishedAt}<br /><strong>Dry run:</strong> ${summary.dryRun}<br /><strong>Total requests:</strong> ${formatRequestMetrics(summary.requestMetrics)}</p>`,
    ...summary.results.map(
      (result) => `
        <h2>${result.category}</h2>
        <p>Inserted ${result.inserted.length}, duplicates ${result.skippedDuplicates.length}, rejected ${result.rejected.length}, discovered ${result.discoveredCount}</p>
        <p>Requests: ${formatRequestMetrics(result.requestMetrics)}</p>
        <ul>${result.inserted
          .slice(0, 3)
          .map((candidate) => `<li>${candidate.name} (${candidate.region})</li>`)
          .join('')}</ul>
        <p>Warnings: ${result.warnings.join(' | ') || 'None'}</p>
      `,
    ),
    `<h2>Global warnings</h2><p>${summary.warnings.join(' | ') || 'None'}</p>`,
  ].join('\n');

  return { subject, text, html };
}

function formatRequestMetrics(metrics: DailyRunSummary['requestMetrics']): string {
  return [
    `brave ${metrics.braveSearchRequests}`,
    `google ${metrics.googleSearchRequests}`,
    `search pages ${metrics.searchPageFetchRequests}`,
    `curated pages ${metrics.curatedPageFetchRequests}`,
    `airtable ${metrics.airtableRequests}`,
    `smtp ${metrics.smtpRequests}`,
    `retries ${metrics.httpRetries}`,
    `seed skips ${metrics.seedCacheSkips}`,
    `canonical cache hits ${metrics.canonicalCacheHits}`,
  ].join(', ');
}
