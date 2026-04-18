
import Header from "@/components/header/Header";
import Sidepanel from "@/components/sidepanel/Sidepanel";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background dark:bg-[#171717] text-foreground transition-colors duration-300">
      <Sidepanel />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
