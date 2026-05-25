import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Folder, 
  FolderPlus, 
  Tag, 
  Trash2, 
  Edit3, 
  X, 
  FileText, 
  ChevronRight, 
  Check, 
  User, 
  BookOpen
} from 'lucide-react';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { db } from '../../firebase';
import { CampaignNote, CampaignFolder } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface CampaignNotesTabProps {
  campaignId: string;
}

// Map categories to appropriate visual themes
const CATEGORY_THEMES: Record<string, { labelBg: string; text: string; bg: string; dot: string; border: string }> = {
  'Geral': { labelBg: 'bg-zinc-950', text: 'text-zinc-300', bg: 'bg-zinc-900/40', dot: 'bg-zinc-500', border: 'border-zinc-800/80' },
  'Lore': { labelBg: 'bg-purple-950/40', text: 'text-purple-400', bg: 'bg-purple-950/10', dot: 'bg-purple-500', border: 'border-purple-800/30' },
  'NPCs': { labelBg: 'bg-emerald-950/40', text: 'text-emerald-400', bg: 'bg-emerald-950/10', dot: 'bg-emerald-500', border: 'border-emerald-800/30' },
  'Lugares': { labelBg: 'bg-sky-950/40', text: 'text-sky-400', bg: 'bg-sky-950/10', dot: 'bg-sky-500', border: 'border-sky-800/30' },
  'Regras': { labelBg: 'bg-red-950/40', text: 'text-red-400', bg: 'bg-red-950/10', dot: 'bg-red-500', border: 'border-red-800/30' },
  'Missões': { labelBg: 'bg-amber-950/40', text: 'text-amber-400', bg: 'bg-amber-950/10', dot: 'bg-amber-500', border: 'border-amber-800/30' },
  'Itens': { labelBg: 'bg-blue-950/40', text: 'text-blue-400', bg: 'bg-blue-950/10', dot: 'bg-blue-500', border: 'border-blue-800/30' },
};

