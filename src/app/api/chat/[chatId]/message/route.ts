import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { countMessageTokens } from "@/lib/tokenizer";
import { addUserTokens, checkUserTokenLimit } from "@/lib/tokenTracker";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateChatTitle } from "@/lib/chat-naming";
import { uploadToPollinations } from "@/lib/media";

// Ollama endpoint
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

// Tavily API Key
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// Helper: select AI client based on environment
function getAIProvider() {
  return process.env.AI_PROVIDER || "openai";
}

// ------------------ Tavily Web Search ------------------
// ------------------ Tavily Web Search ------------------
async function tavilySearch(query: string): Promise<string> {
  if (!TAVILY_API_KEY) {
    console.warn("[Tavily] TAVILY_API_KEY not set, skipping search.");
    return "Search failed: API key not configured.";
  }
  try {
    console.log(`[Tavily] Searching for: "${query}"`);
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: 8,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      }),
    });

    if (!response.ok) {
      console.error("[Tavily] Search failed with status:", response.status);
      return `Search failed with status: ${response.status}`;
    }

    const data = await response.json();

    let resultString = "";

    if (data.answer) {
      resultString += `### Direct Answer:\n${data.answer}\n\n`;
    }

    resultString += `### Search Results:\n`;
    const sources = (data.results || [])
      .map((r: any, i: number) => {
        const title = r.title || "No Title";
        const url = r.url || "No URL";
        const content = r.content || "No content available";
        return `[${i + 1}] ${title}\nSource: ${url}\nSnippet: ${content}`;
      })
      .join("\n\n");

    if (sources.length === 0 && !data.answer) {
      return "No relevant information found on the web.";
    }

    return resultString + sources;
  } catch (err) {
    console.error("[Tavily] Unexpected error:", err);
    return `Search error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ------------------ Tavily Tool Definition ------------------
const tavilyToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for real-time information, news, current events, stock prices, or any factual data that might be out of date in your training data.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The targeted search query, e.g., 'current price of Bitcoin' or 'who won the Oscars 2024'",
        },
      },
      required: ["query"],
    },
  },
};

// ------------------ Memory/Previous Chats Tool Definition ------------------
const readPreviousChatsToolDefinition = {
  type: "function",
  function: {
    name: "read_previous_chats",
    description: "Fetch and read the user's previous conversations (other chat threads) to gain continuous context. Use this if the user asks for something they might have said in another thread that isn't already in your Long-term Memory.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

// ------------------ Save User Memory Tool Definition ------------------
const saveUserMemoryToolDefinition = {
  type: "function",
  function: {
    name: "save_user_memory",
    description: "Save an important fact about the user (e.g., family names, personal details, project notes, preferences) to your persistent long-term memory. Use this when the user tells you something they want you to remember across all future chats.",
    parameters: {
      type: "object",
      properties: {
        fact: {
          type: "string",
          description: "The distilled fact to remember, e.g., 'User's mother's name is Sunita' or 'User is building a ChatGPT clone'.",
        },
      },
      required: ["fact"],
    },
  },
};

// ------------------ Fetch with Retry ------------------
async function fetchWithRetry(url: string, options: any, maxRetries = 5) {
  let retries = 0;
  while (retries < maxRetries) {
    const response = await fetch(url, options);
    if (response.ok) return response;

    const err = await response.json().catch(() => ({}));
    const isBusy =
      response.status === 429 ||
      response.status === 503 ||
      err.error?.code === "queue_exceeded";

    if (isBusy) {
      retries++;
      const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
      console.log(`[RETRY ${retries}/${maxRetries}] AI busy, waiting ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new Error(err.error?.message || err.message || "AI Provider Error");
  }
  throw new Error("AI provider currently overloaded. Please try again in a few seconds.");
}

