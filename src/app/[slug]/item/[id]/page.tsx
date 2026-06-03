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
  const price = formatPrice(
    item.priceCents,
    item.priceLabel,
    menu.store.currency
  );

  return (
    <div className="min-h-screen bg-[#120f0d] text-[#f5efe6]">
      <Link
        href={`/${slug}`}
        className="fixed top-4 left-4 z-30 px-4 py-2 text-sm rounded-full bg-[#1e1916]/90 backdrop-blur border border-[#2a2420] text-[#9a8f82] hover:text-[#f5efe6] lg:top-6 lg:left-8"
      >
        ← Menu
      </Link>

      <div className="lg:min-h-screen lg:flex lg:max-w-7xl lg:mx-auto">
        {imageUrl ? (
          <div className="relative w-full aspect-square max-h-[70vh] lg:max-h-none lg:flex-1 lg:min-h-screen lg:sticky lg:top-0">
            <Image
              src={imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#120f0d] lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#120f0d]/80" />
          </div>
        ) : null}

        <article
          className={`px-6 pb-16 relative flex flex-col justify-center ${
            imageUrl ? "-mt-8 lg:mt-0 lg:flex-1 lg:px-12 lg:py-16 xl:px-16" : "pt-20 lg:flex-1 lg:px-12 lg:py-16 max-w-2xl mx-auto"
          }`}
        >
          {category && (
            <p
              className="text-xs tracking-[0.3em] uppercase mb-2"
              style={{ color: accent }}
            >
              {category.name}
            </p>
          )}
          <h1 className="font-[family-name:var(--font-display)] text-4xl lg:text-5xl xl:text-[3.25rem] leading-tight">
            {item.name}
          </h1>
          {price && (
            <p
              className="text-2xl lg:text-3xl mt-4 font-medium"
              style={{ color: accent }}
            >
              {price}
            </p>
          )}
          {item.description && (
            <p className="text-[#9a8f82] mt-6 lg:mt-8 text-lg lg:text-xl leading-relaxed max-w-xl">
              {item.description}
            </p>
          )}
          <DietaryBadgeIcons
            tags={item.tags}
            size="md"
            accent={accent}
            className="mt-6 lg:mt-8"
          />
        </article>
      </div>
    </div>
  );
}