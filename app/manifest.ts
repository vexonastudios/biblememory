import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Inscribed',
    short_name: 'Inscribed',
    description:
      'Inscribed helps you hide God’s Word in your heart through phrase-by-phrase audio repetition and spaced repetition review. Hands-free, perfect for driving.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#961931',
    orientation: 'portrait-primary',
    categories: ['education', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'My Library',
        short_name: 'Library',
        description: 'View verses due for review',
        url: '/library',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Recite Mode',
        short_name: 'Recite',
        description: 'Practice reciting a verse',
        url: '/review',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
