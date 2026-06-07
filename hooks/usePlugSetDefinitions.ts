import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchManifestDefinitions } from "@/lib/manifestTableClient";

const fetchPlugSetDefinitions = async (plugSetHashes: number[]) => {
  return fetchManifestDefinitions("DestinyPlugSetDefinition", plugSetHashes);
};

export function usePlugSetDefinitions(plugSetHashes: number[]) {
  const stablePlugSetHashes = useMemo(
    () => Array.from(new Set(plugSetHashes)).sort((a, b) => a - b),
    [plugSetHashes]
  );
  const plugSetHashesKey = stablePlugSetHashes.join(",");

  const { data, error, isLoading } = useQuery({
    queryKey: ["plugSetDefinitions", plugSetHashesKey],
    queryFn: () => fetchPlugSetDefinitions(stablePlugSetHashes),
    enabled: stablePlugSetHashes.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    plugSetDefinitions: data ?? {},
    isLoading,
    error,
  };
}
