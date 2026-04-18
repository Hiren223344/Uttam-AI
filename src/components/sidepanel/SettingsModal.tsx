"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import axios from "axios";
import { BrainCircuit, Trash2, ShieldCheck, Settings as SettingsIcon } from "lucide-react";
import { TextShimmer } from "@/components/core/text-shimmer";

export function SettingsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [memory, setMemory] = useState<string | null>(null);
  const [fetchingMemory, setFetchingMemory] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMemory();
    }
  }, [open]);

  const fetchMemory = async () => {
    setFetchingMemory(true);
    try {
      const res = await axios.get("/api/user/profile");
      setMemory(res.data.aiMemory);
    } catch (err) {
      console.error("Failed to fetch memory:", err);
    } finally {
      setFetchingMemory(false);
    }
  };

  const handleClearMemory = async () => {
    if (!confirm("Are you sure you want to clear all saved memories? This cannot be undone.")) return;
    setLoading(true);
    try {
      await axios.post("/api/user/update", { aiMemory: "" });
      setMemory(null);
    } catch (err) {
      setError("Failed to clear memory");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#171717] border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl transition-all">
        <DialogHeader className="border-b border-zinc-100 dark:border-zinc-800/50 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1 px-2 rounded-md bg-indigo-500/10 text-indigo-500 text-[10px] font-bold uppercase tracking-wider italic">Frenix V3</div>
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4 min-h-[350px]">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <BrainCircuit size={16} className="text-pink-500" />
                Personalized Memory
              </h4>
              {memory && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearMemory}
                  disabled={loading}
                  className="h-8 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 gap-1.5 font-bold"
                >
                  <Trash2 size={12} /> Clear Memory
                </Button>
              )}
            </div>

            <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 p-4 min-h-[250px] max-h-[350px] overflow-y-auto custom-scrollbar">
              {fetchingMemory ? (
                <div className="flex flex-col gap-3 py-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 w-full bg-zinc-200/50 dark:bg-zinc-800/50 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : memory ? (
                <div className="flex flex-col gap-2">
                  {memory.split("\n").filter(f => f.trim().startsWith("-")).map((fact, idx) => (
                    <div key={idx} className="group relative flex items-start gap-3 p-3 bg-white dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-700/30 shadow-sm animate-in fade-in zoom-in-95 duration-200" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0 shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
                      <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {fact.replace(/^- /, "")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-10 text-center gap-4 opacity-50">
                  <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-full">
                    <BrainCircuit size={32} className="text-zinc-400" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">No memories found</p>
                    <p className="text-[11px] text-zinc-500 max-w-[180px]">Ask Uttam to remember something and it will appear here.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 p-3 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10">
              <TextShimmer className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-2" duration={2}>
                ✨ Memories help Uttam stay personal across different conversations.
              </TextShimmer>
            </div>
          </div>
          
          {error && <p className="text-sm font-medium text-red-500 mt-2 px-2">⚠️ {error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
