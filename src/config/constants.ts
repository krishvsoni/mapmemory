export const RETRIEVAL_DEFAULTS = {
  beamDepth: 2,
  beamWidth: 5,
  episodicTopK: 5,
  minSimilarity: 0.15,
  recencyHalfLifeSteps: 50,
} as const;

export const TRIPLET_CONSTRAINTS = {
  maxWordsPerTriplet: 7,
  hardWordCeiling: 12,
} as const;

export const CACHE_DEFAULTS = {
  embeddingCacheSize: 2000,
  embeddingCacheTtlSeconds: 60 * 60 * 24 * 7,
} as const;

export const ENTITY_RESOLUTION = {
  mergeSimilarityThreshold: 0.92,
} as const;

export const RELATION_RESOLUTION = {
  mergeSimilarityThreshold: 0.88,
} as const;

export const EPISODIC_SCORE_WEIGHTS = {
  relevance: 0.3,
  querySimilarity: 0.25,
  importance: 0.2,
  recency: 0.15,
  reinforcement: 0.1,
} as const;

export const REFLECTION_DEFAULTS = {
  candidatePoolSize: 60,
  clusterSize: 12,
  minClusterSize: 4,
  defaultImportance: 7,
} as const;

export const CENTRALITY_DEFAULTS = {
  dampingFactor: 0.85,
  iterations: 20,
  cacheTtlSeconds: 60 * 60,
  topKDefault: 10,
} as const;

export const PATHFINDING_DEFAULTS = {
  maxDepth: 6,
} as const;

export const CONSOLIDATION_DEFAULTS = {
  maxExistingFactsForContradictionPrompt: 40,
} as const;

export const RATE_LIMIT_DEFAULTS = {
  requestsPerMinute: 120,
  windowSeconds: 60,
} as const;

export const RETENTION_DEFAULTS = {
  supersededEdgeRetentionDays: 30,
} as const;

export interface PlanLimit {
  maxSpaces: number;
  maxEpisodesPerMonth: number;
}

export const PLAN_LIMITS: Record<string, PlanLimit> = {
  free: { maxSpaces: 2, maxEpisodesPerMonth: 500 },
  pro: { maxSpaces: 25, maxEpisodesPerMonth: 20_000 },
  enterprise: { maxSpaces: Number.POSITIVE_INFINITY, maxEpisodesPerMonth: Number.POSITIVE_INFINITY },
};

export const DEFAULT_PLAN_LIMIT: PlanLimit = PLAN_LIMITS.free as PlanLimit;
