export type ItemSourceInfo = {
  collectibleHash?: number;
  sourceText?: string;
  requirementText?: string;
};

export function findCollectibleForItemHash(
  collectibleTable: Record<string, any> | undefined,
  itemHash: number | undefined,
  preferredCollectibleHash?: number
) {
  if (!collectibleTable || !itemHash) return null;

  if (preferredCollectibleHash) {
    const preferredCollectible = collectibleTable[String(preferredCollectibleHash)];

    if (preferredCollectible?.itemHash === itemHash) {
      return preferredCollectible;
    }
  }

  return (
    Object.values(collectibleTable).find(
      (collectible: any) => collectible?.itemHash === itemHash
    ) ?? null
  );
}

export function cleanSourceText(sourceText: string | undefined): string | undefined {
  const cleanedText = sourceText?.replace(/^Source:\s*/i, "").trim();

  return cleanedText || undefined;
}

export function getItemSourceInfo({
  itemDefinition,
  collectibleTable,
  preferredCollectibleHash,
}: {
  itemDefinition: any;
  collectibleTable: Record<string, any> | undefined;
  preferredCollectibleHash?: number;
}): ItemSourceInfo | null {
  const itemHash = Number(itemDefinition?.hash);
  const collectibleHash =
    preferredCollectibleHash ?? Number(itemDefinition?.collectibleHash);
  const collectible = findCollectibleForItemHash(
    collectibleTable,
    Number.isFinite(itemHash) ? itemHash : undefined,
    Number.isFinite(collectibleHash) ? collectibleHash : undefined
  );
  const sourceText = cleanSourceText(
    collectible?.sourceString ?? itemDefinition?.sourceData?.sourceString
  );
  const requirementText =
    collectible?.stateInfo?.requirements?.entitlementUnavailableMessage?.trim() ||
    undefined;

  if (!sourceText && !requirementText) return null;

  return {
    collectibleHash: collectible?.hash,
    sourceText,
    requirementText,
  };
}
