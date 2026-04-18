import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, MessageCircleDashed, Sparkle } from "lucide-react"

export default function Header() {
  return (
    <header className="p-2 flex items-center justify-between">
      <div className="flex items-center gap-2 px-2">
        <img
          src="/uttam.png"
          alt="Frenix Logo"
          className="w-5 h-5 opacity-90 dark:invert-0"
        />
        <span className="text-lg font-medium tracking-tight text-foreground">Frenix</span>
      </div>

      <div >
        <button className="rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 p-2 cursor-pointer transition-colors">
          <MessageCircleDashed width={20} height={20} className="text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </header>
  )
}