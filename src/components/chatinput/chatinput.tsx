"use client";

import { ArrowUp, AudioLinesIcon, MicIcon, Plus, X, FileText, Image as ImageIcon } from "lucide-react";
import { Input } from "../ui/input";
import { useState, useRef } from "react";
import clsx from "clsx";

export default function ChatInput({ sendPrompt }: { sendPrompt: (message: string, files?: { data: string, type: string, name: string }[]) => void }) {
  const [promptInput, setPromptInput] = useState("");
  const [files, setFiles] = useState<{ data: string, type: string, name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (files.length + selectedFiles.length > 5) {
      alert("You can only upload up to 5 images/files.");
      return;
    }

    const newFilesPromises = selectedFiles.map(file => {
      return new Promise<{ data: string, type: string, name: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            data: event.target?.result as string,
            type: file.type,
            name: file.name
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const newFiles = await Promise.all(newFilesPromises);
    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() && files.length === 0) return;

    sendPrompt(promptInput, files.length > 0 ? files : undefined);
    setPromptInput("");
    setFiles([]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col w-full gap-2">
      {files.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 overflow-x-auto no-scrollbar">
          {files.map((file, idx) => (
            <div key={idx} className="relative group flex-shrink-0">
               <div className="flex items-center gap-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-in fade-in zoom-in-95 duration-200">
                  {file.type.startsWith("image/") ? (
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                       <img src={file.data} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg">
                       <FileText size={18} className="text-zinc-500" />
                    </div>
                  )}
                  <div className="flex flex-col pr-6">
                     <span className="text-[10px] font-medium truncate max-w-[80px]">{file.name}</span>
                     <span className="text-[9px] text-zinc-500 uppercase">{file.type.split("/")[1] || "file"}</span>
                  </div>
               </div>
               <button 
                 onClick={() => removeFile(idx)}
                 className="absolute -top-1.5 -right-1.5 p-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-full transition-colors shadow-sm"
               >
                 <X size={12} className="text-zinc-600 dark:text-zinc-300" />
               </button>
            </div>
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
          multiple
          accept="image/*,.pdf,.txt,.js,.ts,.tsx,.json"
        />
        <div className="flex border border-gray-200 dark:border-zinc-800 p-2 w-[100%] items-center rounded-4xl shadow bg-white dark:bg-[#171717] transition-colors">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <Plus className="ml-1 text-gray-500" strokeWidth={1} />
          </button>

          <Input
            className="border-0 shadow-none outline-0 focus-visible:ring-0 bg-transparent dark:bg-transparent"
            type="text"
            placeholder="Ask anything or upload files..."
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
          />

          <div className="mr-2 cursor-pointer">
            <MicIcon height={20} width={20} className="text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
          </div>

          <div
            className={clsx(
              "flex p-2 rounded-full cursor-pointer transition-colors",
              {
                "bg-black dark:bg-white": promptInput.length > 0 || files.length > 0,
                "bg-gray-200 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700": promptInput.length === 0 && files.length === 0,
              }
            )}
          >
            {(promptInput.length > 0 || files.length > 0) ? (
              <button type="submit">
                <ArrowUp height={20} width={20} className="text-white dark:text-black" />
              </button>
            ) : (
              <AudioLinesIcon height={20} width={20} className="text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
