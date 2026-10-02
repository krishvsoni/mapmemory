import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listSpaces } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/Card';
import { CreateSpaceForm } from './create-space-form';

export default async function SpacesPage() {
  let spaces;
  try {
    spaces = await listSpaces();
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) redirect('/login');
    throw error;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Memory spaces</h1>
        <p className="text-sm text-slate-400">Each space is an isolated graph memory for one agent or use case.</p>
      </div>

      <Card title="Create a space">
        <CreateSpaceForm />
      </Card>

      <Card title={`${spaces.length} space${spaces.length === 1 ? '' : 's'}`}>
        {spaces.length === 0 ? (
          <p className="text-sm text-slate-500">No spaces yet — create one above.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {spaces.map((space) => (
              <li key={space.id} className="py-3">
                <Link href={`/spaces/${space.id}`} className="text-indigo-400 hover:text-indigo-300 font-medium">
                  {space.name}
                </Link>
                {space.description && <p className="text-sm text-slate-500">{space.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
