import type {
  Vendor,
  VendorDefinition,
  VendorGroup,
  VendorSaleItem,
} from "@/lib/vendors";

function getDefinitionByHash(
  definitions: Record<number, any> | Record<string, any> | undefined,
  hash: number | undefined
) {
  if (!definitions || !Number.isSafeInteger(hash)) {
    return undefined;
  }

  const definitionsRecord = definitions as Record<number, any>;
  return definitionsRecord[hash!] ?? definitionsRecord[String(hash!) as unknown as number];
}

export function normalizeVendorSearchText(values: unknown[]) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" ")
    .toLowerCase();
}

export function matchesVendorSearch(searchText: string, searchQuery: string) {
  const searchTerms = searchQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (searchTerms.length === 0) {
    return true;
  }

  return searchTerms.every((searchTerm) => searchText.includes(searchTerm));
}

function collectItemDefinitionSearchValues(
  definition: any,
  itemDefinitions: Record<number, any>,
  sandboxPerkDefinitions: Record<number, any> | Record<string, any> | undefined
) {
  if (!definition) {
    return [];
  }

  const perkHashes = (definition.perks || [])
    .map((perk: any) => Number(perk?.perkHash))
    .filter(Number.isSafeInteger);
  const socketPlugHashes = (definition.sockets?.socketEntries || [])
    .flatMap((socketEntry: any) => [
      socketEntry?.singleInitialItemHash,
      ...(socketEntry?.reusablePlugItems || []).map(
        (plugItem: any) => plugItem?.plugItemHash
      ),
    ])
    .map((plugHash: any) => Number(plugHash))
    .filter(Number.isSafeInteger);

  return [
    definition.hash,
    definition.displayProperties?.name,
    definition.displayProperties?.description,
    definition.flavorText,
    definition.itemTypeDisplayName,
    definition.inventory?.tierTypeName,
    definition.plug?.plugCategoryIdentifier,
    definition.traitIds,
    ...perkHashes.flatMap((perkHash: number) => {
      const perkDefinition = getDefinitionByHash(sandboxPerkDefinitions, perkHash);
      return [
        perkHash,
        perkDefinition?.displayProperties?.name,
        perkDefinition?.displayProperties?.description,
      ];
    }),
    ...socketPlugHashes.flatMap((plugHash: number) => {
      const plugDefinition = getDefinitionByHash(itemDefinitions, plugHash);
      return [
        plugHash,
        plugDefinition?.displayProperties?.name,
        plugDefinition?.displayProperties?.description,
        plugDefinition?.itemTypeDisplayName,
      ];
    }),
  ];
}

function buildSaleItemSearchText({
  saleItem,
  itemDefinitions,
  sandboxPerkDefinitions,
  vendorDefinition,
  internalVendorByHash,
}: {
  saleItem: VendorSaleItem;
  itemDefinitions: Record<number, any>;
  sandboxPerkDefinitions: Record<number, any> | Record<string, any> | undefined;
  vendorDefinition?: VendorDefinition;
  internalVendorByHash: Record<number, Vendor>;
}) {
  const itemDefinition = itemDefinitions[saleItem.itemHash];
  const categoryName =
    saleItem.displayCategoryIndex !== undefined
      ? vendorDefinition?.displayCategories?.[saleItem.displayCategoryIndex]
          ?.displayProperties?.name
      : undefined;
  const internalVendorHash = itemDefinition?.preview?.previewVendorHash;
  const internalVendor =
    internalVendorHash !== undefined
      ? internalVendorByHash[internalVendorHash]
      : undefined;

  const costSearchValues = saleItem.costs.flatMap((cost) => {
    const costDefinition = itemDefinitions[cost.itemHash];
    return [
      cost.itemHash,
      costDefinition?.displayProperties?.name,
      costDefinition?.displayProperties?.description,
    ];
  });

  const internalVendorItemSearchValues = internalVendor
    ? internalVendor.items.flatMap((internalSaleItem) =>
        collectItemDefinitionSearchValues(
          itemDefinitions[internalSaleItem.itemHash],
          itemDefinitions,
          sandboxPerkDefinitions
        )
      )
    : [];

  return normalizeVendorSearchText([
    ...collectItemDefinitionSearchValues(
      itemDefinition,
      itemDefinitions,
      sandboxPerkDefinitions
    ),
    categoryName,
    ...saleItem.failureStrings,
    ...costSearchValues,
    internalVendor?.name,
    internalVendor?.locationLabel,
    ...internalVendorItemSearchValues,
  ]);
}

