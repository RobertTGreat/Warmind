import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getServerBungieApiKey } from '@/lib/serverBungie';

export const runtime = 'nodejs';

const IMAGE_SIZE = {
    width: 1200,
    height: 630,
};
const BUNGIE_API_BASE = 'https://www.bungie.net/Platform';
const RAID_ACTIVITY_MODE = 4;
const DUNGEON_ACTIVITY_MODE = 82;
const ACTIVITY_HISTORY_PAGE_SIZE = 250;

interface ActivityEmbedStats {
    clears: number;
    totalSeconds: number;
    kills: number;
    assists: number;
    deaths: number;
    activityCount: number;
}

interface SearchUserResult {
    membershipId: string;
    membershipType: number;
    displayName: string;
    bungieGlobalDisplayName?: string;
    bungieGlobalDisplayNameCode?: number;
    destinyMemberships?: SearchUserResult[];
}

export async function GET(request: NextRequest) {
    const user = request.nextUrl.searchParams.get('user')?.trim();
    const title = user ? `${user}'s Activity Report` : 'Activity Report';
    const stats = user ? await getActivityEmbedStats(user) : null;

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: '#05070d',
                    color: 'white',
                    fontFamily: 'Arial, sans-serif',
                    padding: 64,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#e3ce62', fontSize: 28, fontWeight: 700, letterSpacing: 6 }}>
                        WARMIND
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 24 }}>
                        Report Info
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <div style={{ color: '#94a3b8', fontSize: 30, textTransform: 'uppercase', letterSpacing: 4 }}>
                        Destiny 2
                    </div>
                    <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.05 }}>
                        {title}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: 30, maxWidth: 940, lineHeight: 1.35 }}>
                        Clears, special runs, total time, kills, assists, deaths, and activity history.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 18 }}>
                    {buildStatTiles(stats).map((tile) => (
                        <div
                            key={tile.label}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                width: 160,
                                height: 92,
                                border: '1px solid rgba(255,255,255,0.16)',
                                background: 'rgba(15,23,42,0.72)',
                                padding: 20,
                            }}
                        >
                            <div style={{ color: '#64748b', fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
                                {tile.label.toUpperCase()}
                            </div>
                            <div style={{ color: '#e3ce62', fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                                {tile.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ),
        IMAGE_SIZE
    );
}

function buildStatTiles(stats: ActivityEmbedStats | null) {
    if (!stats) {
        return [
            { label: 'Clears', value: '--' },
            { label: 'Activities', value: '--' },
            { label: 'Total Time', value: '--' },
            { label: 'Kills', value: '--' },
            { label: 'Assists', value: '--' },
            { label: 'Deaths', value: '--' },
        ];
    }

    return [
        { label: 'Clears', value: stats.clears.toLocaleString() },
        { label: 'Activities', value: stats.activityCount.toLocaleString() },
        { label: 'Total Time', value: formatEmbedDuration(stats.totalSeconds) },
        { label: 'Kills', value: stats.kills.toLocaleString() },
        { label: 'Assists', value: stats.assists.toLocaleString() },
        { label: 'Deaths', value: stats.deaths.toLocaleString() },
    ];
}

async function getActivityEmbedStats(user: string): Promise<ActivityEmbedStats | null> {
    const player = await findPlayer(user);

    if (!player) {
        return null;
    }

    const characterIds = await getCharacterIds(player.membershipType, player.membershipId);

    if (characterIds.length === 0) {
        return null;
    }

    const histories = await Promise.all(
        characterIds.flatMap((characterId) => [
            getActivityHistory(player.membershipType, player.membershipId, characterId, RAID_ACTIVITY_MODE),
            getActivityHistory(player.membershipType, player.membershipId, characterId, DUNGEON_ACTIVITY_MODE),
        ])
    );
    const activities = uniqueActivities(histories.flat());

    return activities.reduce(
        (stats, activity) => {
            const completed = Number(activity.values?.completed?.basic?.value ?? 0) > 0;
            const durationSeconds = Number(activity.values?.activityDurationSeconds?.basic?.value ?? 0);

            stats.clears += completed ? 1 : 0;
            stats.totalSeconds += completed ? durationSeconds : 0;
            stats.kills += Number(activity.values?.kills?.basic?.value ?? 0);
            stats.assists += Number(activity.values?.assists?.basic?.value ?? 0);
            stats.deaths += Number(activity.values?.deaths?.basic?.value ?? 0);
            stats.activityCount += 1;

            return stats;
        },
        {
            clears: 0,
            totalSeconds: 0,
            kills: 0,
            assists: 0,
            deaths: 0,
            activityCount: 0,
        }
    );
}

async function findPlayer(user: string): Promise<SearchUserResult | null> {
    const [displayNamePrefix, displayNameCode] = parseBungieName(user);
    const searchResponse = await bungieFetch('/User/Search/GlobalName/0/', {
        method: 'POST',
        body: JSON.stringify({ displayNamePrefix }),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const searchResults = searchResponse?.Response?.searchResults ?? [];

    for (const result of searchResults) {
        const destinyMembership = result.destinyMemberships?.[0] ?? result;
        const resultCode = Number(result.bungieGlobalDisplayNameCode ?? 0);

        if (displayNameCode && resultCode !== displayNameCode) {
            continue;
        }

        return {
            ...destinyMembership,
            displayName: result.displayName ?? result.bungieGlobalDisplayName ?? destinyMembership.displayName,
        };
    }

    return null;
}

async function getCharacterIds(membershipType: number, membershipId: string): Promise<string[]> {
    const profileResponse = await bungieFetch(
        `/Destiny2/${membershipType}/Profile/${membershipId}/?components=200`
    );
    const characters = profileResponse?.Response?.characters?.data ?? {};
    return Object.keys(characters).sort();
}

async function getActivityHistory(
    membershipType: number,
    membershipId: string,
    characterId: string,
    mode: number
) {
    const activities = [];
    let page = 0;

    while (true) {
        const historyResponse = await bungieFetch(
            `/Destiny2/${membershipType}/Account/${membershipId}/Character/${characterId}/Stats/Activities/?mode=${mode}&count=${ACTIVITY_HISTORY_PAGE_SIZE}&page=${page}`
        );
        const pageActivities = historyResponse?.Response?.activities ?? [];

        if (pageActivities.length === 0) {
            return activities;
        }

        activities.push(...pageActivities);
        page += 1;
    }
}

async function bungieFetch(path: string, init: RequestInit = {}) {
    const apiKey = getServerBungieApiKey();

    if (!apiKey) {
        return null;
    }

    const response = await fetch(`${BUNGIE_API_BASE}${path}`, {
        ...init,
        headers: {
            'X-API-Key': apiKey,
            ...(init.headers ?? {}),
        },
        next: {
            revalidate: 900,
        },
    });

    if (!response.ok) {
        return null;
    }

    return response.json();
}

function uniqueActivities(activities: any[]) {
    return [...new Map(activities.map((activity) => [
        activity.activityDetails?.instanceId,
        activity,
    ])).values()];
}

function parseBungieName(user: string): [string, number | null] {
    const match = user.match(/^(.+?)#(\d{1,4})$/);

    if (!match) {
        return [user, null];
    }

    return [match[1].trim(), Number(match[2])];
}

function formatEmbedDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}
