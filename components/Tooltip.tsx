'use client';

import React, { useState } from 'react';
import { HelpCircle, Info } from 'lucide-react';

interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  title,
  className = '',
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center group cursor-help ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(!visible)}
    >
      {children || <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-200 transition-colors" />}

      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-dark-800 text-slate-200 text-xs rounded-xl shadow-xl border border-dark-600 z-50 pointer-events-none transition-opacity">
          {title && <div className="font-bold text-white mb-1 border-b border-dark-700 pb-1 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-emerald-400" />{title}</div>}
          <div className="text-[11px] leading-relaxed text-slate-300">{content}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dark-800" />
        </div>
      )}
    </div>
  );
};
