import useSWR from "swr";

const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.json();
};

export function useManifestTable<T = any>(definitionType: string) {
  const { data, error, isLoading } = useSWR<Record<string, T>>(
    `/api/manifest-table/${definitionType}`,
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
