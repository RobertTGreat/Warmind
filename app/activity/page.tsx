'use client';

import dynamic from 'next/dynamic';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { useActivityHistory } from '@/hooks/useActivityHistory';
import { useOtherUserProfile } from '@/hooks/useOtherUserProfile';
import { useOtherUserActivityHistory } from '@/hooks/useOtherUserActivityHistory';
import { ACTIVITIES } from '@/lib/activityDefinitions';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useState, useMemo } from 'react';

// Lazy load heavy components
const ActivityReportCard = dynamic(
  () => import('@/components/ActivityReportCard').then((mod) => mod.ActivityReportCard),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-white/5 rounded" /> }
);

const PGCRViewer = dynamic(
  () => import('@/components/PGCRViewer').then((mod) => mod.PGCRViewer),
  { ssr: false }
);

const UserSearch = dynamic(
  () => import('@/components/UserSearch').then((mod) => mod.UserSearch),
  { ssr: false }
);

const CLASS_NAMES = {
    0: 'Titan',
    1: 'Hunter',
    2: 'Warlock'
};

export default function ActivityPage() {
    const { 
        profile, 
        isLoading, 
        isError, 
        isLoggedIn,
    } = useDestinyProfile();

    const { raidHistory: myRaidHistory, dungeonHistory: myDungeonHistory, isLoadingHistory: myIsLoadingHistory } = useActivityHistory();
    
    // Other user state
    const [selectedUser, setSelectedUser] = useState<{ membershipType: number; membershipId: string; displayName: string } | null>(null);
    
    // Fetch other user's profile
    const { profile: otherUserProfile, isLoading: isLoadingOtherProfile } = useOtherUserProfile(
        selectedUser?.membershipType || null,
        selectedUser?.membershipId || null
    );

    // Get character IDs from other user's profile
    const otherUserCharacterIds = useMemo(() => {
        if (!otherUserProfile?.characters?.data) return [];
        return Object.keys(otherUserProfile.characters.data);
    }, [otherUserProfile]);

    // Fetch other user's activity history
    const { raidHistory: otherRaidHistory, dungeonHistory: otherDungeonHistory, isLoadingHistory: otherIsLoadingHistory } = 
        useOtherUserActivityHistory(
            selectedUser?.membershipType || null,
            selectedUser?.membershipId || null,
            otherUserCharacterIds
        );

    // Use selected user's data if available, otherwise use current user's data
    const activeProfile = selectedUser ? otherUserProfile : profile;
    const raidHistory = selectedUser ? otherRaidHistory : myRaidHistory;
    const dungeonHistory = selectedUser ? otherDungeonHistory : myDungeonHistory;
    const isLoadingHistory = selectedUser ? otherIsLoadingHistory : myIsLoadingHistory;
    const isLoadingProfile = selectedUser ? isLoadingOtherProfile : isLoading;

    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

    const handleSelectUser = (membershipType: number, membershipId: string, displayName: string) => {
        setSelectedUser({ membershipType, membershipId, displayName });
    };

    const handleClearUser = () => {
        setSelectedUser(null);
    };

    if (isLoadingProfile) {
        return (
            <div className="w-full h-[calc(100vh-80px)] flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-destiny-gold" />
            </div>
        );
    }

    if (!isLoggedIn && !selectedUser) {
        return (
            <div className="p-10 text-center text-slate-400">
                Please login to view your activity report, or search for another player.
            </div>
        );
    }

    if (selectedUser && !activeProfile) {
        return (
            <div className="p-10 text-center text-slate-400">
                <Loader2 className="w-12 h-12 animate-spin text-destiny-gold mx-auto mb-4" />
                <p>Loading {selectedUser.displayName}'s profile...</p>
            </div>
        );
    }

    const metrics = profile?.metrics?.data;
    const records = profile?.profileRecords?.data;
    const collectibles = profile?.profileCollectibles?.data;
    
    const characters = profile?.characters?.data || {};
    const characterIds = Object.keys(characters);
    const characterClasses: Record<string, string> = {};
    characterIds.forEach(id => {
        const clsType = characters[id].classType;
        characterClasses[id] = CLASS_NAMES[clsType as keyof typeof CLASS_NAMES] || 'Unknown';
    });

    const raids = ACTIVITIES.filter(a => a.type === 'RAID');
    const dungeons = ACTIVITIES.filter(a => a.type === 'DUNGEON');

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24">
            <PageHeader 
                title={selectedUser ? `${selectedUser.displayName}'s Activity Report` : "Activity Report"} 
                description="Track Raid and Dungeon completions, flawless runs, and exotic drops."
            >
                <div className="flex flex-col items-end gap-2">
                    <UserSearch 
                        onSelectUser={handleSelectUser}
                        onClear={handleClearUser}
                        selectedUser={selectedUser}
                    />
                    {selectedUser && (
                        <div className="text-sm text-slate-400">
                            Viewing: <span className="text-white font-semibold">{selectedUser.displayName}</span>
                        </div>
                    )}
                </div>
            </PageHeader>

            <div className="mt-8 space-y-12">
                {/* Raids Section */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-destiny-gold rounded-full"/>
                        Raids
                    </h2>
                    {isLoadingHistory && raidHistory.length === 0 ? (
                         <div className="text-slate-500 italic animate-pulse">Loading activity history...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {raids.map(activity => (
                                <ActivityReportCard 
                                    key={activity.id} 
                                    activity={activity}
                                    metrics={metrics}
                                    records={records}
                                    collectibles={collectibles}
                                    history={raidHistory}
                                    onSelectRun={setSelectedActivityId}
                                    characterIds={characterIds}
                                    characterClasses={characterClasses}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Dungeons Section */}
                <section>
                     <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-purple-500 rounded-full"/>
                        Dungeons
                    </h2>
                     {isLoadingHistory && dungeonHistory.length === 0 ? (
                         <div className="text-slate-500 italic animate-pulse">Loading activity history...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {dungeons.map(activity => (
                                <ActivityReportCard 
                                    key={activity.id} 
                                    activity={activity}
                                    metrics={metrics}
                                    records={records}
                                    collectibles={collectibles}
                                    history={dungeonHistory}
                                    onSelectRun={setSelectedActivityId}
                                    characterIds={characterIds}
                                    characterClasses={characterClasses}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* PGCR Modal */}
            {selectedActivityId && (
                <PGCRViewer 
                    instanceId={selectedActivityId} 
                    onClose={() => setSelectedActivityId(null)} 
                />
            )}
        </div>
    );
}
