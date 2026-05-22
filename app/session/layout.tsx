import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Memory Session',
  description:
    'Listen to phrase-by-phrase audio repetition to memorize a Bible verse with Inscribed. Hands-free — perfect for driving or daily routine.',
};

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
