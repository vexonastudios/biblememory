import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scripture Builder — Bible Memory App',
  description:
    'Memorize Bible verses using the Builder Method: phrase-by-phrase audio repetition with voice recall. ElevenLabs powered, hands-free design perfect for driving.',
  keywords: ['Bible memorization', 'Scripture memory', 'builder method', 'audio Bible'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
