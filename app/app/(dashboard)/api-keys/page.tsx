import { redirect } from 'next/navigation';
import { listApiKeys, listSpaces } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { IssueKeyForm } from './issue-key-form';
import { revokeApiKeyAction } from './actions';

export default async function ApiKeysPage() {
  let keys, spaces;
  try {
    const [keysResult, spacesResult] = await Promise.all([listApiKeys(), listSpaces()]);
    keys = keysResult.apiKeys;
    spaces = spacesResult;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) redirect('/login');
    throw error;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">API keys</h1>
        <p className="text-sm text-slate-400">Scoped, role-based credentials for developers and services.</p>
      </div>

      <Card title="Issue a new key">
        <IssueKeyForm spaces={spaces} />
      </Card>

      <Card title={`${keys.length} active key${keys.length === 1 ? '' : 's'}`}>
        {keys.length === 0 ? (
          <p className="text-sm text-slate-500">No keys yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase">
                <th className="pb-2">Name</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Prefix</th>
                <th className="pb-2">Last used</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="py-2 text-slate-200">{key.name}</td>
                  <td className="py-2">
                    <Badge>{key.role}</Badge>
                  </td>
                  <td className="py-2 text-slate-500 font-mono text-xs">{key.keyPrefix}</td>
                  <td className="py-2 text-slate-500">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'never'}
                  </td>
                  <td className="py-2 text-right">
                    <form action={revokeApiKeyAction.bind(null, key.id)}>
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                        revoke
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
