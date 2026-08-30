import type { ProductDTO } from "@/shared/types";
import { DietaryBadgeIcons } from "@/components/dietary-badges";
import { getDisplayMarketingBadges } from "@/lib/menu-badges";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

/**
 * Slight per-dish variation so a long scroll does not read as a template.
 * Cycles by position rather than randomly, so the page lays out identically
 * on server and client and there is nothing to hydrate-mismatch.
 */
const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"] as const;

function MarketingBadge({ type }: { type: "new" | "bestseller" }) {
  if (type === "new") {
    return (
      <span className="menu-badge-burst absolute top-0 right-2 z-20 grid h-14 w-14 place-items-center text-[10px] font-extrabold uppercase tracking-wide text-white">
        New
      </span>
    );
  }
  return (
    <span className="absolute top-1 left-1 z-20 grid h-14 w-14 place-items-center rounded-full border-2 border-[#e6d9ae] bg-[#c9a962] text-center text-[8.5px] font-extrabold uppercase leading-[1.15] tracking-wide text-white shadow-md">
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
  const price = formatPrice(item.priceCents, item.priceLabel, currency);
  const badges = getDisplayMarketingBadges(item.tags, item.sortOrder);
  const imageUrl = item.displayImageUrl;
  const tilt = TILTS[index % TILTS.length]!;

  /** Even dishes put the plate on the left, odd on the right. */
  const plateLeft = index % 2 === 0;

  return (
    <article className="menu-dish-row">
      <Link
        href={`/${slug}/item/${item.id}`}
        className="group grid items-center gap-4 sm:gap-6 md:grid-cols-[1.05fr_0.95fr] md:gap-10"
      >
        {/* Plate */}
        <div
          className={`relative mx-auto w-full max-w-[420px] ${
            plateLeft ? "md:order-1" : "md:order-2"
          }`}
        >
          <div
            className={`relative aspect-square ${tilt} transition-transform duration-500 ease-out group-hover:rotate-0 group-hover:scale-[1.04]`}
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
                sizes="(max-width: 768px) 92vw, 420px"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center rounded-full border border-dashed border-[#c8bda8] bg-[#faf6ef]/60">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#a89b88]">
                  Photo coming
                </span>
              </div>
            )}
          </div>
        </div>

        {/*
          Text sits opposite the plate and leans toward it, so the eye runs
          plate -> label -> next plate down the page instead of bouncing.
        */}
        <div
          className={`${plateLeft ? "md:order-2 md:text-left" : "md:order-1 md:text-right"} ${
            plateLeft ? "md:-ml-10" : "md:-mr-10"
          } relative z-10`}
        >
          <div className="inline-block w-full max-w-[420px] rounded-xl bg-[#1a3a5c] px-4 py-3 text-left shadow-[0_10px_30px_-10px_rgba(26,47,74,0.6)] sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-[family-name:var(--font-display)] text-[15px] font-extrabold uppercase leading-tight tracking-wide text-white sm:text-lg">
                {item.name}
              </h3>
              {price && (
                <span
                  className="shrink-0 rounded px-2 py-1 text-[13px] font-bold leading-none sm:text-sm"
                  style={{ backgroundColor: accent, color: "#fffdf7" }}
                >
                  {price}
                </span>
              )}
            </div>

            {item.description && (
              <p className="mt-2 text-[12px] leading-relaxed text-[#cfe0f0] sm:text-[13px]">
                {item.description}
              </p>
            )}

            <DietaryBadgeIcons
              tags={item.tags}
              size="sm"
              accent={accent}
              className="mt-2.5"
            />
          </div>
        </div>
      </Link>
    </article>
  );
}
