"use client";

import type { ElementType } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Backpack,
  Book,
  Home,
  Layers,
  Medal,
  Scroll,
  Shield,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import {
  DEFAULT_PAGE_OPTIONS,
  type DefaultPage,
} from "@/lib/defaultPages";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

const pageIconMap: Record<DefaultPage, ElementType> = {
  "/": Home,
  "/character": User,
  "/character/inventory": Backpack,
  "/character/loadouts": Layers,
  "/character/optimizer": Target,
  "/collections": Book,
  "/triumphs": Medal,
  "/quests": Scroll,
  "/activity": Activity,
  "/activity/wrapped": Sparkles,
};

export function DefaultPagePrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const hasChosenDefaultPage = useSettingsStore(
    (state) => state.hasChosenDefaultPage,
  );
  const setDefaultPage = useSettingsStore((state) => state.setDefaultPage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || hasChosenDefaultPage) {
    return null;
  }

  const handleChooseDefaultPage = (page: DefaultPage) => {
    setDefaultPage(page);

    if (pathname === "/" && page !== "/") {
      router.replace(page);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl border border-white/10 bg-[#0b0f14] p-5 shadow-2xl shadow-black/70 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-destiny-gold/10 text-destiny-gold">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Choose your default page
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Where should Warmind open when you visit the app?
            </p>
          </div>
        </div>

        <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {DEFAULT_PAGE_OPTIONS.map((option) => {
            const Icon = pageIconMap[option.value];

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChooseDefaultPage(option.value)}
                className={cn(
                  "flex items-center gap-3 border border-white/10 bg-white/[0.03] p-3 text-left transition-colors",
                  "hover:border-destiny-gold/40 hover:bg-destiny-gold/10",
                  "focus:outline-none focus:ring-2 focus:ring-destiny-gold/50",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-black/30 text-slate-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
