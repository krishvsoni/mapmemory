import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSpace, listCentralEntities, listEpisodes } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Workbench } from './workbench';

export default async function SpaceDetailPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;

  let space, episodes, centralEntities;
  try {
    const [spaceResult, episodesResult, centralResult] = await Promise.all([
      getSpace(spaceId),
      listEpisodes(spaceId),
      listCentralEntities(spaceId),
    ]);
    space = spaceResult;
    episodes = episodesResult.episodes;
    centralEntities = centralResult.entities;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 401) redirect('/login');
      if (error.statusCode === 404) notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-white">{space.name}</h1>
        {space.description && <p className="text-sm text-slate-400">{space.description}</p>}
        <Link href={`/spaces/${spaceId}/graph`} className="text-sm text-indigo-400 hover:text-indigo-300">
          Open graph explorer →
        </Link>
      </div>

      <Workbench spaceId={spaceId} />

      <div className="grid grid-cols-2 gap-4">
        <Card title="Central entities">
          {centralEntities.length === 0 ? (
            <p className="text-sm text-slate-500">No entities yet.</p>
          ) : (
            <ul className="space-y-1">
              {centralEntities.map((entity) => (
                <li key={entity.nodeId} className="flex justify-between text-sm text-slate-300">
                  <span>{entity.label}</span>
                  <span className="text-slate-500">{entity.centrality.toFixed(3)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent episodes">
          {episodes.length === 0 ? (
            <p className="text-sm text-slate-500">No episodes yet.</p>
          ) : (
            <ul className="space-y-2">
              {episodes.slice(0, 10).map((episode) => (
                <li key={episode.id} className="text-sm text-slate-300">
                  <Badge tone={episode.kind === 'reflection' ? 'warning' : 'default'}>{episode.kind}</Badge>{' '}
                  {episode.rawText}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
