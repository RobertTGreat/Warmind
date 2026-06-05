"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { 
    ScrollText, 
    Book, 
    Medal,
    History,
    Home,
    Swords,
    Users,
    Globe,
    Activity,
    Layers,
    Target,
    Sparkles,
    ShieldCheck
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

type SubNavItem = {
    name: string;
    href: string;
    icon: any;
};

const SUB_NAV_MAP: Record<string, SubNavItem[]> = {
    '/character': [
        { name: 'Home', href: '/character', icon: Home },
        { name: 'Loadouts', href: '/character/loadouts', icon: Layers },
        { name: 'Optimizer', href: '/character/optimizer', icon: Target },
    ],
    '/progression': [
        { name: 'Wishlist', href: '/progression', icon: Book },
        { name: 'Ergo Sum', href: '/progression/ergo-sum', icon: Swords },
    ],
    '/collections': [
        { name: 'Collections', href: '/collections', icon: Book },
        { name: 'Sets', href: '/collections/sets', icon: Layers },
        { name: 'Armor Set Bonuses', href: '/collections/armor-set-bonuses', icon: ShieldCheck },
    ],
    '/triumphs': [
        { name: 'Triumphs', href: '/triumphs', icon: Medal },
    ],
     '/clan': [
        { name: 'Clan', href: '/clan', icon: Users },
    ],
    '/quests': [
        { name: 'Quests', href: '/quests', icon: Swords },
    ],
    '/activity': [
        { name: 'Activity', href: '/activity', icon: Activity },
        { name: 'Wrapped', href: '/activity/wrapped', icon: Sparkles },
    ],
};

export function Sidebar() {
    const pathname = usePathname();
    
    // Find the current section key that matches the pathname
    const currentSection = Object.keys(SUB_NAV_MAP).find(key => pathname.startsWith(key));
    const items = currentSection ? SUB_NAV_MAP[currentSection] : null;

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
