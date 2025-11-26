'use client';

import { useEffect } from "react";
import { loginWithBungie } from "@/lib/bungie";
import { ArrowRight } from "lucide-react";
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { NewsFeed } from "@/components/NewsFeed";
import { ClanBrowser } from "@/components/ClanBrowser";
import { FireteamList } from "@/components/FireteamList";

export default function Home() {
  const { isLoggedIn } = useDestinyProfile();

  useEffect(() => {
    // Hide scrollbar on home page
    document.documentElement.classList.add('no-scrollbar');
    document.body.classList.add('no-scrollbar');

    return () => {
      document.documentElement.classList.remove('no-scrollbar');
      document.body.classList.remove('no-scrollbar');
    };
  }, []);

  if (!isLoggedIn) {
    // Login Overlay State
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-xl">
            <div className="flex flex-col items-center space-y-8 p-8 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white/5 rounded-sm flex items-center justify-center border border-white/10 shadow-2xl">
                        <div className="w-8 h-8 bg-destiny-gold rotate-45" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-[0.2em] text-white uppercase">
                        WARMIND
                    </h1>
                </div>
                
                <p className="text-slate-400 max-w-sm text-center text-sm leading-relaxed">
                    Sign in with your Bungie account to access your personalized dashboard.
                </p>

                <button
                    onClick={() => loginWithBungie()}
                    className="group relative px-8 py-4 bg-destiny-gold/90 hover:bg-destiny-gold text-slate-900 font-bold text-lg uppercase tracking-widest rounded-sm transition-all hover:shadow-[0_0_30px_rgba(227,206,98,0.3)]"
                >
                    <span className="flex items-center gap-2">
                        Login with Bungie
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </span>
                </button>
            </div>
        </div>
    );
  }

  // Dashboard State (Logged In)
  return (
    <div className="flex justify-center pt-8 min-h-screen pb-20">
      {/* Main Dashboard Content - Center */}
      <div className="flex-1 px-4 sm:px-8 space-y-12 max-w-[1400px]">
          {/* News Feed */}
          <div className="space-y-6">
            <div className="w-full">
                <NewsFeed />
            </div>
          </div>

          {/* Bottom Grid: Clan Roster (2 cols) + Fireteam (1 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Clan Roster */}
              <div className="lg:col-span-2">
                  <ClanBrowser />
              </div>

              {/* Fireteam Widget */}
              <div className="lg:col-span-1 h-full">
                   <FireteamList />
              </div>
          </div>
      </div>
    </div>
  );
}
