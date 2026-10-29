import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NavProgress } from '@/components/NavProgress';
import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
});
const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-serif',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'ResourcesHub: borrow or share equipment and rooms',
  description:
    'Book underused labs, tools and rooms with eligibility checks, fair allocation and a full audit trail.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plex.variable} ${plexMono.variable} ${serif.variable}`}>
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
