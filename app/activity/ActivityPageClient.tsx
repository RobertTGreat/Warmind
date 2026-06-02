'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowDownAZ,
    ArrowDownZA,
    ArrowUpDown,
    BarChart3,
    Check,
    ChevronDown,
    Filter,
    Info,
    Loader2,
    RotateCcw,
    Search,
    ShieldCheck,
    Skull,
    SlidersHorizontal,
    Star,
    Swords,
    Timer,
    Trophy,
    Users,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { PageHeader } from '@/components/PageHeader';
import { FrostedCard } from '@/components/FrostedCard';
import { useActivityHistory } from '@/hooks/useActivityHistory';
import { useOtherUserProfile } from '@/hooks/useOtherUserProfile';
import { useOtherUserActivityHistory } from '@/hooks/useOtherUserActivityHistory';
import { useActivityDefinitions } from '@/hooks/useActivityDefinitions';
import { useManifestTable } from '@/hooks/useManifestTable';
import { searchUsers } from '@/hooks/useUserSearch';
import {
    ACTIVITIES,
    type ActivityType,
} from '@/lib/activityDefinitions';
import {
    ACTIVITY_SPECIAL_TAGS,
    ActivityDefinitionContext,
    ActivityReportSummary,
    ActivitySortDirection,
    ActivitySortKey,
    buildActivityCatalog,
    buildManifestActivityCatalog,
    buildActivityReport,
    collectActivityReferenceHashes,
    formatActivityDuration,
    sortActivityReports,
} from '@/lib/activityReport';
import { getInvalidInstanceIds } from '@/lib/activityCache';
import { cn } from '@/lib/utils';

const ActivityReportCard = dynamic(
    () => import('@/components/ActivityReportCard').then((mod) => mod.ActivityReportCard),
    { ssr: false, loading: () => <div className="h-[410px] animate-pulse rounded-md bg-white/5" /> }
);

const UserSearch = dynamic(
    () => import('@/components/UserSearch').then((mod) => mod.UserSearch),
    { ssr: false }
);

type SelectedUser = {
    membershipType: number;
    membershipId: string;
    displayName: string;
};

type ActivityScopeFilter = 'ENDGAME' | 'ALL_SUPPORTED';
type ActivityModeFilter = 'ALL' | string;
type PopoutPanel = 'INFO' | 'FILTERS' | 'SORT' | null;

interface ActivityModeFilterOption {
    value: ActivityModeFilter;
    label: string;
    keywords: string;
}

interface ActivityModeDefinitionContext {
    displayProperties?: {
        name?: string;
    };
}

const CLASS_NAMES = {
    0: 'Titan',
    1: 'Hunter',
    2: 'Warlock',
};

const SORT_OPTIONS: { key: ActivitySortKey; label: string }[] = [
    { key: 'type', label: 'Activity Mode' },
    { key: 'activity', label: 'Activity Name' },
    { key: 'totalClears', label: 'Total Clears' },
    { key: 'clears', label: 'Standard Clears' },
    { key: 'specialClears', label: 'Special Clears' },
    { key: 'failedClears', label: 'Failed Runs' },
    { key: 'fastest', label: 'Fastest Time' },
    { key: 'average', label: 'Average Time' },
    { key: 'totalTime', label: 'Total Time' },
    { key: 'kills', label: 'Kills' },
    { key: 'assists', label: 'Assists' },
    { key: 'deaths', label: 'Deaths' },
    { key: 'recent', label: 'Most Recent' },
];

const ENDGAME_ACTIVITY_TYPES = new Set<ActivityType>(['RAID', 'DUNGEON']);
const ALL_ACTIVITY_MODE_FILTER = 'ALL';

