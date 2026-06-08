"use client";

import type { Category, Store } from "@/db/schema";
import type { PublicMenuItem } from "@/lib/stores";
import { CollageCategoryBoard } from "@/components/menu/collage-category-board";
import { useMemo, useState } from "react";

type Props = {
  store: Store;
  categories: Category[];
  items: PublicMenuItem[];
};

type CategorySection = {
  category: Category | null;
  items: PublicMenuItem[];
  label: string;
};

export function PublicMenu({ store, categories, items }: Props) {
  const accent = store.accentColor ?? "#2f6b45";
  const sections = useMemo(() => {
    const grouped: CategorySection[] = categories
      .map((category) => ({
        category,
        items: items.filter((i) => i.categoryId === category.id),
        label: category.name,
      }))
      .filter((s) => s.items.length > 0);

    const uncategorized = items.filter(
      (i) =>
        !i.categoryId || !categories.some((c) => c.id === i.categoryId)
    );
    if (uncategorized.length > 0) {
      grouped.push({
        category: null,
        items: uncategorized,
        label: "More",
      });
    }

    return grouped;
  }, [categories, items]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeSection = sections[activeIndex];

  function goTo(index: number) {
    if (index < 0 || index >= sections.length) return;
    setActiveIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (sections.length === 0) {
    return (
      <div className="min-h-screen menu-collage-bg flex items-center justify-center px-6 text-[#1a3a5c]">
        <p className="text-center text-lg">This menu has no published dishes yet.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen menu-collage-bg text-[#1a2f4a]"
      style={{ "--menu-accent": accent } as React.CSSProperties}
    >
      <header className="px-5 pt-10 pb-6 sm:px-8 sm:pt-12 text-center">
        <p
          className="text-[11px] uppercase tracking-[0.35em] mb-3"
          style={{ color: accent }}
        >
          Menu
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl text-[#1a3a5c] leading-tight">
          {store.name}
        </h1>
        {store.tagline && (
          <p className="mt-3 text-[#5c6b7a] text-base sm:text-lg max-w-xl mx-auto">
            {store.tagline}
          </p>
        )}
        {store.description && (
          <p className="mt-2 text-[#7a8796] text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            {store.description}
          </p>
        )}
      </header>

      <nav className="sticky top-0 z-20 px-4 py-3 bg-[#f3ead8]/92 backdrop-blur-md border-b border-[#ddd0ba]">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 max-w-5xl mx-auto justify-start sm:justify-center">
          {sections.map((section, index) => (
            <CategoryChip
              key={section.category?.id ?? "more"}
              active={index === activeIndex}
              onClick={() => goTo(index)}
              accent={accent}
            >
              {section.label}
            </CategoryChip>
          ))}
        </div>
      </nav>

      <main className="px-4 py-8 sm:px-6 sm:py-10 pb-20">
        {activeSection && (
          <CollageCategoryBoard
            key={activeSection.category?.id ?? "more"}
            section={activeSection}
            storeName={store.name}
            accent={accent}
            currency={store.currency}
            slug={store.slug}
            hasPrev={activeIndex > 0}
            hasNext={activeIndex < sections.length - 1}
            onPrev={() => goTo(activeIndex - 1)}
            onNext={() => goTo(activeIndex + 1)}
          />
        )}
      </main>

      <footer className="text-center text-[#8a96a3] text-xs py-8 border-t border-[#ddd0ba]">
        Powered by SmartMenu
      </footer>
    </div>
  );
}

function CategoryChip({
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
      className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap border"
      style={
        active
          ? {
              backgroundColor: accent,
              borderColor: accent,
              color: "#faf6ef",
            }
          : {
              backgroundColor: "#faf6ef",
              borderColor: "#d8ccb6",
              color: "#5c6b7a",
            }
      }
    >
      {children}
    </button>
  );
}