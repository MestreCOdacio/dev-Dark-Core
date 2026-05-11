import { ReactNode } from 'react';

export interface StatButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'danger' | 'success' | 'warning' | 'neutral';
  icon?: ReactNode;
  id?: string;
}

export function StatButton({ 
  label, 
  onClick, 
  variant = 'neutral',
  icon,
  id
}: StatButtonProps) {
  const styles = {
    danger: 'bg-red-950/20 hover:bg-red-900/30 text-red-400 border-red-900/50',
    success: 'bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 border-emerald-900/50',
    warning: 'bg-amber-950/20 hover:bg-amber-900/30 text-amber-400 border-amber-900/50',
    neutral: 'bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-300 border-zinc-700/50',
  }[variant];

  return (
    <button
      id={id}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border flex flex-col items-center justify-center transition-all min-w-[36px] group ${styles}`}
    >
      {icon && <div className="mb-0.5 opacity-60 group-hover:opacity-100 transition-opacity">{icon}</div>}
      <span className="text-[10px] font-black italic uppercase tracking-tighter leading-none">{label}</span>
    </button>
  );
}