function buildVendorMetadataSearchText({
  vendor,
  groupName,
  vendorDefinition,
  destinationNames,
}: {
  vendor: Vendor;
  groupName: string;
  vendorDefinition?: VendorDefinition;
  destinationNames?: Record<number, string>;
}) {
  const categoryNames =
    vendorDefinition?.displayCategories?.map(
      (category) => category.displayProperties?.name
    ) ?? [];
  const locationNames =
    vendorDefinition?.locations?.flatMap((location) => {
      const destinationHash = location.destinationHash;
      if (!destinationHash) {
        return [];
      }

      return [
        destinationHash,
        destinationNames?.[destinationHash],
      ];
    }) ?? [];

  return normalizeVendorSearchText([
    vendor.name,
    vendor.locationLabel,
    groupName,
    vendorDefinition?.displayProperties?.description,
    ...categoryNames,
    ...(vendorDefinition?.failureStrings ?? []),
    ...locationNames,
  ]);
}

export function filterVendorGroupsBySearch(
  vendorGroups: VendorGroup[],
  searchQuery: string,
  {
    itemDefinitions,
    vendorDefinitions,
    sandboxPerkDefinitions,
    internalVendorByHash,
    destinationNames = {},
  }: {
    itemDefinitions: Record<number, any>;
    vendorDefinitions: Record<number, VendorDefinition>;
    sandboxPerkDefinitions: Record<number, any> | Record<string, any> | undefined;
    internalVendorByHash: Record<number, Vendor>;
    destinationNames?: Record<number, string>;
  }
): VendorGroup[] {
  const normalizedQuery = searchQuery.trim();
  if (!normalizedQuery) {
    return vendorGroups;
  }

  return vendorGroups
    .map((group) => {
      const vendors = group.vendors
        .map((vendor) => {
          const vendorDefinition = vendorDefinitions[vendor.vendorHash];
          const vendorMetadataSearchText = buildVendorMetadataSearchText({
            vendor,
            groupName: group.categoryName,
            vendorDefinition,
            destinationNames,
          });
          const vendorMetadataMatches = matchesVendorSearch(
            vendorMetadataSearchText,
            normalizedQuery
          );

          const filteredItems = vendor.items.filter((saleItem) => {
            if (vendorMetadataMatches) {
              return true;
            }

            const itemSearchText = buildSaleItemSearchText({
              saleItem,
              itemDefinitions,
              sandboxPerkDefinitions,
              vendorDefinition,
              internalVendorByHash,
            });

            return matchesVendorSearch(itemSearchText, normalizedQuery);
          });

          if (filteredItems.length === 0) {
            return null;
          }

          return {
            ...vendor,
            items: vendorMetadataMatches ? vendor.items : filteredItems,
          };
        })
        .filter((vendor): vendor is Vendor => vendor !== null);

      if (vendors.length === 0) {
        return null;
      }

      return {
        ...group,
        vendors,
      };
    })
    .filter((group): group is VendorGroup => group !== null);
}

export function collectMatchingVendorHashes(
  vendorGroups: VendorGroup[],
  searchQuery: string,
  {
    itemDefinitions,
    vendorDefinitions,
    sandboxPerkDefinitions,
    internalVendorByHash,
    destinationNames = {},
  }: {
    itemDefinitions: Record<number, any>;
    vendorDefinitions: Record<number, VendorDefinition>;
    sandboxPerkDefinitions: Record<number, any> | Record<string, any> | undefined;
    internalVendorByHash: Record<number, Vendor>;
    destinationNames?: Record<number, string>;
  }
) {
  const normalizedQuery = searchQuery.trim();
  if (!normalizedQuery) {
    return [];
  }

  const filteredGroups = filterVendorGroupsBySearch(vendorGroups, normalizedQuery, {
    itemDefinitions,
    vendorDefinitions,
    sandboxPerkDefinitions,
    internalVendorByHash,
    destinationNames,
  });

  return filteredGroups.flatMap((group) =>
    group.vendors.map((vendor) => vendor.vendorHash)
  );
}
