"use client";

import type { Category } from "@/db/schema";
import type { PublicMenuItem } from "@/lib/stores";
import { CollageDish } from "@/components/menu/collage-dish";
import { splitCategoryTitle } from "@/lib/menu-badges";
import { ChevronLeft, ChevronRight } from "lucide-react";

type CategorySection = {
  category: Category | null;
  items: PublicMenuItem[];
  label: string;
};

export function CollageCategoryBoard({
  section,
  storeName,
  accent,
  currency,
  slug,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  section: CategorySection;
  storeName: string;
  accent: string;
  currency: string;
  slug: string;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const { primary, secondary } = splitCategoryTitle(section.label);

  return (
    <section className="relative mx-auto w-full max-w-3xl lg:max-w-5xl">
      <div
        className="menu-collage-bg relative overflow-hidden rounded-[28px] border border-[#d8ccb6] shadow-[0_24px_60px_-28px_rgba(26,47,74,0.45)]"
        style={{ "--menu-accent": accent } as React.CSSProperties}
      >
        <div className="menu-rope-edge absolute inset-y-0 left-0 w-3 sm:w-4 rounded-l-[28px]" />
        <div className="menu-rope-edge absolute inset-y-0 right-0 w-3 sm:w-4 rounded-r-[28px]" />

        <div
          className="pointer-events-none absolute inset-0 menu-watermark opacity-40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 flex flex-wrap content-start gap-16 p-8 opacity-[0.035] overflow-hidden"
          aria-hidden
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="font-[family-name:var(--font-script)] text-5xl whitespace-nowrap"
              style={{ color: accent }}
            >
              {storeName}
            </span>
          ))}
        </div>

        <div className="relative px-5 sm:px-8 md:px-10 py-8 sm:py-10">
          <header className="mb-8 sm:mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2
              className="font-[family-name:var(--font-script)] text-5xl sm:text-6xl md:text-7xl leading-none"
              style={{ color: accent }}
            >
              {primary}
            </h2>
            {secondary && (
              <h2
                className="font-[family-name:var(--font-script)] text-4xl sm:text-5xl md:text-6xl leading-none"
                style={{ color: accent }}
              >
                {secondary}
              </h2>
            )}
          </header>

          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:gap-x-8">
            {section.items.map((item, index) => (
              <CollageDish
                key={item.id}
                item={item}
                slug={slug}
                currency={currency}
                accent={accent}
                layoutIndex={index}
              />
            ))}
          </div>

          {(hasPrev || hasNext) && (
            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                onClick={onPrev}
                disabled={!hasPrev}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c8bda8] bg-[#faf6ef]/90 text-[#1a3a5c] shadow-sm transition enabled:hover:bg-white disabled:opacity-30"
                aria-label="Previous category"
              >
                <ChevronLeft size={22} />
              </button>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#5c6b7a]">
                {section.label}
              </p>
              <button
                type="button"
                onClick={onNext}
                disabled={!hasNext}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c8bda8] bg-[#faf6ef]/90 text-[#1a3a5c] shadow-sm transition enabled:hover:bg-white disabled:opacity-30"
                aria-label="Next category"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}