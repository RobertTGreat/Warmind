import useSWR from "swr";
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

  const clarityUrl =
    uniqueHashes.length > 0 ? `/api/clarity?hashes=${uniqueHashes.join(",")}` : null;
  const { data, error, isLoading } = useSWR(clarityUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 12 * 60 * 60 * 1000,
  });

  return {
    descriptions: data ?? {},
    isLoading,
    isError: error,
  };
}
