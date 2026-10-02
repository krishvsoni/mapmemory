import { EPISODIC_SCORE_WEIGHTS } from '../../../config/constants.js';

export function episodicRelevance(overlapCount: number, totalFactCount: number): number {
  const total = Math.max(totalFactCount, 1);
  return (overlapCount / total) * Math.log(total === 1 ? Math.E : total);
}

export function recencyWeight(ageInSteps: number, halfLifeSteps: number): number {
  if (halfLifeSteps <= 0) return 1;
  return Math.pow(0.5, Math.max(0, ageInSteps) / halfLifeSteps);
}

export function reinforcementBoost(accessCount: number): number {
  return 1 - 1 / (1 + Math.max(0, accessCount));
}

export interface CompositeScoreInputs {
  relevance: number;
  importance: number;
  ageInSteps: number;
  halfLifeSteps: number;
  accessCount: number;
}

export function compositeEpisodicScore(inputs: CompositeScoreInputs): number {
  const normalizedImportance = Math.min(Math.max(inputs.importance, 1), 10) / 10;
  const recency = recencyWeight(inputs.ageInSteps, inputs.halfLifeSteps);
  const reinforcement = reinforcementBoost(inputs.accessCount);

  return (
    EPISODIC_SCORE_WEIGHTS.relevance * inputs.relevance +
    EPISODIC_SCORE_WEIGHTS.importance * normalizedImportance +
    EPISODIC_SCORE_WEIGHTS.recency * recency +
    EPISODIC_SCORE_WEIGHTS.reinforcement * reinforcement
  );
}
