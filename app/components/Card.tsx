import type { ReactNode } from 'react';

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
