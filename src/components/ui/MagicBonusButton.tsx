import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

export interface MagicBonusButtonProps {
  value: number;
  onSelect: (v: number) => void;
  id?: string;
}

export function MagicBonusButton({ 
  value, 
  onSelect,
  id
}: MagicBonusButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative" id={id}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
          value > 0 
            ? 'bg-amber-500 border-amber-500 text-white' 
            : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
        }`}
        title="Modificador Mágico"
      >
        <Sparkles size={14} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 5 }}
              className="absolute left-0 mt-2 bg-zinc-900 border border-zinc-800 p-2 rounded-xl shadow-2xl z-20 flex gap-1 min-w-[150px]"
            >
              {[0, 1, 2, 3].map(v => (
                <button
                  key={v}
                  onClick={() => {
                    onSelect(v);
                    setIsOpen(false);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                    value === v 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  +{v}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
