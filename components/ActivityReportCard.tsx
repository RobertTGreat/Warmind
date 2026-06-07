import { useQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    Clock3,
    ExternalLink,
    Info,
    Loader2,
    ShieldCheck,
    Skull,
    Swords,
    Timer,
    Trophy,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    ActivityReportSummary,
    ActivityRunSummary,
    filterActivityReportByTag,
    formatActivityDuration,
} from '@/lib/activityReport';
import { usePGCR } from '@/hooks/useActivityHistory';
import type { PGCRPlayer } from '@/hooks/useActivityHistory';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);
const ACTIVITY_CARD_HEIGHT = 540;
const ACTIVITY_CARD_IMAGE_HEIGHT = 176;

interface ActivityReportCardProps {
    report: ActivityReportSummary;
    metrics: any;
    records: any;
    collectibles: any;
    characterIds: string[];
    characterClasses: Record<string, string>;
    flexModeEnabled?: boolean;
    className?: string;
}

interface ProfileAchievement {
    label: string;
    tone: 'gold' | 'flawless' | 'blue' | 'dayOne' | 'weekOne' | 'green' | 'lowMan';
}

interface PGCRData {
    period?: string;
    entries?: PGCRPlayer[];
}

type BackFaceMode = 'stats' | 'run' | null;
type FlexBorderTone = 'dayOne' | 'weekOne' | 'flawless';

