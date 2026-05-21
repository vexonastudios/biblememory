import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ThemeProvider from '@/components/ThemeProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,          // Prevents accidental pinch-zoom during active sessions
  viewportFit: 'cover',         // Safe area for notch phones (iPhone X+)
  themeColor: '#961931',
};

export const metadata: Metadata = {
  title: 'Inscribed — Bible Memory App',
  description:
    'Memorize Bible verses using the Builder Method: phrase-by-phrase audio repetition with voice recall. ElevenLabs powered, hands-free design perfect for driving.',
  keywords: ['Bible memorization', 'Scripture memory', 'builder method', 'audio Bible'],

  // PWA / installability
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Inscribed',
    startupImage: [
      {
        url: '/icons/apple-touch-icon.png',
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },

  // Open Graph
  openGraph: {
    title: 'Inscribed — Bible Memory App',
    description: 'Memorize Bible verses with audio repetition and spaced review.',
    type: 'website',
    locale: 'en_US',
  },

  // Icons
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;1,400&display=swap"
          rel="stylesheet"
        />
        {/* iOS standalone app meta */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Scripture" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* Prevent blue highlight on tap on mobile */}
        <style>{`* { -webkit-tap-highlight-color: transparent; }`}</style>
        
        {/* Synchronous script to prevent theme flash on reload */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const settings = JSON.parse(localStorage.getItem('bible-memory-settings'));
                const theme = settings?.state?.theme || 'light';
                if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark-theme');
                } else {
                  document.documentElement.classList.remove('dark-theme');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
