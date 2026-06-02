import { useMemo } from "react";
import useSWR from "swr";
import { fetchManifestDefinitions } from "@/lib/manifestTableClient";

const fetchPlugSetDefinitions = async (plugSetHashes: number[]) => {
  return fetchManifestDefinitions("DestinyPlugSetDefinition", plugSetHashes);
};

export function usePlugSetDefinitions(plugSetHashes: number[]) {
  const stablePlugSetHashes = useMemo(
    () => Array.from(new Set(plugSetHashes)).sort((a, b) => a - b),
    [plugSetHashes]
  );
  const cacheKey =
    stablePlugSetHashes.length > 0
      ? ["plug-set-definitions", stablePlugSetHashes.join(",")]
      : null;

  const { data, error, isLoading } = useSWR(cacheKey, () =>
    fetchPlugSetDefinitions(stablePlugSetHashes)
  );

  return {
    plugSetDefinitions: data ?? {},
    isLoading,
    error,
  };
}
