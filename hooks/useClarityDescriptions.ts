import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ClarityDescription } from "@/lib/clarityDescriptions";

const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.json() as Promise<Record<number, ClarityDescription>>;
};

export function useClarityDescriptions(plugHashes: number[]) {
  const uniqueHashes = useMemo(() => {
    return Array.from(new Set(plugHashes))
      .filter((plugHash) => Number.isSafeInteger(plugHash) && plugHash > 0)
      .sort((firstHash, secondHash) => firstHash - secondHash);
  }, [plugHashes]);

  const clarityHashesKey = uniqueHashes.join(",");
  const clarityUrl = `/api/clarity?hashes=${clarityHashesKey}`;
  const { data, error, isLoading } = useQuery({
    queryKey: ["clarityDescriptions", clarityHashesKey],
    queryFn: () => fetcher(clarityUrl),
    enabled: uniqueHashes.length > 0,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    descriptions: data ?? {},
    isLoading,
    isError: error,
  };
}
