import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Shield, Sword, X } from 'lucide-react';
import { useState } from 'react';

export function MagicBonusButton({ 
  value, 
  onSelect 
}: { 
  value: number, 
  onSelect: (v: number) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
          value > 0 
            ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-lg shadow-amber-500/20' 
            : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-400'
        }`}
      >
        <Sparkles size={14} fill={value > 0 ? "currentColor" : "none"} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[110]" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex gap-1 z-[120]"
            >
              {[0, 1, 2, 3].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => { onSelect(b); setIsOpen(false); }}
                  className={`w-8 h-8 rounded-lg font-mono font-black text-xs transition-all ${
                    value === b 
                      ? 'bg-amber-500 text-white' 
                      : 'hover:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  +{b}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
