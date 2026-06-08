"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
    LogOut, 
    Menu, 
    X, 
    Settings,
    ChevronDown,
    Check,
    Heart,
    Search,
    Star
} from 'lucide-react';
import { CLASS_NAMES } from '@/hooks/useDestinyProfile';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { logout, getBungieImage } from '@/lib/bungie';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  getHeaderNavigationEntries,
  headerNavigationItems,
  isNavigationHrefActive,
  type HeaderNavigationEntry,
} from '@/lib/navigation';

export function Header() {
  const pathname = usePathname();
  const { stats, displayName, isLoggedIn, allCharacters, selectCharacter } = useDestinyProfileContext();
  const headerSearchQuery = useUIStore((state) => state.headerSearchQuery);
  const headerSearchVisible = useUIStore((state) => state.headerSearchVisible);
  const headerSearchPlaceholder = useUIStore((state) => state.headerSearchPlaceholder);
  const setHeaderSearchQuery = useUIStore((state) => state.setHeaderSearchQuery);
  const favouriteHeaderNavHrefs = useSettingsStore((state) => state.favouriteHeaderNavHrefs);
  const toggleFavouriteHeaderNavItem = useSettingsStore((state) => state.toggleFavouriteHeaderNavItem);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [characterSelectorOpen, setCharacterSelectorOpen] = useState(false);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [showHeaderNavLabels, setShowHeaderNavLabels] = useState(true);
  const headerNavRef = useRef<HTMLElement>(null);
  const headerNavMeasurementRef = useRef<HTMLUListElement>(null);
  const characterSelectorRef = useRef<HTMLDivElement>(null);
  const searchPopoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerNavigationEntries = useMemo(() => getHeaderNavigationEntries(), []);
  const headerNavigationEntryByHref = useMemo(
    () => new Map(headerNavigationEntries.map((item) => [item.href, item])),
    [headerNavigationEntries]
  );
  const favouriteHeaderNavItems = useMemo(
    () =>
      favouriteHeaderNavHrefs.reduce<HeaderNavigationEntry[]>((items, href) => {
        const navigationEntry = headerNavigationEntryByHref.get(href);

        if (navigationEntry) {
          items.push(navigationEntry);
        }

        return items;
      }, []),
    [favouriteHeaderNavHrefs, headerNavigationEntryByHref]
  );
  const expandedHeaderNavigationItems = useMemo(
    () =>
      [...headerNavigationItems].sort((firstItem, secondItem) => {
        const firstItemSubPageCount = firstItem.subNav?.length ?? 0;
        const secondItemSubPageCount = secondItem.subNav?.length ?? 0;

        return secondItemSubPageCount - firstItemSubPageCount;
      }),
    []
  );

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
    setCharacterSelectorOpen(false);
    setSearchPopoverOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    if (menuOpen || !isLoggedIn) {
      return;
    }

    const updateHeaderNavLabelVisibility = () => {
      const headerNav = headerNavRef.current;
      const measurementList = headerNavMeasurementRef.current;

      if (!headerNav || !measurementList) {
        setShowHeaderNavLabels(true);
        return;
      }

      const availableWidth = headerNav.getBoundingClientRect().width;
      const labelledNavigationWidth = measurementList.getBoundingClientRect().width;

      if (availableWidth <= 0 || labelledNavigationWidth <= 0) {
        setShowHeaderNavLabels(true);
        return;
      }

      setShowHeaderNavLabels(labelledNavigationWidth <= availableWidth);
    };

    const animationFrameId = window.requestAnimationFrame(updateHeaderNavLabelVisibility);

    const resizeObserver = new ResizeObserver(updateHeaderNavLabelVisibility);

    if (headerNavRef.current) {
      resizeObserver.observe(headerNavRef.current);
    }

    if (headerNavMeasurementRef.current) {
      resizeObserver.observe(headerNavMeasurementRef.current);
    }

    window.addEventListener('resize', updateHeaderNavLabelVisibility);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderNavLabelVisibility);
    };
  }, [favouriteHeaderNavItems, isLoggedIn, menuOpen]);

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

  useEffect(() => {
    if (!searchPopoverOpen) return;

    searchInputRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchPopoverRef.current &&
        !searchPopoverRef.current.contains(event.target as Node)
      ) {
        setSearchPopoverOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchPopoverOpen]);

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

      {/* Header bar - always 64px */}
      <header className="sticky top-0 z-50 h-16 w-full border-b border-white/10 bg-[#0f1115] shadow-lg shadow-black/30">
        <div className="h-16">
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
                <nav
                  ref={headerNavRef}
                  className="relative mx-2 flex min-w-0 flex-1 justify-center overflow-hidden animate-in fade-in duration-150 sm:mx-4"
                >
                  {isLoggedIn && (
                    <>
                      <ul
                        ref={headerNavMeasurementRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap opacity-0"
                      >
                        {favouriteHeaderNavItems.map((item) => {
                          const Icon = item.icon;

                          return (
                            <li key={item.href}>
                              <span className="relative flex items-center gap-2 px-3 py-2 text-sm font-medium uppercase tracking-wider">
                                <Icon className="h-4 w-4 shrink-0" />
                                <span>{item.name}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      <ul className="no-scrollbar flex items-center gap-1 overflow-x-auto flex-nowrap">
                        {favouriteHeaderNavItems.map((item) => {
                          const isActive = isNavigationHrefActive(pathname, item.href);
                          const Icon = item.icon;
                          
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                title={item.parentName ? `${item.parentName}: ${item.name}` : item.name}
                                className={cn(
                                  "relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors uppercase tracking-wider",
                                  isActive 
                                    ? "text-destiny-gold bg-white/5" 
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className={showHeaderNavLabels ? "inline" : "hidden"}>{item.name}</span>
                                
                                {isActive && (
                                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-destiny-gold shadow-[0_0_8px_rgba(227,206,98,0.5)]" />
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </>
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
            <div className="flex shrink-0 items-center justify-end min-w-[48px] gap-2">
              {!menuOpen && headerSearchVisible && (
                <div className="relative" ref={searchPopoverRef}>
                  <button
                    type="button"
                    onClick={() => setSearchPopoverOpen((isOpen) => !isOpen)}
                    className={cn(
                      "flex p-2 transition-colors",
                      searchPopoverOpen
                        ? "bg-white/10 text-destiny-gold"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    )}
                    title="Search"
                    aria-expanded={searchPopoverOpen}
                    aria-label="Search inventory"
                  >
                    <Search className="h-5 w-5" />
                  </button>

                  {searchPopoverOpen && (
                    <div className="absolute right-0 top-full z-100 mt-3 w-[min(24rem,calc(100vw-2rem))] border border-white/10 bg-[#0b0f14]/95 p-3 shadow-2xl shadow-black/70 backdrop-blur-xl">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder={headerSearchPlaceholder}
                          className="w-full border border-white/10 bg-black/45 py-2.5 pl-9 pr-9 text-sm text-white outline-none transition-colors focus:border-destiny-gold/60"
                          value={headerSearchQuery}
                          onChange={(event) => setHeaderSearchQuery(event.target.value)}
                        />
                        {headerSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setHeaderSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 transition-colors hover:text-white"
                            aria-label="Clear search"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Settings Link (Desktop only, when menu closed) */}
              {!menuOpen && (
                <Link
                  href="/settings"
                  className={cn(
                    "flex p-2 transition-colors",
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
              className="fixed inset-0 top-16 z-40 bg-black/60 animate-in fade-in duration-200"
              onClick={() => setMenuOpen(false)}
            />
            
            {/* Menu Panel */}
            <div
              className="fixed top-16 left-0 right-0 z-50 border-b border-white/10 bg-[#0b0f14]/95 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="px-6 sm:px-12 py-6 max-w-7xl mx-auto">
                {/* Navigation Cards Grid */}
                <div className="flex flex-wrap gap-x-6 gap-y-4 justify-center">
                  {expandedHeaderNavigationItems.map((item) => {
                    const isActive = isNavigationHrefActive(pathname, item.href);
                    const Icon = item.icon;
                    const hasSubNav = item.subNav && item.subNav.length > 0;
                    const isMainItemFavourite = favouriteHeaderNavHrefs.includes(item.href);
                    
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
                          "group relative flex w-44 flex-col transition-all duration-200 border border-transparent",
                          isActive 
                            ? "bg-white/5 border-white/10" 
                            : "hover:border-white/20"
                        )}
                      >
                        {/* Main Card Content */}
                        <Link
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className="flex min-h-28 flex-col p-3 pr-10"
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

                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleFavouriteHeaderNavItem(item.href);
                          }}
                          className={cn(
                            "absolute right-2 top-2 z-10 p-1 transition-colors",
                            isMainItemFavourite
                              ? "text-destiny-gold"
                              : "text-slate-600 hover:text-destiny-gold"
                          )}
                          title={isMainItemFavourite ? `Remove ${item.name} from header` : `Add ${item.name} to header`}
                          aria-label={isMainItemFavourite ? `Remove ${item.name} from header` : `Add ${item.name} to header`}
                        >
                          <Star
                            className={cn(
                              "w-3.5 h-3.5",
                              isMainItemFavourite && "fill-current"
                            )}
                          />
                        </button>

                        {/* Sub Navigation */}
                        {hasSubNav && (
                          <div className="border-t border-white/10 p-1">
                            {item.subNav!.map((subItem) => {
                              const SubIcon = subItem.icon;
                              const isSubActive = isNavigationHrefActive(pathname, subItem.href);
                              const isSubItemFavourite = favouriteHeaderNavHrefs.includes(subItem.href);
                              
                              return (
                                <div
                                  key={subItem.href}
                                  className={cn(
                                    "flex items-center transition-colors",
                                    isSubActive
                                      ? "bg-destiny-gold/10 text-destiny-gold"
                                      : "text-slate-500 hover:bg-white/5 hover:text-white"
                                  )}
                                >
                                  <Link
                                    href={subItem.href}
                                    onClick={() => setMenuOpen(false)}
                                    title={subItem.name}
                                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-xs transition-colors"
                                  >
                                    <SubIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{subItem.name}</span>
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      toggleFavouriteHeaderNavItem(subItem.href);
                                    }}
                                    title={isSubItemFavourite ? `Remove ${subItem.name} from header` : `Add ${subItem.name} to header`}
                                    aria-label={isSubItemFavourite ? `Remove ${subItem.name} from header` : `Add ${subItem.name} to header`}
                                    className={cn(
                                      "mr-1 p-1 transition-colors",
                                      isSubItemFavourite
                                        ? "text-destiny-gold"
                                        : "text-slate-600 hover:text-destiny-gold"
                                    )}
                                  >
                                    <Star
                                      className={cn(
                                        "h-3 w-3",
                                        isSubItemFavourite && "fill-current"
                                      )}
                                    />
                                  </button>
                                </div>
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
