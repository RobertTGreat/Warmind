import { useQuery } from '@tanstack/react-query';
import { bungieApi, endpoints } from '@/lib/bungie';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

export function useOtherUserProfile(membershipType: number | null, destinyMembershipId: string | null) {
    const profileUrl =
        membershipType && destinyMembershipId
            ? endpoints.getProfile(membershipType, destinyMembershipId)
            : null;
    const { data: profile, error, isLoading } = useQuery({
        queryKey: ['destinyProfile', 'otherUser', membershipType, destinyMembershipId],
        queryFn: () => fetcher(profileUrl as string),
        enabled: Boolean(profileUrl),
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    return {
        profile: profile?.Response,
        isLoading,
        isError: error,
    };
}