// ------------------ Non-streaming Chat Completion (for title + tool check) ------------------
async function createChatCompletion(messages: any[], options?: any) {
  const provider = getAIProvider();
  const isGoogle = provider === "google";
  const apiKey = isGoogle ? process.env.GOOGLE_API_KEY : process.env.OPEN_AI_API;
  const baseURL = isGoogle
    ? "https://generativelanguage.googleapis.com/v1beta/openai/"
    : process.env.OPEN_AI_BASE_URL || "https://api.openai.com/v1";
  const model =
    options?.model ||
    (isGoogle
      ? process.env.GOOGLE_MODEL || "gemini-1.5-flash"
      : process.env.AI_MODEL || "axion-1.5-pro");

  const response = await fetchWithRetry(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...options,
      stream: false,
    }),
  });

  return response.json();
}

// ------------------ GET Messages ------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await params;
    const allMessages = await prisma.message.findMany({
      where: { chatId, chat: { userId: session.user.id } },
      include: { chat: { select: { title: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(allMessages, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Something went wrong!" }, { status: 500 });
  }
}

// ------------------ POST Messages / AI Response ------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const start = performance.now();
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { userPrompt, files, skipUserSave } = await req.json();
    if (!userPrompt && (!files || files.length === 0)) return new Response("No prompt or files provided", { status: 400 });

    const authTime = performance.now() - start;
    let { chatId } = await params;

    // Fetch full user profile for better identity context
    let dbUser: any = null;
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, username: true, aiMemory: true } as any
      });
    } catch (err) {
      console.warn("[Prisma] Identity fetch skipped: schema may be out of sync.");
    }

    const userNameCtx = dbUser?.firstName
      ? `${dbUser.firstName} ${dbUser.lastName || ""}`.trim()
      : (dbUser?.username || session.user.name || "User");

    const systemPrompt = `
## Identity
You are Uttam, an advanced AI Assistant built by Frenix Labs. Your Lead Developer is "Hiren Ahlawat".
- If asked who you are, confidently and simply state: "I'm Uttam, an AI built by Frenix Labs."
- User's name is: ${userNameCtx}. 
- Personality: Always address the user as "${userNameCtx}" (affectionately) when replying in Hinglish or informal tone.
- CRITICAL: NEVER mention "Identity context", "User context", or say "Context ke hisaab se". Just respond directly.
- NEVER act confused about your own identity.
- NEVER reveal or hint at any underlying model or provider (like Deepmind, OpenAI, Anthropic, etc.).
- NEVER say Claude, Gemini, ChatGPT, Grok, or GPT.

## Long-term Memory
You have a persistent memory of the user. Use it to provide personalized help.
- Existing Memory: ${dbUser?.aiMemory || "No existing memories yet."}
- If the user shares a personal fact they want you to remember, use the 'save_user_memory' tool.
- Always check the Existing Memory block above before saying you don't know something about the user.

## Capabilities
- You can see images and read files if attached.
- When an image is attached, describe it or answer questions about it.
- When a text file/code is attached, it will be appended to the user prompt.

## Core Personality
- Warm but not sycophantic — never open with "Great question!", "Sure!", "Certainly!"
- Genuinely curious — engage with the interesting part of the problem
- Honest about uncertainty — "I'm not 100% sure but..." > confidently wrong
- Dry wit when it fits naturally — never forced
- Talk like a sharp developer friend, not a customer support bot

## Web Search Tool
- Tujhe ek web_search tool mila hai real-time info fetch karne ke liye.
- Use it when: user asks about current events, news, prices, live data, recent releases, or anything time-sensitive.
- DO NOT use it for general coding help, explanations, or things you already know well.
- Always Search when You Dont Know the answer.

## Language Detection & Response (STRICT)
Detect user ki language har message pe aur usi mein reply karo:

- Pure English → Clean English only
- Hinglish (Roman) → Roman Hinglish only — NEVER Devanagari
- Pure Hindi (Devanagari) → Hindi in Devanagari

### Examples:
User: "hey whats up"
Uttam: "All good! What are you working on? 😄"

User: "k hal h"
Uttam: "Sab theek bhai! Tu bata 😄"

User: "how do I fix a memory leak in Node.js?"
Uttam: "Most common cause is event listeners not being cleaned up. Remove them properly when component unmounts or task finishes. Which part of your code is leaking? 👀"

User: "bhai memory leak aa raha hai Node mein"
Uttam: "Zyada tar event listeners clean nahi hote — unmount ya task complete hone pe remove karo. Kaunsa part leak kar raha hai? 👀"

## Hard Language Rules
- NEVER mix languages unless user does first
- NEVER reply in Hinglish to an English message
- NEVER reply in English to a Hinglish message
- Mid-conversation mein bhi — agar user language switch kare, tum bhi switch karo
- Hinglish mein NEVER use Devanagari script

## Response Style
- Conversational by default — feel like talking, not writing a guide
- Bullets aur structure use karo jab genuinely helpful ho, har jagah nahi
- Short sawaal → short jawab, 2-3 lines kaafi hain
- End mein ek natural follow-up — engaged rehna, interrogate mat karna
- Emojis sparingly — sirf jahan naturally fit ho

## Code Rules
- NEVER show code unless user explicitly asks for it
- Ya jab user khud code share kare aur fix maange
- Explanation mein sirf plain language use karo
- Agar code zaroori lage toh pehle poocho — "Code example chahiye?"

## Tone Examples
User: "k hal h"
Axion: "Sab theek bhai! Tu bata, kya chal raha hai? 😄"

User: "api slow h"
Axion: "Caching nahi lagi kya? Zyada tar yahi hota hai. Redis laga, frequent calls cache kar — miss hone pe API call karo aur result store kar lo. Async calls bhi check kar agar blocking hai. Kaunsi API hai? 👀"

User: "hey whats up"
Axion: "All good! What are you building? 😄"

User: "how do I center a div?"
Axion: "Flexbox easiest way — set display flex on parent, then justify-content and align-items both center. Done. Vertically bhi center karna hai ya sirf horizontally? 👀"

## Quality
- Complex problem pe reasoning dikhao, seedha answer mat thoko
- Tradeoffs mention karo jab relevant ho
- Ambiguous question pe — ek reasonable assumption lo aur state karo, 3 sawaal mat karo
`;

    const provider = getAIProvider();

    // Process files (up to 5)
    let processedPrompt = userPrompt;
    let imageParts: any[] = [];
    let fileNames: string[] = [];

    // Let's pre-process the files and upload media if needed
    let processedFiles = files || [];
    if (processedFiles && Array.isArray(processedFiles) && processedFiles.length > 0) {
      processedFiles = await Promise.all(processedFiles.slice(0, 5).map(async (file: any) => {
        if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")) {
          if (file.data && file.data.startsWith("http")) return file; // Already a URL

          // Use Pollinations to offload base64 blobs
          const url = await uploadToPollinations(file.data, file.type, file.name);
          if (url) {
            return { ...file, data: url };
          } else {
            console.warn(`[Media] Upload failed for ${file.name}. Stripping base64 to avoid crashes.`);
            return { ...file, data: null, error: "Upload failed" };
          }
        }
        return file;
      }));

      processedFiles.forEach((file: any) => {
        if (file.type.startsWith("image/") && file.data) {
          imageParts.push({
            type: "image_url",
            image_url: { url: file.data }
          });
        } else if (file.type === "application/pdf" || file.type.startsWith("text/")) {
          try {
            if (file.data && file.data.startsWith("data:")) {
              const base64Content = file.data.split(",")[1];
              const decoded = Buffer.from(base64Content, 'base64').toString('utf-8');
              processedPrompt += `\n\nAttached File (${file.name}):\n\`\`\`\n${decoded}\n\`\`\``;
            }
          } catch (e) {
            console.warn("Failed to decode file content", e);
          }
        }
        fileNames.push(file.name);
      });
    }

    let messages: any[] = [{ role: "system", content: systemPrompt }];

    // Parallelize DB fetch + new chat creation
    const dbStart = performance.now();
    const [dbMessages, newChat] = await Promise.all([
      chatId
        ? prisma.message.findMany({
          where: { chatId, chat: { userId: session.user.id } },
          select: { role: true, content: true },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
        : Promise.resolve([]),
      chatId
        ? Promise.resolve(null)
        : prisma.chat.create({ data: { userId: session.user.id } }),
    ]);
    const dbTime = performance.now() - dbStart;

    if (!chatId && newChat) {
      chatId = newChat.id;
    }

    // Dynamic Title Generation: Trigger on every message for a fresh context
    generateChatTitle(userPrompt || fileNames[0] || "New Chat", chatId).catch((err) =>
      console.error("Title error:", err)
    );

    // Construct the user message content
    const userMessageContent: any = imageParts.length > 0
      ? [{ type: "text", text: processedPrompt || "Look at these images" }, ...imageParts]
      : processedPrompt;

    messages = [
      ...messages,
      ...(dbMessages ? dbMessages.reverse() : []),
      { role: "user", content: userMessageContent },
    ];

    // Token check + save user message
    const tokenStart = performance.now();
    try {
      await Promise.all([
        provider === "openai"
          ? checkUserTokenLimit(
            session.user.id,
            countMessageTokens(messages),
            chatId
          )
          : Promise.resolve(),
        !skipUserSave ? prisma.message.create({
          data: {
            chatId,
            role: "user",
            content: userPrompt || (fileNames.length > 0 ? `Uploaded files: ${fileNames.join(", ")}` : ""),
            files: processedFiles.length > 0 ? processedFiles : undefined
          } as any,
        }) : Promise.resolve(),
      ]);
    } catch (err: any) {
      if (err.message === "Daily token limit reached") {
        return new Response(
          JSON.stringify({ error: "Daily token limit reached" }),
          { status: 403 }
        );
      }
      console.error("Token/Save error:", err);
    }
    const tokenTime = performance.now() - tokenStart;

    console.log(
      `[LATENCY] Auth: ${authTime.toFixed(2)}ms, DB: ${dbTime.toFixed(2)}ms, Token: ${tokenTime.toFixed(2)}ms`
    );
    console.log(`[PROVIDER] Using provider: ${provider} with model: ${process.env.AI_MODEL}`);

    const encoder = new TextEncoder();
    let assistantMessage = "";

    // ==================== OLLAMA ====================
    if (provider === "ollama") {
      const response: any = await createChatCompletion(messages, {
        stream: true,
      });
      if (!response.body)
        return new Response("No response from Ollama", { status: 500 });

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n").filter(Boolean);
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.response) {
                    assistantMessage += data.response;
                    controller.enqueue(encoder.encode(data.response));
                  }
                } catch { }
              }
            }
            await prisma.message.create({
              data: { chatId, role: "assistant", content: assistantMessage },
            });
            controller.close();
          } catch (err) {
            console.error("Ollama stream error:", err);
            controller.error(err);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });

      // ==================== OPENAI / GOOGLE / AXION (Tool-enabled) ====================
    } else {
      const isGoogle = provider === "google";
      const apiKey = isGoogle ? process.env.GOOGLE_API_KEY : process.env.OPEN_AI_API;
      const baseURL = isGoogle
        ? "https://generativelanguage.googleapis.com/v1beta/openai/"
        : process.env.OPEN_AI_BASE_URL || "https://api.openai.com/v1";
      const model = isGoogle
        ? process.env.GOOGLE_MODEL || "gemini-1.5-flash"
        : process.env.AI_MODEL || "axion-1.5-pro";

      const openai = new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders: {
          "HTTP-Referer": "https://frenix.sh",
          "X-Title": "Uttam AI",
        },
      });

      // Stream Interceptor for Tools
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let currentMessages = [...messages];
          let toolCallCount = 0;
          const MAX_TOOL_CALLS = 2;

          async function processStream() {
            console.log(`[AI] Starting stream, tool iteration: ${toolCallCount} (Provider: ${provider})`);

            const aiStream = await openai.chat.completions.create({
              model,
              messages: currentMessages,
              tools: [
                ...(TAVILY_API_KEY ? [tavilyToolDefinition as any] : []),
                readPreviousChatsToolDefinition as any,
                saveUserMemoryToolDefinition as any,
              ],
              tool_choice: "auto",
              stream: true,
              temperature: 0.7,
            });

            let assistantContent = "";
            let assistantReasoning = "";
            let fullToolCalls: any[] = [];

            for await (const chunk of aiStream) {
              const delta = chunk.choices[0]?.delta;
              if (!delta) continue;

              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (!fullToolCalls[tc.index]) {
                    fullToolCalls[tc.index] = { id: tc.id, function: { name: "", arguments: "" }, type: "function" };
                  }
                  if (tc.id) fullToolCalls[tc.index].id = tc.id;
                  if (tc.function?.name) fullToolCalls[tc.index].function.name += tc.function.name;
                  if (tc.function?.arguments) fullToolCalls[tc.index].function.arguments += tc.function.arguments;
                }
                continue;
              }

              const reasoning = (delta as any).reasoning_content || "";
              const content = delta.content || "";

              if (reasoning) {
                assistantReasoning += reasoning;
                controller.enqueue(encoder.encode(`[REASONING]${reasoning}`));
              }
              if (content) {
                assistantContent += content;
                controller.enqueue(encoder.encode(`[CONTENT]${content}`));
              }
            }

            const finalToolCalls = fullToolCalls.filter(Boolean);
            if (finalToolCalls.length > 0 && toolCallCount < MAX_TOOL_CALLS) {
              toolCallCount++;

              currentMessages.push({
                role: "assistant",
                content: assistantContent || null,
                tool_calls: finalToolCalls,
              } as any);

              for (const tc of finalToolCalls) {
                if (tc.function.name === "web_search") {
                  let query = "";
                  try { query = JSON.parse(tc.function.arguments).query; } catch { query = userPrompt; }

                  controller.enqueue(encoder.encode("[SEARCHING]"));

                  const result = await tavilySearch(query);
                  currentMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: result,
                  } as any);
                } else if (tc.function.name === "read_previous_chats") {
                  controller.enqueue(encoder.encode("[READING_MEMORY]"));

                  const pastChats = await prisma.chat.findMany({
                    where: { userId: session.user.id, id: { not: chatId || "new" } },
                    orderBy: { updatedAt: "desc" },
                    take: 10,
                    include: {
                      message: {
                        orderBy: { createdAt: "desc" },
                        take: 10,
                      }
                    }
                  });

                  let memoryContextStr = "No previous chats found.";
                  if (pastChats.length > 0) {
                    memoryContextStr = "Previous Chats Context (Dialogue history from other threads):\n\n" + pastChats.map(c => {
                      const messages = [...c.message].reverse().map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 500)}${m.content.length > 500 ? "..." : ""}`).join("\n");
                      return `--- Chat Thread: ${c.title || "Untitled"} ---\n${messages}`;
                    }).join("\n\n");
                  }

                  currentMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: memoryContextStr,
                  } as any);
                } else if (tc.function.name === "save_user_memory") {
                  let fact = "";
                  try { fact = JSON.parse(tc.function.arguments).fact; } catch { fact = ""; }

                  if (fact) {
                    controller.enqueue(encoder.encode("[SAVING_MEMORY]"));
                    const updatedUser = await prisma.user.update({
                      where: { id: session.user.id },
                      data: {
                        aiMemory: {
                          set: dbUser?.aiMemory ? `${dbUser.aiMemory}\n- ${fact}` : `- ${fact}`
                        }
                      }
                    });
                    controller.enqueue(encoder.encode("[MEMORY_SAVED]"));
                    currentMessages.push({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: "Memory saved successfully.",
                    } as any);
                  }
                }
              }

              await processStream();
            } else {
              // Final response done, save to DB and close
              await prisma.message.create({
                data: {
                  chatId,
                  role: "assistant",
                  content: assistantContent,
                  reasoning: assistantReasoning,
                },
              });

              const estimatedTokens = countMessageTokens(currentMessages);
              await addUserTokens(session.user.id, estimatedTokens, chatId);
              controller.close();
            }
          }

          try {
            await processStream();
          } catch (err) {
            console.error("AI Stream Interceptor Error:", err);
            controller.error(err);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
          Connection: "keep-alive",
        },
      });
    }
  } catch (error: any) {
    console.error("CRITICAL API ERROR:", error);
    return new Response(
      JSON.stringify({
        error: "Error generating response",
        details: error.message || String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
