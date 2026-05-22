import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Verse Library',
  description:
    'View all your memorized Bible verses, track spaced repetition progress, and see which verses are due for review today.',
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
