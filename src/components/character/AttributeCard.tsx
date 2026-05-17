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
    <div className="bg-zinc-900/40 border border-zinc-800 p-4 py-3 rounded-2xl flex items-center justify-between group hover:border-zinc-700 transition-all shadow-lg relative min-h-[72px]">
      <div className="flex items-center gap-4 flex-1">
        {/* Advantage Toggle Icon */}
        <div className="relative shrink-0">
          <button 
            type="button"
            id={`adv-toggle-${label}`}
            onClick={() => setShowAdvMenu(!showAdvMenu)}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              advDisStatus === 'advantage' ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
              advDisStatus === 'disadvantage' ? 'bg-rose-500 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
              'bg-transparent border-zinc-800 hover:border-zinc-600'
            }`}
            title="Vantagem / Desvantagem"
          />
          
          <AnimatePresence>
            {showAdvMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAdvMenu(false)} />
                <motion.div 
                  initial={{ opacity: 0, x: -10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -10, scale: 0.95 }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 z-20 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 flex flex-col gap-1 shadow-2xl min-w-[120px]"
                >
                  <button 
                    type="button"
                    onClick={() => { onToggleAdvDis('advantage'); setShowAdvMenu(false); }}
                    className={`text-[9px] uppercase font-black tracking-[0.1em] p-2.5 rounded-lg hover:bg-emerald-500/10 text-left transition-all ${advDisStatus === 'advantage' ? 'text-emerald-500 bg-emerald-500/5' : 'text-zinc-500'}`}
                  >
                    Vantagem
                  </button>
                  <button 
                    type="button"
                    onClick={() => { onToggleAdvDis('disadvantage'); setShowAdvMenu(false); }}
                    className={`text-[9px] uppercase font-black tracking-[0.1em] p-2.5 rounded-lg hover:bg-rose-500/10 text-left transition-all ${advDisStatus === 'disadvantage' ? 'text-rose-500 bg-rose-500/5' : 'text-zinc-500'}`}
                  >
                    Desvantagem
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-0.5 min-w-[3rem]">
          <span className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-600 block leading-none">
            {label}
          </span>
          <div className="flex items-center">
            <DeferredNumberInput
              value={value}
              onChange={onUpdate}
              min={1}
              max={99}
              className="w-10 bg-transparent text-xl font-mono font-black text-white outline-none focus:text-amber-500 transition-colors"
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-6 shrink-0 h-full">
        <div className="text-right min-w-[3.5rem] relative h-full flex flex-col justify-center">
          <motion.div 
            key={mod}
            initial={{ y: -5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-col items-end"
          >
            <span className={`text-2xl font-black font-mono italic tracking-tighter ${mod > 0 ? 'text-emerald-500' : mod < 0 ? 'text-rose-500' : 'text-zinc-700'}`}>
              {formatModifier(mod)}
            </span>
            <span className="text-[7px] uppercase font-black text-zinc-700 tracking-tighter absolute -bottom-1 lg:-bottom-2 right-0 whitespace-nowrap">Modificador</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
