import { getPublishedMenu } from "@/lib/stores";
import { DietaryBadgeIcons } from "@/components/dietary-badges";
import { getDisplayMarketingBadges, splitCategoryTitle } from "@/lib/menu-badges";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function DishDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const menu = await getPublishedMenu(slug);
  if (!menu) notFound();

  const item = menu.items.find((i) => i.id === id);
  if (!item) notFound();

  const accent = menu.store.accentColor ?? "#2f6b45";
  const imageUrl = item.publicImageUrl;
  const category = menu.categories.find((c) => c.id === item.categoryId);
  const categoryTitle = category ? splitCategoryTitle(category.name) : null;
  const price = formatPrice(
    item.priceCents,
    item.priceLabel,
    menu.store.currency
  );
  const marketingBadges = getDisplayMarketingBadges(item.tags, item.sortOrder);

  return (
    <div
      className="min-h-screen menu-collage-bg text-[#1a2f4a]"
      style={{ "--menu-accent": accent } as React.CSSProperties}
    >
      <Link
        href={`/${slug}`}
        className="fixed top-4 left-4 z-30 px-4 py-2 text-sm rounded-full bg-[#faf6ef]/95 backdrop-blur border border-[#d8ccb6] text-[#1a3a5c] hover:bg-white shadow-sm"
      >
        ← Menu
      </Link>

      <article className="mx-auto max-w-lg px-5 pt-16 pb-16 sm:max-w-xl sm:px-8">
        {categoryTitle && (
          <p
            className="text-center font-[family-name:var(--font-script)] text-4xl sm:text-5xl mb-2"
            style={{ color: accent }}
          >
            {categoryTitle.primary}
            {categoryTitle.secondary ? ` · ${categoryTitle.secondary}` : ""}
          </p>
        )}

        {imageUrl ? (
          <div className="relative mx-auto mb-8 aspect-[4/5] w-full max-w-md">
            {marketingBadges.map((badge) => (
              <span
                key={badge}
                className={`absolute z-10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md ${
                  badge === "new"
                    ? "top-3 right-3 rounded-full bg-[#d63b3b]"
                    : "top-3 left-3 rounded-sm bg-[#d63b3b] -rotate-6"
                }`}
              >
                {badge === "new" ? "New" : "Best seller"}
              </span>
            ))}
            <Image
              src={imageUrl}
              alt={item.name}
              fill
              className="menu-dish-cutout object-contain object-bottom"
              priority
              unoptimized
              sizes="(max-width: 768px) 100vw, 400px"
            />
          </div>
        ) : null}

        <div className="space-y-3 text-center">
          {price && (
            <p className="inline-flex px-4 py-1.5 rounded-md bg-[#1a3a5c] text-white text-lg font-semibold shadow-sm">
              {price}
            </p>
          )}
          <h1 className="block px-4 py-2 rounded-md bg-[#1a3a5c] text-white text-xl sm:text-2xl font-bold uppercase tracking-wide leading-snug shadow-sm">
            {item.name}
          </h1>
          {item.description && (
            <p className="px-4 py-3 rounded-md bg-[#faf6ef]/95 border border-[#e0d5c3] text-[#3d4f63] text-base leading-relaxed shadow-sm">
              {item.description}
            </p>
          )}
          <DietaryBadgeIcons
            tags={item.tags}
            size="md"
            accent={accent}
            showLabels
            className="justify-center mt-4"
          />
        </div>
      </article>
    </div>
  );
}