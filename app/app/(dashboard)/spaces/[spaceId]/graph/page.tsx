import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getGraphSnapshot, getSpace } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { Explorer } from './explorer';

export default async function GraphExplorerPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;

  let space, snapshot;
  try {
    [space, snapshot] = await Promise.all([getSpace(spaceId), getGraphSnapshot(spaceId)]);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 401) redirect('/login');
      if (error.statusCode === 404) notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <Link href={`/spaces/${spaceId}`} className="text-xs text-indigo-400 hover:text-indigo-300">
          ← {space.name}
        </Link>
        <h1 className="text-xl font-bold text-white">Graph explorer</h1>
        <p className="text-sm text-slate-400">
          Pick a date to see what the memory believed then. Dashed edges are facts that were later replaced.
        </p>
      </div>
      <Explorer spaceId={spaceId} initialSnapshot={snapshot} />
    </div>
  );
}