export default function ActivityPage() {
    const {
        profile,
        displayName,
        isLoading,
        isLoggedIn,
    } = useDestinyProfileContext();

    const [activityScope, setActivityScope] = useState<ActivityScopeFilter>('ENDGAME');
    const includeAllActivities = activityScope === 'ALL_SUPPORTED';

    const {
        raidHistory: myRaidHistory,
        dungeonHistory: myDungeonHistory,
        allHistory: myAllHistory,
        isLoadingHistory: myIsLoadingHistory,
        isLoadingAllHistory: myIsLoadingAllHistory,
    } = useActivityHistory({ includeAllActivities });

    const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
    const [activitySearch, setActivitySearch] = useState('');
    const [activityModeFilter, setActivityModeFilter] = useState<ActivityModeFilter>(ALL_ACTIVITY_MODE_FILTER);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [minimumClears, setMinimumClears] = useState(0);
    const [sortKey, setSortKey] = useState<ActivitySortKey>('type');
    const [sortDirection, setSortDirection] = useState<ActivitySortDirection>('asc');
    const [invalidInstanceIds, setInvalidInstanceIds] = useState<Set<string>>(new Set());
    const [openPanel, setOpenPanel] = useState<PopoutPanel>(null);
    const [flexModeEnabled, setFlexModeEnabled] = useState(false);
    const [sharedUserQuery, setSharedUserQuery] = useState<string | null>(null);

    const { profile: otherUserProfile, isLoading: isLoadingOtherProfile } = useOtherUserProfile(
        selectedUser?.membershipType || null,
        selectedUser?.membershipId || null
    );

    const otherUserCharacterIds = useMemo(() => {
        if (!otherUserProfile?.characters?.data) {
            return [];
        }

        return Object.keys(otherUserProfile.characters.data);
    }, [otherUserProfile]);

    const {
        raidHistory: otherRaidHistory,
        dungeonHistory: otherDungeonHistory,
        allHistory: otherAllHistory,
        isLoadingHistory: otherIsLoadingHistory,
        isLoadingAllHistory: otherIsLoadingAllHistory,
    } = useOtherUserActivityHistory(
        selectedUser?.membershipType || null,
        selectedUser?.membershipId || null,
        otherUserCharacterIds,
        { includeAllActivities }
    );

    useEffect(() => {
        getInvalidInstanceIds().then(setInvalidInstanceIds);
    }, []);

    useEffect(() => {
        const url = new URL(window.location.href);
        const queryUser = url.searchParams.get('user') || url.searchParams.get('');

        if (!queryUser) {
            return;
        }

        setSharedUserQuery(queryUser);
    }, []);

    useEffect(() => {
        if (!sharedUserQuery || selectedUser) {
            return;
        }

        let cancelled = false;

        const loadSharedUser = async () => {
            try {
                const searchResults = await searchUsers(sharedUserQuery);
                const matchingUser = searchResults[0];

                if (!matchingUser || cancelled) {
                    return;
                }

                const displayName = matchingUser.bungieGlobalDisplayName || matchingUser.displayName;
                const displayNameWithCode = matchingUser.bungieGlobalDisplayNameCode
                    ? `${displayName}#${matchingUser.bungieGlobalDisplayNameCode}`
                    : displayName;

                setSelectedUser({
                    membershipType: matchingUser.membershipType,
                    membershipId: matchingUser.membershipId,
                    displayName: displayNameWithCode,
                });
                setSharedUserQuery(displayNameWithCode);
                updateActivityReportUserUrl(displayNameWithCode);
            } catch (error) {
                console.error('Failed to load shared activity report user', error);
            }
        };

        loadSharedUser();

        return () => {
            cancelled = true;
        };
    }, [sharedUserQuery, selectedUser]);

    useEffect(() => {
        if (!isLoggedIn || selectedUser || sharedUserQuery) {
            return;
        }

        const url = new URL(window.location.href);
        const queryUser = url.searchParams.get('user') || url.searchParams.get('');

        if (queryUser) {
            return;
        }

        const currentUserDisplayName = getProfileShareDisplayName(profile, displayName);

        if (currentUserDisplayName) {
            updateActivityReportUserUrl(currentUserDisplayName);
        }
    }, [displayName, isLoggedIn, profile, selectedUser, sharedUserQuery]);

    const activeProfile = selectedUser ? otherUserProfile : profile;
    const raidHistory = selectedUser ? otherRaidHistory : myRaidHistory;
    const dungeonHistory = selectedUser ? otherDungeonHistory : myDungeonHistory;
    const allHistory = selectedUser ? otherAllHistory : myAllHistory;
    const isLoadingBaseHistory = selectedUser ? otherIsLoadingHistory : myIsLoadingHistory;
    const isLoadingFullHistory = selectedUser ? otherIsLoadingAllHistory : myIsLoadingAllHistory;
    const isLoadingProfile = selectedUser ? isLoadingOtherProfile : isLoggedIn && isLoading;

    const metrics = activeProfile?.metrics?.data;
    const records = activeProfile?.profileRecords?.data;
    const collectibles = activeProfile?.profileCollectibles?.data;

    const characters = activeProfile?.characters?.data || {};
    const characterIds = Object.keys(characters);
    const characterClasses = useMemo(() => {
        const classMap: Record<string, string> = {};

        for (const characterId of characterIds) {
            const classType = characters[characterId].classType;
            classMap[characterId] = CLASS_NAMES[classType as keyof typeof CLASS_NAMES] || 'Unknown';
        }

        return classMap;
    }, [characters, characterIds.join(',')]);

    const endgameHistory = useMemo(
        () => [...raidHistory, ...dungeonHistory],
        [raidHistory, dungeonHistory]
    );

    const activityHistory = includeAllActivities ? allHistory : endgameHistory;
    const referenceHashes = useMemo(
        () => collectActivityReferenceHashes(activityHistory),
        [activityHistory]
    );
    const { definitions: activityDefinitions } = useActivityDefinitions(referenceHashes);
    const { table: manifestActivityDefinitions } = useManifestTable<ActivityDefinitionContext>(
        'DestinyActivityDefinition',
        { view: 'activity-report-catalog' }
    );
    const { table: activityModeSourceDefinitions } = useManifestTable<ActivityDefinitionContext>(
        'DestinyActivityDefinition',
        { view: 'activity-card' }
    );
    const { table: activityTypeDefinitions } = useManifestTable<ActivityModeDefinitionContext>('DestinyActivityTypeDefinition');
    const { table: activityModeDefinitions } = useManifestTable<ActivityModeDefinitionContext>('DestinyActivityModeDefinition');

    const enrichedManifestActivityDefinitions = useMemo(() => enrichActivityDefinitionsWithModeNames(
        manifestActivityDefinitions ?? {},
        activityTypeDefinitions ?? {},
        activityModeDefinitions ?? {}
    ), [manifestActivityDefinitions, activityTypeDefinitions, activityModeDefinitions]);

    const enrichedHistoryActivityDefinitions = useMemo(() => enrichActivityDefinitionsWithModeNames(
        activityDefinitions,
        activityTypeDefinitions ?? {},
        activityModeDefinitions ?? {}
    ), [activityDefinitions, activityTypeDefinitions, activityModeDefinitions]);

    const enrichedActivityModeSourceDefinitions = useMemo(() => enrichActivityDefinitionsWithModeNames(
        activityModeSourceDefinitions ?? {},
        activityTypeDefinitions ?? {},
        activityModeDefinitions ?? {}
    ), [activityModeSourceDefinitions, activityTypeDefinitions, activityModeDefinitions]);

    const manifestBackedActivities = useMemo(() => buildManifestActivityCatalog(
        ACTIVITIES,
        enrichedManifestActivityDefinitions
    ), [enrichedManifestActivityDefinitions]);
    const activityDefinitionCatalog = useMemo(() => ({
        ...enrichedManifestActivityDefinitions,
        ...enrichedHistoryActivityDefinitions,
    }), [enrichedManifestActivityDefinitions, enrichedHistoryActivityDefinitions]);

    const activityCatalog = useMemo(() => buildActivityCatalog(
        manifestBackedActivities,
        activityHistory,
        activityDefinitionCatalog,
        includeAllActivities
    ), [activityHistory, activityDefinitionCatalog, includeAllActivities, manifestBackedActivities]);

    const activityModeFilterOptions = useMemo(
        () => buildActivityModeFilterOptions(enrichedActivityModeSourceDefinitions, activityCatalog),
        [enrichedActivityModeSourceDefinitions, activityCatalog]
    );

    const activityReports = useMemo(
        () => activityCatalog.map((activity) => buildActivityReport(activity, activityHistory, invalidInstanceIds)),
        [activityCatalog, activityHistory, invalidInstanceIds]
    );

    const filteredReports = useMemo(() => {
        const normalizedSearch = activitySearch.trim().toLowerCase();

        const matchingReports = activityReports.filter((report) => {
            if (!includeAllActivities && !ENDGAME_ACTIVITY_TYPES.has(report.activity.type)) {
                return false;
            }

            if (!reportMatchesActivityModeFilter(report, activityModeFilter)) {
                return false;
            }

            if (normalizedSearch && !report.activity.name.toLowerCase().includes(normalizedSearch)) {
                return false;
            }

            if (report.totalClears < minimumClears) {
                return false;
            }

            return selectedTags.every((tag) => Boolean(report.specialTagCounts[tag]));
        });

        return sortActivityReports(matchingReports, sortKey, sortDirection);
    }, [
        activityReports,
        activitySearch,
        activityModeFilter,
        includeAllActivities,
        minimumClears,
        selectedTags,
        sortDirection,
        sortKey,
    ]);

    const groupedReports = useMemo(() => groupReportsByMode(filteredReports), [filteredReports]);
    const aggregateStats = useMemo(() => getAggregateStats(filteredReports), [filteredReports]);
    const showSearchPrompt = !isLoggedIn && !selectedUser;
    const isLoadingRelevantHistory = includeAllActivities ? isLoadingFullHistory : isLoadingBaseHistory;
    const showHistoryLoading = isLoadingRelevantHistory && activityHistory.length === 0;
    const activeReportOwner = selectedUser?.displayName || displayName;
    const currentUserDisplayName = getProfileShareDisplayName(profile, displayName);

    const handleSelectUser = (membershipType: number, membershipId: string, userDisplayName: string) => {
        setSelectedUser({ membershipType, membershipId, displayName: userDisplayName });
        setSharedUserQuery(userDisplayName);
        updateActivityReportUserUrl(userDisplayName);
        setOpenPanel(null);
    };

    const handleClearUser = () => {
        setSelectedUser(null);
        setSharedUserQuery(null);
        updateActivityReportUserUrl(currentUserDisplayName);
        setOpenPanel(null);
    };

    const toggleSpecialTag = (tag: string) => {
        setSelectedTags((currentTags) => (
            currentTags.includes(tag)
                ? currentTags.filter((currentTag) => currentTag !== tag)
                : [...currentTags, tag]
        ));
    };

    const handleActivityModeChange = (nextActivityModeFilter: ActivityModeFilter) => {
        setActivityModeFilter(nextActivityModeFilter);

        if (
            nextActivityModeFilter !== ALL_ACTIVITY_MODE_FILTER &&
            !isEndgameActivityModeFilter(nextActivityModeFilter)
        ) {
            setActivityScope('ALL_SUPPORTED');
        }
    };

    const resetControls = () => {
        setActivitySearch('');
        setActivityScope('ENDGAME');
        setActivityModeFilter(ALL_ACTIVITY_MODE_FILTER);
        setSelectedTags([]);
        setMinimumClears(0);
        setSortKey('type');
        setSortDirection('asc');
    };

    return (
        <div className="min-h-screen pb-24 ml-12 md:ml-0">
            <PageHeader
                title={activeReportOwner ? `${activeReportOwner}'s Activity Report` : 'Activity Report'}
                description="Review raid and dungeon clears, special runs, speed trends, and PGCR details."
            >
                <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:items-end">
                    <div className="flex items-start gap-2">
                        <UserSearch
                            onSelectUser={handleSelectUser}
                            onClear={handleClearUser}
                            selectedUser={selectedUser}
                        />
                        <ActivityHeaderControls
                            openPanel={openPanel}
                            setOpenPanel={setOpenPanel}
                            infoPanel={(
                                <InfoPanel
                                    stats={aggregateStats}
                                    ownerName={activeReportOwner}
                                    loading={showHistoryLoading}
                                    shownCount={filteredReports.length}
                                    totalCount={activityReports.length}
                                    includeAllActivities={includeAllActivities}
                                    flexModeEnabled={flexModeEnabled}
                                    onFlexModeToggle={() => setFlexModeEnabled((enabled) => !enabled)}
                                />
                            )}
                            filtersPanel={(
                                <FilterPanel
                                    activitySearch={activitySearch}
                                    activityScope={activityScope}
                                    activityModeFilter={activityModeFilter}
                                    activityModeOptions={activityModeFilterOptions}
                                    minimumClears={minimumClears}
                                    selectedTags={selectedTags}
                                    onSearchChange={setActivitySearch}
                                    onScopeChange={setActivityScope}
                                    onModeChange={handleActivityModeChange}
                                    onMinimumClearsChange={setMinimumClears}
                                    onTagToggle={toggleSpecialTag}
                                    onReset={resetControls}
                                />
                            )}
                            sortPanel={(
                                <SortPanel
                                    sortKey={sortKey}
                                    sortDirection={sortDirection}
                                    onSortKeyChange={setSortKey}
                                    onSortDirectionChange={setSortDirection}
                                />
                            )}
                        />
                    </div>
                    {selectedUser && (
                        <div className="flex items-center justify-end gap-2 text-sm text-slate-400">
                            <span>Viewing</span>
                            <span className="font-semibold text-white">{selectedUser.displayName}</span>
                        </div>
                    )}
                </div>
            </PageHeader>

            {showSearchPrompt ? (
                <FrostedCard className="mx-auto mt-16 max-w-2xl p-8 text-center">
                    <Search className="mx-auto mb-4 h-10 w-10 text-destiny-gold" />
                    <h2 className="text-2xl font-bold uppercase tracking-wide text-white">
                        Search a Guardian
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Sign in to view your own report, or search for another player above.
                    </p>
                </FrostedCard>
            ) : isLoadingProfile ? (
                <div className="flex h-[calc(100vh-220px)] items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-destiny-gold" />
                </div>
            ) : selectedUser && !activeProfile ? (
                <FrostedCard className="mx-auto mt-16 max-w-2xl p-8 text-center">
                    <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-destiny-gold" />
                    <p className="text-slate-400">Loading {selectedUser.displayName}&apos;s profile...</p>
                </FrostedCard>
            ) : (
                <section className="min-w-0 space-y-4">
                    {selectedTags.length > 0 && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedTags([])}
                                className="inline-flex items-center gap-2 self-start border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                                Clear Tags
                            </button>
                        </div>
                    )}

                    {showHistoryLoading ? (
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="h-[410px] animate-pulse rounded-md bg-white/5" />
                            ))}
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <FrostedCard className="p-10 text-center">
                            <Filter className="mx-auto mb-3 h-8 w-8 text-slate-500" />
                            <p className="font-semibold text-white">No activities match those filters.</p>
                            <button
                                type="button"
                                onClick={resetControls}
                                className="mt-4 inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-destiny-gold/50 hover:text-white"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Reset controls
                            </button>
                        </FrostedCard>
                    ) : (
                        <div className="space-y-8">
                            {groupedReports.map((group) => (
                                <div key={group.mode} className="space-y-4">
                                    <ActivityModeDivider mode={group.mode} count={group.reports.length} />
                                    <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                                        {group.reports.map((report) => (
                                            <ActivityReportCard
                                                key={report.activity.id}
                                                report={report}
                                                metrics={metrics}
                                                records={records}
                                                collectibles={collectibles}
                                                characterIds={characterIds}
                                                characterClasses={characterClasses}
                                                flexModeEnabled={flexModeEnabled}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

function ActivityModeDivider({ mode, count }: { mode: string; count: number }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold uppercase tracking-wide text-white">
                    {mode}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    {count}
                </span>
            </div>
            <div className="h-px flex-1 bg-white/10" />
        </div>
    );
}

function ActivityHeaderControls({
    openPanel,
    setOpenPanel,
    infoPanel,
    filtersPanel,
    sortPanel,
}: {
    openPanel: PopoutPanel;
    setOpenPanel: (panel: PopoutPanel) => void;
    infoPanel: ReactNode;
    filtersPanel: ReactNode;
    sortPanel: ReactNode;
}) {
    const activePanel = openPanel === 'INFO' ? infoPanel : openPanel === 'FILTERS' ? filtersPanel : openPanel === 'SORT' ? sortPanel : null;

    return (
        <div className="relative flex shrink-0 items-start gap-1">
            <RailButton
                label="Report info"
                icon={Info}
                active={openPanel === 'INFO'}
                onClick={() => setOpenPanel(openPanel === 'INFO' ? null : 'INFO')}
            />
            <RailButton
                label="Filters"
                icon={SlidersHorizontal}
                active={openPanel === 'FILTERS'}
                onClick={() => setOpenPanel(openPanel === 'FILTERS' ? null : 'FILTERS')}
            />
            <RailButton
                label="Sort"
                icon={ArrowUpDown}
                active={openPanel === 'SORT'}
                onClick={() => setOpenPanel(openPanel === 'SORT' ? null : 'SORT')}
            />

            {activePanel && (
                <div
                    className="absolute right-0 top-12 z-50"
                    style={{ width: 'min(22rem, calc(100vw - 2rem))' }}
                >
                    {activePanel}
                </div>
            )}
        </div>
    );
}

function RailButton({
    label,
    icon: Icon,
    active,
    onClick,
}: {
    label: string;
    icon: LucideIcon;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            title={label}
            onClick={onClick}
            className={cn(
                'flex h-10 w-10 items-center justify-center rounded-sm border transition-colors',
                active
                    ? 'border-destiny-gold bg-destiny-gold text-slate-950 shadow-[0_0_15px_rgba(227,206,98,0.35)]'
                    : 'border-white/10 bg-[#151922]/95 text-slate-300 hover:border-white/25 hover:text-white'
            )}
        >
            <Icon className="h-5 w-5" />
            <span className="sr-only">{label}</span>
        </button>
    );
}

function InfoPanel({
    stats,
    ownerName,
    loading,
    shownCount,
    totalCount,
    includeAllActivities,
    flexModeEnabled,
    onFlexModeToggle,
}: {
    stats: AggregateStats;
    ownerName?: string | null;
    loading: boolean;
    shownCount: number;
    totalCount: number;
    includeAllActivities: boolean;
    flexModeEnabled: boolean;
    onFlexModeToggle: () => void;
}) {
    return (
        <FrostedCard className="p-4 shadow-2xl">
            <PanelTitle
                icon={BarChart3}
                title="Report Info"
                action={onFlexModeToggle}
                actionIcon={Star}
                actionLabel={flexModeEnabled ? 'Disable Flex mode' : 'Enable Flex mode'}
                actionActive={flexModeEnabled}
            />

            <div className="mt-4 space-y-4">
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Guardian</div>
                    <div className="mt-1 truncate text-2xl font-bold uppercase tracking-wide text-white">
                        {ownerName || 'Unknown'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                        {shownCount} of {totalCount} cards shown - {includeAllActivities ? 'All supported history' : 'Raids and dungeons'}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <SummaryTile icon={Trophy} label="Clears" value={stats.totalClears.toLocaleString()} loading={loading} />
                    <SummaryTile icon={ShieldCheck} label="Special" value={stats.specialClears.toLocaleString()} loading={loading} />
                    <SummaryTile icon={Timer} label="Total Time" value={formatActivityDuration(stats.totalSeconds)} loading={loading} />
                    <SummaryTile icon={Swords} label="Kills" value={stats.totalKills.toLocaleString()} loading={loading} />
                    <SummaryTile icon={Users} label="Assists" value={stats.totalAssists.toLocaleString()} loading={loading} />
                    <SummaryTile icon={Skull} label="Deaths" value={stats.totalDeaths.toLocaleString()} loading={loading} />
                </div>
            </div>
        </FrostedCard>
    );
}

function SummaryTile({
    icon: Icon,
    label,
    value,
    loading,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    loading: boolean;
}) {
    return (
        <div className="min-w-0 border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <Icon className="h-3 w-3" />
                <span>{label}</span>
            </div>
            <div className="mt-1 truncate text-xl font-bold text-white">
                {loading ? <span className="inline-block h-6 w-14 animate-pulse bg-white/10" /> : value}
            </div>
        </div>
    );
}

function FilterPanel({
    activitySearch,
    activityScope,
    activityModeFilter,
    activityModeOptions,
    minimumClears,
    selectedTags,
    onSearchChange,
    onScopeChange,
    onModeChange,
    onMinimumClearsChange,
    onTagToggle,
    onReset,
}: {
    activitySearch: string;
    activityScope: ActivityScopeFilter;
    activityModeFilter: ActivityModeFilter;
    activityModeOptions: ActivityModeFilterOption[];
    minimumClears: number;
    selectedTags: string[];
    onSearchChange: (value: string) => void;
    onScopeChange: (value: ActivityScopeFilter) => void;
    onModeChange: (value: ActivityModeFilter) => void;
    onMinimumClearsChange: (value: number) => void;
    onTagToggle: (tag: string) => void;
    onReset: () => void;
}) {
    return (
        <FrostedCard className="p-4 shadow-2xl">
            <PanelTitle icon={SlidersHorizontal} title="Filters" action={onReset} />

            <div className="mt-4 space-y-5">
                <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Activity Name
                    </span>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={activitySearch}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Search activity cards"
                            className="w-full border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-destiny-gold/60"
                        />
                    </div>
                </label>

                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        View
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 border border-white/10 p-1">
                        <SegmentButton
                            label="Raid + Dungeon"
                            active={activityScope === 'ENDGAME'}
                            onClick={() => onScopeChange('ENDGAME')}
                        />
                        <SegmentButton
                            label="All Supported"
                            active={activityScope === 'ALL_SUPPORTED'}
                            onClick={() => onScopeChange('ALL_SUPPORTED')}
                        />
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Activity Mode
                    </div>
                    <ActivityModeSearchSelect
                        value={activityModeFilter}
                        options={activityModeOptions}
                        onChange={onModeChange}
                    />
                </div>

                <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Minimum Clears
                    </span>
                    <input
                        type="number"
                        min={0}
                        value={minimumClears}
                        onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            onMinimumClearsChange(Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0);
                        }}
                        className="mt-2 w-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-destiny-gold/60"
                    />
                </label>

                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Special Tags
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {ACTIVITY_SPECIAL_TAGS.map((tag) => {
                            const selected = selectedTags.includes(tag);
                            const dayOneTag = tag === 'Day One';

                            return (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => onTagToggle(tag)}
                                    className={cn(
                                        'rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors',
                                        selected
                                            ? dayOneTag
                                                ? 'border-destiny-gold bg-destiny-gold text-black'
                                                : 'border-destiny-gold bg-destiny-gold/15 text-destiny-gold'
                                            : dayOneTag
                                                ? 'border-destiny-gold/70 bg-destiny-gold text-black hover:border-destiny-gold'
                                                : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                                    )}
                                >
                                    {tag}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </FrostedCard>
    );
}

function ActivityModeSearchSelect({
    value,
    options,
    onChange,
}: {
    value: ActivityModeFilter;
    options: ActivityModeFilterOption[];
    onChange: (value: ActivityModeFilter) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [menuPosition, setMenuPosition] = useState<{
        left: number;
        top: number;
        width: number;
    } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find((option) => option.value === value);
    const normalizedSearchText = searchText.trim().toLowerCase();
    const filteredOptions = options.filter((option) => {
        if (!normalizedSearchText) {
            return true;
        }

        return `${option.label} ${option.value} ${option.keywords}`
            .toLowerCase()
            .includes(normalizedSearchText);
    });

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            const clickedTrigger = containerRef.current?.contains(target);
            const clickedMenu = menuRef.current?.contains(target);

            if (!clickedTrigger && !clickedMenu) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const updateMenuPosition = () => {
            const buttonRect = buttonRef.current?.getBoundingClientRect();

            if (!buttonRect) {
                return;
            }

            setMenuPosition({
                left: buttonRect.left,
                top: buttonRect.bottom + 8,
                width: buttonRect.width,
            });
        };

        updateMenuPosition();
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [isOpen]);

    const handleSelect = (nextValue: ActivityModeFilter) => {
        onChange(nextValue);
        setSearchText('');
        setIsOpen(false);
    };

    const dropdownMenu = isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
                ref={menuRef}
                className="fixed z-[1000] border border-white/10 shadow-2xl shadow-black/60"
                style={{
                    left: menuPosition.left,
                    top: menuPosition.top,
                    width: menuPosition.width,
                    backgroundColor: '#0d1118',
                }}
            >
                <div className="relative border-b border-white/10">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setIsOpen(false);
                            }
                        }}
                        autoFocus
                        placeholder="Search activity modes"
                        className="w-full bg-black/30 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                </div>

                <div role="listbox" className="max-h-64 overflow-y-auto py-1">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => {
                            const selected = option.value === value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => handleSelect(option.value)}
                                    className={cn(
                                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                                        selected
                                            ? 'bg-destiny-gold/15 text-destiny-gold'
                                            : 'text-slate-200 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {selected && (
                                        <Check className="h-4 w-4 shrink-0 text-destiny-gold" />
                                    )}
                                </button>
                            );
                        })
                    ) : (
                        <div className="px-3 py-3 text-sm text-slate-500">
                            No matching types
                        </div>
                    )}
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <div ref={containerRef} className="relative mt-2">
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((currentValue) => !currentValue)}
                className={cn(
                    'flex min-h-10 w-full items-center justify-between gap-2 border border-white/10 bg-black/30 px-3 py-2 text-left text-sm text-white outline-none transition-colors',
                    isOpen
                        ? 'border-destiny-gold/60'
                        : 'hover:border-white/20'
                )}
            >
                <span className="truncate font-semibold">
                    {selectedOption?.label ?? 'All Activity Modes'}
                </span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                        isOpen && 'rotate-180 text-destiny-gold'
                    )}
                />
            </button>

            {dropdownMenu}
        </div>
    );
}

