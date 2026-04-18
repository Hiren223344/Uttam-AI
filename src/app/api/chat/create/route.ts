import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { generateChatTitle } from "@/lib/chat-naming";
import { uploadToPollinations } from "@/lib/media";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { prompt, files } = body;

    // files is now an array
    if (!prompt && (!files || files.length === 0)) {
      return NextResponse.json({ error: "Bad Request: No content provided" }, { status: 400 });
    }

    const newChat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: "New Chat",
      },
    });

    let processedFiles = files || [];
    
    if (processedFiles.length > 0) {
      processedFiles = await Promise.all(processedFiles.map(async (f: any) => {
        if (f.type.startsWith("image/") || f.type.startsWith("video/") || f.type.startsWith("audio/")) {
          const url = await uploadToPollinations(f.data, f.type, f.name);
          if (url) {
            return { ...f, data: url };
          }
        }
        return f;
      }));
    }

    const fileNames = processedFiles.map((f: any) => f.name).join(", ");

    // Save the first message
    await prisma.message.create({
      data: {
        chatId: newChat.id,
        role: "user",
        content: prompt || (fileNames ? `Uploaded files: ${fileNames}` : ""),
        files: processedFiles.length > 0 ? processedFiles : undefined // Adding files to DB just incase we need them later in creation
      } as any,
    });

    // Generate title in the background
    generateChatTitle(prompt || fileNames || "New Chat", newChat.id).catch(console.error);

    return NextResponse.json({ chatId: newChat.id }, { status: 200 });
  } catch (error: any) {
    console.error("Chat creation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
