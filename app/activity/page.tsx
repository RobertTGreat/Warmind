'use client';

import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { useActivityHistory } from '@/hooks/useActivityHistory';
import { ACTIVITIES } from '@/lib/activityDefinitions';
import { ActivityReportCard } from '@/components/ActivityReportCard';
import { PGCRViewer } from '@/components/PGCRViewer';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useState } from 'react';

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

    const { raidHistory, dungeonHistory, isLoadingHistory } = useActivityHistory();
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="w-full h-[calc(100vh-80px)] flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-destiny-gold" />
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="p-10 text-center text-slate-400">
                Please login to view your activity report.
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
                title="Activity Report" 
                description="Track your Raid and Dungeon completions, flawless runs, and exotic drops."
            />

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
