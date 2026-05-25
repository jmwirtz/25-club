import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "25 Club",
  description: "Investment club portfolio and AI-assisted analysis",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              25 Club
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/portfolio" className="hover:text-blue-600">Portfolio</Link>
              <Link href="/analyze" className="hover:text-blue-600">Analyze</Link>
              <Link href="/members" className="hover:text-blue-600">Members</Link>
              <Link href="/transactions" className="hover:text-blue-600">Transactions</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-slate-500">
            Built collaboratively with Claude. Data as of the latest LPL/Flagstone report; prices fetched live.
          </div>
        </footer>
      </body>
    </html>
  );
}
