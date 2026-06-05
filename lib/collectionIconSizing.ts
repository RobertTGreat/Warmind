import { ITEM_ICON_CSS_PX, type ItemIconSize } from "@/lib/itemIconImage";

const EXTRA_LARGE_COLLECTION_ICON_SIZE_PX = 80;

export function getCollectionIconSizePx(characterIconSize: ItemIconSize): number {
  switch (characterIconSize) {
    case "small":
      return ITEM_ICON_CSS_PX.medium;
    case "medium":
      return ITEM_ICON_CSS_PX.large;
    case "large":
    default:
      return EXTRA_LARGE_COLLECTION_ICON_SIZE_PX;
  }
}

export function getIconWidthClassName(iconSizePx: number): string | undefined {
  switch (iconSizePx) {
    case ITEM_ICON_CSS_PX.small:
      return "w-12";
    case ITEM_ICON_CSS_PX.medium:
      return "w-14";
    case ITEM_ICON_CSS_PX.large:
      return "w-16";
    case EXTRA_LARGE_COLLECTION_ICON_SIZE_PX:
      return "w-20";
    default:
      return undefined;
  }
}
