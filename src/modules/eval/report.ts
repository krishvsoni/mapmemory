import type { ModeSummary } from './metrics.js';

function pct(value: number | null): string {
  return value === null ? '  n/a' : `${(value * 100).toFixed(1).padStart(5)}%`;
}

export function formatReport(datasetName: string, summaries: ModeSummary[]): string {
  const lines = [`Dataset: ${datasetName}`, ''];
  for (const summary of summaries) {
    lines.push(
      `Mode ${summary.mode}: accuracy ${pct(summary.accuracy)}  evidence recall ${pct(summary.evidenceRecall)}  ` +
        `retrieval p50 ${summary.retrievalP50Ms.toFixed(0)}ms p95 ${summary.retrievalP95Ms.toFixed(0)}ms  (n=${summary.total})`,
    );
    for (const [category, score] of Object.entries(summary.byCategory).sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`  ${category.padEnd(34)} ${pct(score.accuracy)}  recall ${pct(score.evidenceRecall)}  n=${score.total}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
