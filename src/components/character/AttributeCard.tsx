import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { getModifier, formatModifier } from '../../utils/characterUtils';
import { DeferredNumberInput } from './DeferredNumberInput';
import { D20Icon } from '../ui/Icons';

export function AttributeCard({ 
  value, 
  label, 
  onUpdate,
  onRoll,
  advDisStatus,
  onToggleAdvDis
}: { 
  value: number, 
  label: string, 
  onUpdate: (v: number) => void,
  onRoll: () => void | Promise<void>,
  advDisStatus?: 'advantage' | 'disadvantage' | null,
  onToggleAdvDis: (type: 'advantage' | 'disadvantage') => void,
  key?: string | number | null;
}) {
  const mod = getModifier(value);
  const [showAdvMenu, setShowAdvMenu] = useState(false);

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 p-4 py-3 rounded-xl flex items-center justify-between group hover:border-zinc-700 transition-all shadow-lg relative">
      <div className="flex items-center gap-3">
        {/* Advantage Toggle Icon */}
        <div className="relative">
          <button 
            type="button"
            id={`adv-toggle-${label}`}
            onClick={() => setShowAdvMenu(!showAdvMenu)}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              advDisStatus === 'advantage' ? 'bg-emerald-500 border-emerald-500' :
              advDisStatus === 'disadvantage' ? 'bg-rose-500 border-rose-500' :
              'bg-transparent border-zinc-700 hover:border-zinc-500'
            }`}
          />
          
          <AnimatePresence>
            {showAdvMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAdvMenu(false)} />
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute left-6 top-0 z-20 bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex flex-col gap-1 shadow-2xl min-w-[100px]"
                >
                  <button 
                    type="button"
                    onClick={() => { onToggleAdvDis('advantage'); setShowAdvMenu(false); }}
                    className={`text-[10px] uppercase font-bold tracking-widest p-2 rounded hover:bg-emerald-500/10 text-left transition-colors ${advDisStatus === 'advantage' ? 'text-emerald-500' : 'text-zinc-400'}`}
                  >
                    Vantagem
                  </button>
                  <button 
                    type="button"
                    onClick={() => { onToggleAdvDis('disadvantage'); setShowAdvMenu(false); }}
                    className={`text-[10px] uppercase font-bold tracking-widest p-2 rounded hover:bg-rose-500/10 text-left transition-colors ${advDisStatus === 'disadvantage' ? 'text-rose-500' : 'text-zinc-400'}`}
                  >
                    Desvantagem
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block">
            {label}
          </span>
          <div className="flex items-center gap-1">
            <DeferredNumberInput
              value={value}
              onChange={onUpdate}
              min={1}
              max={99}
              className="w-12 bg-transparent text-2xl font-mono font-bold text-white outline-none focus:text-amber-500 text-center"
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* D20 Roll Button */}
        <button 
          type="button"
            id={`roll-${label}`}
          onClick={onRoll}
          className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-white transition-all active:scale-95 border border-zinc-700/50 shadow-inner group-hover:border-amber-500/20"
          title={`Rolar ${label}`}
        >
          <D20Icon size={18} />
        </button>

        <div className="text-right min-w-[3rem] pr-2">
          <motion.div 
            key={mod}
            initial={{ y: -5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-col items-end"
          >
            <span className={`text-2xl font-black font-mono italic ${mod > 0 ? 'text-emerald-500' : mod < 0 ? 'text-rose-500' : 'text-zinc-600'}`}>
              {formatModifier(mod)}
            </span>
            <span className="text-[8px] uppercase font-black text-zinc-600 tracking-tighter">Modificador</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
