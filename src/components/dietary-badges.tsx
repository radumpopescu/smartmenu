"use client";

import {
  DIETARY_BADGES,
  getDietaryBadge,
  parseDietaryBadgeIds,
  type DietaryBadgeId,
} from "@/lib/dietary-badges";
import { cn } from "@/lib/utils";

export function DietaryBadgePicker({
  value,
  onChange,
}: {
  value: DietaryBadgeId[];
  onChange: (ids: DietaryBadgeId[]) => void;
}) {
  const selected = new Set(value);

  function toggle(id: DietaryBadgeId) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(DIETARY_BADGES.filter((b) => next.has(b.id)).map((b) => b.id));
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {DIETARY_BADGES.map((badge) => {
        const on = selected.has(badge.id);
        const Icon = badge.Icon;
        return (
          <button
            key={badge.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(badge.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition touch-manipulation min-h-[72px]",
              on
                ? "border-[#c9a962] bg-[#faf6ee] text-[#1a1612] ring-1 ring-[#c9a962]/40"
                : "border-[#e8e2d9] bg-white text-[#5c534a] hover:border-[#d4cfc6]"
            )}
          >
            <Icon
              size={22}
              strokeWidth={on ? 2.25 : 1.75}
              className={on ? "text-[#c9a962]" : "text-[#9a8f82]"}
            />
            <span className="text-[10px] leading-tight font-medium">
              {badge.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DietaryBadgeIcons({
  tags,
  size = "md",
  accent,
  className,
}: {
  tags: string | null;
  size?: "sm" | "md";
  accent?: string;
  className?: string;
}) {
  const ids = parseDietaryBadgeIds(tags);
  if (ids.length === 0) return null;

  const iconSize = size === "sm" ? 14 : 18;
  const pad = size === "sm" ? "p-1" : "p-1.5";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {ids.map((id) => {
        const badge = getDietaryBadge(id);
        if (!badge) return null;
        const Icon = badge.Icon;
        return (
          <span
            key={id}
            title={badge.label}
            className={cn(
              "inline-flex items-center justify-center rounded-full border",
              pad,
              size === "sm"
                ? "border-[#e8e2d9] bg-[#f8f6f3] text-[#5c534a]"
                : "border-[#3d3530] bg-[#1e1916] text-[#c4b8a8]"
            )}
            style={
              accent && size !== "sm"
                ? { borderColor: `${accent}44`, color: accent }
                : undefined
            }
          >
            <Icon size={iconSize} aria-hidden />
            <span className="sr-only">{badge.label}</span>
          </span>
        );
      })}
    </div>
  );
}