"use client";

import { Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function Login() {
    const { data: session, status } = useSession();
    console.log(session);
    if (status === "loading") return <p>Loading....</p>;
    if (session?.user) return redirect("/");
    return (
        <div className="min-h-screen flex flex-col font-jakarta">
            <header className="fixed top-0 left-0 p-6 flex items-center gap-2">
                <img src="/uttam.png" className="w-8 h-8 opacity-90" alt="Logo" />
                <span className="text-xl font-bold tracking-tight">Uttam AI</span>
            </header>
            <div className="max-w-xs m-auto text-center mt-[4rem]">
                <h1 className="text-3xl font-semibold">Log in or sign up</h1>
                <p className="text-gray-500 mt-3 text-sm leading-5">Welcome to the Frenix Secure Flow.</p>

                <div className="mt-7">
                    <div className="mt-3">
                        <button className="auth-btns w-full flex items-center justify-center p-3 rounded-4xl bg-black text-white dark:bg-white dark:text-black font-semibold cursor-pointer transition-all hover:opacity-80" onClick={() => signIn("frenix")}>
                            <img src="/uttam.png" className="w-5 h-5 mr-3 dark:invert" alt="Frenix Icon" />
                            Continue with Frenix
                        </button>
                    </div>
                </div>

                <div className="mt-[4rem] flex justify-center items-center gap-2">
                    <Link href="/" className="underline underline-offset-1 text-gray-600 text-sm">Terms of Use</Link>
                    <div className="text-gray-600"> | </div>
                    <Link href="/" className="underline underline-offset-1 text-gray-600 text-sm">Privacy Policy</Link>
                </div>
            </div>
        </div>
    )
}