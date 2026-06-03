"use client";

import type { Category, MenuItem, Restaurant } from "@/db/schema";
import { formatPrice, parseTags } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
};

export function PublicMenu({ restaurant, categories, items }: Props) {
  const accent = restaurant.accentColor ?? "#c9a962";
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const itemsByCategory = categories.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.categoryId === cat.id),
  }));

  const uncategorized = items.filter(
    (i) => !i.categoryId || !categories.find((c) => c.id === i.categoryId)
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id.replace("cat-", ""));
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories.length, items.length]);

  function scrollToCategory(id: string) {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      className="min-h-screen bg-[#120f0d] text-[#f5efe6]"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <header className="relative px-5 pt-12 pb-8 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}44, transparent)`,
          }}
        />
        <p
          className="text-xs tracking-[0.35em] uppercase mb-3 relative"
          style={{ color: accent }}
        >
          Menu
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-[1.1] relative">
          {restaurant.name}
        </h1>
        {restaurant.tagline && (
          <p className="text-[#9a8f82] mt-3 text-lg relative">
            {restaurant.tagline}
          </p>
        )}
        {restaurant.description && (
          <p className="text-[#6d6358] mt-4 text-sm leading-relaxed max-w-md relative">
            {restaurant.description}
          </p>
        )}
      </header>

      <nav className="sticky top-0 z-20 px-4 py-3 bg-[#120f0d]/90 backdrop-blur-md border-b border-[#2a2420]">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <Chip
            active={activeCategory === "all"}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            accent={accent}
          >
            All
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              active={activeCategory === cat.id}
              onClick={() => scrollToCategory(cat.id)}
              accent={accent}
            >
              {cat.name}
            </Chip>
          ))}
        </div>
      </nav>

      <main className="px-4 pb-24 max-w-lg mx-auto">
        {itemsByCategory.map(({ category, items: catItems }, sectionIndex) => {
          if (catItems.length === 0) return null;
          return (
            <section
              key={category.id}
              id={`cat-${category.id}`}
              ref={(el) => {
                sectionRefs.current[category.id] = el;
              }}
              className="pt-10"
            >
              <h2
                className="font-[family-name:var(--font-display)] text-2xl mb-6 flex items-baseline gap-3"
                style={{ color: accent }}
              >
                {category.name}
                <span className="text-[#4a423c] text-sm font-[family-name:var(--font-body)] font-normal">
                  {catItems.length}
                </span>
              </h2>
              <div className="space-y-8">
                {catItems.map((item, i) => (
                  <DishCard
                    key={item.id}
                    item={item}
                    accent={accent}
                    featured={sectionIndex === 0 && i === 0}
                    slug={restaurant.slug}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {uncategorized.length > 0 && (
          <section className="pt-10">
            <h2
              className="font-[family-name:var(--font-display)] text-2xl mb-6"
              style={{ color: accent }}
            >
              More
            </h2>
            <div className="space-y-8">
              {uncategorized.map((item) => (
                <DishCard
                  key={item.id}
                  item={item}
                  accent={accent}
                  slug={restaurant.slug}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center text-[#4a423c] text-xs py-8 border-t border-[#2a2420]">
        Powered by SmartMenu
      </footer>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 px-4 py-1.5 rounded-full text-sm transition whitespace-nowrap"
      style={
        active
          ? { backgroundColor: accent, color: "#120f0d" }
          : { backgroundColor: "#1e1916", color: "#9a8f82" }
      }
    >
      {children}
    </button>
  );
}

function DishCard({
  item,
  accent,
  featured,
  slug,
}: {
  item: MenuItem;
  accent: string;
  featured?: boolean;
  slug: string;
}) {
  const imageUrl = item.enhancedImageUrl ?? item.originalImageUrl;
  const tags = parseTags(item.tags);
  const price = formatPrice(item.priceCents, item.priceLabel);

  if (featured && imageUrl) {
    return (
      <Link
        href={`/${slug}/item/${item.id}`}
        className="block relative rounded-2xl overflow-hidden aspect-[4/5] group"
      >
        <Image
          src={imageUrl}
          alt={item.name}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.02]"
          unoptimized
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120f0d] via-[#120f0d]/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          {tags.length > 0 && (
            <div className="flex gap-2 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border"
                  style={{ borderColor: `${accent}66`, color: accent }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <h3 className="font-[family-name:var(--font-display)] text-3xl leading-tight">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-[#c4b8a8] text-sm mt-2 line-clamp-2">
              {item.description}
            </p>
          )}
          {price && (
            <p className="mt-3 text-xl font-medium" style={{ color: accent }}>
              {price}
            </p>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/${slug}/item/${item.id}`}
      className="block group"
    >
      {imageUrl ? (
        <div className="relative rounded-2xl overflow-hidden mb-4 aspect-[16/10]">
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover"
            unoptimized
          />
          <div
            className="absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md"
            style={{ backgroundColor: `${accent}dd`, color: "#120f0d" }}
          >
            {price}
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start mb-2 border-b border-[#2a2420] pb-3">
          <h3 className="font-[family-name:var(--font-display)] text-xl pr-4">
            {item.name}
          </h3>
          {price && (
            <span style={{ color: accent }} className="shrink-0 font-medium">
              {price}
            </span>
          )}
        </div>
      )}

      {imageUrl && (
        <>
          <h3 className="font-[family-name:var(--font-display)] text-xl group-hover:opacity-90 transition">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-[#9a8f82] text-sm mt-1.5 leading-relaxed">
              {item.description}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] uppercase tracking-widest text-[#6d6358]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {!imageUrl && item.description && (
        <p className="text-[#9a8f82] text-sm mt-1">{item.description}</p>
      )}
    </Link>
  );
}