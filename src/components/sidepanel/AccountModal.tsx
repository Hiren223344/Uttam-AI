"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Loader2, Camera, Pencil, User, ShieldCheck } from "lucide-react";

export function AccountModal({ open, onOpenChange, session }: { open: boolean, onOpenChange: (open: boolean) => void, session: any }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session?.user && open) {
      setFirstName(session.user.firstName || "");
      setLastName(session.user.lastName || "");
      setUsername(session.user.username || "");
      setAvatarPreview(session.user.image || "");
    }
  }, [session, open]);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = { firstName, lastName, username, image: avatarPreview };
      const res = await axios.post("/api/user/update", payload);
      if (res.data.success) {
        onOpenChange(false);
        window.location.reload(); 
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const renderEditableField = (label: string, fieldName: string, value: string) => {
    return (
      <div className="flex flex-col gap-1.5 flex-1 group">
        <label className="text-[11px] font-bold uppercase text-zinc-500 tracking-wider font-mono">{label}</label>
        <div 
          className="flex items-center justify-between h-11 px-4 bg-gray-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl cursor-default transition-all shadow-sm"
        >
          <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
            {value || `Set ${label}`}
          </span>
          <Pencil size={14} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#171717] border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl transition-all">
        <DialogHeader className="border-b border-zinc-100 dark:border-zinc-800/50 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1 px-2 rounded-md bg-indigo-500/10 text-indigo-500 text-[10px] font-bold uppercase tracking-wider italic">Profile Account</div>
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500">My Profile</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/20 dark:border-indigo-500/20 group cursor-pointer shadow-lg shadow-indigo-500/10">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-3xl shadow-inner">
                  {username?.charAt(0)?.toUpperCase() || "U"}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase text-zinc-500 flex items-center gap-2 tracking-wider font-mono">
                <ShieldCheck size={14} className="text-green-500" />
                Verified Email
              </label>
              <Input 
                value={session?.user?.email || "Unknown"} 
                disabled 
                className="bg-zinc-100 dark:bg-zinc-900 border-transparent text-zinc-400 cursor-not-allowed select-all h-11 rounded-2xl font-medium px-4"
              />
            </div>
            
            <div className="flex gap-4">
              {renderEditableField("First Name", "firstName", firstName)}
              {renderEditableField("Last Name", "lastName", lastName)}
            </div>
            
            {renderEditableField("Username", "username", username)}
          </div>
          
          {error && <p className="text-sm font-medium text-red-500 mt-2 px-2">⚠️ {error}</p>}
          
          <div className="mt-2 text-center">
             <Button 
               onClick={handleSave} 
               disabled={loading || !session?.user}
               className="w-full h-11 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-500/10 dark:shadow-none"
             >
                {loading ? <Loader2 className="animate-spin" /> : "Save Profile"}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
