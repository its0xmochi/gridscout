'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Send, CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react';

interface TelegramAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketSymbol?: string;
}

export function TelegramAlertModal({
  isOpen,
  onClose,
  marketSymbol = 'Universe',
}: TelegramAlertModalProps) {
  const [mode, setMode] = useState<'webhook' | 'bot'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [alertBoundaryExit, setAlertBoundaryExit] = useState(true);
  const [alertBreakout, setAlertBreakout] = useState(true);
  const [alertFunding, setAlertFunding] = useState(true);

  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(
    null
  );

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gridscout_alerts_config');
      if (saved) {
        try {
          const cfg = JSON.parse(saved);
          if (cfg.webhookUrl) setWebhookUrl(cfg.webhookUrl);
          if (cfg.botToken) setBotToken(cfg.botToken);
          if (cfg.chatId) setChatId(cfg.chatId);
          if (cfg.mode) setMode(cfg.mode);
        } catch {}
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'gridscout_alerts_config',
        JSON.stringify({
          mode,
          webhookUrl,
          botToken,
          chatId,
          alertBoundaryExit,
          alertBreakout,
          alertFunding,
        })
      );
    }
    setStatusMessage({ text: 'Alert preferences saved locally!', isError: false });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleSendTest = async () => {
    setTesting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: mode === 'webhook' ? webhookUrl : undefined,
          botToken: mode === 'bot' ? botToken : undefined,
          chatId: mode === 'bot' ? chatId : undefined,
          symbol: marketSymbol,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ text: data.error || 'Failed to send test alert.', isError: true });
      } else {
        setStatusMessage({ text: 'Test alert delivered successfully!', isError: false });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Network error.', isError: true });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sky-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Telegram Alerts</h3>
            <p className="text-xs text-slate-400">Real-time alerts for boundary exits & breakout warnings</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex border-b border-slate-800 my-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode('webhook')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              mode === 'webhook'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Custom Webhook
          </button>
          <button
            type="button"
            onClick={() => setMode('bot')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              mode === 'bot'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Direct Telegram Bot
          </button>
        </div>

        {mode === 'webhook' ? (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                placeholder="https://maker.ifttt.com/... or Zapier / custom webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Receives a POST request with JSON payload when price action breaches bounds.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Telegram Bot Token
              </label>
              <input
                type="text"
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Chat ID
              </label>
              <input
                type="text"
                placeholder="-100123456789 or user ID"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        )}

        {/* Triggers */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2 mb-4 text-xs">
          <div className="font-medium text-slate-300 mb-1">Alert Triggers:</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertBoundaryExit}
              onChange={(e) => setAlertBoundaryExit(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-600 focus:ring-0"
            />
            <span>Price crosses upper or lower grid boundary</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertBreakout}
              onChange={(e) => setAlertBreakout(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-600 focus:ring-0"
            />
            <span>Active 6-hour volatility breakout detected</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertFunding}
              onChange={(e) => setAlertFunding(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-600 focus:ring-0"
            />
            <span>Funding APR diverges &gt; 40 points from 10.95% baseline</span>
          </label>
        </div>

        {statusMessage && (
          <div
            className={`p-2.5 rounded text-xs mb-4 flex items-center gap-2 ${
              statusMessage.isError
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {statusMessage.isError ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing || (mode === 'webhook' ? !webhookUrl : !botToken || !chatId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testing ? 'Sending...' : 'Send Test Ping'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-colors"
            >
              Save Alert Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
