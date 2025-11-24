import useSWR from 'swr';
import { bungieApi, endpoints } from '@/lib/bungie';
import { useState, useEffect } from 'react';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

export function useOtherUserProfile(membershipType: number | null, destinyMembershipId: string | null) {
    const { data: profile, error, isLoading } = useSWR(
        membershipType && destinyMembershipId 
            ? endpoints.getProfile(membershipType, destinyMembershipId)
            : null,
        fetcher,
        { revalidateOnFocus: false }
    );

    return {
        profile: profile?.Response,
        isLoading,
        isError: error,
    };
}

