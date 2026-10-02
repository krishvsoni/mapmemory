import { redirect } from 'next/navigation';
import { getApiKey, getTenantName } from '@/lib/session';
import { DashboardNav } from './dashboard-nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const apiKey = await getApiKey();
  if (!apiKey) redirect('/login');

  const tenantName = await getTenantName();

  return (
    <div className="min-h-screen flex">
      <DashboardNav tenantName={tenantName} />
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
