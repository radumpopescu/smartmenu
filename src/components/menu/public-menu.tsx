"use client";

import type { Category, Store } from "@/db/schema";
import type { PublicMenuItem } from "@/lib/stores";
import { DietaryBadgeIcons } from "@/components/dietary-badges";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  store: Store;
  categories: Category[];
  items: PublicMenuItem[];
};

export function PublicMenu({ store, categories, items }: Props) {
  const accent = store.accentColor ?? "#c9a962";
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
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories.length, items.length]);

  function scrollToCategory(id: string) {
    if (id === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setActiveCategory("all");
      return;
    }
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const navCategories = itemsByCategory.filter((s) => s.items.length > 0);

  return (
    <div
      className="min-h-screen bg-[#120f0d] text-[#f5efe6] lg:flex"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[280px] xl:w-[300px] shrink-0 border-r border-[#2a2420] bg-[#0f0d0b] sticky top-0 h-screen">
        <div className="p-8 pb-6 border-b border-[#2a2420]">
          <p
            className="text-[10px] tracking-[0.35em] uppercase mb-2"
            style={{ color: accent }}
          >
            Menu
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl leading-tight">
            {store.name}
          </h1>
          {store.tagline && (
            <p className="text-[#9a8f82] mt-2 text-sm leading-snug">
              {store.tagline}
            </p>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <SidebarLink
            active={activeCategory === "all"}
            onClick={() => scrollToCategory("all")}
            accent={accent}
          >
            All dishes
          </SidebarLink>
          {navCategories.map(({ category, items: catItems }) => (
            <SidebarLink
              key={category.id}
              active={activeCategory === category.id}
              onClick={() => scrollToCategory(category.id)}
              accent={accent}
            >
              <span className="flex-1 truncate">{category.name}</span>
              <span className="text-[#4a423c] text-xs tabular-nums">
                {catItems.length}
              </span>
            </SidebarLink>
          ))}
          {uncategorized.length > 0 && (
            <SidebarLink
              active={activeCategory === "more"}
              onClick={() => scrollToCategory("more")}
              accent={accent}
            >
              <span className="flex-1">More</span>
              <span className="text-[#4a423c] text-xs">{uncategorized.length}</span>
            </SidebarLink>
          )}
        </nav>
        <p className="p-6 text-[#4a423c] text-[10px] tracking-wide border-t border-[#2a2420]">
          SmartMenu
        </p>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile / tablet header */}
        <header className="relative px-5 pt-12 pb-8 overflow-hidden lg:px-10 lg:pt-14 lg:pb-10 xl:px-14">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}44, transparent)`,
            }}
          />
          <p
            className="text-xs tracking-[0.35em] uppercase mb-3 relative lg:hidden"
            style={{ color: accent }}
          >
            Menu
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl lg:text-5xl xl:text-[3.25rem] leading-[1.1] relative">
            {store.name}
          </h1>
          {store.tagline && (
            <p className="text-[#9a8f82] mt-3 text-lg lg:text-xl relative max-w-2xl">
              {store.tagline}
            </p>
          )}
          {store.description && (
            <p className="text-[#6d6358] mt-4 text-sm lg:text-base leading-relaxed max-w-xl relative">
              {store.description}
            </p>
          )}
        </header>

        {/* Mobile category chips */}
        <nav className="sticky top-0 z-20 px-4 py-3 bg-[#120f0d]/90 backdrop-blur-md border-b border-[#2a2420] lg:hidden">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 max-w-lg mx-auto md:max-w-3xl">
            <Chip
              active={activeCategory === "all"}
              onClick={() => scrollToCategory("all")}
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

        <main className="px-4 pb-24 max-w-lg mx-auto md:max-w-3xl lg:max-w-none lg:mx-0 lg:px-10 lg:pb-16 xl:px-14 flex-1">
          {itemsByCategory.map(({ category, items: catItems }, sectionIndex) => {
            if (catItems.length === 0) return null;
            return (
              <section
                key={category.id}
                id={`cat-${category.id}`}
                ref={(el) => {
                  sectionRefs.current[category.id] = el;
                }}
                className="pt-10 lg:pt-14 scroll-mt-4 lg:scroll-mt-8"
              >
                <h2
                  className="font-[family-name:var(--font-display)] text-2xl lg:text-3xl mb-6 lg:mb-8 flex items-baseline gap-3"
                  style={{ color: accent }}
                >
                  {category.name}
                  <span className="text-[#4a423c] text-sm font-[family-name:var(--font-body)] font-normal">
                    {catItems.length}
                  </span>
                </h2>

                {/* Mobile list */}
                <div className="space-y-8 lg:hidden">
                  {catItems.map((item, i) => (
                    <DishCardMobile
                      key={item.id}
                      item={item}
                      accent={accent}
                      currency={store.currency}
                      featured={sectionIndex === 0 && i === 0}
                      slug={store.slug}
                    />
                  ))}
                </div>

                {/* Tablet / desktop grid */}
                <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8">
                  {catItems.map((item, i) => (
                    <DishCardDesktop
                      key={item.id}
                      item={item}
                      accent={accent}
                      currency={store.currency}
                      slug={store.slug}
                      wide={sectionIndex === 0 && i === 0}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {uncategorized.length > 0 && (
            <section
              id="cat-more"
              ref={(el) => {
                sectionRefs.current.more = el;
              }}
              className="pt-10 lg:pt-14 scroll-mt-4 lg:scroll-mt-8"
            >
              <h2
                className="font-[family-name:var(--font-display)] text-2xl lg:text-3xl mb-6 lg:mb-8"
                style={{ color: accent }}
              >
                More
              </h2>
              <div className="space-y-8 lg:hidden">
                {uncategorized.map((item) => (
                  <DishCardMobile
                    key={item.id}
                    item={item}
                    accent={accent}
                    currency={store.currency}
                    slug={store.slug}
                  />
                ))}
              </div>
              <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8">
                {uncategorized.map((item) => (
                  <DishCardDesktop
                    key={item.id}
                    item={item}
                    accent={accent}
                    currency={store.currency}
                    slug={store.slug}
                  />
                ))}
              </div>
            </section>
          )}
        </main>

        <footer className="text-center text-[#4a423c] text-xs py-8 border-t border-[#2a2420] lg:hidden">
          Powered by SmartMenu
        </footer>
      </div>
    </div>
  );
}

function SidebarLink({
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
      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition ${
        active ? "font-medium" : "text-[#9a8f82] hover:text-[#f5efe6] hover:bg-[#1e1916]"
      }`}
      style={
        active
          ? { backgroundColor: `${accent}22`, color: accent }
          : undefined
      }
    >
      {children}
    </button>
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

function DishCardMobile({
  item,
  accent,
  currency,
  featured,
  slug,
}: {
  item: PublicMenuItem;
  accent: string;
  currency: string;
  featured?: boolean;
  slug: string;
}) {
  const imageUrl = item.publicImageUrl;
  const price = formatPrice(item.priceCents, item.priceLabel, currency);

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
          <DietaryBadgeIcons
            tags={item.tags}
            size="md"
            accent={accent}
            className="mb-2"
          />
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
    <Link href={`/${slug}/item/${item.id}`} className="block group">
      {imageUrl ? (
        <div className="relative rounded-2xl overflow-hidden mb-4 aspect-[16/10]">
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
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
            <p className="text-[#9a8f82] text-sm mt-1.5 leading-relaxed line-clamp-3">
              {item.description}
            </p>
          )}
          <DietaryBadgeIcons
            tags={item.tags}
            size="md"
            accent={accent}
            className="mt-3"
          />
        </>
      )}

      {!imageUrl && item.description && (
        <p className="text-[#9a8f82] text-sm mt-1 line-clamp-4">
          {item.description}
        </p>
      )}
    </Link>
  );
}

