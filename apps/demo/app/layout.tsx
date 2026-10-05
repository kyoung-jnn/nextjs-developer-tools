import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">Next.js Payload Demo</Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