export function CampaignNotesTab({ campaignId }: CampaignNotesTabProps) {
  const { user, profile } = useAuth();
  const userId = user?.uid || localStorage.getItem('shadowdark_userid') || 'anonymous';
  const isGM = userId === 'MESTRE';

  // db data states
  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [folders, setFolders] = useState<CampaignFolder[]>([]);

  // Filtering states - activeFolderId replaces selectedFolderId
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');

  // Modals / forms states
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<CampaignNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteFolderId, setNoteFolderId] = useState<string>('');
  const [noteCategory, setNoteCategory] = useState('Geral');

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<CampaignFolder | null>(null);
  const [folderName, setFolderName] = useState('');

  // Deletion confirmations
  const [noteToDelete, setNoteToDelete] = useState<CampaignNote | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<CampaignFolder | null>(null);

  const [viewingNote, setViewingNote] = useState<CampaignNote | null>(null);

  // Load folders (always loaded)
  useEffect(() => {
    if (!campaignId) return;

    // Real-time folders
    const qFolders = query(collection(db, 'campaign_folders'), where('campaignId', '==', campaignId));
    const unsubFolders = onSnapshot(qFolders, (snap) => {
      const fList: CampaignFolder[] = [];
      snap.forEach(d => {
        fList.push({ id: d.id, ...d.data() } as CampaignFolder);
      });
      setFolders(fList.sort((a, b) => a.createdAt - b.createdAt));
    }, (err) => console.error("Folders loaded error:", err));

    return () => {
      unsubFolders();
    };
  }, [campaignId]);

  // Load notes on-demand based on active folder or universal search
  useEffect(() => {
    if (!campaignId) return;

    let unsubNotes = () => {};

    const isSearching = searchText.trim() !== '';

    if (isSearching) {
      // Load all notes of the campaign for universal search
      const qNotes = query(collection(db, 'campaign_notes'), where('campaignId', '==', campaignId));
      unsubNotes = onSnapshot(qNotes, (snap) => {
        const nList: CampaignNote[] = [];
        snap.forEach(d => {
          nList.push({ id: d.id, ...d.data() } as CampaignNote);
        });
        setNotes(nList.sort((a, b) => b.updatedAt - a.updatedAt));
      }, (err) => console.error("Notes loaded error:", err));
    } else if (activeFolderId !== null) {
      // Load notes of the active folder
      let qNotes;
      if (activeFolderId === 'unassigned') {
        qNotes = query(
          collection(db, 'campaign_notes'),
          where('campaignId', '==', campaignId),
          where('folderId', '==', null)
        );
      } else {
        qNotes = query(
          collection(db, 'campaign_notes'),
          where('campaignId', '==', campaignId),
          where('folderId', '==', activeFolderId)
        );
      }

      unsubNotes = onSnapshot(qNotes, (snap) => {
        const nList: CampaignNote[] = [];
        snap.forEach(d => {
          nList.push({ id: d.id, ...d.data() } as CampaignNote);
        });
        setNotes(nList.sort((a, b) => b.updatedAt - a.updatedAt));
      }, (err) => console.error("Notes loaded error:", err));
    } else {
      // Top level overview (no folder selected, not searching): clear notes
      setNotes([]);
    }

    return () => {
      unsubNotes();
    };
  }, [campaignId, activeFolderId, searchText]);

  // Aggregate categories dynamically from all available notes
  const availableCategories = useMemo(() => {
    const predefined = ['Geral', 'Lore', 'NPCs', 'Lugares', 'Regras', 'Missões', 'Itens'];
    const activeFromNotes = notes.map(n => n.category).filter(Boolean);
    const combined = Array.from(new Set([...predefined, ...activeFromNotes]));
    return combined;
  }, [notes]);

  // Filtered notes list
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      // Search check
      const queryStr = searchText.toLowerCase();
      const matchesSearch = n.title.toLowerCase().includes(queryStr) || n.content.toLowerCase().includes(queryStr);
      if (!matchesSearch) return false;

      // Category check
      if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;

      // Folder check (only applies if we are NOT searching)
      if (searchText.trim() === '') {
        if (activeFolderId === 'unassigned') {
          return !n.folderId;
        } else if (activeFolderId !== null) {
          return n.folderId === activeFolderId;
        }
      }

      return true;
    });
  }, [notes, activeFolderId, selectedCategory, searchText]);

  // Folder helper labels
  const folderMap = useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach(f => {
      map[f.id] = f.name;
    });
    return map;
  }, [folders]);

  // Handlers for Save Note
  const openNewNoteModal = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteFolderId(activeFolderId !== null && activeFolderId !== 'unassigned' ? activeFolderId : '');
    setNoteCategory('Geral');
    setIsNoteModalOpen(true);
  };

  const openEditNoteModal = (note: CampaignNote) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteFolderId(note.folderId || '');
    setNoteCategory(note.category || 'Geral');
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    try {
      const authorName = profile?.nickname || (isGM ? 'Mestre do Jogo' : 'Explorador');
      const authorRole = isGM ? 'Mestre' : 'Jogador';
      
      const noteId = editingNote?.id || doc(collection(db, 'campaign_notes')).id;
      const noteRef = doc(db, 'campaign_notes', noteId);

      const notePayload: CampaignNote = {
        id: noteId,
        campaignId,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        folderId: noteFolderId || null,
        category: noteCategory.trim(),
        authorId: editingNote?.authorId || userId,
        authorName: editingNote?.authorName || authorName,
        authorRole: editingNote?.authorRole || authorRole,
        createdAt: editingNote?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(noteRef, notePayload, { merge: true });
      setIsNoteModalOpen(false);
      setEditingNote(null);
    } catch (err) {
      console.error("Save note error:", err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'campaign_notes', noteId));
      setNoteToDelete(null);
    } catch (err) {
      console.error("Delete note error:", err);
    }
  };

  // Handlers for Folder Management
  const openNewFolderModal = () => {
    setEditingFolder(null);
    setFolderName('');
    setIsFolderModalOpen(true);
  };

  const openEditFolderModal = (e: React.MouseEvent, folder: CampaignFolder) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setFolderName(folder.name);
    setIsFolderModalOpen(true);
  };

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    try {
      const fId = editingFolder?.id || doc(collection(db, 'campaign_folders')).id;
      const fRef = doc(db, 'campaign_folders', fId);

      const folderPayload: CampaignFolder = {
        id: fId,
        campaignId,
        name: folderName.trim(),
        createdAt: editingFolder?.createdAt || Date.now()
      };

      await setDoc(fRef, folderPayload, { merge: true });
      setIsFolderModalOpen(false);
      setEditingFolder(null);
    } catch (err) {
      console.error("Save folder error:", err);
    }
  };

  const handleDeleteFolder = async (fId: string) => {
    try {
      // Find notes locked in this folder, and detach them (set folderId to null)
      const qOrphans = query(
        collection(db, 'campaign_notes'),
        where('campaignId', '==', campaignId),
        where('folderId', '==', fId)
      );
      const querySnap = await getDocs(qOrphans);
      const batchPromises: Promise<any>[] = [];
      querySnap.forEach((docSnap) => {
        batchPromises.push(updateDoc(doc(db, 'campaign_notes', docSnap.id), { folderId: null }));
      });
      await Promise.all(batchPromises);

      // Delete the folder record
      await deleteDoc(doc(db, 'campaign_folders', fId));
      setFolderToDelete(null);
      if (activeFolderId === fId) {
        setActiveFolderId(null);
      }
    } catch (err) {
      console.error("Delete folder error:", err);
    }
  };

  // Helper theme retriever
  const getTheme = (cat: string) => {
    return CATEGORY_THEMES[cat] || {
      labelBg: 'bg-zinc-900',
      text: 'text-amber-500/80',
      bg: 'bg-zinc-950/10',
      dot: 'bg-amber-500/55',
      border: 'border-zinc-800/80'
    };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 text-zinc-100">
      {/* LEFT COLUMN: Categories Sidebar */}
      <div className="md:col-span-3 space-y-6">
        {/* Categories Sidebar Selection */}
        <div className="bg-zinc-950/40 border border-zinc-900/80 p-5 rounded-3xl space-y-4">
          <h3 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest flex items-center gap-2">
            <Tag size={14} className="text-zinc-500" />
            Categorias
          </h3>

          <div className="flex flex-wrap md:flex-col gap-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-[10px] uppercase font-black tracking-widest transition-all ${
                selectedCategory === 'all'
                  ? 'bg-zinc-900 text-amber-500 border-l-2 border-amber-500'
                  : 'bg-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              🏷️ Todas as Categorias
            </button>

            {availableCategories.map(cat => {
              const theme = getTheme(cat);
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-[10px] uppercase font-black tracking-widest transition-all ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-l-2 border-amber-500'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Notes Search, Folders and Grid */}
      <div className="md:col-span-9 space-y-6">
        {/* Action and Search Panel */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
          {/* Searching */}
          <div className="relative flex-1 max-w-md group/search">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within/search:text-amber-500 transition-colors" size={16} />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar pelo título ou conteúdo..."
              className="w-full bg-zinc-950 border border-zinc-900/80 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-zinc-300 placeholder-zinc-600 outline-none focus:border-amber-500/50 focus:bg-zinc-900/30 transition-all shadow"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={openNewFolderModal}
              className="bg-zinc-900 border border-zinc-800 hover:border-amber-500 hover:bg-amber-500/10 text-zinc-300 hover:text-amber-500 text-[10px] font-black uppercase tracking-widest py-3 px-5 rounded-2xl transition-all shadow active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderPlus size={14} /> Nova Pasta
            </button>
            <button
              onClick={openNewNoteModal}
              className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest py-3 px-5 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={14} /> Nova Nota
            </button>
          </div>
        </div>

        {/* If searching: show notes list regardless of folder borders */}
        {searchText.trim() !== '' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <span>Resultados de busca para:</span>
              <span className="text-amber-500">"{searchText}"</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredNotes.map(note => {
                const theme = getTheme(note.category);
                return (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setViewingNote(note)}
                    className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700/85 p-5 rounded-3xl flex flex-col gap-4 relative overflow-hidden group shadow-md transition-all h-[240px] hover:shadow-lg cursor-pointer hover:bg-zinc-900/40"
                  >
                    {/* Note metadata headers: Category and Folder */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${theme.labelBg} ${theme.text} border ${theme.border}`}>
                        {note.category || 'Geral'}
                      </span>

                      <span className="text-[8px] font-mono font-black text-zinc-500 uppercase tracking-widest truncate max-w-[120px]" title={note.folderId ? `Pasta: ${folderMap[note.folderId] || ''}` : 'Sem pasta'}>
                        📁 {note.folderId ? folderMap[note.folderId] || 'Local' : 'Sem pasta'}
                      </span>
                    </div>

                    {/* Title and Content */}
                    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                      <h4 className="text-sm font-black italic uppercase tracking-tighter text-white truncate group-hover:text-amber-500 transition-colors">
                        {note.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 font-bold leading-relaxed overflow-hidden text-ellipsis line-clamp-5 whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>

                    {/* Footer with actions and author stamp */}
                    <div className="border-t border-zinc-900 pt-3 flex items-center justify-between gap-4 mt-auto" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 min-w-0" title={`Por ${note.authorName} (${note.authorRole})`}>
                        <div className="w-5 h-5 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center">
                          <User size={10} className="text-zinc-600" />
                        </div>
                        <span className="text-[9px] text-zinc-500 font-bold truncate">
                          {note.authorName}
                          {note.authorRole === 'Mestre' && (
                            <span className="text-amber-500 text-[8px] font-black font-mono ml-0.5 tracking-tight">[DM]</span>
                          )}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 text-zinc-500">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditNoteModal(note);
                          }}
                          className="p-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-500 rounded-lg transition-all active:scale-90 cursor-pointer"
                          title="Editar Anotação"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoteToDelete(note);
                          }}
                          className="p-1.5 bg-zinc-950 border border-zinc-800 hover:border-red-900/40 text-zinc-400 hover:text-red-500 rounded-lg transition-all active:scale-90 cursor-pointer"
                          title="Excluir Anotação"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {filteredNotes.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center bg-zinc-950/20 border border-zinc-900 border-dashed rounded-3xl">
                  <BookOpen size={36} className="text-zinc-800 mb-3" />
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-600 italic">
                    Nenhuma anotação encontrada na busca
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Normal folders-based navigation mode */
          <div className="space-y-6">
            {activeFolderId === null ? (
              /* Folders Top Level List View */
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider">
                    Suas Pastas e Seções
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Folders List */}
                  {folders.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setActiveFolderId(f.id)}
                      className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700/80 p-5 rounded-3xl flex flex-col justify-between relative overflow-hidden group shadow-md transition-all h-[180px] hover:shadow-lg cursor-pointer hover:bg-zinc-900/40"
                    >
                      <div className="flex items-start justify-between">
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl">
                          <Folder size={24} />
                        </div>
                        {/* Folder Action buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => openEditFolderModal(e, f)}
                            className="p-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-500 rounded-lg transition-all cursor-pointer"
                            title="Renomear Pasta"
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderToDelete(f);
                            }}
                            className="p-1.5 bg-zinc-950 border border-zinc-800 hover:border-red-900/40 text-zinc-400 hover:text-red-500 rounded-lg transition-all cursor-pointer"
                            title="Excluir Pasta"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-black uppercase tracking-wider text-white group-hover:text-amber-500 transition-colors truncate">
                          {f.name}
                        </h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">
                          Clique para ver as anotações
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Notas sem Pasta Card */}
                  <div
                    onClick={() => setActiveFolderId('unassigned')}
                    className="bg-zinc-900/30 border border-zinc-800/60 border-dashed hover:border-zinc-750 p-5 rounded-3xl flex flex-col justify-between relative overflow-hidden group shadow-md transition-all h-[180px] hover:shadow-lg cursor-pointer hover:bg-zinc-900/40"
                  >
                    <div className="p-3 bg-zinc-800/20 border border-zinc-800 text-zinc-400 rounded-2xl w-fit">
                      <FileText size={24} />
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-black uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors truncate">
                        Sem Pasta
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">
                        Anotações avulsas e soltas
                      </p>
                    </div>
                  </div>
                </div>

                {folders.length === 0 && (
                  <div className="py-12 flex flex-col items-center justify-center bg-zinc-950/20 border border-zinc-900 border-dashed rounded-3xl mt-2 text-center px-4">
                    <FolderPlus size={32} className="text-zinc-800 mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500 italic max-w-sm leading-relaxed">
                      Crie pastas para organizar suas anotações corporativas, lore de Phandalin e monstros!
                    </p>
                    <button
                      onClick={openNewFolderModal}
                      className="mt-3 text-[10px] font-black uppercase text-amber-500/80 hover:text-amber-500 tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus size={12} /> Criar a Primeira Pasta
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Inside Selected Folder View */
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900/80 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveFolderId(null)}
                      className="text-[10px] font-black uppercase text-zinc-500 hover:text-amber-500 bg-zinc-900/45 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      ← Voltar para as Pastas
                    </button>
                    
                    <span className="text-zinc-600 font-bold text-xs uppercase">/</span>
                    
                    <div className="flex items-center gap-1.5 text-xs text-white uppercase tracking-wider font-extrabold italic">
                      📁 {activeFolderId === 'unassigned' ? 'Anotações Sem Pasta' : folderMap[activeFolderId]}
                    </div>
                  </div>
                </div>

                {/* Notes Grid of this specific folder */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredNotes.map(note => {
                    const theme = getTheme(note.category);
                    return (
                      <motion.div
                        key={note.id}
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => setViewingNote(note)}
                        className="bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700/85 p-5 rounded-3xl flex flex-col gap-4 relative overflow-hidden group shadow-md transition-all h-[240px] hover:shadow-lg cursor-pointer hover:bg-zinc-900/40"
                      >
                        {/* Note metadata headers: Category and Folder */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${theme.labelBg} ${theme.text} border ${theme.border}`}>
                            {note.category || 'Geral'}
                          </span>
                        </div>

                        {/* Title and Content */}
                        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                          <h4 className="text-sm font-black italic uppercase tracking-tighter text-white truncate group-hover:text-amber-500 transition-colors">
                            {note.title}
                          </h4>
                          <p className="text-[11px] text-zinc-400 font-bold leading-relaxed overflow-hidden text-ellipsis line-clamp-5 whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>

                        {/* Footer with actions and author stamp */}
                        <div className="border-t border-zinc-900 pt-3 flex items-center justify-between gap-4 mt-auto" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 min-w-0" title={`Por ${note.authorName} (${note.authorRole})`}>
                            <div className="w-5 h-5 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center">
                              <User size={10} className="text-zinc-600" />
                            </div>
                            <span className="text-[9px] text-zinc-500 font-bold truncate">
                              {note.authorName}
                              {note.authorRole === 'Mestre' && (
                                <span className="text-amber-500 text-[8px] font-black font-mono ml-0.5 tracking-tight">[DM]</span>
                              )}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 text-zinc-500">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditNoteModal(note);
                              }}
                              className="p-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-500 rounded-lg transition-all active:scale-90 cursor-pointer"
                              title="Editar Anotação"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNoteToDelete(note);
                              }}
                              className="p-1.5 bg-zinc-950 border border-zinc-800 hover:border-red-900/40 text-zinc-400 hover:text-red-500 rounded-lg transition-all active:scale-90 cursor-pointer"
                              title="Excluir Anotação"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {filteredNotes.length === 0 && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center bg-zinc-950/20 border border-zinc-900 border-dashed rounded-3xl">
                      <BookOpen size={36} className="text-zinc-800 mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-600 italic text-center px-4 leading-relaxed">
                        Nenhuma anotação encontrada nesta pasta.
                      </p>
                      <button
                        onClick={openNewNoteModal}
                        className="mt-3 text-[10px] font-black uppercase text-amber-500/80 hover:text-amber-500 tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus size={12} /> Adicionar Nota Aqui
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FORM MODAL: Create & Edit Note */}
      <AnimatePresence>
        {isNoteModalOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-zinc-900 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <form onSubmit={handleSaveNote} className="flex flex-col h-full max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-zinc-900 flex items-center justify-between pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-500">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
                        {editingNote ? 'Editar Anotação' : 'Nova Anotação'}
                      </h3>
                      <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">
                        Qualquer jogador ou mestre da campanha poderá ler e editar
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNoteModalOpen(false)}
                    className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Form Fields container */}
                <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Título do Card</label>
                    <input
                      type="text"
                      required
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Ex: Segredos da Ruína, Nome do NPC, Pista"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500/40 transition-all font-sans"
                    />
                  </div>

                  {/* Organizing Layout (Folder and category side by side) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Folder dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Arquivar na Pasta</label>
                      <select
                        value={noteFolderId}
                        onChange={(e) => setNoteFolderId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-zinc-300 outline-none focus:border-amber-500/40 transition-all cursor-pointer"
                      >
                        <option value="">Sem Pasta (Vazio)</option>
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>{f.name.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    {/* Category Selector/Input */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Categoria</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={noteCategory}
                          onChange={(e) => setNoteCategory(e.target.value)}
                          placeholder="Digite ou escolha uma abaixo..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-zinc-300 outline-none focus:border-amber-500/40 transition-all"
                        />
                      </div>
                      
                      {/* Suggestion tags */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {['Geral', 'Lore', 'NPCs', 'Lugares', 'Regras', 'Missões', 'Itens'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setNoteCategory(tag)}
                            className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-colors ${
                              noteCategory === tag 
                                ? 'bg-amber-500 text-black' 
                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Text Content Block */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Anotações e Conteúdo Livre</label>
                    <textarea
                      required
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Escreva seus relatórios, lore do mundo, regras customizadas ou sumário de sessões..."
                      rows={8}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs font-bold text-zinc-300 placeholder-zinc-700 outline-none focus:border-amber-500/40 transition-all font-sans resize-y min-h-[150px] leading-relaxed"
                    />
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="p-6 bg-zinc-950/80 border-t border-zinc-900 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest py-3.5 rounded-xl transition-all hover:shadow shadow-amber-950/25 active:scale-95 cursor-pointer"
                  >
                    Salvar Notas
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNoteModalOpen(false)}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest py-3.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FORM MODAL: Create & Edit Folder */}
      <AnimatePresence>
        {isFolderModalOpen && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl"
            >
              <div className="space-y-1">
                <h4 className="text-base font-black text-white italic uppercase tracking-wider flex items-center gap-2">
                  <FolderPlus size={16} className="text-amber-500" />
                  {editingFolder ? 'Renomear Pasta' : 'Nova Pasta'}
                </h4>
                <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">
                  Agrupe suas anotações por sessão ou assunto
                </p>
              </div>

              <form onSubmit={handleSaveFolder} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-zinc-600">Nome da Pasta</label>
                  <input
                    type="text"
                    required
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Ex: Sessão 01, Lore de Phandalin"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-500/45 transition-all text-center uppercase"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[9px] tracking-widest py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFolderModalOpen(false)}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-black uppercase text-[9px] tracking-widest py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM MODAL: Delete Note */}
      <AnimatePresence>
        {noteToDelete && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl text-center"
            >
              <div className="space-y-2">
                <div className="w-12 h-12 bg-red-950/30 border border-red-900/30 text-red-500 flex items-center justify-center rounded-2xl mx-auto">
                  <Trash2 size={20} />
                </div>
                <h4 className="text-base font-black text-red-500 uppercase italic">Excluir Anotação</h4>
                <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                  Você tem certeza que deseja excluir o card de anotação <span className="text-white font-bold">"{noteToDelete.title}"</span>? 
                  Esta operação é definitiva e apagará as anotações do banco de dados.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleDeleteNote(noteToDelete.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[9px] tracking-widest py-3 rounded-xl transition-all cursor-pointer"
                >
                  Excluir
                </button>
                <button
                  onClick={() => setNoteToDelete(null)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-black uppercase text-[9px] tracking-widest py-3 rounded-xl transition-all cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM MODAL: Delete Folder */}
      <AnimatePresence>
        {folderToDelete && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl text-center"
            >
              <div className="space-y-2">
                <div className="w-12 h-12 bg-red-950/30 border border-red-900/30 text-red-500 flex items-center justify-center rounded-2xl mx-auto">
                  <Folder size={20} className="text-red-500" />
                </div>
                <h4 className="text-base font-black text-red-500 uppercase italic">Excluir Pasta</h4>
                <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                  Você tem certeza que deseja deletar a pasta <span className="text-white font-black">"{folderToDelete.name}"</span>?
                </p>
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-500 font-bold uppercase leading-relaxed text-left">
                  💡 NOTA: As notas arquivadas nesta pasta NÁO serão perdidas. Elas apenas serão movidas de volta para "Sem Pasta" (uncategorized).
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleDeleteFolder(folderToDelete.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[9px] tracking-widest py-3 rounded-xl transition-all cursor-pointer"
                >
                  Confirmar Exclusão
                </button>
                <button
                  onClick={() => setFolderToDelete(null)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-black uppercase text-[9px] tracking-widest py-3 rounded-xl transition-all cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILED VIEW MODAL: Read Note */}
      <AnimatePresence>
        {viewingNote && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-zinc-900 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-900 flex items-center justify-between pb-4">
                <div className="flex items-center gap-3 pr-4">
                  <div className={`p-2.5 rounded-xl border ${getTheme(viewingNote.category).labelBg} ${getTheme(viewingNote.category).border} ${getTheme(viewingNote.category).text}`}>
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white uppercase italic tracking-tighter truncate">
                      {viewingNote.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${getTheme(viewingNote.category).labelBg} ${getTheme(viewingNote.category).text} border ${getTheme(viewingNote.category).border}`}>
                        {viewingNote.category || 'Geral'}
                      </span>
                      {viewingNote.folderId && (
                        <span className="text-[8px] font-mono font-black text-zinc-500 uppercase tracking-widest">
                          📁 {folderMap[viewingNote.folderId] || 'Local'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingNote(null)}
                  className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all cursor-pointer flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 max-h-[50vh]">
                <div className="text-xs text-zinc-300 font-bold leading-relaxed whitespace-pre-wrap font-sans">
                  {viewingNote.content}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-zinc-950/80 border-t border-zinc-900 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={12} className="text-zinc-500" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-zinc-400 font-bold leading-tight truncate">
                      {viewingNote.authorName}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-black uppercase tracking-wider truncate">
                      {viewingNote.authorRole} • {new Date(viewingNote.updatedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const noteToEdit = viewingNote;
                      setViewingNote(null);
                      openEditNoteModal(noteToEdit);
                    }}
                    className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-amber-500 font-black uppercase text-[9px] tracking-widest py-2.5 px-4 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 size={12} /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingNote(null)}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[9px] tracking-widest py-2.5 px-5 rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
