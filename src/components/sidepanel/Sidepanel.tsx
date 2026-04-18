"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarCloseIcon, SidebarOpenIcon, Trash2, User, CreditCard, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import NewChat from "../icons/NewChat";
import Search from "../icons/Search";
import Library from "../icons/Library";
import clsx from "clsx";
import { useState } from "react";
import { useChats } from "@/hooks/chat";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";

import { AccountModal } from "./AccountModal";
import { SettingsModal } from "./SettingsModal";

export default function Sidepanel() {
    const [collapsed, setCollapsed] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { data: session } = useSession();
    const { chats, deleteChat } = useChats();
    const router = useRouter();
    const params = useParams();

    const userName = session?.user?.username || session?.user?.firstName || session?.user?.name || "User";
    const userInitial = userName.charAt(0).toUpperCase();

    return (
        <>
        <div className={clsx("bg-gray-50 dark:bg-[#171717] transition-all duration-300 flex flex-col box-border h-screen overflow-y-auto overflow-x-hidden border-r border-gray-200 dark:border-zinc-800",
            collapsed ? 'w-[68px]' : 'w-[260px]'
        )}>
            <div className="sticky top-0 z-1 bg-gray-50 dark:bg-[#171717]">
                <div className="flex justify-between p-4 group">
                    <button className={clsx("cursor-pointer",
                        {
                            'group-hover:hidden': collapsed
                        }
                    )}>
                        <img 
                            src="/uttam.png" 
                            alt="Frenix Logo" 
                            className="w-6 h-6 opacity-90 dark:invert-0"
                        />
                    </button>
                    <button className={clsx("cursor-pointer",
                        {
                            "hidden group-hover:block": collapsed
                        }
                    )} onClick={() => setCollapsed(!collapsed)}>
                        {
                            collapsed ?
                                <SidebarOpenIcon width={16} height={16} className="text-gray-600 h-6 w-6" />
                                :
                                <SidebarCloseIcon width={16} height={16} className="text-gray-600 h-6 w-6" />
                        }
                    </button>
                </div>
                <div className="px-2">
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200">
                        <NewChat className="text-current w-6 h-6 flex-shrink-0" />
                        <span className={clsx({
                            "hidden": collapsed
                        })}>New chat</span>
                    </Link>
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200">
                        <Search className="text-current w-6 h-6 flex-shrink-0" />
                        <span className={clsx({
                            "hidden": collapsed
                        })}>Search chat</span>
                    </Link>
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200">
                        <Library className="text-current w-6 h-6 flex-shrink-0" />
                        <span className={clsx({
                            "hidden": collapsed
                        })}>Library</span>
                    </Link>
                </div>
            </div>


            <div className={clsx("flex-1", { "hidden": collapsed })}>
                <div className="my-6 mx-2">
                    <p className="px-2 text-gray-500 text-xs font-semibold uppercase tracking-wider">Recent Chats</p>
                    <div className="mt-2">
                        {
                            Array.isArray(chats) && chats.map((element: any) => {
                                const isActive = params.chatId === element.id;
                                return (
                                    <div key={element.id} className={clsx("group flex items-center justify-between gap-1 pr-2 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-zinc-800/80 mb-0.5", {
                                        "bg-gray-200 dark:bg-zinc-800/80": isActive
                                    })}>
                                        <Link href={`/c/${element.id}`} className="flex-1 block p-2 text-sm truncate text-gray-700 dark:text-zinc-300 font-medium">
                                            {element.title}
                                        </Link>
                                        <button
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const confirmed = window.confirm("Delete this chat?");
                                                if (confirmed) {
                                                    const ok = await deleteChat(element.id);
                                                    if (ok && isActive) router.push("/");
                                                }
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-md transition-all duration-200 active:scale-95"
                                        >
                                            <Trash2 size={14} className="stroke-[2.5]" />
                                        </button>
                                    </div>
                                )
                            })
                        }
                    </div>
                </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-[#171717] flex-0 inset-0 mt-auto border-t border-gray-200 dark:border-zinc-800 p-2">
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-full outline-none">
                        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer w-full text-left">
                            <div className="relative flex-shrink-0">
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="User" className="rounded-full w-8 h-8 object-cover border border-gray-200 dark:border-zinc-700" />
                                ) : (
                                    <div className="rounded-full w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                                        {userInitial}
                                    </div>
                                )}
                            </div>
                            <div className={clsx("flex flex-col flex-1 min-w-0 transition-opacity duration-300",
                                { "opacity-0 invisible w-0": collapsed, "opacity-100 visible": !collapsed }
                            )}>
                                <span className="text-sm font-semibold truncate text-gray-800 dark:text-gray-200">{userName}</span>
                                <span className="text-[11px] text-gray-500 truncate">{session?.user?.email}</span>
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="end" className="w-56 mb-2 ml-2 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-xl rounded-xl p-1.5 animate-in slide-in-from-bottom-2">
                        <DropdownMenuLabel className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            My Account
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800" />
                        <DropdownMenuItem onClick={() => setAccountOpen(true)} className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                            <User className="w-4 h-4 opacity-70" />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                            <CreditCard className="w-4 h-4 opacity-70" />
                            Billing
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={() => setSettingsOpen(true)}
                            className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <Settings className="w-4 h-4 opacity-70" />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800" />
                        <DropdownMenuItem 
                            onClick={() => signOut()}
                            className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

        </div>
        <AccountModal open={accountOpen} onOpenChange={setAccountOpen} session={session} />
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </>
    )
}