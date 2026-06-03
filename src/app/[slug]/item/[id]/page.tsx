import { getPublishedMenu } from "@/lib/stores";
import { DietaryBadgeIcons } from "@/components/dietary-badges";
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

  const accent = menu.store.accentColor ?? "#c9a962";
  const imageUrl = item.publicImageUrl;
  const category = menu.categories.find((c) => c.id === item.categoryId);

  return (
    <div className="min-h-screen bg-[#120f0d] text-[#f5efe6]">
      <Link
        href={`/${slug}`}
        className="fixed top-4 left-4 z-30 px-4 py-2 text-sm rounded-full bg-[#1e1916]/90 backdrop-blur border border-[#2a2420] text-[#9a8f82] hover:text-[#f5efe6]"
      >
        ← Menu
      </Link>

      {imageUrl ? (
        <div className="relative w-full aspect-square max-h-[70vh]">
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#120f0d]" />
        </div>
      ) : null}

      <article className="px-6 pb-16 -mt-8 relative max-w-lg mx-auto">
        {category && (
          <p
            className="text-xs tracking-[0.3em] uppercase mb-2"
            style={{ color: accent }}
          >
            {category.name}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight">
          {item.name}
        </h1>
        {formatPrice(item.priceCents, item.priceLabel, menu.store.currency) && (
          <p className="text-2xl mt-3 font-medium" style={{ color: accent }}>
            {formatPrice(item.priceCents, item.priceLabel, menu.store.currency)}
          </p>
        )}
        {item.description && (
          <p className="text-[#9a8f82] mt-6 text-lg leading-relaxed">
            {item.description}
          </p>
        )}
        <DietaryBadgeIcons
          tags={item.tags}
          size="md"
          accent={accent}
          className="mt-6"
        />
      </article>
    </div>
  );
}