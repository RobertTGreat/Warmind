import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchManifestDefinitions } from "@/lib/manifestTableClient";
import { getManifestTable } from "@/lib/manifestRepository";

const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.json();
};

type ManifestTableOptions = {
  view?: string;
};

const MANIFEST_TABLE_QUERY_VERSION = "full-table-cache-v3";

export function useManifestTable<T = any>(
  definitionType: string,
  options?: ManifestTableOptions
) {
  const tableUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (options?.view) {
      params.set("view", options.view);
    }

    const query = params.toString();
    return `/api/manifest-table/${definitionType}${query ? `?${query}` : ""}`;
  }, [definitionType, options?.view]);

  const { data, error, isLoading } = useQuery({
    queryKey: [
      "manifestTable",
      MANIFEST_TABLE_QUERY_VERSION,
      definitionType,
      options?.view ?? "full",
    ],
    queryFn: async () => {
      try {
        return await getManifestTable<T>(definitionType, { view: options?.view });
      } catch (error) {
        console.warn("[Manifest] IndexedDB table lookup failed, falling back to API", error);
        return fetcher(tableUrl) as Promise<Record<string, T>>;
      }
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    table: data,
    isLoading,
    isError: error,
  };
}

export function useManifestDefinition<T = any>(
  definitionType: string,
  hash: number | undefined
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["manifestDefinition", definitionType, hash],
    queryFn: () => fetchManifestDefinitions<T>(definitionType, [hash!]),
    enabled: Number.isFinite(hash),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    definition: hash && data ? data[String(hash)] : undefined,
    isLoading,
    isError: error,
  };
}
