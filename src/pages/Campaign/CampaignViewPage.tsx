import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  History,
  Plus,
  Users,
  User,
  X,
  Award,
  Bed,
  Check,
  ChevronRight,
  Swords,
  Backpack,
  Flame,
} from "lucide-react";
import {
  doc,
  onSnapshot,
  query,
  collection,
  where,
  updateDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { Campaign, CharacterState, RollLog, ATTR_LABELS } from "../../types";
import {
  sanitizeCharacter,
  getStressColor,
  getModifier,
  formatModifier,
} from "../../utils/characterUtils";
import { handleFirestoreError, OperationType } from "../../utils/errorUtils";
import { CharacterSearchModal } from "../../components/modals/CharacterSearchModal";
import { UserSearchModal } from "../../components/modals/UserSearchModal";
import { CampaignNotesTab } from "../../components/Campaign/CampaignNotesTab";
import { ARMOR_VALUES } from "../../constants";
import { useAuth } from "../../contexts/AuthContext";

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const CircularProgress = ({
  value,
  max,
  active,
}: {
  value: number;
  max: number;
  active: boolean;
}) => {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / max) * circumference;
  const dashoffset = circumference - progress;

  return (
    <div className="flex items-center gap-1.5 bg-zinc-950/50 border border-zinc-800/50 px-2 py-1.5 rounded-xl">
      <div className="relative w-6 h-6 flex items-center justify-center">
        <svg className={`w-6 h-6 -rotate-90 ${active ? "animate-pulse" : ""}`}>
          <circle
            cx="12"
            cy="12"
            r={radius}
            className="stroke-zinc-800 fill-none"
            strokeWidth="2.5"
          />
          <circle
            cx="12"
            cy="12"
            r={radius}
            className="stroke-amber-500 fill-none transition-all duration-300"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Flame
            size={8}
            className={active ? "text-amber-500" : "text-zinc-700"}
          />
        </div>
      </div>
      <span
        className={`text-[9px] font-mono font-black ${active ? "text-amber-500" : "text-zinc-500"}`}
      >
        {formatTime(value)}
      </span>
    </div>
  );
};

