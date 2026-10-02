import { redirect } from 'next/navigation';
import { getApiKey } from '@/lib/session';

export default async function RootPage() {
  const apiKey = await getApiKey();
  redirect(apiKey ? '/spaces' : '/login');
}
