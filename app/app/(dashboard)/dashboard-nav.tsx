'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from './dashboard-actions';
import { Button } from '@/components/Button';

const NAV_ITEMS = [
  { href: '/spaces', label: 'Spaces' },
  { href: '/api-keys', label: 'API Keys' },
  { href: '/usage', label: 'Usage' },
];

export function DashboardNav({ tenantName }: { tenantName: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 flex flex-col">
      <div className="px-4 py-5">
        <h1 className="text-lg font-bold text-white">mapmemory</h1>
        <p className="text-xs text-slate-500 truncate">{tenantName ?? 'your tenant'}</p>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action={signOutAction} className="p-3">
        <Button variant="secondary" type="submit" className="w-full">
          Sign out
        </Button>
      </form>
    </aside>
  );
}
