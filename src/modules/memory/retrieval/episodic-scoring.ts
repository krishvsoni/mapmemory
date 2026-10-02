export function episodicRelevance(overlapCount: number, totalFactCount: number): number {
  const total = Math.max(totalFactCount, 1);
  return (overlapCount / total) * Math.log(total === 1 ? Math.E : total);
}

export function recencyWeight(ageInSteps: number, halfLifeSteps: number): number {
  if (halfLifeSteps <= 0) return 1;
  return Math.pow(0.5, Math.max(0, ageInSteps) / halfLifeSteps);
}
