"use client";

import type { MenuItemWithImages } from "@/lib/product-image-display";
import { formatPrice, parseTags } from "@/lib/utils";
import Image from "next/image";
import { ImageOff, GripVertical, EyeOff, Eye } from "lucide-react";
import { forwardRef } from "react";

type Props = {
  item: MenuItemWithImages;
  currency: string;
  displayUrl: string | null;
  imageCount: number;
  onOpen: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  isHidden?: boolean;
  dimmed?: boolean;
  onToggleHidden?: () => void;
  style?: React.CSSProperties;
};

export const ProductGridCard = forwardRef<HTMLElement, Props>(function ProductGridCard(
  {
    item,
    currency,
    displayUrl,
    imageCount,
    onOpen,
    dragHandleProps,
    isDragging,
    isHidden,
    dimmed,
    onToggleHidden,
    style,
  },
  ref
) {
  const tags = parseTags(item.tags);

  return (
    <article
      ref={ref}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`relative bg-white rounded-lg border border-[#e8e2d9] transition-all cursor-pointer touch-manipulation ${
        isDragging
          ? "opacity-40 shadow-lg z-10"
          : dimmed
            ? "opacity-45 hover:opacity-60 border-[#e8e2d9]"
            : "hover:border-[#d4cfc6] hover:shadow-sm"
      }`}
    >
      <div className="relative aspect-square bg-[#f0ebe3] rounded-t-lg overflow-hidden">
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt={item.name}
            fill
            className="object-cover pointer-events-none"
            sizes="120px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#9a8f82] pointer-events-none">
            <ImageOff size={20} />
            <span className="text-[10px] mt-1">No photo</span>
          </div>
        )}
        {item.displayImageId && (
          <span className="absolute bottom-1 right-1 text-[9px] bg-[#1a1612] text-white px-1 rounded font-medium pointer-events-none">
            menu
          </span>
        )}
        {imageCount > 1 && (
          <span className="absolute bottom-1 left-1 text-[9px] bg-white/90 text-[#1a1612] px-1 rounded font-medium border border-[#e8e2d9] pointer-events-none">
            {imageCount} photos
          </span>
        )}
        {onToggleHidden && (
          <button
            type="button"
            aria-label={isHidden ? "Show in grid" : "Hide from grid"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden();
            }}
            className={`absolute top-1 left-1 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border shadow-sm touch-manipulation ${
              isHidden
                ? "bg-[#faf6ee] border-[#c9a962]/50 text-[#1a1612]"
                : "bg-white/95 border-[#e8e2d9] text-[#5c534a] hover:text-[#1a1612]"
            }`}
          >
            {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
        {dragHandleProps && (
          <button
            type="button"
            aria-label="Drag to reorder"
            className="absolute top-1 right-1 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md bg-white/95 border border-[#e8e2d9] shadow-sm text-[#5c534a] touch-manipulation cursor-grab active:cursor-grabbing"
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </button>
        )}
      </div>

      <div className="w-full p-2 space-y-0.5 text-left pointer-events-none">
        <h3 className="text-xs font-medium text-[#1a1612] leading-snug line-clamp-2 min-h-[2.5em]">
          {item.name}
        </h3>
        <p className="text-xs text-[#c9a962] font-medium">
          {formatPrice(item.priceCents, item.priceLabel, currency) || "—"}
        </p>
        {tags.length > 0 && (
          <p className="text-[9px] text-[#9a8f82] truncate">{tags.join(" · ")}</p>
        )}
      </div>
    </article>
  );
});