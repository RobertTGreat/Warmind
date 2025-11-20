'use client';

import { FrostedCard } from "@/components/FrostedCard";
import { loginWithBungie } from "@/lib/bungie";
import { ArrowRight, Calendar, Star, Trophy, Globe, Crown, Clock } from "lucide-react";
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { SeasonPassTrack } from "@/components/SeasonPassTrack";
import { SeasonalChallenges } from "@/components/SeasonalChallenges";

export default function Home() {
  const { isLoggedIn, isLoading, stats, profile } = useDestinyProfile();

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
    <div className="flex flex-col items-center pt-8 min-h-screen pb-20">
      {/* Dashboard Content */}
      <div className="w-full max-w-7xl px-4 sm:px-8 space-y-8">
          
          {/* Seasonal Section */}
          <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Crown className="w-6 h-6 text-destiny-gold" />
                  Seasonal Operations
              </h2>
              <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Season Pass & Challenges */}
            <div className="space-y-6">
                <FrostedCard className="p-6 space-y-6 min-h-[300px] relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-destiny-gold/20 rounded-sm flex items-center justify-center border border-destiny-gold/30">
                            <Star className="w-5 h-5 text-destiny-gold" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Season Pass</h3>
                            <p className="text-xs text-slate-400">Reward Track</p>
                        </div>
                    </div>
                    
                    {/* Real Season Pass Track */}
                    {stats?.currentSeasonHash && stats.characterProgressions ? (
                        <SeasonPassTrack 
                            seasonHash={stats.currentSeasonHash} 
                            progressions={stats.characterProgressions} 
                        />
                    ) : (
                        <div className="text-sm text-slate-500">Loading season data...</div>
                    )}
                    
                    <div className="pt-6 border-t border-white/5">
                        <div className="flex items-center gap-3 mb-4">
                             <div className="w-8 h-8 bg-destiny-gold/10 rounded-sm flex items-center justify-center border border-destiny-gold/20">
                                <Trophy className="w-4 h-4 text-destiny-gold" />
                            </div>
                            <h4 className="text-sm font-bold text-white uppercase">
                                Seasonal Challenges
                            </h4>
                        </div>
                        
                        {/* Real Seasonal Challenges */}
                        {stats?.currentSeasonHash ? (
                             <SeasonalChallenges seasonHash={stats.currentSeasonHash} profile={profile} />
                        ) : (
                             <div className="text-sm text-slate-500">Loading challenges...</div>
                        )}
                    </div>
                </FrostedCard>
            </div>

            {/* Column 2: Weekly & Daily */}
            <div className="space-y-6">
                <FrostedCard className="p-6 space-y-4 min-h-[300px]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-sm flex items-center justify-center border border-blue-500/30">
                            <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Ritual Activities</h3>
                            <p className="text-xs text-slate-400">Weekly & Daily</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weekly Pathfinder</h4>
                             <div className="p-3 bg-white/5 rounded-sm border border-white/5 flex items-center justify-between">
                                 <span className="text-sm text-white">Objectives Complete</span>
                                 <span className="text-destiny-gold font-mono">3/10</span>
                             </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daily Challenges</h4>
                             <div className="space-y-2">
                                 <div className="flex items-center gap-2 text-sm text-slate-300">
                                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                     <span>Vanguard Ops</span>
                                 </div>
                                 <div className="flex items-center gap-2 text-sm text-slate-300">
                                     <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                                     <span>Crucible Match</span>
                                 </div>
                                 <div className="flex items-center gap-2 text-sm text-slate-300">
                                     <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                                     <span>Gambit Matches</span>
                                 </div>
                             </div>
                        </div>
                    </div>
                </FrostedCard>
            </div>
            
            {/* Column 3: Events */}
            <div className="space-y-6">
                <FrostedCard className="p-6 space-y-4 min-h-[300px] relative">
                     {/* Active Event Indicator */}
                     <div className="absolute top-0 right-0 p-2">
                         <div className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-wider">
                             Inactive
                         </div>
                     </div>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-sm flex items-center justify-center border border-purple-500/30">
                            <Globe className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Event Card</h3>
                            <p className="text-xs text-slate-400">Limited Time Events</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center h-40 text-center space-y-2 opacity-50">
                        <Clock className="w-8 h-8 text-slate-600" />
                        <p className="text-sm text-slate-500">No active event.</p>
                    </div>
                    
                    <div className="pt-4 border-t border-white/5">
                         <h4 className="text-sm font-bold text-white uppercase mb-2">Active Title</h4>
                         <div className="p-2 bg-white/5 rounded-sm text-center">
                             <span className="text-purple-300 font-bold tracking-widest uppercase text-sm">
                                 {stats?.title || "GODSLAYER"}
                             </span>
                         </div>
                    </div>
                </FrostedCard>
            </div>
          </div>
      </div>
    </div>
  );
}
