import { memo } from "react";
import { cn } from "@/lib/utils";

type FastBungieIconProps = {
  src: string;
  alt?: string;
  size: number;
  className?: string;
  fetchPriority?: "auto" | "high" | "low";
};

export const FastBungieIcon = memo(function FastBungieIcon({
  src,
  alt = "",
  size,
  className,
  fetchPriority = "low",
}: FastBungieIconProps) {
  const shouldLoadEagerly = fetchPriority === "high";

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={shouldLoadEagerly ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={fetchPriority}
      draggable={false}
      className={cn("h-full w-full object-cover", className)}
    />
  );
});
