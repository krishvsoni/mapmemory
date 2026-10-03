import type { QuestionOutcome, RetrievalMode } from './eval.types.js';

export interface CategoryScore {
  total: number;
  accuracy: number;
  evidenceRecall: number | null;
}

export interface ModeSummary {
  mode: RetrievalMode;
  total: number;
  accuracy: number;
  evidenceRecall: number | null;
  retrievalP50Ms: number;
  retrievalP95Ms: number;
  byCategory: Record<string, CategoryScore>;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function ratio(hits: number, total: number): number {
  return total === 0 ? 0 : hits / total;
}

function evidenceRecall(outcomes: QuestionOutcome[]): number | null {
  const measurable = outcomes.filter((o) => o.evidenceHit !== null);
  if (measurable.length === 0) return null;
  return ratio(measurable.filter((o) => o.evidenceHit).length, measurable.length);
}

function score(outcomes: QuestionOutcome[]): CategoryScore {
  return {
    total: outcomes.length,
    accuracy: ratio(outcomes.filter((o) => o.correct).length, outcomes.length),
    evidenceRecall: evidenceRecall(outcomes),
  };
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function summarizeByMode(outcomes: QuestionOutcome[]): ModeSummary[] {
  return [...groupBy(outcomes, (o) => o.mode)].map(([mode, modeOutcomes]) => {
    const latencies = modeOutcomes.map((o) => o.retrievalMs);
    const overall = score(modeOutcomes);
    return {
      mode: mode as RetrievalMode,
      total: overall.total,
      accuracy: overall.accuracy,
      evidenceRecall: overall.evidenceRecall,
      retrievalP50Ms: percentile(latencies, 50),
      retrievalP95Ms: percentile(latencies, 95),
      byCategory: Object.fromEntries(
        [...groupBy(modeOutcomes, (o) => o.category)].map(([category, rows]) => [category, score(rows)]),
      ),
    };
  });
}