export function ActivityReportCard({
    report,
    metrics,
    records,
    characterIds,
    characterClasses,
    flexModeEnabled = false,
    className,
}: ActivityReportCardProps) {
    const { activity } = report;
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [backFaceMode, setBackFaceMode] = useState<BackFaceMode>(null);
    const [selectedCardTag, setSelectedCardTag] = useState<string | null>(null);

    const { data: activityDefinitionData } = useQuery({
        queryKey: ['manifestDefinition', 'DestinyActivityDefinition', activity.activityHash],
        queryFn: () => fetcher(endpoints.getActivityDefinition(activity.activityHash)),
        enabled: Boolean(activity.activityHash),
        staleTime: 24 * 60 * 60 * 1000,
        gcTime: 7 * 24 * 60 * 60 * 1000,
    });

    const activityDefinition = activityDefinitionData?.Response;
    const activityName = activity.name;
    const imageUrl = activity.image || (activityDefinition?.pgcrImage ? getBungieImage(activityDefinition.pgcrImage) : undefined);
    const description = activityDefinition?.displayProperties?.description;
    const activeCardTag = selectedCardTag && report.specialTagCounts[selectedCardTag] ? selectedCardTag : null;
    const visibleReport = useMemo(
        () => filterActivityReportByTag(report, activeCardTag),
        [report, activeCardTag]
    );
    const profileAchievements = useProfileAchievements(report, metrics, records);
    const titleBadges = useMemo(
        () => [...profileAchievements, ...getLowManTitleBadges(report)],
        [profileAchievements, report]
    );
    const flexBorderTone = flexModeEnabled ? getFlexBorderTone(profileAchievements, report) : null;
    const flexBorderClass = flexBorderTone ? flexBorderToneClasses[flexBorderTone] : undefined;
    const weeklyProgress = useWeeklyClassProgress(report, characterIds);
    const completionRate = getCompletionRate(visibleReport);

    const selectedRun = useMemo(() => {
        if (!selectedRunId) {
            return null;
        }

        return report.runs.find((run) => run.instanceId === selectedRunId) ?? null;
    }, [report.runs, selectedRunId]);

    const { pgcr, isLoading: isLoadingPGCR, isError: pgcrError } = usePGCR(backFaceMode === 'run' ? selectedRunId : null);

    const openRunDetails = (run: ActivityRunSummary) => {
        setSelectedRunId(run.instanceId);
        setBackFaceMode('run');
    };

    const openFullStats = () => {
        setBackFaceMode('stats');
    };

    const closeBackFace = () => {
        setBackFaceMode(null);
    };

    return (
        <article
            className={cn(
                'group/card relative rounded-md text-white',
                className
            )}
            style={{ height: ACTIVITY_CARD_HEIGHT, perspective: '1600px' }}
        >
            <div
                className="relative h-full w-full transition-transform duration-500"
                style={{
                    transform: backFaceMode ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transformStyle: 'preserve-3d',
                }}
            >
                <div
                    className={cn(
                        'flex h-full flex-col overflow-visible rounded-md border border-white/10 bg-[#151922]/90 shadow-xl transition-colors hover:border-white/25',
                        flexBorderClass
                    )}
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    <div
                        className="relative shrink-0 overflow-hidden rounded-t-md bg-slate-950"
                        style={{ height: ACTIVITY_CARD_IMAGE_HEIGHT }}
                    >
                        {imageUrl && (
                            <img
                                src={imageUrl}
                                alt=""
                                className="h-full w-full rounded-t-md object-cover opacity-75 transition-transform duration-700 group-hover/card:scale-105"
                            />
                        )}
                        <div className="absolute inset-0 rounded-t-md bg-gradient-to-b from-black/10 via-black/30 to-[#151922]" />

                        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                            {characterIds.map((characterId) => {
                                const classNameValue = characterClasses[characterId] || 'Unknown';
                                const isDone = weeklyProgress[characterId];
                                const iconPath = `/class-${classNameValue.toLowerCase()}.svg`;

                                return (
                                    <div
                                        key={characterId}
                                        title={`${classNameValue} weekly clear ${isDone ? 'complete' : 'incomplete'}`}
                                        className={cn(
                                            'flex h-7 w-7 items-center justify-center rounded-full border bg-black/55 backdrop-blur-sm transition-colors',
                                            isDone
                                                ? 'border-destiny-gold shadow-[0_0_12px_rgba(227,206,98,0.45)]'
                                                : 'border-white/15 opacity-60'
                                        )}
                                    >
                                        <img
                                            src={iconPath}
                                            alt={classNameValue}
                                            className="h-4 w-4"
                                            style={{ filter: isDone ? 'none' : 'brightness(0.7)' }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={openFullStats}
                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center border border-white/15 bg-black/50 text-slate-300 backdrop-blur transition-colors hover:border-destiny-gold/50 hover:text-white"
                            title="Show full stats"
                        >
                            <Info className="h-4 w-4" />
                            <span className="sr-only">Show full stats</span>
                        </button>

                        <div className="absolute bottom-3 left-4 right-4">
                            {titleBadges.length > 0 && (
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    {titleBadges.slice(0, 6).map((achievement) => (
                                        <span
                                            key={achievement.label}
                                            className={cn(
                                                'activity-achievement-tag rounded-sm border px-2.5 py-1 text-xs font-black uppercase tracking-wide shadow-lg',
                                                achievementToneClasses[achievement.tone]
                                            )}
                                        >
                                            {achievement.label}
                                        </span>
                                    ))}
                                    {titleBadges.length > 6 && (
                                        <span className="rounded-sm border border-white/10 bg-slate-900 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-slate-100">
                                            +{titleBadges.length - 6}
                                        </span>
                                    )}
                                </div>
                            )}
                            <h3 className="text-2xl font-extrabold uppercase leading-none tracking-wide text-white drop-shadow sm:text-3xl">
                                {activityName}
                            </h3>
                            {description && (
                                <p className="mt-1 line-clamp-1 text-xs text-slate-300/85">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col p-4">
                        {Object.keys(report.specialTagCounts).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(report.specialTagCounts).map(([tag, data]) => {
                                    const selected = activeCardTag === tag;

                                    return (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setSelectedCardTag(selected ? null : tag)}
                                            className={cn(
                                                'text-xs font-semibold uppercase tracking-wide text-slate-400 underline-offset-4 transition-colors hover:text-white',
                                                selected
                                                    ? 'text-destiny-gold underline decoration-2 decoration-destiny-gold/80'
                                                    : 'hover:underline'
                                            )}
                                            title={selected ? `Clear ${tag} card filter` : `Filter this card by ${tag}`}
                                            aria-pressed={selected}
                                        >
                                            {tag} ({data.amount})
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                <span>Recent History</span>
                                <span>{completionRate}% Clear Rate</span>
                            </div>
                            <RunMarkers report={visibleReport} onSelectRun={openRunDetails} />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCell icon={Trophy} label="Clears" value={visibleReport.totalClears.toLocaleString()} />
                            <StatCell icon={Timer} label="Fastest" value={formatActivityDuration(visibleReport.fastestSeconds)} />
                            <StatCell icon={Clock3} label="Average" value={formatActivityDuration(visibleReport.averageSeconds)} />
                            <StatCell icon={CalendarDays} label="Total Time" value={formatActivityDuration(visibleReport.totalSeconds)} />
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                            <div className="min-w-0 text-xs text-slate-500">
                                {visibleReport.latestRun ? (
                                    <>
                                        Latest{' '}
                                        <span className="text-slate-300">
                                            {new Date(visibleReport.latestRun.period).toLocaleDateString()}
                                        </span>
                                    </>
                                ) : (
                                    activeCardTag ? 'No matching runs' : 'No runs recorded'
                                )}
                            </div>

                            <button
                                type="button"
                                disabled={!visibleReport.latestRun}
                                onClick={() => visibleReport.latestRun && openRunDetails(visibleReport.latestRun)}
                                className={cn(
                                    'inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                                    visibleReport.latestRun
                                        ? 'border-white/10 text-slate-300 hover:border-destiny-gold/50 hover:text-white'
                                        : 'cursor-not-allowed border-white/5 text-slate-600'
                                )}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Run Info
                            </button>
                        </div>
                    </div>
                </div>

                {backFaceMode === 'stats' ? (
                    <FullStatsFace
                        activityName={activityName}
                        report={visibleReport}
                        completionRate={completionRate}
                        flexBorderClass={flexBorderClass}
                        onBack={closeBackFace}
                    />
                ) : (
                    <RunDetailsFace
                        activityName={activityName}
                        selectedRun={selectedRun}
                        pgcr={pgcr}
                        isLoading={isLoadingPGCR}
                        isError={Boolean(pgcrError)}
                        flexBorderClass={flexBorderClass}
                        onBack={closeBackFace}
                    />
                )}
            </div>
        </article>
    );
}

function FullStatsFace({
    activityName,
    report,
    completionRate,
    flexBorderClass,
    onBack,
}: {
    activityName: string;
    report: ActivityReportSummary;
    completionRate: number;
    flexBorderClass?: string;
    onBack: () => void;
}) {
    const latestRunDate = report.latestRun ? new Date(report.latestRun.period).toLocaleDateString() : '--';
    const fullStats = [
        { icon: Trophy, label: 'Clears', value: report.totalClears.toLocaleString() },
        { icon: ShieldCheck, label: 'Special Clears', value: report.specialClears.toLocaleString() },
        { icon: CheckCircle2, label: 'Standard Clears', value: report.regularClears.toLocaleString() },
        { icon: Skull, label: 'Failed Runs', value: report.failedClears.toLocaleString() },
        { icon: Timer, label: 'Fastest', value: formatActivityDuration(report.fastestSeconds) },
        { icon: Clock3, label: 'Average', value: formatActivityDuration(report.averageSeconds) },
        { icon: CalendarDays, label: 'Total Time', value: formatActivityDuration(report.totalSeconds) },
        { icon: CheckCircle2, label: 'Clear Rate', value: `${completionRate}%` },
        { icon: Swords, label: 'Kills', value: report.totalKills.toLocaleString() },
        { icon: Users, label: 'Assists', value: report.totalAssists.toLocaleString() },
        { icon: Skull, label: 'Deaths', value: report.totalDeaths.toLocaleString() },
        { icon: Swords, label: 'K/D', value: report.kd === null ? '--' : report.kd.toFixed(2) },
        { icon: CalendarDays, label: 'Latest', value: latestRunDate },
    ];

    return (
        <div
            className={cn(
                'absolute inset-0 flex h-full flex-col overflow-hidden rounded-md border border-white/10 bg-[#151922] shadow-xl',
                flexBorderClass
            )}
            style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
            }}
        >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
                <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Full Stats
                    </div>
                    <h3 className="mt-1 truncate text-2xl font-extrabold uppercase tracking-wide text-white">
                        {activityName}
                    </h3>
                    <div className="mt-1 text-xs text-slate-400">
                        {report.runs.length.toLocaleString()} tracked runs
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 text-slate-300 transition-colors hover:border-white/25 hover:text-white"
                    title="Back to activity card"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back to activity card</span>
                </button>
            </div>

            <div className="activity-card-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pr-3">
                <div className="grid grid-cols-2 gap-3">
                    {fullStats.map((stat) => (
                        <DetailedStatCell
                            key={stat.label}
                            icon={stat.icon}
                            label={stat.label}
                            value={stat.value}
                        />
                    ))}
                </div>

                {Object.keys(report.specialTagCounts).length > 0 && (
                    <div className="mt-5">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                            Badges
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(report.specialTagCounts).map(([tag, data]) => (
                                <span
                                    key={tag}
                                    className={getSpecialTagBadgeClasses(tag)}
                                >
                                    {tag} ({data.amount})
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function RunDetailsFace({
    activityName,
    selectedRun,
    pgcr,
    isLoading,
    isError,
    flexBorderClass,
    onBack,
}: {
    activityName: string;
    selectedRun: ActivityRunSummary | null;
    pgcr?: PGCRData;
    isLoading: boolean;
    isError: boolean;
    flexBorderClass?: string;
    onBack: () => void;
}) {
    const runDate = selectedRun ? new Date(selectedRun.period).toLocaleString() : 'Unknown run';
    const players = pgcr?.entries ?? [];

    return (
        <div
            className={cn(
                'absolute inset-0 flex h-full flex-col overflow-hidden rounded-md border border-white/10 bg-[#151922] shadow-xl',
                flexBorderClass
            )}
            style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
            }}
        >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
                <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Run Details
                    </div>
                    <h3 className="mt-1 truncate text-2xl font-extrabold uppercase tracking-wide text-white">
                        {activityName}
                    </h3>
                    <div className="mt-1 text-xs text-slate-400">
                        {runDate}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 text-slate-300 transition-colors hover:border-white/25 hover:text-white"
                    title="Back to activity card"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back to activity card</span>
                </button>
            </div>

            {selectedRun && (
                <div className="grid grid-cols-4 gap-3 border-b border-white/10 px-4 py-3">
                    <CompactRunStat label="Status" value={selectedRun.completed ? 'Clear' : 'Failed'} tone={selectedRun.completed ? 'green' : 'red'} />
                    <CompactRunStat label="Time" value={formatActivityDuration(selectedRun.durationSeconds)} />
                    <CompactRunStat label="Players" value={selectedRun.playerCount?.toString() ?? '--'} />
                    <CompactRunStat label="Tags" value={selectedRun.specialTags.length > 0 ? selectedRun.specialTags.length.toString() : '--'} />
                </div>
            )}

            <div className="activity-card-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pr-3">
                {isLoading ? (
                    <div className="flex h-56 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-destiny-gold" />
                    </div>
                ) : isError ? (
                    <div className="flex h-56 flex-col items-center justify-center text-center text-red-300">
                        <AlertTriangle className="mb-3 h-8 w-8" />
                        <p className="font-semibold">Failed to load run details.</p>
                    </div>
                ) : players.length === 0 ? (
                    <div className="flex h-56 items-center justify-center text-sm italic text-slate-600">
                        No PGCR players found for this run.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {players.map((entry, index) => (
                            <RunPlayerRow key={`${getPlayerDisplayName(entry)}-${index}`} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const achievementToneClasses = {
    gold: 'border-destiny-gold bg-destiny-gold text-slate-950',
    flawless: 'activity-achievement-tag--shiny activity-achievement-tag--flawless',
    blue: 'border-sky-300 bg-sky-500 text-slate-950',
    dayOne: 'activity-achievement-tag--shiny activity-achievement-tag--day-one',
    weekOne: 'activity-achievement-tag--shiny activity-achievement-tag--week-one',
    green: 'border-emerald-300 bg-emerald-500 text-slate-950',
    lowMan: 'border-cyan-300 bg-cyan-400 text-slate-950',
};

const flexBorderToneClasses: Record<FlexBorderTone, string> = {
    dayOne: 'activity-card-flex-border activity-card-flex-border--day-one',
    weekOne: 'activity-card-flex-border activity-card-flex-border--week-one',
    flawless: 'activity-card-flex-border activity-card-flex-border--flawless',
};

function getFlexBorderTone(
    achievements: ProfileAchievement[],
    report: ActivityReportSummary
): FlexBorderTone | null {
    const achievementTones = new Set(achievements.map((achievement) => achievement.tone));
    const specialTags = Object.keys(report.specialTagCounts);

    if (achievementTones.has('dayOne') || Boolean(report.specialTagCounts['Day One'])) {
        return 'dayOne';
    }

    if (achievementTones.has('weekOne')) {
        return 'weekOne';
    }

    if (
        achievementTones.has('flawless') ||
        specialTags.some((tag) => tag !== 'Personal Flawless' && tag.includes('Flawless'))
    ) {
        return 'flawless';
    }

    return null;
}

function getLowManTitleBadges(report: ActivityReportSummary): ProfileAchievement[] {
    const titleBadges: ProfileAchievement[] = [];
    const tagCounts = report.specialTagCounts;

    if (report.activity.type === 'RAID' && hasAnySpecialTag(tagCounts, ['Trio', 'Trio Flawless'])) {
        titleBadges.push({ label: 'Trio', tone: 'lowMan' });
    }

    if (
        (report.activity.type === 'RAID' || report.activity.type === 'DUNGEON') &&
        hasAnySpecialTag(tagCounts, ['Duo', 'Duo Flawless'])
    ) {
        titleBadges.push({ label: 'Duo', tone: 'lowMan' });
    }

    if (
        (report.activity.type === 'RAID' || report.activity.type === 'DUNGEON') &&
        hasAnySpecialTag(tagCounts, ['Solo', 'Solo Flawless'])
    ) {
        titleBadges.push({ label: 'Solo', tone: 'lowMan' });
    }

    return titleBadges;
}

function hasAnySpecialTag(
    tagCounts: ActivityReportSummary['specialTagCounts'],
    tagNames: string[]
): boolean {
    return tagNames.some((tagName) => Boolean(tagCounts[tagName]));
}

function getSpecialTagBadgeClasses(tag: string): string {
    if (tag === 'Day One') {
        return 'activity-achievement-tag activity-achievement-tag--shiny activity-achievement-tag--day-one rounded-sm border px-2.5 py-1 text-xs font-black uppercase tracking-wide';
    }

    if (tag !== 'Personal Flawless' && tag.includes('Flawless')) {
        return 'activity-achievement-tag activity-achievement-tag--shiny activity-achievement-tag--flawless rounded-sm border px-2.5 py-1 text-xs font-black uppercase tracking-wide';
    }

    return 'rounded-sm border border-destiny-gold/30 bg-destiny-gold/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-destiny-gold';
}

function useProfileAchievements(report: ActivityReportSummary, metrics: any, records: any): ProfileAchievement[] {
    return useMemo(() => {
        const { activity } = report;
        const achievements: ProfileAchievement[] = [];
        const checkRecordComplete = createRecordChecker(records);
        const checkMetricComplete = createMetricChecker(metrics);
        const findRecordHash = createRecordFinder(records);
        const supportsMasterAchievement = activity.type === 'RAID' || activity.type === 'DUNGEON';

        const masterRecordHash = supportsMasterAchievement
            ? activity.masterRecordHash ?? findMasterRecordHash(activity.name, findRecordHash)
            : undefined;
        const flawlessRecordHash = activity.flawlessRecordHash ?? findFlawlessRecordHash(activity.name, findRecordHash);
        const contestRecordHash = activity.contestRecordHash ?? activity.dayOneRecordHash ?? findContestRecordHash(activity.name, findRecordHash);

        const isSoloFlawless = checkRecordComplete(activity.soloFlawlessRecordHash) || checkMetricComplete(activity.soloFlawlessMetricHash);
        const isFlawless = checkRecordComplete(flawlessRecordHash) || checkMetricComplete(activity.flawlessMetricHash);
        const isMaster = supportsMasterAchievement && (
            checkRecordComplete(masterRecordHash) ||
            report.completedRuns.some((run) => run.referenceId !== activity.activityHash)
        );
        const isDayOne = checkRecordComplete(contestRecordHash) || Boolean(report.specialTagCounts['Day One']);
        const weekOneRun = getWeekOneRun(report);
        const isEpicFlawless = checkRecordComplete(activity.epicFlawlessRecordHash);
        const isEpic = checkRecordComplete(activity.epicRecordHash);

        if (isSoloFlawless) {
            achievements.push({ label: 'Solo Flawless', tone: 'flawless' });
        } else if (isFlawless) {
            achievements.push({ label: 'Flawless', tone: 'flawless' });
        }

        if (isMaster) {
            achievements.push({ label: 'Master', tone: 'gold' });
        }

        if (isDayOne) {
            achievements.push({ label: 'Day One', tone: 'dayOne' });
        } else if (weekOneRun) {
            achievements.push({ label: 'Week One', tone: 'weekOne' });
        }

        if (isEpicFlawless) {
            achievements.push({ label: 'Epic Flawless', tone: 'flawless' });
        } else if (isEpic) {
            achievements.push({ label: 'Epic', tone: 'green' });
        }

        return achievements;
    }, [metrics, records, report]);
}

function useWeeklyClassProgress(report: ActivityReportSummary, characterIds: string[]) {
    return useMemo(() => {
        const lastReset = getLastWeeklyReset();
        const progress: Record<string, boolean> = {};

        for (const characterId of characterIds) {
            progress[characterId] = false;
        }

        for (const run of report.completedRuns) {
            if (!run.characterId || !Object.prototype.hasOwnProperty.call(progress, run.characterId)) {
                continue;
            }

            if (new Date(run.period) >= lastReset) {
                progress[run.characterId] = true;
            }
        }

        return progress;
    }, [characterIds.join(','), report.completedRuns]);
}

function RunMarkers({
    report,
    onSelectRun,
}: {
    report: ActivityReportSummary;
    onSelectRun: (run: ActivityRunSummary) => void;
}) {
    const [hoveredRunId, setHoveredRunId] = useState<string | null>(null);
    const visibleRuns = report.runs.slice(0, 14).reverse();

    if (visibleRuns.length === 0) {
        return (
            <div className="flex h-20 items-center justify-center text-sm italic text-slate-600">
                You have never run this
            </div>
        );
    }

    return (
        <div className="relative h-20 px-2">
            <div className="absolute left-2 right-2 top-1/2 h-px bg-white/10" />

            {visibleRuns.map((run, index) => {
                const left = visibleRuns.length === 1 ? 50 : (index / (visibleRuns.length - 1)) * 100;
                const top = getMarkerTop(run, report.averageSeconds);

                return (
                    <div
                        key={run.instanceId}
                        className="activity-run-marker absolute"
                        style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
                        onMouseEnter={() => setHoveredRunId(run.instanceId)}
                        onMouseLeave={() => setHoveredRunId((currentRunId) => currentRunId === run.instanceId ? null : currentRunId)}
                        onPointerEnter={() => setHoveredRunId(run.instanceId)}
                        onPointerLeave={() => setHoveredRunId((currentRunId) => currentRunId === run.instanceId ? null : currentRunId)}
                        onFocus={() => setHoveredRunId(run.instanceId)}
                        onBlur={() => setHoveredRunId((currentRunId) => currentRunId === run.instanceId ? null : currentRunId)}
                    >
                        <button
                            type="button"
                            onClick={() => onSelectRun(run)}
                            title={getRunTooltipText(run)}
                            className={cn(
                                'h-3.5 w-3.5 rounded-full border border-black/70 shadow-lg transition-transform hover:scale-150',
                                run.completed && run.specialTags.length > 0 && 'bg-destiny-gold shadow-[0_0_10px_rgba(227,206,98,0.55)]',
                                run.completed && run.specialTags.length === 0 && 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]',
                                !run.completed && 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)]'
                            )}
                        >
                            <span className="sr-only">Open run details</span>
                        </button>

                        <div
                            className={cn(
                                'activity-run-tooltip pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 w-44 -translate-x-1/2 border border-white/10 bg-slate-950 px-3 py-2 text-xs opacity-0 shadow-2xl transition-opacity',
                                hoveredRunId === run.instanceId && 'opacity-100'
                            )}
                        >
                            <div className={cn(
                                'font-semibold uppercase tracking-wide',
                                run.completed ? 'text-emerald-300' : 'text-red-300'
                            )}>
                                {run.completed ? 'Completed' : 'Failed'}
                            </div>
                            <div className="mt-1 grid grid-cols-3 gap-2 text-slate-400">
                                <span>K {run.kills}</span>
                                <span>D {run.deaths}</span>
                                <span>A {run.assists}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-slate-500">
                                <span>{formatActivityDuration(run.durationSeconds)}</span>
                                <span>{new Date(run.period).toLocaleDateString()}</span>
                            </div>
                            {run.specialTags.length > 0 && (
                                <div className="mt-1 truncate text-destiny-gold">
                                    {run.specialTags.join(', ')}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function StatCell({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0 border-t border-white/10 pt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <Icon className="h-3 w-3" />
                <span className="truncate">{label}</span>
            </div>
            <div className="mt-1 truncate text-xl font-bold text-white">
                {value}
            </div>
        </div>
    );
}

function DetailedStatCell({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0 border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <Icon className="h-3 w-3" />
                <span className="truncate">{label}</span>
            </div>
            <div className="mt-1 truncate text-xl font-bold text-white">
                {value}
            </div>
        </div>
    );
}

function CompactRunStat({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: 'green' | 'red';
}) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {label}
            </div>
            <div className={cn(
                'mt-1 truncate text-lg font-bold uppercase tracking-wide text-white',
                tone === 'green' && 'text-emerald-300',
                tone === 'red' && 'text-red-300'
            )}>
                {value}
            </div>
        </div>
    );
}

function RunPlayerRow({ entry }: { entry: PGCRPlayer }) {
    const kills = getStatValue(entry, 'kills');
    const deaths = getStatValue(entry, 'deaths');
    const assists = getStatValue(entry, 'assists');
    const completed = getStatValue(entry, 'completed') === 1;
    const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? kills.toFixed(2) : '--';
    const emblemPath = entry.player.emblemBackgroundPath || entry.player.emblemPath || entry.player.destinyUserInfo.iconPath;
    const emblemUrl = emblemPath ? getBungieImage(emblemPath) : null;

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-white/10 bg-black/15 p-2">
            <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden bg-slate-800">
                    {emblemUrl && (
                        <img src={emblemUrl} alt="" className="h-full w-full object-cover" />
                    )}
                </div>
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                        {getPlayerDisplayName(entry)}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                        {entry.player.characterClass} - {entry.player.lightLevel} Power
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-5 gap-3 text-right text-xs">
                <PlayerNumber label="K" value={kills.toLocaleString()} />
                <PlayerNumber label="D" value={deaths.toLocaleString()} />
                <PlayerNumber label="A" value={assists.toLocaleString()} />
                <PlayerNumber label="KD" value={kd} />
                <div className={cn(
                    'self-center text-[10px] font-bold uppercase tracking-wide',
                    completed ? 'text-emerald-300' : 'text-red-300'
                )}>
                    {completed ? 'Clear' : 'DNF'}
                </div>
            </div>
        </div>
    );
}

function PlayerNumber({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-[2.25rem]">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {label}
            </div>
            <div className="font-mono text-slate-100">
                {value}
            </div>
        </div>
    );
}

function getStatValue(entry: PGCRPlayer, statName: 'kills' | 'deaths' | 'assists' | 'completed'): number {
    return entry.values[statName]?.basic?.value ?? 0;
}

function getPlayerDisplayName(entry: PGCRPlayer): string {
    const userInfo = entry.player.destinyUserInfo;
    const globalDisplayName = userInfo.bungieGlobalDisplayName;
    const displayCode = userInfo.bungieGlobalDisplayNameCode;

    if (globalDisplayName && displayCode) {
        return `${globalDisplayName}#${String(displayCode).padStart(4, '0')}`;
    }

    return userInfo.displayName || 'Unknown Guardian';
}

function createRecordChecker(records: any) {
    return (recordHash: number | null | undefined): boolean => {
        if (!recordHash || !records?.records?.[recordHash]) {
            return false;
        }

        const record = records.records[recordHash];

        if (Array.isArray(record.objectives) && record.objectives.length > 0) {
            return record.objectives[0]?.complete === true;
        }

        if (record.state !== undefined) {
            return (record.state & 8) === 8 || record.state === 67;
        }

        if (record.intervalInfo?.intervals) {
            return record.intervalInfo.intervals.some((interval: any) => interval.completed === true);
        }

        return false;
    };
}

function createMetricChecker(metrics: any) {
    return (metricHash: number | null | undefined): boolean => {
        if (!metricHash || !metrics?.metrics?.[metricHash]) {
            return false;
        }

        return metrics.metrics[metricHash].objectiveProgress.progress > 0;
    };
}

function createRecordFinder(records: any) {
    return (searchPattern: (recordName: string, recordDescription: string) => boolean): number | null => {
        if (!records?.records) {
            return null;
        }

        for (const [hash, record] of Object.entries(records.records)) {
            const recordName = (record as any)?.displayProperties?.name?.toLowerCase() || '';
            const recordDescription = (record as any)?.displayProperties?.description?.toLowerCase() || '';

            if (searchPattern(recordName, recordDescription)) {
                return Number(hash);
            }
        }

        return null;
    };
}

function findMasterRecordHash(activityName: string, findRecordHash: ReturnType<typeof createRecordFinder>) {
    const normalizedActivityName = normalizeRecordName(activityName);

    return findRecordHash((recordName, recordDescription) => (
        (recordName.includes('master difficulty') || recordDescription.includes('master difficulty')) &&
        recordTextMatchesActivity(recordName, recordDescription, activityName, normalizedActivityName)
    ));
}

function findFlawlessRecordHash(activityName: string, findRecordHash: ReturnType<typeof createRecordFinder>) {
    const normalizedActivityName = normalizeRecordName(activityName);

    return findRecordHash((recordName, recordDescription) => (
        (recordName.includes('flawless') || recordDescription.includes('flawless')) &&
        !recordName.includes('solo') &&
        recordTextMatchesActivity(recordName, recordDescription, activityName, normalizedActivityName)
    ));
}

function findContestRecordHash(activityName: string, findRecordHash: ReturnType<typeof createRecordFinder>) {
    const normalizedActivityName = normalizeRecordName(activityName);

    return findRecordHash((recordName, recordDescription) => (
        (recordName.includes('contest') || recordName.includes('day one') || recordDescription.includes('contest mode')) &&
        recordTextMatchesActivity(recordName, recordDescription, activityName, normalizedActivityName)
    ));
}

function normalizeRecordName(activityName: string): string {
    return activityName.toLowerCase().replace(/'/g, '').replace(/:/g, '');
}

function recordTextMatchesActivity(
    recordName: string,
    recordDescription: string,
    activityName: string,
    normalizedActivityName: string
) {
    const lowerActivityName = activityName.toLowerCase();

    return (
        recordName.includes(lowerActivityName) ||
        recordName.includes(normalizedActivityName) ||
        recordDescription.includes(lowerActivityName) ||
        recordDescription.includes(normalizedActivityName)
    );
}

function getWeekOneRun(report: ActivityReportSummary): ActivityRunSummary | null {
    const releaseDate = report.activity.releaseDate;
    if (!releaseDate) {
        return null;
    }

    const [year, month, day] = releaseDate.split('-').map(Number);
    const weekOneStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const weekOneEnd = new Date(weekOneStart);
    weekOneEnd.setUTCDate(weekOneEnd.getUTCDate() + 7);
    weekOneEnd.setUTCHours(23, 59, 59, 999);

    return report.completedRuns.find((run) => {
        const runDate = new Date(run.period);
        return runDate >= weekOneStart && runDate <= weekOneEnd;
    }) ?? null;
}

function getCompletionRate(report: ActivityReportSummary): number {
    const totalRuns = report.totalClears + report.failedClears;
    if (totalRuns === 0) {
        return 0;
    }

    return Math.round((report.totalClears / totalRuns) * 100);
}

function getMarkerTop(run: ActivityRunSummary, averageSeconds: number | null): number {
    if (!averageSeconds || averageSeconds <= 0) {
        return 50;
    }

    const durationDifference = run.durationSeconds - averageSeconds;
    const durationRatio = durationDifference / averageSeconds;
    const top = 50 + durationRatio * 35;

    return Math.max(12, Math.min(88, top));
}

function getRunTooltipText(run: ActivityRunSummary): string {
    const status = run.completed ? 'Completed' : 'Failed';
    const runDate = new Date(run.period).toLocaleDateString();
    const duration = formatActivityDuration(run.durationSeconds);
    return `${status} - ${duration} - K ${run.kills} D ${run.deaths} A ${run.assists} - ${runDate}`;
}

function getLastWeeklyReset(): Date {
    const now = new Date();
    const resetDay = 2;
    const currentDay = now.getUTCDay();
    let daysSinceReset = currentDay - resetDay;

    if (daysSinceReset < 0) {
        daysSinceReset += 7;
    }

    const lastReset = new Date(now);
    lastReset.setUTCDate(now.getUTCDate() - daysSinceReset);
    lastReset.setUTCHours(17, 0, 0, 0);

    if (now < lastReset) {
        lastReset.setUTCDate(lastReset.getUTCDate() - 7);
    }

    return lastReset;
}