export function CampaignViewPage() {
  const { id } = useParams<{ id: string }>();
  const campaignId = id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || localStorage.getItem("shadowdark_userid") || null;
  const isGM = userId === "MESTRE";
  const mode = isGM ? "gm" : "player";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const [rolls, setRolls] = useState<RollLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddingChars, setIsAddingChars] = useState(false);
  const [isAddingPlayers, setIsAddingPlayers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [removingCharId, setRemovingCharId] = useState<string | null>(null);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);
  const [removeInput, setRemoveInput] = useState("");

  const [sidebarTab, setSidebarTab] = useState<"history" | "players">(
    "history",
  );

  const [activeMainTab, setActiveMainTab] = useState<
    "fichas" | "combate" | "recursos" | "anotacoes"
  >("fichas");
  const [mobileTab, setMobileTab] = useState<"fichas" | "historico">("fichas");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("shadowdark_sidebar_collapsed") === "true";
  });
  const [hasNewRolls, setHasNewRolls] = useState<boolean>(false);

  const isSidebarCollapsedRef = React.useRef(isSidebarCollapsed);
  const mobileTabRef = React.useRef(mobileTab);
  const isFirstRollLoadRef = React.useRef(true);
  const seenRollIdsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    isSidebarCollapsedRef.current = isSidebarCollapsed;
  }, [isSidebarCollapsed]);

  useEffect(() => {
    mobileTabRef.current = mobileTab;
  }, [mobileTab]);

  const [localLightingState, setLocalLightingState] = useState<
    Record<string, Record<string, number>>
  >({});
  const [timeOffset, setTimeOffset] = useState(0);

  useEffect(() => {
    // Attempt to sync time with a public API to get server offset
    const syncTime = async () => {
      try {
        const start = Date.now();
        const response = await fetch(
          "https://worldtimeapi.org/api/timezone/Etc/UTC",
        );
        const data = await response.json();
        const serverTime = new Date(data.utc_datetime).getTime();
        const end = Date.now();
        const latency = (end - start) / 2;
        setTimeOffset(serverTime - (end - latency));
      } catch (e) {
        console.warn("Could not sync with server time, using local clock", e);
      }
    };
    syncTime();
  }, []);

  useEffect(() => {
    if (characters.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now() + timeOffset;
      const updatedTotal: Record<string, Record<string, number>> = {};

      characters.forEach((char) => {
        const charLighting: Record<string, number> = {};
        char.inventory?.forEach((item) => {
          if (item.category === "Iluminação") {
            if (item.lightIsActive && item.lightStartedAt) {
              const elapsed = (now - item.lightStartedAt) / 1000;
              charLighting[item.id] = Math.max(
                0,
                (item.lightRemaining || 0) - elapsed,
              );
            } else {
              charLighting[item.id] = item.lightRemaining || 0;
            }
          }
        });
        updatedTotal[char.id] = charLighting;
      });

      setLocalLightingState(updatedTotal);
    }, 1000);

    return () => clearInterval(interval);
  }, [characters, timeOffset]);

  const [isBulkXPModalOpen, setIsBulkXPModalOpen] = useState(false);
  const [isBulkRestModalOpen, setIsBulkRestModalOpen] = useState(false);
  const [bulkXPValue, setBulkXPValue] = useState(0);
  const [selectedBulkCharIds, setSelectedBulkCharIds] = useState<string[]>([]);

  const handleBulkXP = async () => {
    if (bulkXPValue <= 0 || selectedBulkCharIds.length === 0 || !campaignId)
      return;
    try {
      const selectedChars = characters.filter((c) =>
        selectedBulkCharIds.includes(c.id),
      );
      for (const char of selectedChars) {
        await updateDoc(doc(db, "characters", char.id), {
          xp: char.xp + bulkXPValue,
        });
      }

      // Unified Log
      const rollRef = doc(collection(db, "rolls"));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: `campaign-${campaignId}`,
        characterName: "Mestre",
        userId: userId || "gm",
        type: "normal",
        value: bulkXPValue,
        modifier: 0,
        label: `Distribuído ${bulkXPValue} XP para: ${selectedChars.map((c) => c.name).join(", ")}`,
        timestamp: Date.now(),
        advantageMode: "none",
      });

      setIsBulkXPModalOpen(false);
      setBulkXPValue(0);
      setSelectedBulkCharIds([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "characters_bulk_xp");
    }
  };

  const handleBulkRest = async () => {
    if (selectedBulkCharIds.length === 0 || !campaignId) return;
    try {
      const selectedChars = characters.filter((c) =>
        selectedBulkCharIds.includes(c.id),
      );
      for (const char of selectedChars) {
        await updateDoc(doc(db, "characters", char.id), {
          "hp.current": char.hp.max,
        });
      }

      // Unified Log
      const rollRef = doc(collection(db, "rolls"));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: `campaign-${campaignId}`,
        characterName: "Mestre",
        userId: userId || "gm",
        type: "normal",
        value: 0,
        modifier: 0,
        label: `Descanso Coletivo realizado para: ${selectedChars.map((c) => c.name).join(", ")}`,
        timestamp: Date.now(),
        advantageMode: "none",
      });

      setIsBulkRestModalOpen(false);
      setSelectedBulkCharIds([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "characters_bulk_rest");
    }
  };

  const handleAddCharacter = async (charId: string) => {
    try {
      if (!campaign || !campaignId) return;
      const newCharIds = [...campaign.characterIds, charId];
      await updateDoc(doc(db, "campaigns", campaignId), {
        characterIds: newCharIds,
      });
      await updateDoc(doc(db, "characters", charId), {
        campaignId: campaignId,
      });
      setIsAddingChars(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    }
  };

  const handleRemovePlayer = async () => {
    if (!removingPlayerId || removeInput !== "REMOVER" || !campaignId) return;
    try {
      if (!campaign) return;
      const uId = removingPlayerId;
      const newPlayerIds = campaign.playerIds.filter((id) => id !== uId);

      const q = query(
        collection(db, "characters"),
        where("campaignId", "==", campaignId),
        where("userId", "==", uId),
      );
      const snap = await getDocs(q);
      const charsToRemoveIds = snap.docs.map((d) => d.id);

      const newCharIds = campaign.characterIds.filter(
        (id) => !charsToRemoveIds.includes(id),
      );

      await updateDoc(doc(db, "campaigns", campaignId), {
        playerIds: newPlayerIds,
        characterIds: newCharIds,
      });

      for (const d of snap.docs) {
        await updateDoc(d.ref, { campaignId: null });
      }
      setRemovingPlayerId(null);
      setRemoveInput("");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    }
  };

  const handleAddPlayer = async (uId: string) => {
    try {
      if (!campaign || !campaignId) return;

      if (campaign.playerIds.includes(uId)) {
        setRemovingPlayerId(uId);
        setRemoveInput("");
        setIsAddingPlayers(false);
        return;
      }

      const newPlayerIds = [...campaign.playerIds, uId];
      await updateDoc(doc(db, "campaigns", campaignId), {
        playerIds: newPlayerIds,
      });
      setIsAddingPlayers(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    }
  };

  const handleClearHistory = async () => {
    if (!campaignId) return;
    try {
      const allToClearIds = [
        `campaign-${campaignId}`,
        ...characters.map((c) => c.id),
      ];

      // Firestore 'in' query limit is 30
      const CHUNK_SIZE = 10;
      for (let i = 0; i < allToClearIds.length; i += CHUNK_SIZE) {
        const chunk = allToClearIds.slice(i, i + CHUNK_SIZE);
        const q = query(
          collection(db, "rolls"),
          where("characterId", "in", chunk),
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      }

      setRolls([]);
    } catch (e) {
      console.error("Failed to clear campaign history:", e);
    }
  };

  const handleRemoveCharacter = async () => {
    if (!removingCharId || removeInput !== "REMOVER" || !campaignId) return;
    try {
      if (!campaign) return;
      const newCharIds = campaign.characterIds.filter(
        (id) => id !== removingCharId,
      );
      await updateDoc(doc(db, "campaigns", campaignId), {
        characterIds: newCharIds,
      });
      await updateDoc(doc(db, "characters", removingCharId), {
        campaignId: null,
      });
      setRemovingCharId(null);
      setRemoveInput("");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    }
  };

  useEffect(() => {
    if (!campaignId) return;

    // 1. Fetch Campaign
    const unsubCamp = onSnapshot(
      doc(db, "campaigns", campaignId),
      (docSnap) => {
        if (docSnap.exists()) {
          setCampaign(docSnap.data() as Campaign);
        }
      },
    );

    // 2. Real-time Characters
    const qChars = query(
      collection(db, "characters"),
      where("campaignId", "==", campaignId),
    );
    const unsubChars = onSnapshot(
      qChars,
      (snap) => {
        const chars: CharacterState[] = [];
        snap.forEach((d) => {
          chars.push(sanitizeCharacter(d.data(), d.id));
        });
        setCharacters(chars);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, "characters"),
    );

    // 3. Real-time Rolls
    const qRolls = query(
      collection(db, "rolls"),
      where("timestamp", ">", Date.now() - 3600000), // Last hour
    );
    const unsubRolls = onSnapshot(
      qRolls,
      (snap) => {
        const allLogs: RollLog[] = [];
        snap.forEach((d) => {
          allLogs.push({ id: d.id, ...d.data() } as RollLog);
        });

        const filtered = allLogs
          .filter(
            (l) =>
              characters.some((c) => c.id === l.characterId) ||
              l.characterId === `campaign-${campaignId}`,
          )
          .sort((a, b) => b.timestamp - a.timestamp);

        let hasNew = false;
        if (!isFirstRollLoadRef.current) {
          const isRetracted = isSidebarCollapsedRef.current || mobileTabRef.current === "fichas";
          filtered.forEach((roll) => {
            if (!seenRollIdsRef.current.has(roll.id)) {
              seenRollIdsRef.current.add(roll.id);
              if (isRetracted) {
                hasNew = true;
              }
            }
          });
        } else {
          filtered.forEach((roll) => {
            seenRollIdsRef.current.add(roll.id);
          });
          isFirstRollLoadRef.current = false;
        }

        setRolls(filtered);
        if (hasNew) {
          setHasNewRolls(true);
        }
      },
      (err) => console.error("Rolls error:", err),
    );

    return () => {
      unsubCamp();
      unsubChars();
      unsubRolls();
    };
  }, [campaignId, characters.length]);

  return (
    <div className="min-h-screen bg-[#0c0c0e] flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar: History */}
      <aside className={`w-full border-b md:border-b-0 md:border-r border-zinc-800 bg-[#09090b] flex flex-col order-2 md:order-1 h-full overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "md:w-16" : "md:w-80"} ${mobileTab === "historico" ? "flex" : "hidden md:flex"}`}>
        {isSidebarCollapsed ? (
          /* Collapsed Sidebar on Desktop */
          <div className="hidden md:flex flex-col items-center h-full py-4 gap-6 select-none">
            {/* Expand Button */}
            <button
              onClick={() => {
                setIsSidebarCollapsed(false);
                localStorage.setItem("shadowdark_sidebar_collapsed", "false");
                setHasNewRolls(false);
              }}
              className="p-3 text-zinc-500 hover:text-white hover:bg-zinc-900/50 rounded-xl transition-all cursor-pointer relative"
              title="Expandir Menu"
            >
              <ChevronRight size={18} />
            </button>
            
            <div className="w-full h-[1px] bg-zinc-900" />
            
            {/* History Toggle Button */}
            <button
              onClick={() => {
                setIsSidebarCollapsed(false);
                localStorage.setItem("shadowdark_sidebar_collapsed", "false");
                setSidebarTab("history");
                setHasNewRolls(false);
              }}
              className="relative p-3.5 hover:bg-zinc-900/50 rounded-xl transition-all cursor-pointer group"
              title="Histórico"
            >
              <History size={18} className={sidebarTab === "history" ? "text-amber-500" : "text-zinc-500 group-hover:text-zinc-200"} />
              {hasNewRolls && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse border-2 border-zinc-950" />
              )}
            </button>

            {/* Players Toggle Button */}
            <button
              onClick={() => {
                setIsSidebarCollapsed(false);
                localStorage.setItem("shadowdark_sidebar_collapsed", "false");
                setSidebarTab("players");
                setHasNewRolls(false);
              }}
              className="p-3.5 hover:bg-zinc-900/50 rounded-xl transition-all cursor-pointer group"
              title="Jogadores"
            >
              <Users size={18} className={sidebarTab === "players" ? "text-amber-500" : "text-zinc-500 group-hover:text-zinc-200"} />
            </button>
          </div>
        ) : null}

        <div className={`flex-1 flex flex-col h-full ${isSidebarCollapsed ? "md:hidden" : "flex"}`}>
          {/* Tabs */}
          <div className="flex border-b border-zinc-900 justify-between items-center px-1">
            <div className="flex flex-1">
              <button
                onClick={() => setSidebarTab("history")}
                className={`flex-1 py-4 text-[10px] uppercase font-black tracking-widest transition-all relative ${sidebarTab === "history" ? "text-amber-500 bg-zinc-900/50" : "text-zinc-600 hover:text-zinc-400"}`}
              >
                Histórico
                {sidebarTab === "history" && (
                  <motion.div
                    layoutId="sidebarTab"
                    className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500"
                  />
                )}
              </button>
              <button
                onClick={() => setSidebarTab("players")}
                className={`flex-1 py-4 text-[10px] uppercase font-black tracking-widest transition-all relative ${sidebarTab === "players" ? "text-amber-500 bg-zinc-900/50" : "text-zinc-600 hover:text-zinc-400"}`}
              >
                Jogadores
                {sidebarTab === "players" && (
                  <motion.div
                    layoutId="sidebarTab"
                    className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500"
                  />
                )}
              </button>
            </div>
            
            <button
              onClick={() => {
                setIsSidebarCollapsed(true);
                localStorage.setItem("shadowdark_sidebar_collapsed", "true");
              }}
              className="hidden md:flex p-2 text-zinc-600 hover:text-white rounded-lg hover:bg-zinc-900/50 transition-colors ml-1 cursor-pointer mr-1"
              title="Retrair Menu"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

        <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 scrollbar-hide">
          <AnimatePresence mode="wait">
            {sidebarTab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <History size={14} />
                    <h2 className="text-[10px] uppercase font-black tracking-widest">
                      Registros
                    </h2>
                  </div>
                  {mode === "gm" && (
                    <button
                      onClick={handleClearHistory}
                      className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[7px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 hover:border-rose-500/30 transition-all"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {rolls.length === 0 && (
                    <p className="text-zinc-700 text-[10px] uppercase font-bold text-center py-8 italic">
                      Sem registros
                    </p>
                  )}
                  <AnimatePresence mode="popLayout">
                    {rolls.slice(0, 20).map((roll) => (
                      <motion.div
                        key={roll.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`border rounded-xl p-3 space-y-2 group transition-colors ${
                          roll.type === "virtue"
                            ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50"
                            : roll.type === "crit-success" ||
                                roll.type === "sanity-success"
                              ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                              : roll.type === "crit-fail" ||
                                  roll.type === "sanity-fail"
                                ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40"
                                : "bg-zinc-900 border-zinc-800/50 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-black uppercase text-amber-500 leading-none truncate max-w-[120px]">
                            {roll.characterName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {roll.type === "virtue" ? (
                              <span className="text-[7px] font-black uppercase px-1 rounded border leading-none py-0.5 text-amber-500 border-amber-500/30 bg-amber-500/5">
                                VIRTUDE
                              </span>
                            ) : roll.type === "sanity-success" ||
                              roll.type === "sanity-fail" ? (
                              <span
                                className={`text-[7px] font-black uppercase px-1 rounded border leading-none py-0.5 ${
                                  roll.type === "sanity-success"
                                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                                    : "text-rose-500 border-rose-500/30 bg-rose-500/5"
                                }`}
                              >
                                {roll.type === "sanity-success"
                                  ? "SUCESSO"
                                  : "FRACASSO"}
                              </span>
                            ) : (
                              roll.advantageMode &&
                              roll.advantageMode !== "none" && (
                                <span
                                  className={`text-[7px] font-black uppercase px-1 rounded border leading-none py-0.5 ${
                                    roll.advantageMode === "advantage"
                                      ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                                      : "text-rose-500 border-rose-500/30 bg-rose-500/5"
                                  }`}
                                >
                                  {roll.advantageMode === "advantage"
                                    ? "VAN"
                                    : "DES"}
                                </span>
                              )
                            )}
                            <span className="text-[8px] font-mono text-zinc-700">
                              {new Date(roll.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`text-xl font-black font-mono ${
                              roll.type === "crit-success" ||
                              roll.type === "sanity-success"
                                ? "text-emerald-400"
                                : roll.type === "crit-fail" ||
                                    roll.type === "sanity-fail"
                                  ? "text-rose-500"
                                  : roll.type === "virtue"
                                    ? "text-amber-500"
                                    : "text-zinc-200"
                            }`}
                          >
                            {(roll.value || 0) + (roll.modifier || 0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] uppercase font-black text-zinc-500 leading-none truncate">
                              {roll.label}
                            </div>
                            <div className="text-[7px] font-mono text-zinc-700 leading-none">
                              d20({roll.value}){roll.modifier >= 0 ? "+" : ""}
                              {roll.modifier}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {sidebarTab === "players" && (
              <motion.div
                key="players"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Users size={14} />
                      <h2 className="text-[10px] uppercase font-black tracking-widest">
                        Ações
                      </h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {mode === "gm" && (
                      <button
                        onClick={() => setIsAddingPlayers(true)}
                        className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 p-3 rounded-xl text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all"
                      >
                        <Plus size={14} /> Adicionar Jogador
                      </button>
                    )}
                    <button
                      onClick={() => setIsAddingChars(true)}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 p-3 rounded-xl text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all"
                    >
                      <Plus size={14} /> Vincular Ficha
                    </button>
                  </div>
                </div>

                <div className="space-y-4 border-t border-zinc-900 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Users size={14} />
                      <h2 className="text-[10px] uppercase font-black tracking-widest">
                        Membros ativos
                      </h2>
                    </div>
                    <span className="text-[9px] bg-zinc-900 px-2 py-0.5 rounded text-zinc-600 font-black">
                      {campaign?.playerIds.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {campaign?.playerIds.map((pid) => (
                      <div
                        key={pid}
                        className="flex items-center justify-between group p-2 rounded-xl hover:bg-zinc-900/50 transition-all border border-transparent hover:border-zinc-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                            <User size={14} className="text-zinc-600" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 truncate max-w-[120px]">
                            {pid}
                          </span>
                        </div>
                        {mode === "gm" && (
                          <button
                            onClick={() => {
                              setRemovingPlayerId(pid);
                              setRemoveInput("");
                            }}
                            className="p-1.5 text-zinc-800 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remover Jogador"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 p-4 md:p-8 pb-24 md:pb-8 order-1 md:order-2 overflow-y-auto ${mobileTab === "fichas" ? "block" : "hidden md:block"}`}>
        <div className="max-w-6xl mx-auto space-y-12">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <button
                onClick={() =>
                  navigate(
                    mode === "gm" ? "/gm/campaigns" : "/player/campaigns",
                  )
                }
                className="flex items-center gap-2 text-zinc-600 hover:text-white transition-colors text-[9px] uppercase font-black tracking-widest mb-1"
              >
                <ChevronLeft size={16} /> Voltar
              </button>
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
                  {campaign?.name}
                </h1>
                {mode === "gm" && (
                  <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center">
                    <span className="text-[7px] uppercase font-black text-zinc-600 leading-none">
                      Acesso
                    </span>
                    <span className="text-sm font-mono font-black text-amber-500 leading-none mt-1">
                      {campaign?.accessCode}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">
                Monitoramento em Tempo Real
              </p>
            </div>
          </header>

          <div className="flex gap-4 sm:gap-8 border-b border-zinc-900 overflow-x-auto scrollbar-hide py-1">
            <button
              onClick={() => setActiveMainTab("fichas")}
              className={`pb-4 px-2 text-xs uppercase font-black tracking-widest transition-all relative ${activeMainTab === "fichas" ? "text-amber-500" : "text-zinc-600 hover:text-zinc-400"}`}
            >
              Fichas
              {activeMainTab === "fichas" && (
                <motion.div
                  layoutId="activeMainTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => setActiveMainTab("combate")}
              className={`pb-4 px-2 text-xs uppercase font-black tracking-widest transition-all relative ${activeMainTab === "combate" ? "text-amber-500" : "text-zinc-600 hover:text-zinc-400"}`}
            >
              Combate{" "}
              <span className="text-[8px] opacity-40 lowercase font-bold tracking-normal italic">
                (Breve)
              </span>
              {activeMainTab === "combate" && (
                <motion.div
                  layoutId="activeMainTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => setActiveMainTab("recursos")}
              className={`pb-4 px-2 text-xs uppercase font-black tracking-widest transition-all relative ${activeMainTab === "recursos" ? "text-amber-500" : "text-zinc-600 hover:text-zinc-400"}`}
            >
              Recursos{" "}
              <span className="text-[8px] opacity-40 lowercase font-bold tracking-normal italic">
                (Breve)
              </span>
              {activeMainTab === "recursos" && (
                <motion.div
                  layoutId="activeMainTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => setActiveMainTab("anotacoes")}
              className={`pb-4 px-2 text-xs uppercase font-black tracking-widest transition-all relative ${activeMainTab === "anotacoes" ? "text-amber-500" : "text-zinc-600 hover:text-zinc-400"}`}
            >
              Anotações
              {activeMainTab === "anotacoes" && (
                <motion.div
                  layoutId="activeMainTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full"
                />
              )}
            </button>
          </div>

          <AnimatePresence>
            {isAddingChars && (
              <CharacterSearchModal
                userIds={
                  mode === "player"
                    ? userId
                      ? [userId]
                      : []
                    : campaign?.playerIds || []
                }
                onSelect={handleAddCharacter}
                onClose={() => setIsAddingChars(false)}
              />
            )}
            {isAddingPlayers && mode === "gm" && (
              <UserSearchModal
                onSelect={handleAddPlayer}
                existingIds={campaign?.playerIds || []}
                onClose={() => setIsAddingPlayers(false)}
              />
            )}
            {removingPlayerId && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl"
                >
                  <div className="space-y-4">
                    <h4 className="text-xl font-black text-rose-500 uppercase italic">
                      Remover Jogador
                    </h4>
                    <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                      Você tem certeza que deseja remover o jogador{" "}
                      <span className="text-white font-mono">
                        {removingPlayerId}
                      </span>
                      ? Todas as fichas dele serão desvinculadas desta campanha.
                    </p>
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-black text-zinc-600 tracking-tighter">
                        Digite "REMOVER" para confirmar:
                      </p>
                      <input
                        type="text"
                        value={removeInput}
                        onChange={(e) => setRemoveInput(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-black text-center outline-none focus:border-rose-500 transition-all uppercase"
                        placeholder="REMOVER"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={handleRemovePlayer}
                      disabled={removeInput !== "REMOVER"}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-30 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all"
                    >
                      Remover
                    </button>
                    <button
                      onClick={() => {
                        setRemovingPlayerId(null);
                        setRemoveInput("");
                      }}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all"
                    >
                      Voltar
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeMainTab === "fichas" && (
              <motion.div
                key="fichas"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {mode === "gm" && (
                  <div className="flex justify-end gap-2 px-1">
                    <button
                      onClick={() => {
                        setIsBulkXPModalOpen(true);
                        setSelectedBulkCharIds(characters.map((c) => c.id));
                      }}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 hover:text-amber-500 hover:border-amber-500/30 transition-all flex items-center gap-2 group"
                      title="Distribuir XP"
                    >
                      <Award
                        size={14}
                        className="group-hover:scale-110 transition-transform"
                      />
                      <span className="text-[9px] uppercase font-black tracking-widest hidden sm:inline">
                        XP
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setIsBulkRestModalOpen(true);
                        setSelectedBulkCharIds(characters.map((c) => c.id));
                      }}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 hover:text-sky-500 hover:border-sky-500/30 transition-all flex items-center gap-2 group"
                      title="Descanso Total"
                    >
                      <Bed
                        size={14}
                        className="group-hover:scale-110 transition-transform"
                      />
                      <span className="text-[9px] uppercase font-black tracking-widest hidden sm:inline">
                        Descanso
                      </span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {characters.map((char) => (
                    <div
                      key={char.id}
                      className="bg-[#121214] border border-zinc-800/80 rounded-[32px] p-6 space-y-6 shadow-2xl relative group overflow-hidden"
                    >
                      {/* Cabecalho de informacoes */}
                      <div className="flex justify-between items-start relative z-10 gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h3 className="text-xl font-black text-white italic uppercase tracking-tight leading-tight truncate hover:text-amber-500 transition-colors">
                            {char.name}
                          </h3>
                          <div className="text-[9px] uppercase tracking-[0.15em] font-black text-zinc-500">
                            {char.ancestry} {char.class} (Nível {char.level})
                          </div>
                        </div>

                        {mode === "gm" && (
                          <div className="flex-shrink-0 z-20">
                            {removingCharId === char.id ? (
                              <div className="bg-zinc-950 border border-rose-900/50 p-2 rounded-xl flex items-center gap-2 shadow-2xl">
                                <input
                                  type="text"
                                  value={removeInput}
                                  onChange={(e) =>
                                    setRemoveInput(e.target.value)
                                  }
                                  placeholder='"REMOVER"'
                                  className="bg-transparent text-[8px] font-black text-white w-20 outline-none border border-rose-900/30 px-1 py-0.5 rounded uppercase"
                                />
                                <button
                                  onClick={handleRemoveCharacter}
                                  disabled={removeInput !== "REMOVER"}
                                  className="text-[8px] font-black uppercase text-rose-500 disabled:opacity-30"
                                >
                                  OK
                                </button>
                                <button
                                  onClick={() => {
                                    setRemovingCharId(null);
                                    setRemoveInput("");
                                  }}
                                  className="text-zinc-600"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRemovingCharId(char.id)}
                                className="p-1 px-1.5 bg-zinc-900/60 border border-zinc-800/80 text-zinc-600 hover:text-rose-500 rounded-lg hover:border-zinc-850 transition-all cursor-pointer"
                                title="Retirar da Campanha"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Layout: Duas Colunas - Barra de Status (Esq) e CA com Escudo (Dir) */}
                      <div className="grid grid-cols-12 gap-4 items-center relative z-10">
                        {/* HP & Estresse Column */}
                        <div className="col-span-8 space-y-4">
                          {/* Vida Section */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-baseline font-sans">
                              <span className="text-[10px] font-black tracking-wider text-red-500 uppercase">
                                Vida
                              </span>
                              <div className="font-mono text-xs font-black">
                                <span className="text-white">
                                  {char.hp.current}
                                </span>
                                {char.hp.temp > 0 && (
                                  <span className="text-sky-400">
                                    {" "}
                                    +{char.hp.temp}
                                  </span>
                                )}
                                <span className="text-zinc-600">
                                  {" "}
                                  / {char.hp.max}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-zinc-950 rounded-full overflow-hidden flex gap-0.5 border border-zinc-900/40">
                              <div
                                className="h-full bg-red-600 transition-all duration-500"
                                style={{
                                  width: `${(char.hp.current / char.hp.max) * 100}%`,
                                }}
                              />
                              {char.hp.temp > 0 && (
                                <div
                                  className="h-full bg-sky-500 transition-all duration-500"
                                  style={{
                                    width: `${(char.hp.temp / char.hp.max) * 100}%`,
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* Estresse Section */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-baseline font-sans">
                              <span className="text-[10px] font-black tracking-wider text-amber-500 uppercase">
                                Estresse
                              </span>
                              <div className="font-mono text-xs font-bold">
                                <span className="text-white">{char.stress}</span>
                                <span className="text-zinc-600"> / 20</span>
                              </div>
                            </div>
                            {/* Medidor Estresse Segmentado */}
                            <div className="flex gap-0.5 h-1.5 mt-1">
                              {Array.from({ length: 20 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`flex-1 rounded-sm transition-all duration-300 ${
                                    i < char.stress
                                      ? getStressColor(i)
                                      : "bg-zinc-950 border border-zinc-900/50"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* CA Shield */}
                        <div className="col-span-4 flex flex-col items-center justify-center">
                          <span className="text-[10px] font-black tracking-wider text-zinc-400 uppercase mb-1">
                            CA
                          </span>
                          <div className="relative w-14 h-16 flex items-center justify-center">
                            {/* Escudo Estilizado customizado */}
                            <svg
                              viewBox="0 0 100 120"
                              className="absolute inset-0 w-full h-full text-zinc-950 fill-zinc-950/80 stroke-zinc-700 stroke-2"
                              style={{
                                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
                              }}
                            >
                              <path d="M50 5 L90 20 V65 C90 90 70 110 50 115 C30 110 10 90 10 65 V20 Z" />
                            </svg>
                            <span className="relative z-10 text-xl font-mono font-black text-white tracking-tighter">
                              {(() => {
                                const base =
                                  ARMOR_VALUES[
                                    char.armor.type as keyof typeof ARMOR_VALUES
                                  ] || 10;
                                const dexMod = getModifier(
                                  char.attributes.DEX || 10,
                                );
                                const dexToAdd =
                                  char.armor.type === "plate" ? 0 : dexMod;
                                const shieldBonus = char.shield?.active ? 2 : 0;
                                return (
                                  base +
                                  dexToAdd +
                                  shieldBonus +
                                  (char.armor?.magicBonus || 0) +
                                  (char.shield?.magicBonus || 0)
                                );
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mini Atributos Grid: ordem padrão RPG - FOR, DES, CON, INT, SAB, CAR */}
                      <div className="grid grid-cols-3 gap-2 relative z-10">
                        {(["STR", "DEX", "CON", "INT", "WIS", "CHA"] as (keyof CharacterState["attributes"])[]).map((key) => {
                          const val = char.attributes[key] || 10;
                          return (
                            <div
                              key={key}
                              className="bg-black/30 border border-zinc-900/60 py-2 rounded-2xl flex flex-col items-center justify-center transition-all hover:bg-black/40"
                            >
                              <span className="text-[7px] uppercase font-black text-zinc-500 tracking-wider leading-none mb-1 text-center">
                                {ATTR_LABELS[key]?.toUpperCase() || key}
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xs font-black text-zinc-100">
                                  {val}
                                </span>
                                <span className="text-[9px] font-black text-zinc-500">
                                  {formatModifier(getModifier(val))}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Botao de Acao: Abrir Ficha */}
                      <div className="pt-2 relative z-10">
                        <button
                          onClick={() => {
                            if (mode === "gm" || char.userId === userId) {
                              navigate(`/character/${char.id}`);
                            }
                          }}
                          disabled={mode === "player" && char.userId !== userId}
                          className={`w-full text-[10px] font-black uppercase tracking-widest py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 border cursor-pointer active:scale-95 ${
                            mode === "gm" || char.userId === userId
                              ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700/80 text-zinc-400 hover:text-white"
                              : "bg-zinc-950/40 text-zinc-700 border-zinc-900 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          Abrir Ficha <ChevronRight size={12} className="opacity-70" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeMainTab === "combate" && (
              <motion.div
                key="combate"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10"
              >
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
                  <Swords size={32} className="text-zinc-700" />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-zinc-500">
                  Modo de Combate
                </h3>
                <p className="text-zinc-700 text-xs font-bold uppercase tracking-widest mt-1 italic">
                  Em breve no Dark Core
                </p>
              </motion.div>
            )}

            {activeMainTab === "recursos" && (
              <motion.div
                key="recursos"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Iluminação Ativa */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
                        <Flame size={24} />
                      </div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">
                        Iluminação Ativa
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {characters.flatMap((char) =>
                      (char.inventory || [])
                        .filter(
                          (item) =>
                            item.category === "Iluminação" &&
                            item.lightIsActive,
                        )
                        .map((item) => (
                          <div
                            key={`${char.id}-${item.id}`}
                            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-amber-500/30 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black text-white italic uppercase tracking-tight truncate">
                                  {item.name}
                                </h4>
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                                  {char.name}
                                </p>
                              </div>
                              <CircularProgress
                                value={
                                  localLightingState[char.id]?.[item.id] ??
                                  item.lightRemaining ??
                                  0
                                }
                                max={item.lightDuration || 3600}
                                active={true}
                              />
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900">
                              <div
                                className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-1000"
                                style={{
                                  width: `${Math.max(0, Math.min(100, ((localLightingState[char.id]?.[item.id] ?? 0) / (item.lightDuration || 3600)) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        )),
                    )}

                    {characters.every(
                      (char) =>
                        !(char.inventory || []).some(
                          (item) =>
                            item.category === "Iluminação" &&
                            item.lightIsActive,
                        ),
                    ) && (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center bg-zinc-950/50 border border-zinc-800 border-dashed rounded-3xl">
                        <Flame size={32} className="text-zinc-800 mb-3" />
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-600 italic">
                          Nenhuma fonte de luz ativa
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Futuros Recursos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-8 opacity-50">
                    <h3 className="text-sm font-black italic uppercase tracking-widest text-zinc-500 mb-4">
                      Tesouro da Campanha
                    </h3>
                    <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest">
                      Em breve: Acompanhamento de loot compartilhado
                    </p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-8 opacity-50">
                    <h3 className="text-sm font-black italic uppercase tracking-widest text-zinc-500 mb-4">
                      Notas de Grupo
                    </h3>
                    <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest">
                      Em breve: Bloco de notas para a party
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeMainTab === "anotacoes" && campaignId && (
              <motion.div
                key="anotacoes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <CampaignNotesTab campaignId={campaignId} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Selector de Abas Mobile */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 px-2 py-1.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center gap-1">
        <button
          onClick={() => setMobileTab("fichas")}
          className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            mobileTab === "fichas"
              ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          Campanha
        </button>
        <button
          onClick={() => {
            setMobileTab("historico");
            setHasNewRolls(false);
          }}
          className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer relative ${
            mobileTab === "historico"
              ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          Histórico ({rolls.length})
          {hasNewRolls && mobileTab === "fichas" && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse border-2 border-zinc-950" />
          )}
        </button>
      </div>

      {/* Bulk Action Modals */}
      <AnimatePresence>
        {(isBulkXPModalOpen || isBulkRestModalOpen) && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-zinc-800 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-2xl border ${isBulkXPModalOpen ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-sky-500/10 border-sky-500/20 text-sky-500"}`}
                  >
                    {isBulkXPModalOpen ? (
                      <Award size={24} />
                    ) : (
                      <Bed size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                      {isBulkXPModalOpen
                        ? "Distribuir Experiência"
                        : "Descanso Coletivo"}
                    </h3>
                    <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">
                      {isBulkXPModalOpen
                        ? "Aumente o XP de múltiplos personagens"
                        : "Restaure PV de múltiplos personagens"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsBulkXPModalOpen(false);
                    setIsBulkRestModalOpen(false);
                  }}
                  className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                {isBulkXPModalOpen && (
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">
                      Quantidade de XP
                    </label>
                    <div className="relative group">
                      <input
                        type="number"
                        value={bulkXPValue || ""}
                        onChange={(e) => setBulkXPValue(Number(e.target.value))}
                        placeholder="Ex: 5"
                        className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-2xl font-black text-amber-500 outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">
                      Selecionar Fichas
                    </h4>
                    <button
                      onClick={() => {
                        if (selectedBulkCharIds.length === characters.length) {
                          setSelectedBulkCharIds([]);
                        } else {
                          setSelectedBulkCharIds(characters.map((c) => c.id));
                        }
                      }}
                      className="text-[9px] uppercase font-black text-amber-500 hover:text-amber-400 transition-colors tracking-widest"
                    >
                      {selectedBulkCharIds.length === characters.length
                        ? "Desmarcar Todos"
                        : "Marcar Todos"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {characters.map((char) => (
                      <button
                        key={char.id}
                        onClick={() => {
                          if (selectedBulkCharIds.includes(char.id)) {
                            setSelectedBulkCharIds(
                              selectedBulkCharIds.filter(
                                (id) => id !== char.id,
                              ),
                            );
                          } else {
                            setSelectedBulkCharIds([
                              ...selectedBulkCharIds,
                              char.id,
                            ]);
                          }
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          selectedBulkCharIds.includes(char.id)
                            ? isBulkXPModalOpen
                              ? "bg-amber-500/10 border-amber-500/30"
                              : "bg-sky-500/10 border-sky-500/30"
                            : "bg-zinc-900/30 border-zinc-800/50 opacity-40 grayscale"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center font-black text-[10px] text-zinc-500">
                            {char.level}
                          </div>
                          <div className="text-left">
                            <div
                              className={`text-sm font-black uppercase italic ${selectedBulkCharIds.includes(char.id) ? "text-white" : "text-zinc-600"}`}
                            >
                              {char.name}
                            </div>
                            <div className="text-[8px] uppercase tracking-widest font-black text-zinc-600">
                              {char.class}
                            </div>
                          </div>
                        </div>
                        {selectedBulkCharIds.includes(char.id) && (
                          <div
                            className={`p-1.5 rounded-lg ${isBulkXPModalOpen ? "bg-amber-500 text-black" : "bg-sky-500 text-white"}`}
                          >
                            <Check size={12} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-950/80 border-t border-zinc-900">
                <button
                  onClick={isBulkXPModalOpen ? handleBulkXP : handleBulkRest}
                  disabled={
                    selectedBulkCharIds.length === 0 ||
                    (isBulkXPModalOpen && bulkXPValue <= 0)
                  }
                  className={`w-full py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-xl active:scale-95 disabled:opacity-30 disabled:grayscale ${
                    isBulkXPModalOpen
                      ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20"
                      : "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/20"
                  }`}
                >
                  {isBulkXPModalOpen
                    ? "Confirmar Distribuição"
                    : "Confirmar Descanso"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
