import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "auto8 MVP1",
  description: "RFQ email to draft quote to sales approval workflow"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-gray-200 bg-white px-6 py-3 flex gap-6 text-sm">
          <Link href="/" className="font-semibold text-gray-800 hover:text-blue-600">auto8</Link>
          <Link href="/rfqs" className="text-gray-600 hover:text-blue-600">RFQs</Link>
          <Link href="/audit" className="text-gray-600 hover:text-blue-600">Audit Logs</Link>
          <Link href="/metrics" className="text-gray-600 hover:text-blue-600">Metrics</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
