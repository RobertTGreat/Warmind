import { useManifestDefinition } from "@/hooks/useManifestTable";

export function usePresentationNode(hash: number | undefined) {
  const { definition, isLoading, isError } = useManifestDefinition(
    "DestinyPresentationNodeDefinition",
    hash
  );

  return {
    node: definition,
    isLoading,
    isError,
  };
}

export function useCollectible(hash: number | undefined) {
  const { definition, isLoading, isError } = useManifestDefinition(
    "DestinyCollectibleDefinition",
    hash
  );

  return {
    collectible: definition,
    isLoading,
    isError,
  };
}

export function useRecord(hash: number | undefined) {
  const { definition, isLoading, isError } = useManifestDefinition(
    "DestinyRecordDefinition",
    hash
  );

  return {
    record: definition,
    isLoading,
    isError,
  };
}
