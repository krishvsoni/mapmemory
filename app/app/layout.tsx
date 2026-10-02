import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'mapmemory dashboard',
  description: 'Graph memory for LLM agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
