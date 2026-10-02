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
