import type { Metadata } from 'next';
import { Quicksand } from 'next/font/google';
import './globals.css';

const quicksand = Quicksand({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-quicksand',
});

export const metadata: Metadata = {
  title: 'O24 Database Control Center',
  description: 'Read-only production database backup monitoring',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={quicksand.className}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}