function SegmentButton({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'min-h-10 px-2 py-2 text-[11px] font-semibold uppercase leading-tight tracking-normal transition-colors sm:text-xs sm:tracking-wide',
                active
                    ? 'bg-destiny-gold text-black'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
            )}
        >
            {label}
        </button>
    );
}

function SortPanel({
    sortKey,
    sortDirection,
    onSortKeyChange,
    onSortDirectionChange,
}: {
    sortKey: ActivitySortKey;
    sortDirection: ActivitySortDirection;
    onSortKeyChange: (value: ActivitySortKey) => void;
    onSortDirectionChange: (value: ActivitySortDirection) => void;
}) {
    const DirectionIcon = sortDirection === 'asc' ? ArrowDownAZ : ArrowDownZA;

    return (
        <FrostedCard className="p-4 shadow-2xl">
            <PanelTitle icon={ArrowUpDown} title="Sort" />

            <div className="mt-4 space-y-4">
                <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Sort By
                    </span>
                    <select
                        value={sortKey}
                        onChange={(event) => onSortKeyChange(event.target.value as ActivitySortKey)}
                        className="mt-2 w-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-destiny-gold/60"
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <button
                    type="button"
                    onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
                    className="flex w-full items-center justify-center gap-2 border border-white/10 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                >
                    <DirectionIcon className="h-4 w-4" />
                    {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                </button>
            </div>
        </FrostedCard>
    );
}

function PanelTitle({
    icon: Icon,
    title,
    action,
    actionIcon: ActionIcon = RotateCcw,
    actionLabel = 'Reset filters',
    actionActive = false,
}: {
    icon: LucideIcon;
    title: string;
    action?: () => void;
    actionIcon?: LucideIcon;
    actionLabel?: string;
    actionActive?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-destiny-gold" />
                <h3 className="text-lg font-bold uppercase tracking-wide text-white">
                    {title}
                </h3>
            </div>
            {action && (
                <button
                    type="button"
                    onClick={action}
                    aria-pressed={actionActive}
                    className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-sm border transition-colors',
                        actionActive
                            ? 'border-destiny-gold bg-destiny-gold text-slate-950 shadow-[0_0_14px_rgba(227,206,98,0.35)]'
                            : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-white'
                    )}
                    title={actionLabel}
                >
                    <ActionIcon className="h-4 w-4" />
                    <span className="sr-only">{actionLabel}</span>
                </button>
            )}
        </div>
    );
}

