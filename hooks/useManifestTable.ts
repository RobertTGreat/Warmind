import useSWR from "swr";
import { useMemo } from "react";

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

  const { data, error, isLoading } = useSWR<Record<string, T>>(
    tableUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 24 * 60 * 60 * 1000,
    }
  );

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
  const { table, isLoading, isError } = useManifestTable<T>(definitionType);

  return {
    definition: hash && table ? table[String(hash)] : undefined,
    isLoading,
    isError,
  };
}
