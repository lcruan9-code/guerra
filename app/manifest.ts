import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Imperium Guerra',
    short_name: 'Imperium Guerra',
    description: 'Confirmação de presença nas guerras da guild (WYD)',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0705',
    theme_color: '#0a0705',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
