import { redirect } from 'next/navigation';
import { getUsage } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';

function formatLimit(limit: number): string {
  return Number.isFinite(limit) ? limit.toLocaleString() : 'unlimited';
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  if (!Number.isFinite(limit)) return null;
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500';
  return (
    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function UsagePage() {
  let usage;
  try {
    usage = await getUsage();
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) redirect('/login');
    throw error;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white">Usage &amp; plan</h1>
        <p className="text-sm text-slate-400">Current consumption against your plan&apos;s limits.</p>
      </div>

      <Card title="Plan" actions={<Badge tone="success">{usage.plan}</Badge>}>
        <p className="text-sm text-slate-400">
          Upgrade by contacting your account owner, or via the billing checkout endpoint.
        </p>
      </Card>

      <Card title="Memory spaces">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-300">
            <span>
              {usage.spaces.used} / {formatLimit(usage.spaces.limit)}
            </span>
          </div>
          <UsageBar used={usage.spaces.used} limit={usage.spaces.limit} />
        </div>
      </Card>

      <Card title="Episodes ingested this month">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-300">
            <span>
              {usage.episodesThisMonth.used.toLocaleString()} / {formatLimit(usage.episodesThisMonth.limit)}
            </span>
          </div>
          <UsageBar used={usage.episodesThisMonth.used} limit={usage.episodesThisMonth.limit} />
        </div>
      </Card>
    </div>
  );
}
