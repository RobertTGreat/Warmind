import type { Metadata } from 'next';
import ActivityPageClient from './ActivityPageClient';
import { getClanMemberTagsDescription } from '@/lib/clanMemberTags';

interface ActivityPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const DEFAULT_TITLE = 'Activity Report';
const DEFAULT_DESCRIPTION = 'Review raid and dungeon clears, special runs, speed trends, and PGCR details.';

export async function generateMetadata({ searchParams }: ActivityPageProps): Promise<Metadata> {
    const params = await searchParams;
    const sharedUser = getSharedUserFromSearchParams(params);
    const title = sharedUser ? `${sharedUser}'s Activity Report` : DEFAULT_TITLE;
    const clanMemberTagsDescription = getClanMemberTagsDescription(sharedUser);
    const description = sharedUser
        ? clanMemberTagsDescription ?? `Report Info for ${sharedUser}: clears, special runs, total time, kills, assists, deaths, and activity history.`
        : DEFAULT_DESCRIPTION;
    const url = sharedUser
        ? `/activity?user=${encodeURIComponent(sharedUser)}`
        : '/activity';

    return {
        title,
        description,
        alternates: {
            canonical: url,
        },
        openGraph: {
            type: 'website',
            url,
            title,
            description,
            siteName: 'Warmind',
            images: [
                {
                    url: `/activity/opengraph-image?user=${encodeURIComponent(sharedUser ?? '')}`,
                    width: 1200,
                    height: 630,
                    alt: `${title} - Report Info`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`/activity/opengraph-image?user=${encodeURIComponent(sharedUser ?? '')}`],
        },
    };
}

export default function ActivityPage() {
    return <ActivityPageClient />;
}

function getSharedUserFromSearchParams(
    searchParams: Record<string, string | string[] | undefined> | undefined
): string | null {
    const userParam = searchParams?.user ?? searchParams?.[''];
    const user = Array.isArray(userParam) ? userParam[0] : userParam;
    return user?.trim() || null;
}
