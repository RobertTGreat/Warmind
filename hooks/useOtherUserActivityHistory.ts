import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityHistoryItem, fetchHistoryForMode } from './useActivityHistory';

interface OtherUserActivityHistoryOptions {
    includeAllActivities?: boolean;
}

const ALL_ACTIVITY_MODE = 0;
const RAID_ACTIVITY_MODE = 4;
const DUNGEON_ACTIVITY_MODE = 82;

export function useOtherUserActivityHistory(
    membershipType: number | null,
    destinyMembershipId: string | null,
    characterIds: string[],
    options: OtherUserActivityHistoryOptions = {}
) {
    const includeAllActivities = options.includeAllActivities ?? false;
    const sortedCharacterIds = useMemo(
        () => [...characterIds].sort(),
        [characterIds.join(',')]
    );
    const isEnabled = Boolean(
        membershipType && destinyMembershipId && sortedCharacterIds.length > 0
    );

    const { data: baseHistory, isLoading: loading } = useQuery({
        queryKey: [
            'otherUserActivityHistory',
            membershipType,
            destinyMembershipId,
            sortedCharacterIds.join(','),
            'base',
        ],
        queryFn: async () => {
            const [raids, dungeons] = await Promise.all([
                fetchHistoryForMode(membershipType!, destinyMembershipId!, sortedCharacterIds, RAID_ACTIVITY_MODE),
                fetchHistoryForMode(membershipType!, destinyMembershipId!, sortedCharacterIds, DUNGEON_ACTIVITY_MODE),
            ]);

            return { raids, dungeons };
        },
        enabled: isEnabled,
        staleTime: 10 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    const { data: allHistory = [], isLoading: loadingAllHistory } = useQuery({
        queryKey: [
            'otherUserActivityHistory',
            membershipType,
            destinyMembershipId,
            sortedCharacterIds.join(','),
            'all',
        ],
        queryFn: () =>
            fetchHistoryForMode(
                membershipType!,
                destinyMembershipId!,
                sortedCharacterIds,
                ALL_ACTIVITY_MODE
            ),
        enabled: includeAllActivities && isEnabled,
        staleTime: 10 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    return {
        raidHistory: baseHistory?.raids ?? [],
        dungeonHistory: baseHistory?.dungeons ?? [],
        allHistory: includeAllActivities ? allHistory : [],
        isLoadingHistory: loading,
        isLoadingAllHistory: includeAllActivities && loadingAllHistory,
    };
}

