import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

import type { Metadata } from 'next';

import './globals.css';

import { AppProviders } from './providers';

export const metadata: Metadata = {
    title: 'Chart Hedgehog',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ru" suppressHydrationWarning>
            {/* Blocking script: applies saved theme class before first paint to prevent FOUC */}
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){var t=localStorage.getItem('ChartHedgehog_theme');if(t==='light'||t==='dark')document.documentElement.classList.add('theme-'+t);})();`,
                    }}
                />
            </head>
            <body>
                <AppRouterCacheProvider>
                    <AppProviders>{children}</AppProviders>
                </AppRouterCacheProvider>
            </body>
        </html>
    );
}
