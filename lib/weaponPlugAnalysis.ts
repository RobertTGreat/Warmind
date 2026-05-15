export interface WeaponPlugOption {
  plugHash: number;
  definition?: any;
  isActive: boolean;
  isEnhanced: boolean;
  isMasterwork: boolean;
  masterworkTier: number | null;
}

export interface WeaponSocketGroup {
  socketIndex: number;
  socketName: string;
  categoryIdentifier: string;
  activePlugHash?: number;
  activePlugDefinition?: any;
  options: WeaponPlugOption[];
  isIntrinsic: boolean;
  isPerkColumn: boolean;
  isMasterworkColumn: boolean;
  isOriginColumn: boolean;
  isCosmeticColumn: boolean;
}

export interface MasterworkPlugInfo {
  activePlug?: WeaponPlugOption;
  availablePlugs: WeaponPlugOption[];
  tier: number | null;
}

export interface WeaponPlugAnalysisInput {
  itemDefinition?: any;
  socketsData?: any;
  reusablePlugsData?: Record<string | number, any[]> | any[];
  plugDefinitions?: Record<number, any>;
  plugSetDefinitions?: Record<number, any>;
}

function getSocketReusablePlugs(
  socket: any,
  socketIndex: number,
  reusablePlugsData?: Record<string | number, any[]> | any[]
): any[] {
  const profileReusablePlugs =
    (reusablePlugsData as any)?.[socketIndex] ??
    (reusablePlugsData as any)?.[String(socketIndex)];

  if (Array.isArray(profileReusablePlugs)) {
    return profileReusablePlugs;
  }

  if (Array.isArray(socket?.reusablePlugs)) {
    return socket.reusablePlugs;
  }

  if (Array.isArray(socket?.reusablePlugItems)) {
    return socket.reusablePlugItems;
  }

  return [];
}

function getDefinitionReusablePlugs(
  itemDefinition: any,
  socketIndex: number,
  plugSetDefinitions?: Record<number, any>
): any[] {
  const socketEntry = itemDefinition?.sockets?.socketEntries?.[socketIndex];
  const reusablePlugItems = Array.isArray(socketEntry?.reusablePlugItems)
    ? socketEntry.reusablePlugItems
    : [];

  const reusablePlugSetHash = socketEntry?.reusablePlugSetHash;
  const randomizedPlugSetHash = socketEntry?.randomizedPlugSetHash;
  const plugSetHashes = [reusablePlugSetHash, randomizedPlugSetHash].filter(Boolean);

  const plugSetItems = plugSetHashes.flatMap((plugSetHash) => {
    const plugSetDefinition = plugSetDefinitions?.[plugSetHash];
    return Array.isArray(plugSetDefinition?.reusablePlugItems)
      ? plugSetDefinition.reusablePlugItems
      : [];
  });

  return [...reusablePlugItems, ...plugSetItems];
}

function getPlugItemHash(plugItem: any): number | null {
  const plugHash =
    typeof plugItem === "number"
      ? plugItem
      : plugItem?.plugItemHash ?? plugItem?.plugHash ?? plugItem?.itemHash;

  return typeof plugHash === "number" ? plugHash : null;
}

function dedupePlugHashes(plugItems: any[]): number[] {
  const plugHashes = new Set<number>();

  for (const plugItem of plugItems) {
    const plugHash = getPlugItemHash(plugItem);

    if (plugHash) {
      plugHashes.add(plugHash);
    }
  }

  return Array.from(plugHashes);
}

