import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AMS Dashboard',
  description: 'Momentum trading dashboard for Indian stocks',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          src="https://s3.tradingview.com/tv.js"
          async
        ></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
