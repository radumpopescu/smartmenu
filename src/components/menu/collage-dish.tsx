import type { PublicMenuItem } from "@/lib/stores";
import { DietaryBadgeIcons } from "@/components/dietary-badges";
import { getDisplayMarketingBadges } from "@/lib/menu-badges";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

const LAYOUTS = [
  {
    wrapper: "col-span-2 flex flex-col items-center",
    image: "w-[min(100%,340px)] aspect-[4/3]",
    label: "items-center text-center",
    tilt: "-rotate-1",
  },
  {
    wrapper: "col-span-1 flex flex-col items-end pt-6",
    image: "w-full aspect-[3/4]",
    label: "items-end text-right",
    tilt: "rotate-2",
  },
  {
    wrapper: "col-span-1 flex flex-col items-start pt-2",
    image: "w-full aspect-[3/4]",
    label: "items-start text-left",
    tilt: "-rotate-2",
  },
  {
    wrapper: "col-span-2 flex flex-col items-center",
    image: "w-[min(100%,380px)] aspect-[5/4]",
    label: "items-center text-center",
    tilt: "rotate-1",
  },
  {
    wrapper: "col-span-1 flex flex-col items-start",
    image: "w-full aspect-square",
    label: "items-start text-left",
    tilt: "rotate-1",
  },
  {
    wrapper: "col-span-1 flex flex-col items-end",
    image: "w-full aspect-square",
    label: "items-end text-right",
    tilt: "-rotate-1",
  },
] as const;

function MarketingBadge({ type }: { type: "new" | "bestseller" }) {
  const isNew = type === "new";
  return (
    <span
      className={`absolute z-10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ${
        isNew
          ? "top-2 right-2 rounded-full bg-[#d63b3b]"
          : "top-2 left-2 rounded-sm bg-[#d63b3b] -rotate-6"
      }`}
    >
      {isNew ? "New" : "Best seller"}
    </span>
  );
}

export function CollageDish({
  item,
  slug,
  currency,
  accent,
  layoutIndex,
}: {
  item: PublicMenuItem;
  slug: string;
  currency: string;
  accent: string;
  layoutIndex: number;
}) {
  const layout = LAYOUTS[layoutIndex % LAYOUTS.length]!;
  const price = formatPrice(item.priceCents, item.priceLabel, currency);
  const badges = getDisplayMarketingBadges(item.tags, item.sortOrder);
  const imageUrl = item.publicImageUrl;

  return (
    <Link
      href={`/${slug}/item/${item.id}`}
      className={`group relative ${layout.wrapper}`}
    >
      {imageUrl ? (
        <div
          className={`relative mb-3 ${layout.image} ${layout.tilt} transition duration-500 group-hover:scale-[1.03] group-hover:-translate-y-1`}
        >
          {badges.map((badge) => (
            <MarketingBadge key={badge} type={badge} />
          ))}
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="menu-dish-cutout object-contain object-bottom"
            unoptimized
            sizes="(max-width: 768px) 50vw, 280px"
          />
        </div>
      ) : (
        <div
          className={`relative mb-3 w-full min-h-[140px] rounded-2xl border border-dashed border-[#c8bda8] bg-[#faf6ef]/70 flex items-center justify-center ${layout.tilt}`}
        >
          {badges.map((badge) => (
            <MarketingBadge key={badge} type={badge} />
          ))}
          <span className="text-[#9a8f82] text-xs uppercase tracking-widest">
            No photo
          </span>
        </div>
      )}

      <div className={`flex flex-col gap-1.5 max-w-[280px] ${layout.label}`}>
        {price && (
          <span className="inline-flex px-3 py-1 rounded-md bg-[#1a3a5c] text-white text-sm font-semibold tracking-wide shadow-sm">
            {price}
          </span>
        )}
        <h3 className="px-2.5 py-1.5 rounded-md bg-[#1a3a5c] text-white text-xs sm:text-sm font-bold uppercase tracking-wide leading-snug shadow-sm">
          {item.name}
        </h3>
        {item.description && (
          <p className="px-2.5 py-2 rounded-md bg-[#faf6ef]/90 border border-[#e0d5c3] text-[#3d4f63] text-[11px] sm:text-xs leading-relaxed line-clamp-4 shadow-sm">
            {item.description}
          </p>
        )}
        <DietaryBadgeIcons
          tags={item.tags}
          size="sm"
          accent={accent}
          className="mt-0.5"
        />
      </div>
    </Link>
  );
}