function DishCardDesktop({
  item,
  accent,
  currency,
  slug,
  wide,
}: {
  item: PublicMenuItem;
  accent: string;
  currency: string;
  slug: string;
  wide?: boolean;
}) {
  const imageUrl = item.publicImageUrl;
  const price = formatPrice(item.priceCents, item.priceLabel, currency);

  return (
    <Link
      href={`/${slug}/item/${item.id}`}
      className={`group flex flex-col rounded-2xl overflow-hidden border border-[#2a2420] bg-[#1e1916] hover:border-[#3d3530] transition-all duration-300 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] ${
        wide ? "xl:col-span-2 xl:flex-row" : ""
      }`}
    >
      {imageUrl ? (
        <div
          className={`relative bg-[#0f0d0b] shrink-0 ${
            wide
              ? "aspect-[16/10] xl:aspect-auto xl:w-[48%] xl:min-h-[280px]"
              : "aspect-[4/3]"
          }`}
        >
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            unoptimized
            sizes={wide ? "(max-width: 1280px) 50vw, 33vw" : "33vw"}
          />
        </div>
      ) : null}

      <div className={`flex flex-col flex-1 p-5 ${wide ? "xl:p-7 xl:justify-center" : ""}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3
            className={`font-[family-name:var(--font-display)] leading-tight group-hover:opacity-90 transition ${
              wide ? "text-2xl xl:text-3xl" : "text-xl"
            }`}
          >
            {item.name}
          </h3>
          {price && (
            <span
              className="shrink-0 text-sm font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              {price}
            </span>
          )}
        </div>
        {item.description && (
          <p
            className={`text-[#9a8f82] leading-relaxed ${
              wide ? "text-base line-clamp-4" : "text-sm line-clamp-3"
            }`}
          >
            {item.description}
          </p>
        )}
        <DietaryBadgeIcons
          tags={item.tags}
          size="md"
          accent={accent}
          className="mt-4"
        />
      </div>
    </Link>
  );
}