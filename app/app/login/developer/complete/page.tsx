import { redirect } from 'next/navigation';
import { setSession } from '@/lib/session';

const API_URL = process.env.MAPMEMORY_API_URL ?? 'http://localhost:4000';

interface ExchangeResult {
  apiKey: string;
  tenantName: string;
}

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function DeveloperLoginCompletePage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  if (!code) redirect('/login?error=developer_login_failed');

  const response = await fetch(`${API_URL}/v1/auth/kinde/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    cache: 'no-store',
  });

  if (!response.ok) redirect('/login?error=developer_login_failed');

  const session = (await response.json()) as ExchangeResult;
  await setSession(session.apiKey, session.tenantName);
  redirect('/spaces');
}
