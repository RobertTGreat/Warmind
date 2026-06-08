export interface VendorIconDefinition {
  displayProperties?: {
    icon?: string;
    smallTransparentIcon?: string;
  };
  factionHash?: number;
}

/**
 * Resolves the vendor portrait icon the same way DIM does:
 * smallTransparentIcon first, then standard icon, then faction icon.
 */
export function getVendorDisplayIcon(
  vendorDefinition?: VendorIconDefinition,
  factionDefinitions?: Record<number, { displayProperties?: { icon?: string } }>
) {
  const displayProperties = vendorDefinition?.displayProperties;
  const factionIcon = vendorDefinition?.factionHash
    ? factionDefinitions?.[vendorDefinition.factionHash]?.displayProperties?.icon
    : undefined;

  return (
    displayProperties?.smallTransparentIcon ||
    displayProperties?.icon ||
    factionIcon ||
    ""
  );
}
