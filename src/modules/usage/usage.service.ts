import { getRedisConnection } from '../queue/redis-connection.js';
import { DEFAULT_PLAN_LIMIT, PLAN_LIMITS, type PlanLimit } from '../../config/constants.js';
import { QuotaExceededError } from '../../shared/errors.js';
import type { SpaceRepository } from '../tenant/space.repository.js';

const MONTHLY_COUNTER_TTL_SECONDS = 60 * 60 * 24 * 40;

function monthlyUsageKey(tenantId: string): string {
  const yearMonth = new Date().toISOString().slice(0, 7);
  return `usage:episodes:${tenantId}:${yearMonth}`;
}

export function resolvePlanLimit(plan: string): PlanLimit {
  return PLAN_LIMITS[plan] ?? DEFAULT_PLAN_LIMIT;
}

export class UsageService {
  constructor(private readonly spaces: SpaceRepository) {}

  planLimit(plan: string): PlanLimit {
    return resolvePlanLimit(plan);
  }

  async assertCanCreateSpace(tenantId: string, plan: string): Promise<void> {
    const limit = this.planLimit(plan);
    if (!Number.isFinite(limit.maxSpaces)) return;

    const existing = await this.spaces.listByTenant(tenantId);
    if (existing.length >= limit.maxSpaces) {
      throw new QuotaExceededError(`Plan "${plan}" allows at most ${limit.maxSpaces} memory spaces`);
    }
  }

  async assertCanIngestAndRecord(tenantId: string, plan: string): Promise<void> {
    const limit = this.planLimit(plan);
    if (!Number.isFinite(limit.maxEpisodesPerMonth)) return;

    const key = monthlyUsageKey(tenantId);
    const redis = getRedisConnection();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, MONTHLY_COUNTER_TTL_SECONDS);

    if (count > limit.maxEpisodesPerMonth) {
      throw new QuotaExceededError(
        `Plan "${plan}" allows at most ${limit.maxEpisodesPerMonth} ingested episodes per month`,
      );
    }
  }

  async currentMonthlyEpisodeCount(tenantId: string): Promise<number> {
    const raw = await getRedisConnection().get(monthlyUsageKey(tenantId));
    return raw ? Number(raw) : 0;
  }
}
