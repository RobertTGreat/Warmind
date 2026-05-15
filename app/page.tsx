'use client';

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { loginWithBungie } from "@/lib/bungie";
import { 
  ArrowRight, 
  Shield, 
  Users, 
  Trophy, 
  Newspaper, 
  Package, 
  BarChart3,
  Sparkles,
  Heart
} from "lucide-react";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";

// Lazy load heavy components to reduce initial JS bundle
const NewsFeed = dynamic(
  () => import("@/components/NewsFeed").then((mod) => mod.NewsFeed),
  { 
    ssr: false,
    loading: () => <div className="h-[300px] animate-pulse bg-white/5 rounded-sm" />
  }
);

const ClanBrowser = dynamic(
  () => import("@/components/ClanBrowser").then((mod) => mod.ClanBrowser),
  { 
    ssr: false,
    loading: () => <div className="h-[400px] animate-pulse bg-white/5 rounded-sm" />
  }
);

const FireteamList = dynamic(
  () => import("@/components/FireteamList").then((mod) => mod.FireteamList),
  { 
    ssr: false,
    loading: () => <div className="h-[400px] animate-pulse bg-white/5 rounded-sm" />
  }
);

const features = [
  {
    icon: Newspaper,
    title: "Live News Feed",
    description: "Latest TWAB posts and patch notes"
  },
  {
    icon: Users,
    title: "Clan Roster",
    description: "Track members' online status in real-time"
  },
  {
    icon: Package,
    title: "Inventory Manager",
    description: "Manage vault and transfer items"
  },
  {
    icon: Trophy,
    title: "Triumphs & Collections",
    description: "Track seals and collectibles"
  },
  {
    icon: BarChart3,
    title: "Activity History",
    description: "Review raids, Crucible, and Nightfalls"
  },
  {
    icon: Shield,
    title: "Character Loadouts",
    description: "Save and equip builds instantly"
  }
];

export default function Home() {
  const { isLoggedIn } = useDestinyProfileContext();
  const [mounted, setMounted] = useState(false);

  // Always call useEffect unconditionally to prevent hook order issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Hide scrollbar on home page when logged out
    if (mounted && !isLoggedIn) {
      document.documentElement.classList.add('no-scrollbar');
      document.body.classList.add('no-scrollbar');
    }

    return () => {
      document.documentElement.classList.remove('no-scrollbar');
      document.body.classList.remove('no-scrollbar');
    };
  }, [mounted, isLoggedIn]);

  if (!mounted) {
    return <LandingPage />;
  }

  if (!isLoggedIn) {
    return <LandingPage />;
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

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Image */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/Renegades-Background.jpg"
          alt=""
          fill
          className="object-cover blur-md"
          priority
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 lg:px-10 py-12 lg:py-0">
        <div className="w-full max-w-[1600px] grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12 items-center">
          
          {/* Left Side - Branding & Features */}
          <div className="space-y-8">
            {/* Logo & Title */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14">
                  <Image
                    src="/icon-512.png"
                    alt="Warmind Logo"
                    fill
                    className="object-contain drop-shadow-[0_0_20px_rgba(227,206,98,0.3)]"
                    priority
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-[0.2em] text-white uppercase">
                    WARMIND
                  </h1>
                  <p className="text-destiny-gold/80 text-xs tracking-[0.3em] uppercase">
                    Destiny 2 Companion
                  </p>
                </div>
              </div>
              
              <p className="text-slate-400 leading-relaxed max-w-md">
                Your personal command center for Destiny 2. Track progress, manage inventory, 
                and stay connected with your fireteam.
              </p>
            </div>

            {/* Feature List */}
            <ul className="space-y-3">
              {features.map((feature) => (
                <li key={feature.title} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-destiny-gold/10 rounded flex items-center justify-center shrink-0">
                    <feature.icon className="w-4 h-4 text-destiny-gold" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-white font-medium text-sm">{feature.title}</span>
                    <span className="text-slate-300 text-sm">— {feature.description}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => loginWithBungie()}
                className="group px-8 py-4 bg-destiny-gold hover:bg-destiny-gold/90 text-slate-900 font-bold uppercase tracking-widest rounded-sm transition-all duration-300 hover:shadow-[0_0_40px_rgba(227,206,98,0.3)]"
              >
                <span className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4" />
                  Sign in with Bungie
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>

              {/* Trust Badges */}
              <div className="flex items-center gap-4 text-xs text-slate-500 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Secure OAuth
                </span>
                <span className="text-slate-600">•</span>
                <span>No Password Stored</span>
              </div>
            </div>
          </div>

          {/* Right Side - Screenshot */}
          <div className="hidden lg:block">
            {/* Screenshot Container */}
            <div className="rounded-lg overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
              {/* Browser Frame */}
              <div className="bg-slate-800/90 px-4 py-2.5 flex items-center gap-2 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-slate-900/80 px-3 py-0.5 rounded text-xs text-slate-400">
                    warmind.app
                  </div>
                </div>
              </div>

              {/* Screenshot */}
              <Image
                src="/screenshot-desktop.png"
                alt="Warmind dashboard interface"
                width={1920}
                height={1080}
                className="w-full h-auto"
              />
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative px-6 py-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col gap-2 text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2024 WARMIND</span>
            <div className="inline-flex items-center gap-3">
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
          <p className="text-center sm:text-left">
            Not affiliated with Bungie. Destiny is a registered trademark of Bungie, Inc.
          </p>
        </div>
      </footer>
    </div>
  );
}