interface AggregateStats {
    totalClears: number;
    specialClears: number;
    totalSeconds: number;
    totalKills: number;
    totalAssists: number;
    totalDeaths: number;
}

function enrichActivityDefinitionsWithModeNames(
    activityDefinitions: Record<string, ActivityDefinitionContext>,
    activityTypeDefinitions: Record<string, ActivityModeDefinitionContext>,
    activityModeDefinitions: Record<string, ActivityModeDefinitionContext>
): Record<string, ActivityDefinitionContext> {
    const enrichedDefinitions: Record<string, ActivityDefinitionContext> = {};

    for (const [activityHash, activityDefinition] of Object.entries(activityDefinitions)) {
        enrichedDefinitions[activityHash] = {
            ...activityDefinition,
            activityTypeName: activityDefinition.activityTypeName ?? getManifestDefinitionName(
                activityTypeDefinitions,
                activityDefinition.activityTypeHash
            ),
            directActivityModeName: activityDefinition.directActivityModeName ?? getManifestDefinitionName(
                activityModeDefinitions,
                activityDefinition.directActivityModeHash
            ),
        };
    }

    return enrichedDefinitions;
}

function getManifestDefinitionName(
    definitions: Record<string, ActivityModeDefinitionContext>,
    definitionHash: number | undefined
): string | undefined {
    if (!definitionHash) {
        return undefined;
    }

    const definitionName = definitions[String(definitionHash)]?.displayProperties?.name?.trim();
    return definitionName || undefined;
}

