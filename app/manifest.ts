import type { MetadataRoute } from 'next';

// Manifesto da plataforma (a landing comercial). Cada guilda tem o seu próprio em
// /[guild]/manifest.webmanifest, para o membro instalar o app com o nome da guilda.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Guilds WYD',
    short_name: 'Guilds WYD',
    description: 'Presença de guerra, montagem de SET e banco de contas para guildas do WYD',
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
