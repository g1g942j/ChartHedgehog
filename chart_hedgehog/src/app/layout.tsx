import type { Metadata } from 'next';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

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
        <html lang="ru">
            <body>
                <AppRouterCacheProvider>
                    <AppProviders>{children}</AppProviders>
                </AppRouterCacheProvider>
            </body>
        </html>
    );
}
