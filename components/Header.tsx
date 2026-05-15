"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
    Shield, 
    Book, 
    User, 
    Scroll, 
    Activity, 
    Trophy, 
    LogOut, 
    Globe, 
    Menu, 
    X, 
    Settings,
    Box,
    Backpack,
    Home,
    Medal,
    Users,
    Swords,
    ChevronDown,
    Check,
    Heart
} from 'lucide-react';
import { CLASS_NAMES } from '@/hooks/useDestinyProfile';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { logout, getBungieImage } from '@/lib/bungie';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { useEffect, useState, useRef } from 'react';
import { CacheStatusBadge } from '@/components/CacheStatusBadge';

type SubNavItem = { name: string; href: string; icon: any };

const navItems: { 
  name: string; 
  href: string; 
  icon: any; 
  description: string;
  subNav?: SubNavItem[];
  disabled?: boolean;
}[] = [
  { name: 'Home', href: '/', icon: Shield, description: 'Dashboard & Overview' },
  { name: 'Collections', href: '/collections', icon: Book, description: 'Weapons, Armor & More' },
  { name: 'Triumphs', href: '/triumphs', icon: Trophy, description: 'Achievements & Seals' },
  { 
    name: 'Character', 
    href: '/character', 
    icon: User, 
    description: 'Inventory & Loadouts',
    subNav: [
      { name: 'Overview', href: '/character', icon: Home },
      { name: 'Vault', href: '/character/vault', icon: Box },
      { name: 'Inventory', href: '/character/inventory', icon: Backpack },
    ]
  },
  { name: 'Quests', href: '/quests', icon: Scroll, description: 'Active Quests' },
  { 
    name: 'Activities', 
    href: '/activity', 
    icon: Globe, 
    description: 'Past Activities',
    subNav: [
      { name: 'Activity Report', href: '/activity', icon: Book },
      { name: 'Wrapped', href: '/activity/wrapped', icon: Swords },
    ]
  },
];

