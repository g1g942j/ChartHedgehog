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
        <html lang="ru">
            <body>
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
