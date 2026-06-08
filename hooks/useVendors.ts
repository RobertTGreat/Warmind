import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { bungieApi, endpoints } from "@/lib/bungie";
import { fetchManifestDefinitions } from "@/lib/manifestTableClient";
import {
  buildVendorGroups,
  type DestinyVendorsResponse,
  type VendorDefinition,
  type VendorGroupDefinition,
  VENDOR_API_COMPONENTS,
} from "@/lib/vendors";

const fetcher = (url: string) => bungieApi.get(url).then((response) => response.data);

interface UseVendorsOptions {
  membershipType?: number;
  destinyMembershipId?: string;
  characterId?: string;
  enabled?: boolean;
}

export function useVendors({
  membershipType,
  destinyMembershipId,
  characterId,
  enabled = true,
}: UseVendorsOptions) {
  const vendorsUrl =
    membershipType && destinyMembershipId && characterId
      ? endpoints.getVendors(
          membershipType,
          destinyMembershipId,
          characterId,
          VENDOR_API_COMPONENTS
        )
      : null;

  const {
    data: vendorsResponse,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "destinyVendors",
      membershipType,
      destinyMembershipId,
      characterId,
    ],
    queryFn: () => fetcher(vendorsUrl as string),
    enabled: Boolean(vendorsUrl && enabled),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const vendorsData = vendorsResponse?.Response as DestinyVendorsResponse | undefined;

  const definitionHashes = useMemo(() => {
    if (!vendorsData?.vendorGroups?.data?.groups) {
      return { vendorHashes: [], groupHashes: [] };
    }

    const vendorHashes = new Set<number>();
    const groupHashes = new Set<number>();

    for (const group of vendorsData.vendorGroups.data.groups) {
      groupHashes.add(group.vendorGroupHash);
      for (const vendorHash of group.vendorHashes) {
        vendorHashes.add(vendorHash);
      }
    }

    return {
      vendorHashes: [...vendorHashes],
      groupHashes: [...groupHashes],
    };
  }, [vendorsData]);

  const {
    data: vendorDefinitions = {},
    isLoading: vendorDefinitionsLoading,
  } = useQuery({
    queryKey: ["vendorDefinitions", definitionHashes.vendorHashes.join(",")],
    queryFn: () =>
      fetchManifestDefinitions<VendorDefinition>(
        "DestinyVendorDefinition",
        definitionHashes.vendorHashes
      ),
    enabled: definitionHashes.vendorHashes.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  const {
    data: vendorGroupDefinitions = {},
    isLoading: vendorGroupDefinitionsLoading,
  } = useQuery({
    queryKey: ["vendorGroupDefinitions", definitionHashes.groupHashes.join(",")],
    queryFn: () =>
      fetchManifestDefinitions<VendorGroupDefinition>(
        "DestinyVendorGroupDefinition",
        definitionHashes.groupHashes
      ),
    enabled: definitionHashes.groupHashes.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  const normalizedVendorDefinitions = useMemo(() => {
    const definitionsByHash: Record<number, VendorDefinition> = {};

    for (const [hashKey, definition] of Object.entries(vendorDefinitions)) {
      definitionsByHash[Number(hashKey)] = definition;
    }

    return definitionsByHash;
  }, [vendorDefinitions]);

  const normalizedVendorGroupDefinitions = useMemo(() => {
    const definitionsByHash: Record<number, VendorGroupDefinition> = {};

    for (const [hashKey, definition] of Object.entries(vendorGroupDefinitions)) {
      definitionsByHash[Number(hashKey)] = definition;
    }

    return definitionsByHash;
  }, [vendorGroupDefinitions]);

  const destinationHashes = useMemo(() => {
    const hashes = new Set<number>();

    for (const vendorDefinition of Object.values(normalizedVendorDefinitions)) {
      for (const location of vendorDefinition.locations ?? []) {
        if (location.destinationHash) {
          hashes.add(location.destinationHash);
        }
      }
    }

    return [...hashes];
  }, [normalizedVendorDefinitions]);

  const {
    data: destinationDefinitions = {},
    isLoading: destinationDefinitionsLoading,
  } = useQuery({
    queryKey: ["vendorDestinationDefinitions", destinationHashes.join(",")],
    queryFn: () =>
      fetchManifestDefinitions<{
        hash: number;
        displayProperties: { name: string };
      }>("DestinyDestinationDefinition", destinationHashes),
    enabled: destinationHashes.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  const destinationNames = useMemo(() => {
    const namesByHash: Record<number, string> = {};

    for (const [hashKey, definition] of Object.entries(destinationDefinitions)) {
      namesByHash[Number(hashKey)] = definition.displayProperties?.name ?? "";
    }

    return namesByHash;
  }, [destinationDefinitions]);

  const vendorGroups = useMemo(() => {
    if (!vendorsData) {
      return [];
    }

    return buildVendorGroups(
      vendorsData,
      normalizedVendorDefinitions,
      normalizedVendorGroupDefinitions,
      destinationNames
    );
  }, [
    destinationNames,
    normalizedVendorDefinitions,
    normalizedVendorGroupDefinitions,
    vendorsData,
  ]);

  const currencyQuantities =
    vendorsData?.currencyLookups?.data?.itemQuantities ?? {};

  return {
    vendorsData,
    vendorGroups,
    vendorDefinitions: normalizedVendorDefinitions,
    destinationNames,
    currencyQuantities,
    isLoading:
      isLoading ||
      (definitionHashes.vendorHashes.length > 0 && vendorDefinitionsLoading) ||
      (definitionHashes.groupHashes.length > 0 && vendorGroupDefinitionsLoading) ||
      (destinationHashes.length > 0 && destinationDefinitionsLoading),
    isFetching,
    error,
    refetch,
  };
}
