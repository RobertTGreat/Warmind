import { memo, type DragEvent, type ReactNode } from "react";
import { FastBungieIcon } from "@/components/FastBungieIcon";
import { getWishListMatchTextClass } from "@/lib/wishlistVisuals";
import { cn } from "@/lib/utils";

export type ItemTileModel = {
  itemHash: number;
  itemInstanceId?: string;
  name: string;
  iconSrc: string | null;
  watermarkSrc?: string | null;
  elementIconSrc?: string | null;
  primaryStat?: number;
  quantity?: number;
  rarityClassName: string;
  isDimmed?: boolean;
  isLocked?: boolean;
  isTrash?: boolean;
  tierNumber?: number;
  isWishListed?: boolean;
  wishListMatchType?: "exact" | "partial" | "item" | "none";
};

type ItemTileProps = {
  item: ItemTileModel;
  sizePx: number;
  className?: string;
  fetchPriority?: "auto" | "high" | "low";
  showBorder?: boolean;
  title?: string;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  children?: ReactNode;
};

export const ItemTile = memo(function ItemTile({
  item,
  sizePx,
  className,
  fetchPriority = "low",
  showBorder = true,
  title,
  draggable,
  onDragStart,
  onDragEnd,
  children,
}: ItemTileProps) {
  const statText = item.primaryStat ?? item.quantity;
  const tierNumber = item.tierNumber ?? 1;
  const tierStarClassName =
    sizePx <= 48
      ? "left-[0.25rem] top-2.5 text-[7px]"
      : sizePx <= 56
        ? "left-[0.28rem] top-3 text-[8px]"
        : sizePx <= 64
          ? "left-[0.3rem] top-3.5 text-[9px]"
          : "left-[0.35rem] top-4 text-[10px]";
  const trashBadgeClassName =
    sizePx <= 48
      ? "h-3 w-3 text-[6px]"
      : sizePx <= 64
        ? "h-3.5 w-3.5 text-[7px]"
        : "h-4 w-4 text-[8px]";
  const statsTextClassName = sizePx <= 48 ? "text-[9px]" : "text-[10px]";
  const tierStarSpacingClassName = sizePx <= 56 ? "-space-y-1" : "-space-y-0.5";

  return (
    <div
      className={cn(
        "group relative flex flex-col select-none",
        item.isDimmed && "opacity-30 grayscale",
        className
      )}
      title={title ?? item.name}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div
        className={cn(
          "relative aspect-square overflow-hidden bg-slate-900",
          showBorder && "border-2",
          showBorder && item.rarityClassName
        )}
      >
        {item.iconSrc && (
          <FastBungieIcon
            src={item.iconSrc}
            alt={item.name}
            size={sizePx}
            fetchPriority={fetchPriority}
          />
        )}

        {item.watermarkSrc && (
          <FastBungieIcon
            src={item.watermarkSrc}
            alt=""
            size={sizePx}
            fetchPriority="low"
            className="absolute inset-0 pointer-events-none"
          />
        )}

        {item.isLocked && (
          <div className="absolute right-0.5 top-0.5 z-20 h-2 w-2 rounded-full bg-yellow-500 shadow-sm" />
        )}

        {item.isTrash && (
          <div
            className={cn(
              "absolute bottom-0.5 right-0.5 z-20 flex items-center justify-center rounded-sm bg-red-500/90 font-bold text-white shadow-lg",
              trashBadgeClassName
            )}
          >
            x
          </div>
        )}

        {tierNumber > 1 && (
          <div
            className={cn(
              "absolute z-20 flex flex-col leading-[0.65]",
              tierStarClassName,
              tierStarSpacingClassName
            )}
          >
            {Array.from({ length: tierNumber }).map((_, index) => (
              <span
                key={index}
                className={cn(
                    "drop-shadow-md",
                    tierNumber === 5 ? "text-destiny-gold" : "text-white"
                  )}
              >
                ✦
              </span>
            ))}
          </div>
        )}

        {children}

        <div className="pointer-events-none absolute inset-0 border-2 border-white opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {(statText !== undefined && statText !== null) || item.elementIconSrc || item.isWishListed ? (
        <div className={cn("mt-0.5 flex min-h-3 w-full items-center justify-between gap-1 px-1.5 font-bold leading-none text-white", statsTextClassName)}>
          <span className={statText === undefined || statText === null ? "text-transparent" : undefined}>
            {statText ?? "0"}
          </span>

          {item.isWishListed && !item.isTrash && (
            <span
              className={cn(
                "text-[8px] leading-none",
                getWishListMatchTextClass(item.wishListMatchType ?? "none")
              )}
            >
              {"\u2605"}
            </span>
          )}

          {item.elementIconSrc && (
            <img
              src={item.elementIconSrc}
              width={12}
              height={12}
              alt=""
              decoding="async"
              loading="lazy"
              fetchPriority="low"
              className="shrink-0 object-contain"
            />
          )}
        </div>
      ) : null}
    </div>
  );
});
