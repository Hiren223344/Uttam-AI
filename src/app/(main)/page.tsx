"use client";
import axios from "axios";
import { useRouter } from "next/navigation";
import ChatInput from "@/components/chatinput/chatinput";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
export default function MainPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [randomGreeting, setRandomGreeting] = useState<string>("");

    const firstName = session?.user?.username || session?.user?.firstName || session?.user?.name?.split(" ")[0] || "User";

    useEffect(() => {
        const hour = new Date().getHours();
        let timeGreeting = "Good Evening";
        if (hour < 12) timeGreeting = "Good Morning";
        else if (hour < 18) timeGreeting = "Good Afternoon";

        if (Math.random() < 0.5) {
            setRandomGreeting(`${timeGreeting}, ${firstName}`);
        } else {
            setRandomGreeting(`${firstName} Returns!`);
        }
    }, [firstName]);

    const checkTokens = async () => {
        try {
            const data = await axios.get("/api/chat/limit");
            console.log(data);
        } catch (error) {
            console.error("Failed to fetch tokens:", error);
        }
    }

    const sendPrompt = async (prompt: string, files?: { data: string, type: string, name: string }[]) => {
        try {
            const newChat = await axios.post("/api/chat/create", { 
                prompt: prompt,
                files: files
            });

            if (newChat.status === 200) {
                const targetChatId = newChat.data.chatId;
                if (files && files.length > 0) {
                    sessionStorage.setItem(`pending_files_${targetChatId}`, JSON.stringify(files));
                }
                router.push(`/c/${targetChatId}`);
            }
        } catch (error) {
            console.error("Failed to create chat:", error);
        }
    }

    useEffect(() => {
        checkTokens()
    }, [])

    return (
        <div className="flex flex-col min-h-screen justify-center items-center pb-[15vh]">
            <h1 className="text-3xl tracking-tight text-zinc-800 dark:text-zinc-200 font-semibold mb-3 min-h-[36px] transition-opacity duration-500">
                {randomGreeting}
            </h1>
            <div className="w-full max-w-2xl mt-6 px-4">
                <ChatInput sendPrompt={(e: any, f: any) => sendPrompt(e, f)} />
            </div>
        </div>
    )
}