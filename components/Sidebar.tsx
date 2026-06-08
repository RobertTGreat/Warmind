"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { sidebarSubNavigationItems } from "@/lib/navigation";
import { Tooltip } from "@/components/ui/Tooltip";

export function Sidebar() {
    const pathname = usePathname();
    
    // Find the current section key that matches the pathname
    const currentSection = Object.keys(sidebarSubNavigationItems).find(key => pathname.startsWith(key));
    const items = currentSection ? sidebarSubNavigationItems[currentSection] : null;

    if (!items) return null;

    return (
        <aside className="fixed left-0 top-16 bottom-0 w-16 flex flex-col items-center justify-center py-8 z-40">
            <nav className="flex flex-col gap-4">
                {items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    
                    return (
                        <Tooltip 
                            key={item.name} 
                            content={item.name} 
                            side="right"
                            delay={150}
                        >
                            <Link
                                href={item.href}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-sm transition-all duration-200",
                                    isActive 
                                        ? "bg-destiny-gold text-slate-900 shadow-[0_0_15px_rgba(227,206,98,0.4)]"
                                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5"
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="sr-only">{item.name}</span>
                            </Link>
                        </Tooltip>
                    );
                })}
            </nav>
        </aside>
    );
}
