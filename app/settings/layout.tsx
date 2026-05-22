import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description:
    'Configure your Inscribed app — choose your Bible translation, set your ElevenLabs voice, adjust playback speed, and personalise your experience.',
  robots: { index: false },   // Settings page doesn't need to be indexed
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
