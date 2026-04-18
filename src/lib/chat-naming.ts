import prisma from "@/lib/prisma";

async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  let retries = 0;
  while (retries < maxRetries) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    retries++;
    const delay = Math.pow(2, retries) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
}

export async function generateChatTitle(userMessage: string, chatId: string) {
  try {
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    let rawTitle = "";

    if (cerebrasKey && cerebrasKey.length > 5) {
      console.log(`[Title] Attempting Cerebras for ${chatId}...`);
      const response = await fetchWithRetry("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cerebrasKey}`,
        },
        body: JSON.stringify({
          model: "llama3.1-8b",
          messages: [
            { role: "system", content: "You are a Proffesional Chat Summarizer and Title Generater. Summarize into a title. No quotes. Title should be less than 3 words. But Informative And English And Professional like User asks Who is your lead Developer You Reply asking for Lead Developer" },
            { role: "user", content: userMessage },
          ],
          max_tokens: 20,
        }),
      });

      if (response && response.ok) {
        const data = await response.json();
        rawTitle = data.choices?.[0]?.message?.content?.trim() || "";
      }
    }

    // Fallback logic
    if (!rawTitle) {
      rawTitle = userMessage.slice(0, 30).trim() + (userMessage.length > 30 ? "..." : "");
    }

    const cleanTitle = rawTitle.replace(/["'.!?]/g, "").trim() || "New Chat";
    console.log(`[Title] Set for ${chatId}: "${cleanTitle}"`);

    await prisma.chat.update({
      where: { id: chatId },
      data: { title: cleanTitle },
    });

    return cleanTitle;
  } catch (err) {
    console.error("[Title] Error:", err);
    return "New Chat";
  }
}
