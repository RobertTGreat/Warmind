import { useState, useEffect } from 'react';
import { getActivityHistory } from '@/lib/bungie';
import { ActivityHistoryItem } from './useActivityHistory';

export function useOtherUserActivityHistory(
    membershipType: number | null,
    destinyMembershipId: string | null,
    characterIds: string[]
) {
    const [raidHistory, setRaidHistory] = useState<ActivityHistoryItem[]>([]);
    const [dungeonHistory, setDungeonHistory] = useState<ActivityHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!membershipType || !destinyMembershipId || characterIds.length === 0) {
            setRaidHistory([]);
            setDungeonHistory([]);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const raids: ActivityHistoryItem[] = [];
                const dungeons: ActivityHistoryItem[] = [];

                for (const charId of characterIds) {
                    // Fetch Raids (Mode 4)
                    try {
                        let page = 0;
                        let hasMore = true;
                        while (hasMore) {
                            const raidRes = await getActivityHistory(membershipType, destinyMembershipId, charId, 4, 250, page);
                            const activities = raidRes.data.Response?.activities;
                            
                            if (activities && activities.length > 0) {
                                raids.push(...activities.map((a: any) => ({ ...a, characterId: charId })));
                                page++;
                            } else {
                                hasMore = false;
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to fetch raid history for char ${charId}`, e);
                    }

                    // Fetch Dungeons (Mode 82)
                    try {
                        let page = 0;
                        let hasMore = true;
                        while (hasMore) {
                            const dungeonRes = await getActivityHistory(membershipType, destinyMembershipId, charId, 82, 250, page);
                            const activities = dungeonRes.data.Response?.activities;

                            if (activities && activities.length > 0) {
                                dungeons.push(...activities.map((a: any) => ({ ...a, characterId: charId })));
                                page++;
                            } else {
                                hasMore = false;
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to fetch dungeon history for char ${charId}`, e);
                    }
                }

                // Deduplicate by instanceId
                const uniqueRaids = Array.from(new Map(raids.map(item => [item.activityDetails.instanceId, item])).values());
                const uniqueDungeons = Array.from(new Map(dungeons.map(item => [item.activityDetails.instanceId, item])).values());

                // Sort by date (newest first)
                uniqueRaids.sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime());
                uniqueDungeons.sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime());

                setRaidHistory(uniqueRaids);
                setDungeonHistory(uniqueDungeons);
            } catch (err) {
                console.error("Error fetching activity history", err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [membershipType, destinyMembershipId, characterIds.join(',')]);

    return {
        raidHistory,
        dungeonHistory,
        isLoadingHistory: loading
    };
}

