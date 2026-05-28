import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Sword } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { loginLegacy } = useAuth();
  const [inputId, setInputId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGMMasterAuth, setIsGMMasterAuth] = useState(false);
  const [gmKey, setGmKey] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    setError('');
    const cleanId = inputId.trim();
    if (!cleanId) return;

    if (cleanId.toLowerCase() === 'mestre') {
      setError('ID não encontrado');
      return;
    }

    setLoading(true);
    
    try {
      const docRef = doc(db, 'users', cleanId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        loginLegacy(cleanId);
        navigate('/');
      } else {
        setError('ID não encontrado');
      }
    } catch (e) {
      console.error("Login Firestore check failed:", e);
      setError('ID não encontrado');
    } finally {
      setLoading(false);
    }
  };

  const handleGMLogin = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (gmKey === 'Simples.') {
      setLoading(true);
      try {
        const mestreRef = doc(db, 'users', 'MESTRE');
        await setDoc(mestreRef, {
          id: 'MESTRE',
          nickname: 'Mestre do Jogo',
          role: 'Mestre',
          createdAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.warn("Could not save Mestre record to DB:", err));
        
        loginLegacy('MESTRE');
        navigate('/gm-dashboard');
      } catch (err) {
        console.error("Mestre Login Error:", err);
        loginLegacy('MESTRE');
        navigate('/gm-dashboard');
      } finally {
        setLoading(false);
      }
    } else {
      alert('Chave Mestre incorreta.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-8 backdrop-blur-xl"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sword className="text-amber-500" size={32} />
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Dark Core RPG</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
            {isGMMasterAuth ? 'Portal do Mestre' : 'Gerenciador de Fichas'}
          </p>
        </div>

        {!isGMMasterAuth ? (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Inserir seu ID</label>
                <input 
                  type="text" 
                  value={inputId}
                  onChange={(e) => {
                    setInputId(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Ex: 182305"
                  className={`w-full bg-zinc-950 border ${error ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500/50'} rounded-xl px-4 py-4 text-center font-mono text-2xl font-bold text-amber-500 outline-none transition-all shadow-inner`}
                />
                {error && (
                  <p className="text-red-500 text-[10px] font-black uppercase tracking-wider text-center mt-1">
                    {error}
                  </p>
                )}
              </div>
              <button 
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-[0.2em] py-4 rounded-xl shadow-lg transition-all active:scale-95"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="space-y-3">
              <button 
                onClick={() => setIsGMMasterAuth(true)}
                className="w-full text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-amber-500 transition-colors py-2"
              >
                Sou o Mestre
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleGMLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Chave Mestre</label>
              <input 
                type="password" 
                value={gmKey}
                onChange={(e) => setGmKey(e.target.value)}
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center font-mono text-xl font-bold text-amber-500 outline-none focus:border-amber-500/50 transition-all shadow-inner"
              />
            </div>
            <div className="space-y-3">
              <button 
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-xs tracking-[0.2em] py-4 rounded-xl shadow-lg transition-all active:scale-95"
              >
                Autenticar Mestre
              </button>
              <button 
                type="button"
                onClick={() => setIsGMMasterAuth(false)}
                className="w-full text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-white transition-colors py-2"
              >
                Voltar
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