function getPlugText(definition: any): string {
  return [
    definition?.displayProperties?.name,
    definition?.displayProperties?.description,
    definition?.itemTypeDisplayName,
    definition?.plug?.plugCategoryIdentifier,
    ...(definition?.itemCategoryHashes ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isEnhancedWeaponPlug(definition: any): boolean {
  const plugText = getPlugText(definition);

  return (
    plugText.includes("enhanced") ||
    plugText.includes(".enhanced") ||
    plugText.includes("_enhanced")
  );
}

export function parseMasterworkTierFromPlug(definition: any): number | null {
  const name = definition?.displayProperties?.name ?? "";
  const description = definition?.displayProperties?.description ?? "";
  const tierMatch = `${name} ${description}`.match(/\bTier\s+(\d+)\b/i);

  return tierMatch ? Number(tierMatch[1]) : null;
}

export function isMasterworkPlug(definition: any): boolean {
  const plugText = getPlugText(definition);

  return plugText.includes("masterwork") || parseMasterworkTierFromPlug(definition) !== null;
}

export function isFunctionalWeaponPerk(definition: any): boolean {
  const plugText = getPlugText(definition);

  if (!definition?.displayProperties?.name) return false;

  const isCosmetic =
    plugText.includes("shader") ||
    plugText.includes("ornament") ||
    plugText.includes("memento") ||
    plugText.includes("tracker") ||
    plugText.includes("kill tracker");

  const isGameplayPlug =
    plugText.includes("trait") ||
    plugText.includes("perk") ||
    plugText.includes("barrel") ||
    plugText.includes("sight") ||
    plugText.includes("scope") ||
    plugText.includes("magazine") ||
    plugText.includes("battery") ||
    plugText.includes("rounds") ||
    plugText.includes("launcher barrel");

  return isGameplayPlug && !isCosmetic && !isMasterworkPlug(definition);
}

export function getWeaponPlugSetHashes(itemDefinition?: any): number[] {
  const socketEntries = itemDefinition?.sockets?.socketEntries ?? [];
  const plugSetHashes = new Set<number>();

  for (const socketEntry of socketEntries) {
    if (socketEntry?.reusablePlugSetHash) {
      plugSetHashes.add(socketEntry.reusablePlugSetHash);
    }

    if (socketEntry?.randomizedPlugSetHash) {
      plugSetHashes.add(socketEntry.randomizedPlugSetHash);
    }
  }

  return Array.from(plugSetHashes);
}

export function collectWeaponPlugHashes({
  itemDefinition,
  socketsData,
  reusablePlugsData,
  plugSetDefinitions,
}: Omit<WeaponPlugAnalysisInput, "plugDefinitions">): number[] {
  const plugHashes = new Set<number>();
  const sockets = socketsData?.sockets ?? [];
  const socketCount = Math.max(
    sockets.length,
    itemDefinition?.sockets?.socketEntries?.length ?? 0
  );

  for (let socketIndex = 0; socketIndex < socketCount; socketIndex += 1) {
    const socket = sockets[socketIndex];
    const socketEntry = itemDefinition?.sockets?.socketEntries?.[socketIndex];

    if (socket?.plugHash) {
      plugHashes.add(socket.plugHash);
    }

    if (socketEntry?.singleInitialItemHash) {
      plugHashes.add(socketEntry.singleInitialItemHash);
    }

    const socketPlugItems = [
      ...getSocketReusablePlugs(socket, socketIndex, reusablePlugsData),
      ...getDefinitionReusablePlugs(itemDefinition, socketIndex, plugSetDefinitions),
    ];

    for (const plugHash of dedupePlugHashes(socketPlugItems)) {
      plugHashes.add(plugHash);
    }
  }

  return Array.from(plugHashes);
}

export function buildWeaponSocketGroups({
  itemDefinition,
  socketsData,
  reusablePlugsData,
  plugDefinitions = {},
  plugSetDefinitions,
}: WeaponPlugAnalysisInput): WeaponSocketGroup[] {
  const sockets = socketsData?.sockets ?? [];
  const socketEntries = itemDefinition?.sockets?.socketEntries ?? [];
  const socketCount = Math.max(sockets.length, socketEntries.length);
  const socketGroups: WeaponSocketGroup[] = [];

  for (let socketIndex = 0; socketIndex < socketCount; socketIndex += 1) {
    const socket = sockets[socketIndex];
    const socketEntry = socketEntries[socketIndex];
    const activePlugHash = socket?.plugHash ?? socketEntry?.singleInitialItemHash;
    const activePlugDefinition = activePlugHash ? plugDefinitions[activePlugHash] : undefined;
    const plugHashes = dedupePlugHashes([
      activePlugHash,
      ...getSocketReusablePlugs(socket, socketIndex, reusablePlugsData),
      ...getDefinitionReusablePlugs(itemDefinition, socketIndex, plugSetDefinitions),
    ]);

    const options = plugHashes
      .map((plugHash) => {
        const definition = plugDefinitions[plugHash];

        return {
          plugHash,
          definition,
          isActive: activePlugHash === plugHash,
          isEnhanced: isEnhancedWeaponPlug(definition),
          isMasterwork: isMasterworkPlug(definition),
          masterworkTier: parseMasterworkTierFromPlug(definition),
        };
      })
      .filter((option) => option.definition?.displayProperties?.name);

    const socketName =
      socketEntry?.socketTypeHash?.toString() ??
      activePlugDefinition?.itemTypeDisplayName ??
      `Socket ${socketIndex + 1}`;
    const categoryIdentifier =
      activePlugDefinition?.plug?.plugCategoryIdentifier ??
      options[0]?.definition?.plug?.plugCategoryIdentifier ??
      "";
    const categoryText = `${socketName} ${categoryIdentifier} ${activePlugDefinition?.itemTypeDisplayName ?? ""}`.toLowerCase();
    const isMasterworkColumn = options.some((option) => option.isMasterwork);
    const isCosmeticColumn =
      categoryText.includes("shader") ||
      categoryText.includes("ornament") ||
      categoryText.includes("memento") ||
      categoryText.includes("tracker") ||
      categoryText.includes("skins");
    const isIntrinsic = socketIndex === 0 || categoryText.includes("intrinsic");
    const isOriginColumn = categoryText.includes("origin");
    const isPerkColumn =
      !isIntrinsic &&
      !isMasterworkColumn &&
      !isCosmeticColumn &&
      options.some((option) => isFunctionalWeaponPerk(option.definition));

    if (options.length > 0) {
      socketGroups.push({
        socketIndex,
        socketName,
        categoryIdentifier,
        activePlugHash,
        activePlugDefinition,
        options,
        isIntrinsic,
        isPerkColumn,
        isMasterworkColumn,
        isOriginColumn,
        isCosmeticColumn,
      });
    }
  }

  return socketGroups;
}

export function getMasterworkPlugInfo(socketGroups: WeaponSocketGroup[]): MasterworkPlugInfo {
  const masterworkOptions = socketGroups.flatMap((socketGroup) =>
    socketGroup.options.filter((option) => option.isMasterwork)
  );
  const activePlug = masterworkOptions.find((option) => option.isActive);
  const tier = activePlug?.masterworkTier ?? null;

  return {
    activePlug,
    availablePlugs: masterworkOptions,
    tier,
  };
}
