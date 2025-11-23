"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Shield, Book, Swords, User, Scroll, Activity, Trophy, UserCircle, LogOut, Globe } from 'lucide-react';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { logout, getBungieImage } from '@/lib/bungie';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';

const navItems = [
  { name: 'Clan', href: '/clan', icon: Shield },
  { name: 'Collections', href: '/collections', icon: Book },
  { name: 'Triumphs', href: '/triumphs', icon: Trophy },
  { name: 'Portal', href: '/portal', icon: Globe },
  { name: 'Character', href: '/character', icon: User },
  { name: 'Quests', href: '/quests', icon: Scroll },
  { name: 'Activity', href: '/activity', icon: Activity },
];

import { useEffect, useState } from 'react';

export function Header() {
  const pathname = usePathname();
  const { stats, displayName, isLoggedIn } = useDestinyProfile();
  const [mounted, setMounted] = useState(false);

  // Fetch emblem definition to get secondaryOverlay
  const emblemHash = stats?.emblemHash;
  // Use useItemDefinitions to fetch the emblem definition
  const { definitions: emblemDefs } = useItemDefinitions(emblemHash ? [emblemHash] : []);
  const emblemDef = emblemHash ? emblemDefs[emblemHash] : null;

  // Prefer secondaryOverlay, fallback to secondarySpecial, secondaryIcon, then stats.emblemPath
  // secondaryOverlay is usually the transparent "character menu" version of the emblem
  const emblemImage = 
      (emblemDef?.secondaryOverlay && getBungieImage(emblemDef.secondaryOverlay)) ||
      (emblemDef?.secondarySpecial && getBungieImage(emblemDef.secondarySpecial)) ||
      (emblemDef?.secondaryIcon && getBungieImage(emblemDef.secondaryIcon)) ||
      stats?.emblemPath;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering content dependent on auth state until mounted
  if (!mounted) return null;

  if (!isLoggedIn) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-gray-800/20 backdrop-blur-md">
      <div className="flex h-16 items-center px-4 sm:px-8 w-full mx-auto justify-between">
        {/* Left: Stats (Logo Replacement) or Nothing */}
        <div className="flex items-center gap-4 min-w-[200px] relative shrink-0">
           {isLoggedIn && stats ? (
               <div className="flex items-center gap-3 animate-in fade-in duration-500">
                   {/* Emblem Icon */}
                   <div className="absolute top-0 left-0 w-24 h-24 rounded-sm overflow-hidden shadow-xl z-10">
                       {emblemImage && (
                           <Image 
                            src={emblemImage} 
                            alt="Emblem" 
                            fill 
                            sizes="96px"
                            className="object-cover" 
                           />
                       )}
                   </div>
                   
                   {/* Text Stats */}
                   <div className="flex flex-col ml-28 z-0">
                       <div className="flex items-center gap-2">
                           <span className="font-bold text-white text-sm tracking-wide">{displayName}</span>
                       </div>
                       <div className="flex items-center gap-2 text-xs text-slate-400">
                           <span className="text-destiny-gold font-semibold">✧ {stats.light}</span>
                           <span>•</span>
                           <span className="text-white/80">GR {stats.guardianRank}</span>
                           <span>•</span>
                           <span>Season {stats.seasonRank ?? '-'}</span>
                       </div>
                   </div>
            </div>
           ) : (
               // Show nothing if not logged in
               <div className="w-8 h-8" /> 
           )}
        </div>

        {/* Center: Navigation */}
        <nav className="flex-1 flex justify-center mx-4 overflow-hidden">
            {isLoggedIn && (
              <ul className="flex items-center gap-1 sm:gap-4 flex-nowrap">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-sm uppercase tracking-wider",
                      isActive 
                        ? "text-destiny-gold bg-white/5" 
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{item.name}</span>
                    
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-destiny-gold shadow-[0_0_8px_rgba(227,206,98,0.5)]"
                        initial={false}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
            )}
        </nav>

        {/* Right: Logout / Actions */}
        <div className="flex items-center justify-end min-w-[200px]">
             {isLoggedIn && (
                 <button 
                    onClick={() => logout()}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-sm transition-colors group relative"
                    title="Logout"
                 >
                     <LogOut className="w-5 h-5" />
                     <span className="sr-only">Logout</span>
                 </button>
             )}
        </div>
      </div>
    </header>
  );
}