export function Header() {
  const pathname = usePathname();
  const { stats, displayName, isLoggedIn, allCharacters, selectCharacter } = useDestinyProfileContext();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [characterSelectorOpen, setCharacterSelectorOpen] = useState(false);
  const characterSelectorRef = useRef<HTMLDivElement>(null);

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
    setCharacterSelectorOpen(false);
  }, [pathname]);

  // Close character selector on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (characterSelectorRef.current && !characterSelectorRef.current.contains(event.target as Node)) {
        setCharacterSelectorOpen(false);
      }
    };
    
    if (characterSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [characterSelectorOpen]);

  // Fetch emblem definition to get secondaryOverlay
  const emblemHash = stats?.emblemHash;
  const { definitions: emblemDefs } = useItemDefinitions(emblemHash ? [emblemHash] : []);
  const emblemDef = emblemHash ? emblemDefs[emblemHash] : null;

  const emblemImage = 
      (emblemDef?.secondaryOverlay && getBungieImage(emblemDef.secondaryOverlay)) ||
      (emblemDef?.secondarySpecial && getBungieImage(emblemDef.secondarySpecial)) ||
      (emblemDef?.secondaryIcon && getBungieImage(emblemDef.secondaryIcon)) ||
      stats?.emblemPath;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!isLoggedIn) return null;

  return (
    <>
      {/* Emblem - Positioned at root level so it can overlay everything */}
      {isLoggedIn && stats && emblemImage && (
        <div className="fixed top-0 left-4 sm:left-8 w-24 h-24 overflow-hidden shadow-xl z-100 pointer-events-none">
          <Image 
            src={emblemImage} 
            alt="Emblem" 
            fill 
            sizes="96px"
            className="object-cover"
            priority
            fetchPriority="high"
          />
        </div>
      )}

      {/* Fixed header bar - always 64px */}
      <header className="sticky top-0 z-50 w-full h-16">
        <div className="h-16 border-b border-white/5 bg-gray-800/20 backdrop-blur-xl">
          <div className="px-4 sm:px-8 w-full mx-auto h-full">
          {/* Top Bar - Always visible */}
          <div className="flex h-16 items-center justify-between">
            {/* Left: User Stats */}
            <div className="flex items-center gap-4 min-w-[200px] relative shrink-0" ref={characterSelectorRef}>
              {isLoggedIn && stats ? (
                <div className="flex items-center gap-3 animate-in fade-in duration-500">
                  {/* Spacer for emblem */}
                  <div className="w-24 h-16 shrink-0" />
                  
                  {/* Clickable user details */}
                  <button 
                    onClick={() => setCharacterSelectorOpen(!characterSelectorOpen)}
                    className={cn(
                      "flex flex-col ml-4 z-0 text-left px-3 py-1.5 -mx-3 -my-1.5 transition-all duration-200",
                      "hover:bg-white/5 cursor-pointer group",
                      characterSelectorOpen && "bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm tracking-wide">{displayName}</span>
                      <span className={cn(
                        "text-xs text-slate-500 px-1.5 py-0.5 bg-white/5",
                        "group-hover:bg-white/10 transition-colors"
                      )}>
                        {CLASS_NAMES[stats.classType]}
                      </span>
                      <ChevronDown className={cn(
                        "w-3.5 h-3.5 text-slate-500 transition-transform duration-200",
                        characterSelectorOpen && "rotate-180 text-destiny-gold"
                      )} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="text-destiny-gold font-semibold">✧ {stats.light}</span>
                      <span>•</span>
                      <span className="text-white/80">GR {stats.guardianRank}</span>
                      <span>•</span>
                      <span>Season {stats.seasonRank ?? '-'}</span>
                    </div>
                  </button>
                  <CacheStatusBadge />
                  
                  {/* Character Selector Dropdown */}
                    {characterSelectorOpen && allCharacters.length > 1 && (
                      <div
                        className="absolute left-28 top-full mt-2 z-100 w-64 bg-gray-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/70 overflow-hidden isolate animate-in fade-in slide-in-from-top-2 duration-150"
                        style={{ backdropFilter: 'blur(24px) saturate(180%)' }}
                      >
                        <div className="p-2 border-b border-white/5">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold px-2">
                            Switch Character
                          </span>
                        </div>
                        <div className="p-1">
                          {allCharacters.map((char) => {
                            const isSelected = char.characterId === stats.characterId;
                            return (
                              <button
                                key={char.characterId}
                                onClick={() => {
                                  selectCharacter(char.characterId);
                                  setCharacterSelectorOpen(false);
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 border border-transparent",
                                  isSelected 
                                    ? "bg-linear-to-r from-destiny-gold/10 to-transparent text-destiny-gold border-l-destiny-gold border-l-2 border-r-0" 
                                    : "text-slate-300 hover:bg-linear-to-r from-white/5 to-transparent hover:text-white hover:border-l-white/70 border-l-2 border-r-0"
                                )}
                              >
                                {/* Character Emblem */}
                                <div className="relative w-10 h-10  overflow-hidden shrink-0 border border-white/10">
                                  <Image
                                    src={char.emblemPath}
                                    alt={CLASS_NAMES[char.classType]}
                                    fill
                                    sizes="40px"
                                    className="object-cover"
                                  />
                                </div>
                                
                                {/* Character Info */}
                                <div className="flex-1 text-left">
                                  <div className="font-semibold text-sm">
                                    {CLASS_NAMES[char.classType]}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    ✧ {char.light} Power
                                  </div>
                                </div>
                                
                                {/* Selected Indicator */}
                                {isSelected && (
                                  <Check className="w-4 h-4 text-destiny-gold shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="w-8 h-8" /> 
              )}
            </div>

            {/* Center: Navigation (Desktop, only when menu closed) */}
              {!menuOpen && (
                <nav className="flex-1 justify-center mx-4 overflow-hidden hidden lg:flex animate-in fade-in duration-150">
                  {isLoggedIn && (
                    <ul className="flex items-center gap-1 sm:gap-4 flex-nowrap">
                      {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        
                        if (item.disabled) {
                          return (
                            <li key={item.name}>
                              <span
                                className="relative flex items-center gap-2 px-3 py-2 text-sm font-medium uppercase tracking-wider text-slate-600 cursor-not-allowed"
                                title="Coming Soon"
                              >
                                <Icon className="w-4 h-4" />
                                <span className="hidden xl:inline">{item.name}</span>
                              </span>
                            </li>
                          );
                        }
                        
                        return (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              className={cn(
                                "relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors uppercase tracking-wider",
                                isActive 
                                  ? "text-destiny-gold bg-white/5" 
                                  : "text-slate-400 hover:text-white hover:bg-white/5"
                              )}
                            >
                              <Icon className="w-4 h-4" />
                              <span className="hidden xl:inline">{item.name}</span>
                              
                              {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-destiny-gold shadow-[0_0_8px_rgba(227,206,98,0.5)]" />
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </nav>
              )}

            {/* Center: Settings & Logout (only when menu open) */}
              {menuOpen && (
                <div className="flex-1 flex items-center justify-end gap-3 mx-4 animate-in fade-in slide-in-from-right-2 duration-200">
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "p-2.5 transition-colors",
                      pathname === '/settings'
                        ? "bg-white/10 text-destiny-gold"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                    title="Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                  <button 
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}

            {/* Right: Hamburger Menu Button */}
            <div className="flex items-center justify-end min-w-[48px] gap-2">
              {/* Settings Link (Desktop only, when menu closed) */}
              {!menuOpen && (
                <Link
                  href="/settings"
                  className={cn(
                    "hidden lg:flex p-2 transition-colors",
                    pathname === '/settings'
                      ? "text-destiny-gold bg-white/5"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>
              )}

              {/* Hamburger Menu Button */}
              {isLoggedIn && (
                <button 
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={cn(
                    "p-2 transition-colors",
                    menuOpen 
                      ? "text-destiny-gold bg-white/10" 
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                  title={menuOpen ? "Close Menu" : "Open Menu"}
                >
                  {menuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </header>

      {/* Overlay Menu Panel */}
        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 top-16 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setMenuOpen(false)}
            />
            
            {/* Menu Panel */}
            <div
              className="fixed top-16 left-0 right-0 z-50 bg-gray-800/20 backdrop-blur-xl border-b border-white/10 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="px-6 sm:px-12 py-6 max-w-7xl mx-auto">
                {/* Navigation Cards Grid */}
                <div className="flex flex-wrap gap-x-6 gap-y-4 justify-center">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    const hasSubNav = item.subNav && item.subNav.length > 0;
                    
                    // Handle disabled items
                    if (item.disabled) {
                      return (
                        <div
                          key={item.name}
                          className="group relative flex transition-all duration-200 border border-transparent opacity-40 cursor-not-allowed"
                          title="Coming Soon"
                        >
                          <div className="flex flex-col p-3 w-32">
                            <div className="w-5 h-5 mb-2 text-slate-600">
                              <Icon className="w-full h-full" />
                            </div>
                            <div className="font-semibold text-sm mb-0.5 text-slate-600">
                              {item.name}
                            </div>
                            <div className="text-xs text-slate-700 leading-relaxed">
                              Coming Soon
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={item.name}
                        className={cn(
                          "group relative flex transition-all duration-200 border border-transparent",
                          isActive 
                            ? "bg-white/5 border-white/10" 
                            : "hover:border-white/20"
                        )}
                      >
                        {/* Main Card Content */}
                        <Link
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className="flex flex-col p-3 w-32"
                        >
                          {/* Icon */}
                          <div className={cn(
                            "w-5 h-5 mb-2 transition-colors",
                            isActive 
                              ? "text-destiny-gold" 
                              : "text-slate-400 group-hover:text-white"
                          )}>
                            <Icon className="w-full h-full" />
                          </div>
                          
                          {/* Title */}
                          <div className={cn(
                            "font-semibold text-sm mb-0.5 transition-colors",
                            isActive ? "text-white" : "text-white"
                          )}>
                            {item.name}
                          </div>
                          
                          {/* Description */}
                          <div className="text-xs text-slate-500 leading-relaxed">
                            {item.description}
                          </div>

                          {/* Active Indicator - Left border accent */}
                          {isActive && (
                            <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-destiny-gold" />
                          )}
                        </Link>

                        {/* Sub Navigation - Vertical on right side, centered */}
                        {hasSubNav && (
                          <div className="flex flex-col justify-center border-l border-white/10">
                            {item.subNav!.map((subItem) => {
                              const SubIcon = subItem.icon;
                              const isSubActive = pathname === subItem.href;
                              
                              return (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  onClick={() => setMenuOpen(false)}
                                  title={subItem.name}
                                  className={cn(
                                    "p-2 transition-colors",
                                    isSubActive
                                      ? "text-destiny-gold bg-destiny-gold/10"
                                      : "text-slate-500 hover:text-white hover:bg-white/5"
                                  )}
                                >
                                  <SubIcon className="w-4 h-4" />
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Support and other projects links */}
                <div className="flex justify-center mt-4 pt-3 border-t border-white/5">
                  <div className="inline-flex items-center gap-3 text-xs text-slate-500">
                    <a
                      href="https://ko-fi.com/roberttgreat"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-[#FF5E5B] transition-colors"
                    >
                      <Heart className="w-3 h-3" />
                      <span>Support on Ko-fi</span>
                    </a>
                    <span className="text-slate-700">•</span>
                    <a
                      href="https://pleiades.chat"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <Image
                        src="/favicon-pleiades.svg"
                        alt="Pleiades"
                        width={12}
                        height={12}
                        className="w-3 h-3"
                      />
                      <span>pleiades.chat</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
    </>
  );
}
