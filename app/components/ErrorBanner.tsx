export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-md px-3 py-2">{message}</div>
  );
}
