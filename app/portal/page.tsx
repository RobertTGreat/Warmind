'use client';

import { PageHeader } from "@/components/PageHeader";
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { SeasonPassTrack } from "@/components/SeasonPassTrack";
import { SeasonalChallenges } from "@/components/SeasonalChallenges";
import { WeeklyMilestones } from "@/components/WeeklyMilestones";
import { EventCard } from "@/components/EventCard";
import { Loader2, Lock } from "lucide-react";
import { loginWithBungie } from "@/lib/bungie";

export default function PortalPage() {
  const { profile, stats, isLoggedIn, isLoading } = useDestinyProfile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-destiny-gold" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="p-4 bg-white/5 rounded-full">
            <Lock className="w-12 h-12 text-slate-400" />
        </div>
        <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Authentication Required</h1>
            <p className="text-slate-400 max-w-md">
                Please sign in with your Bungie.net account to access the Portal, track your progress, and view seasonal rewards.
            </p>
        </div>
        <button 
            onClick={loginWithBungie}
            className="px-8 py-3 bg-destiny-gold text-black font-bold uppercase tracking-wider rounded-sm hover:bg-yellow-400 transition-colors"
        >
            Sign In with Bungie
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 pt-10">
      <div className="px-4 sm:px-8 space-y-12 max-w-[1600px] mx-auto mt-8">
        
        {/* Event Section (Conditionally Rendered) */}
        <EventCard profile={profile} />

        {/* Seasonal Section */}
        <section className="space-y-6">
            <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-bold text-white">Seasonal Progress</h2>
                <span className="px-2 py-0.5 text-xs font-bold bg-destiny-gold/20 text-destiny-gold rounded uppercase">
                    Current Season
                </span>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Season Pass Track - Takes up 2 cols */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-black/20 border border-white/5 p-6 rounded-sm backdrop-blur-sm">
                        <SeasonPassTrack 
                            seasonHash={stats?.currentSeasonHash} 
                            progressions={stats?.characterProgressions} 
                        />
                    </div>
                </div>

                {/* Seasonal Challenges - Takes up 1 col */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white uppercase tracking-wide">Seasonal Challenges</h3>
                    <div className="bg-black/20 border border-white/5 p-6 rounded-sm backdrop-blur-sm">
                        <SeasonalChallenges 
                            seasonHash={stats?.currentSeasonHash} 
                            profile={profile}
                        />
                    </div>
                </div>
            </div>
        </section>

        {/* Weekly Section */}
        <section className="space-y-6">
            <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-bold text-white">Weekly Activities</h2>
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-500/20 text-blue-400 rounded uppercase">
                    Resets Tuesday
                </span>
            </div>
            
            <div className="bg-black/20 border border-white/5 p-6 rounded-sm backdrop-blur-sm">
                <WeeklyMilestones />
            </div>
        </section>

      </div>
    </div>
  );
}
