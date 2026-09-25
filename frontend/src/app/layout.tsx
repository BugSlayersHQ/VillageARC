import type { Metadata, Viewport } from 'next';
import React from 'react';
import './globals.css';
import { BRAND } from '@/constants/brand';
import { AuthProvider } from '@/context/AuthContext';

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.fullDescription,
  openGraph: {
    type: 'website',
    title: `${BRAND.name} — ${BRAND.eyebrow}`,
    description: `${BRAND.tagline} ${BRAND.shortDescription}`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          type="image/svg+xml"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231C1917'/><polygon points='16,7 25,12 25,22 16,27 7,22 7,12' fill='none' stroke='%23FE551B' stroke-width='2.5'/><circle cx='16' cy='16' r='3' fill='%23FE551B'/></svg>"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
