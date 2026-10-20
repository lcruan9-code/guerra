import type { Metadata, Viewport } from 'next';
import { Cinzel, Rajdhani } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-cinzel',
  display: 'swap',
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rajdhani',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Guilds WYD — a plataforma da sua guilda',
  description: 'Presença de guerra, montagem de SET e banco de contas para guildas do WYD',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Guilds WYD',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-180.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0705',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${rajdhani.variable}`}>
      <body>{children}</body>
    </html>
  );
}