function updateActivityReportUserUrl(userDisplayName: string | null): void {
    const url = new URL(window.location.href);

    url.searchParams.delete('');

    if (userDisplayName) {
        url.searchParams.set('user', userDisplayName);
    } else {
        url.searchParams.delete('user');
    }

    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function getProfileShareDisplayName(profile: any, fallbackDisplayName: string | null | undefined): string | null {
    const userInfo = profile?.profile?.data?.userInfo;
    const bungieGlobalDisplayName = userInfo?.bungieGlobalDisplayName?.trim();
    const bungieGlobalDisplayNameCode = userInfo?.bungieGlobalDisplayNameCode;

    if (bungieGlobalDisplayName) {
        return bungieGlobalDisplayNameCode
            ? `${bungieGlobalDisplayName}#${bungieGlobalDisplayNameCode}`
            : bungieGlobalDisplayName;
    }

    return fallbackDisplayName?.trim() || null;
}

function buildActivityModeFilterOptions(
    activityDefinitions: Record<string, ActivityDefinitionContext>,
    activityCatalog: { activityMode?: string }[]
): ActivityModeFilterOption[] {
    const modeLabels = new Map<string, string>();

    for (const activityDefinition of Object.values(activityDefinitions)) {
        addActivityModeOption(modeLabels, getActivityDefinitionModeName(activityDefinition));
    }

    for (const activity of activityCatalog) {
        addActivityModeOption(modeLabels, activity.activityMode);
    }

    const modeOptions = [...modeLabels.entries()]
        .map(([value, label]) => ({
            value,
            label,
            keywords: label,
        }))
        .sort(compareActivityModeFilterOptions);

    return [
        {
            value: ALL_ACTIVITY_MODE_FILTER,
            label: 'All Activity Modes',
            keywords: 'everything all supported endgame',
        },
        ...modeOptions,
    ];
}

function addActivityModeOption(modeLabels: Map<string, string>, activityMode: string | undefined): void {
    const modeLabel = activityMode?.trim();

    if (!modeLabel) {
        return;
    }

    const modeKey = normalizeActivityModeFilterValue(modeLabel);

    if (!modeLabels.has(modeKey)) {
        modeLabels.set(modeKey, modeLabel);
    }
}

function getActivityDefinitionModeName(activityDefinition: ActivityDefinitionContext): string | undefined {
    const activityTypeName = activityDefinition.activityTypeName?.trim();
    const directActivityModeName = activityDefinition.directActivityModeName?.trim();

    return activityTypeName || directActivityModeName || undefined;
}

function reportMatchesActivityModeFilter(
    report: ActivityReportSummary,
    activityModeFilter: ActivityModeFilter
): boolean {
    if (activityModeFilter === ALL_ACTIVITY_MODE_FILTER) {
        return true;
    }

    return normalizeActivityModeFilterValue(report.activity.activityMode) === activityModeFilter;
}

function isEndgameActivityModeFilter(activityModeFilter: ActivityModeFilter): boolean {
    return activityModeFilter === normalizeActivityModeFilterValue('Raid') ||
        activityModeFilter === normalizeActivityModeFilterValue('Dungeon');
}

function normalizeActivityModeFilterValue(activityMode: string | undefined): string {
    return (activityMode ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function groupReportsByMode(reports: ActivityReportSummary[]) {
    const groups = new Map<string, ActivityReportSummary[]>();

    for (const report of reports) {
        const activityMode = report.activity.activityMode?.trim() || 'Activity';
        const groupReports = groups.get(activityMode) ?? [];
        groupReports.push(report);
        groups.set(activityMode, groupReports);
    }

    return [...groups.entries()]
        .map(([mode, groupReports]) => ({
            mode,
            reports: groupReports,
        }))
        .sort((firstGroup, secondGroup) => compareActivityModeLabels(firstGroup.mode, secondGroup.mode));
}

function compareActivityModeFilterOptions(
    firstOption: ActivityModeFilterOption,
    secondOption: ActivityModeFilterOption
): number {
    return compareActivityModeLabels(firstOption.label, secondOption.label);
}

function compareActivityModeLabels(firstMode: string, secondMode: string): number {
    const firstPriority = getActivityModeSortPriority(firstMode);
    const secondPriority = getActivityModeSortPriority(secondMode);

    if (firstPriority !== secondPriority) {
        return firstPriority - secondPriority;
    }

    return firstMode.localeCompare(secondMode);
}

function getActivityModeSortPriority(activityMode: string): number {
    const normalizedMode = normalizeActivityModeFilterValue(activityMode);

    if (normalizedMode === normalizeActivityModeFilterValue('Raid')) {
        return 0;
    }

    if (normalizedMode === normalizeActivityModeFilterValue('Dungeon')) {
        return 1;
    }

    return 2;
}

function getAggregateStats(reports: ActivityReportSummary[]): AggregateStats {
    return reports.reduce(
        (stats, report) => ({
            totalClears: stats.totalClears + report.totalClears,
            specialClears: stats.specialClears + report.specialClears,
            totalSeconds: stats.totalSeconds + report.totalSeconds,
            totalKills: stats.totalKills + report.totalKills,
            totalAssists: stats.totalAssists + report.totalAssists,
            totalDeaths: stats.totalDeaths + report.totalDeaths,
        }),
        {
            totalClears: 0,
            specialClears: 0,
            totalSeconds: 0,
            totalKills: 0,
            totalAssists: 0,
            totalDeaths: 0,
        }
    );
}
