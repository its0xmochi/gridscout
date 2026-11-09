'use client';

import React from 'react';
import { Navbar } from '../../components/Navbar';
import { FundingFarm } from '../../components/FundingFarm';

export default function FundingFarmPage() {
  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <FundingFarm />
      </main>

      <footer className="border-t border-dark-750 bg-dark-850 py-6 text-center text-xs text-slate-500">
        <p>
          GridScout &amp; Funding Farm — Strictly Read-Only Analytics &amp; Delta-Neutral Verification.
        </p>
      </footer>
    </div>
  );
}
