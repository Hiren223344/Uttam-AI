"use client";
import ChatInput from "@/components/chatinput/chatinput";
import { use } from "react";
import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useChats } from "@/hooks/chat";
import clsx from "clsx";
import { Copy, Eye, Play, X, Layout, Globe, FileText, ArchiveRestore, BrainCircuit, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock as UICodeBlock, CodeBlockCopyButton } from "@/components/ui/code-block";
import { TextShimmer } from "@/components/core/text-shimmer";

// Robustly extract text from potentially nested React nodes (from rehype-highlight)
const extractText = (child: any): string => {
  if (typeof child === "string") return child;
  if (typeof child === "number") return String(child);
  if (Array.isArray(child)) return child.map(extractText).join("");
  if (child?.props?.children) return extractText(child.props.children);
  return "";
};

const CodeBlock = ({ inline, className, children, onPreview }: any) => {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const isHTML = language === "html";
  const rawCode = String(children).replace(/\n$/, "");

  if (inline) {
    return (
      <code className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-200 px-1.5 py-0.5 rounded-md font-mono text-[13px] font-medium border border-zinc-200/50 dark:border-zinc-700/50">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-6">
      <UICodeBlock code={rawCode} language={language} className="border-border/50 shadow-xl">
        <div className="flex items-center gap-1.5 p-1 bg-background/50 backdrop-blur-md rounded-lg border border-border/50">
          {isHTML && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-neutral-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
              onClick={() => onPreview?.(rawCode)}
              title="Run Code"
            >
              <Play size={14} className="fill-current" />
            </Button>
          )}
          <CodeBlockCopyButton className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800" />
        </div>
      </UICodeBlock>
    </div>
  );
};

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setAllMessages] = useState<any[]>([]);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isReadingMemory, setIsReadingMemory] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memorySaved, setMemorySaved] = useState(false);

  useEffect(() => {
    if (previewContent) {
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <base target="_self">
            <script src="https://unpkg.com/lucide@latest"></script>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.5;
                color: #1a1a1a;
                background-color: #ffffff;
              }
            </style>
          </head>
          <body>
            ${previewContent}
            <script>
              lucide.createIcons();
            </script>
          </body>
        </html>
      `;
      const blob = new Blob([fullHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [previewContent]);

  const hasFetched = useRef(false);
  const { startPollingChat } = useChats();
  const [autoScroll, setAutoScroll] = useState(true);

  const fetchChat = async () => {
    try {
      const res = await fetch(`/api/chat/${chatId}/message`);
      if (res.ok) {
        const data = await res.json();
        
        // Handle pending files from home page
        const pendingFilesStr = sessionStorage.getItem(`pending_files_${chatId}`);
        let pendingFiles = null;
        if (pendingFilesStr) {
          try {
            pendingFiles = JSON.parse(pendingFilesStr);
            sessionStorage.removeItem(`pending_files_${chatId}`);
          } catch(e) {}
        }

        const messagesWithFile = data.map((msg: any, idx: number) => {
          if (idx === 0 && pendingFiles && msg.role === "user") {
            return { ...msg, files: pendingFiles };
          }
          return msg;
        });

        setAllMessages(messagesWithFile);

        const lastMessage = messagesWithFile[messagesWithFile.length - 1];
        if (lastMessage?.role === "user") {
          await streamAssistantResponse(lastMessage.content, pendingFiles || undefined, true);
        }

        if (data.length === 1 && lastMessage?.role === "user") {
          startPollingChat(chatId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sendPrompt = async (prompt: string, files?: { data: string, type: string, name: string }[]) => {
    const tempUser = { 
      id: Date.now(), 
      role: "user", 
      content: prompt,
      files: files 
    };
    setAllMessages(prev => [...prev, tempUser]);
    await streamAssistantResponse(prompt, files, false);
  };

  const streamAssistantResponse = async (prompt: string, files?: { data: string, type: string, name: string }[], skipUserSave: boolean = false) => {
    try {
      const res = await fetch(`/api/chat/${chatId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userPrompt: prompt,
          files: files,
          skipUserSave: skipUserSave
        }),
      });

      if (!res.ok) {
        let errorMsg = res.statusText;
        try {
          const errorData = await res.json();
          errorMsg = errorData.details || errorData.error || res.statusText;
        } catch { /* fallback to statusText */ }

        console.error("API Error:", errorMsg);
        setAllMessages(prev => [
          ...prev.slice(0, -1),
          { id: Date.now(), role: "assistant", content: `Error: ${errorMsg}. Please try again.` }
        ]);
        return;
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let assistantReasoning = "";
      let currentType = "CONTENT";

      const tempId = Date.now();
      setAllMessages(prev => [...prev, { id: tempId, role: "assistant", content: "", reasoning: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        const lines = chunk.split(/(\[REASONING\]|\[CONTENT\]|\[SEARCHING\]|\[READING_MEMORY\]|\[SAVING_MEMORY\]|\[MEMORY_SAVED\])/).filter(Boolean);

        for (const part of lines) {
          if (part === "[REASONING]") {
            currentType = "REASONING";
            setIsSearching(false);
            setIsReadingMemory(false);
          } else if (part === "[CONTENT]") {
            currentType = "CONTENT";
            setIsSearching(false);
            setIsReadingMemory(false);
          } else if (part === "[SEARCHING]") {
            setIsSearching(true);
            setIsReadingMemory(false);
            setIsSavingMemory(false);
          } else if (part === "[READING_MEMORY]") {
            setIsReadingMemory(true);
            setIsSearching(false);
            setIsSavingMemory(false);
          } else if (part === "[SAVING_MEMORY]") {
            setIsSavingMemory(true);
            setIsReadingMemory(false);
            setIsSearching(false);
          } else if (part === "[MEMORY_SAVED]") {
            setIsSavingMemory(false);
            setMemorySaved(true);
            setTimeout(() => setMemorySaved(false), 3000);
          } else {
            if (currentType === "REASONING") assistantReasoning += part;
            else assistantMessage += part;
          }
        }

        setAllMessages(prev =>
          prev.map(msg => (msg.id === tempId ? { ...msg, content: assistantMessage, reasoning: assistantReasoning } : msg))
        );
      }
      setIsSearching(false);
      setIsReadingMemory(false);
      setIsSavingMemory(false);
    } catch (err) {
      console.error("Error streaming assistant:", err);
      setIsSearching(false);
      setIsReadingMemory(false);
      setIsSavingMemory(false);
    }
  };

  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 50) setAutoScroll(true);
    else setAutoScroll(false);
  };

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchChat();
    }
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-background">
      <div className={clsx("flex flex-col h-full transition-all duration-500 flex-1", {
        "max-w-[60%]": previewContent,
        "max-w-full": !previewContent
      })}>
        <div
          className="flex-1 overflow-y-auto px-6"
          ref={chatContainerRef}
          onScroll={handleScroll}
        >
          <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto py-10 px-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={clsx("flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300", {
                  "items-end": msg.role === "user",
                  "items-start": msg.role === "assistant"
                })}
              >
                <div className={clsx("py-3 px-6 rounded-3xl break-words", {
                  "bg-neutral-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 max-w-[85%] w-fit shadow-sm border border-neutral-200/50 dark:border-zinc-700/20": msg.role === "user",
                  "text-zinc-900 dark:text-zinc-100 w-full": msg.role === "assistant"
                })}>
                  {msg.reasoning && (
                    <details className="mb-4 text-sm text-zinc-500 dark:text-zinc-400 group bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden">
                      <summary className="cursor-pointer list-none px-4 py-3 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-3 font-semibold text-[13px] tracking-tight">
                        <div className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full group-open:bg-indigo-500 transition-all shadow-[0_0_8px_rgba(99,102,241,0.4)]"></div>
                        Thinking Process
                      </summary>
                      <div className="px-4 pb-4 pt-1 text-[13px] leading-relaxed opacity-70 whitespace-pre-wrap font-medium font-mono italic">
                        {msg.reasoning}
                      </div>
                    </details>
                  )}
                  {msg.files && msg.files.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {msg.files.map((file: any, idx: number) => (
                        <div key={idx} className="max-w-[200px] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm">
                          {file.type.startsWith("image/") ? (
                            <img src={file.data} alt="uploaded" className="w-full h-auto object-cover max-h-[150px]" />
                          ) : (
                            <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50">
                              <FileText size={20} className="text-zinc-500 flex-shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[12px] font-semibold truncate">{file.name}</span>
                                <span className="text-[9px] text-zinc-500 uppercase">{file.type.split("/")[1] || "file"}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={clsx("markdown-content break-words text-[15px] transition-all", {
                    "text-zinc-900 dark:text-zinc-100": msg.role === "user",
                    "text-zinc-800 dark:text-zinc-200": msg.role === "assistant"
                  })}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm as any, remarkBreaks as any]}
                      components={{
                        code: (props) => <CodeBlock {...props} onPreview={setPreviewContent} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            
            {isSearching && (
              <div className="flex items-center gap-2.5 px-2 py-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <Globe size={14} className="text-zinc-400 dark:text-zinc-500 animate-spin-slow" />
                <TextShimmer className="text-[13px] font-medium opacity-80" duration={1}>
                  Searching the web...
                </TextShimmer>
              </div>
            )}
            
            {isReadingMemory && (
              <div className="flex items-center gap-2.5 px-2 py-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <ArchiveRestore size={14} className="text-indigo-400 dark:text-indigo-500 animate-pulse" />
                <TextShimmer className="text-[13px] font-medium opacity-80" duration={1.5}>
                  Reading previous chats context...
                </TextShimmer>
              </div>
            )}

            {isSavingMemory && (
              <div className="flex items-center gap-2.5 px-2 py-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <BrainCircuit size={14} className="text-pink-400 dark:text-pink-500 animate-pulse" />
                <TextShimmer className="text-[13px] font-medium opacity-80" duration={1} spread={1}>
                  Memory Saving...
                </TextShimmer>
              </div>
            )}

            {memorySaved && (
              <div className="flex items-center gap-2.5 px-2 py-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500/20">
                  <Check size={10} className="text-green-500" />
                </div>
                <TextShimmer className="text-[13px] font-semibold text-green-600 dark:text-green-400" duration={2}>
                  Memory Saved!
                </TextShimmer>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center pb-6 pt-2 w-full border-t border-zinc-100 dark:border-zinc-900/50">
          <div className="w-full max-w-4xl px-6">
            <ChatInput sendPrompt={sendPrompt} />
          </div>
          <p className="mt-3 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 text-center">Frenix built with Intelligence. Mistakes possible.</p>
        </div>
      </div>

      {previewContent && (
        <div className="w-[40%] h-full border-l border-zinc-200 dark:border-zinc-800/60 flex flex-col bg-white dark:bg-[#171717] animate-in slide-in-from-right duration-500 ease-out z-50 shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#171717] border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100">
                <Layout size={18} className="stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-sm tracking-tight text-neutral-900 dark:text-neutral-100 uppercase tracking-widest text-[11px] opacity-80">Live Preview</h3>
            </div>
            <button
              onClick={() => setPreviewContent(null)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 group"
            >
              <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
          <div className="flex-1 w-full bg-white relative overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="absolute inset-0 w-full h-full border-none shadow-inner bg-white"
                title="HTML Artifact Preview"
                sandbox="allow-scripts allow-forms"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
