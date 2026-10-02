export function Badge({ children, tone = 'default' }: { children: string; tone?: 'default' | 'success' | 'warning' }) {
  const toneClasses = {
    default: 'bg-slate-800 text-slate-300',
    success: 'bg-emerald-900/40 text-emerald-300',
    warning: 'bg-amber-900/40 text-amber-300',
  }[tone];

  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${toneClasses}`}>{children}</span>;
}
