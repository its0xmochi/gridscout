import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GridScout | Perpetual Futures Grid Suitability Scanner',
  description:
    'Discovers and ranks perpetual futures markets on Hyperliquid Core and builder DEXes by historical grid trading suitability. Strictly read-only simulation engine.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-900 text-slate-100 flex flex-col antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
        <div className="flex-1">{children}</div>

        <footer className="border-t border-dark-750 bg-dark-850/80 py-8 px-4 sm:px-6 lg:px-8 mt-12 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-200">GridScout</span>
              <span className="text-slate-600">•</span>
              <span>Production-Quality Read-Only Perp Scanner</span>
            </div>

            <p className="text-center md:text-right max-w-2xl text-[11px] leading-relaxed text-slate-400">
              Not financial advice. Backtests are historical simulations and do not predict future results. Grid trading can lose money, especially during sustained trends, breakouts, poor liquidity and adverse funding.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
