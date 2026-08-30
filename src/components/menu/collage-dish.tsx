import type { ProductDTO } from "@/shared/types";
import { DietaryBadgeIcons } from "@/components/dietary-badges";
import { getDisplayMarketingBadges } from "@/lib/menu-badges";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

/**
 * Per-dish variation.
 *
 * A collage reads as designed rather than generated when the plates are not
 * all the same size. These cycle by position, so a category always lays out
 * the same way between renders — no randomness, nothing to hydrate-mismatch.
 *
 * `pull` is a negative top margin that lets a plate ride up into the gap left
 * by its neighbour. It only looks right because the photos are transparent
 * cut-outs; against a boxed photo it would just overlap a white rectangle.
 */
const VARIANTS = [
  { ratio: "aspect-[5/4]", width: "w-full", tilt: "-rotate-1", pull: "" },
  { ratio: "aspect-square", width: "w-[92%]", tilt: "rotate-2", pull: "sm:-mt-8" },
  { ratio: "aspect-[4/3]", width: "w-full", tilt: "rotate-1", pull: "sm:-mt-4" },
  { ratio: "aspect-[5/4]", width: "w-[95%]", tilt: "-rotate-2", pull: "sm:-mt-10" },
  { ratio: "aspect-square", width: "w-full", tilt: "rotate-1", pull: "sm:-mt-6" },
  { ratio: "aspect-[4/3]", width: "w-[90%]", tilt: "-rotate-1", pull: "sm:-mt-8" },
] as const;

function MarketingBadge({ type }: { type: "new" | "bestseller" }) {
  if (type === "new") {
    return (
      <span className="menu-badge-burst absolute -top-1 right-2 z-20 grid place-items-center h-12 w-12 text-[9px] font-extrabold uppercase tracking-wide text-white">
        New
      </span>
    );
  }
  return (
    <span className="absolute top-1 left-1 z-20 grid place-items-center h-11 w-11 rounded-full border-2 border-[#e6d9ae] bg-[#c9a962] text-[7.5px] font-extrabold uppercase leading-[1.15] tracking-wide text-white text-center shadow-md">
      Best
      <br />
      seller
    </span>
  );
}

export function CollageDish({
  item,
  slug,
  currency,
  accent,
  index,
}: {
  item: ProductDTO;
  slug: string;
  currency: string;
  accent: string;
  index: number;
}) {
  const v = VARIANTS[index % VARIANTS.length]!;
  const price = formatPrice(item.priceCents, item.priceLabel, currency);
  const badges = getDisplayMarketingBadges(item.tags, item.sortOrder);
  const imageUrl = item.displayImageUrl;

  return (
    <article className={`break-inside-avoid mb-8 sm:mb-10 ${v.pull}`}>
      <Link href={`/${slug}/item/${item.id}`} className="group block">
        <div className={`relative mx-auto ${v.width}`}>
          <div
            className={`relative ${v.ratio} ${v.tilt} transition-transform duration-500 ease-out group-hover:scale-[1.04] group-hover:rotate-0`}
          >
            {badges.map((b) => (
              <MarketingBadge key={b} type={b} />
            ))}
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={item.name}
                fill
                className="menu-dish-cutout object-contain"
                unoptimized
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center rounded-full border border-dashed border-[#c8bda8] bg-[#faf6ef]/60">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#a89b88]">
                  Photo coming
                </span>
              </div>
            )}
          </div>

          {/*
            The label overlaps the plate slightly, the way the printed menus
            tuck their text blocks under the rim.
          */}
          <div className="relative z-10 -mt-5 sm:-mt-7 mx-auto w-[94%] max-w-[300px]">
            <div className="rounded-lg bg-[#1a3a5c] px-3 py-2 shadow-[0_6px_18px_-6px_rgba(26,47,74,0.55)]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[12.5px] sm:text-[13.5px] font-extrabold uppercase leading-tight tracking-wide text-white">
                  {item.name}
                </h3>
                {price && (
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold leading-tight"
                    style={{ backgroundColor: accent, color: "#fffdf7" }}
                  >
                    {price}
                  </span>
                )}
              </div>

              {item.description && (
                <p className="mt-1 text-[10.5px] leading-snug text-[#cfe0f0] line-clamp-3">
                  {item.description}
                </p>
              )}
            </div>

            <DietaryBadgeIcons
              tags={item.tags}
              size="sm"
              accent={accent}
              className="mt-1.5 justify-center"
            />
          </div>
        </div>
      </Link>
    </article>
  );
}
