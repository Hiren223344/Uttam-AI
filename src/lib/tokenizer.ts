// tokenCounter.ts
import { encodingForModel } from "js-tiktoken";

let cachedEncoding: any = null;

export function countMessageTokens(
  messages: any[],
  model: any = "gpt-3.5-turbo-0613"
): number {
  if (!cachedEncoding) {
    // Defaulting to gpt-3.5 encoding for all since we just need an estimate
    cachedEncoding = encodingForModel("gpt-3.5-turbo-0613");
  }
  const encoding = cachedEncoding;

  let numTokens = 0;
  const tokensPerMessage = 3;

  for (const message of messages) {
    numTokens += tokensPerMessage;
    
    // Handle role safely
    numTokens += encoding.encode(String(message.role || "")).length;

    // Handle content safely
    if (typeof message.content === "string") {
      numTokens += encoding.encode(message.content).length;
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "text" && typeof part.text === "string") {
          numTokens += encoding.encode(part.text).length;
        } else if (part.type === "image_url") {
          numTokens += 200; // Average tokens for an image
        }
      }
    }

    // Handle name safely
    if (message.name) {
      numTokens += encoding.encode(String(message.name)).length;
    }

    // Handle tool_calls safely
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (call.function) {
          numTokens += encoding.encode(String(call.function.name || "")).length;
          numTokens += encoding.encode(String(call.function.arguments || "")).length;
        }
      }
    }

    // Handle tool_call_id safely
    if (message.tool_call_id) {
      numTokens += encoding.encode(String(message.tool_call_id)).length;
    }
  }

  numTokens += 3; // assistant priming
  return numTokens;
}
