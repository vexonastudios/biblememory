import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recite Mode',
  description:
    'Practice reciting a memorized Bible verse from memory. Speak aloud and get instant feedback — part of your spaced repetition review.',
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
