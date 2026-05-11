import React, { ReactNode } from 'react';

export function StatButton({ 
  label, 
  onClick, 
  variant = 'neutral',
  icon,
  id
}: { 
  label: string, 
  onClick: () => void, 
  variant?: 'danger' | 'success' | 'warning' | 'neutral',
  icon?: ReactNode,
  id?: string
}) {
  const styles = {
    danger: 'bg-red-950/20 hover:bg-red-900/30 text-red-400 border-red-900/50',
    success: 'bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 border-emerald-900/50',
    warning: 'bg-amber-950/20 hover:bg-amber-900/30 text-amber-400 border-amber-900/50',
    neutral: 'bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-300 border-zinc-700/50',
  }[variant];

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-mono font-black uppercase transition-all active:scale-95 ${styles}`}
    >
      {icon}
      {label}
    </button>
  );
}
