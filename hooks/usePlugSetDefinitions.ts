import { useMemo } from "react";
import useSWR from "swr";
import { bungieApi, endpoints } from "@/lib/bungie";

const fetchPlugSetDefinitions = async (plugSetHashes: number[]) => {
  const plugSetDefinitions: Record<number, any> = {};

  await Promise.all(
    plugSetHashes.map(async (plugSetHash) => {
      const response = await bungieApi.get(endpoints.getPlugSetDefinition(plugSetHash));
      plugSetDefinitions[plugSetHash] = response.data.Response;
    })
  );

  return plugSetDefinitions;
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
