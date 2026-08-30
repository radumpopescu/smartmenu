"use client";

import type { CategoryDTO, ProductDTO, StoreDTO } from "@/shared/types";
import {
  CollageCategoryBoard,
  type CategorySection,
} from "@/components/menu/collage-category-board";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  store: StoreDTO;
  categories: CategoryDTO[];
  items: ProductDTO[];
};

function sectionDomId(section: CategorySection) {
  return `cat-${section.category?.id ?? "more"}`;
}

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
      (i) => !i.categoryId || !categories.some((c) => c.id === i.categoryId)
    );
    if (uncategorized.length > 0) {
      grouped.push({ category: null, items: uncategorized, label: "More" });
    }
    return grouped;
  }, [categories, items]);

  /**
   * Running offset so the left/right alternation continues across category
   * boundaries — otherwise every section would restart on the left and the
   * zigzag would break at each heading.
   */
  const offsets = useMemo(() => {
    const out: number[] = [];
    let running = 0;
    for (const s of sections) {
      out.push(running);
      running += s.items.length;
    }
    return out;
  }, [sections]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  /**
   * Scroll-spy. setState lives in the observer callback — that is the
   * "subscribe to an external system" shape, not a render-time cascade.
   */
  useEffect(() => {
    const ids = sections.map(sectionDomId);
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // A band near the top: the section under the nav is the active one.
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  /** Keep the active chip in view on narrow screens. */
  useEffect(() => {
    if (!activeId || !navRef.current) return;
    const chip = navRef.current.querySelector<HTMLElement>(
      `[data-chip="${activeId}"]`
    );
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeId]);

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (sections.length === 0) {
    return (
      <div className="menu-collage-bg flex min-h-screen items-center justify-center px-6 text-[#1a3a5c]">
        <p className="text-center text-lg">This menu has no published dishes yet.</p>
      </div>
    );
  }

  return (
    <div
      className="menu-collage-bg min-h-screen text-[#1a2f4a]"
      style={{ "--menu-accent": accent } as React.CSSProperties}
    >
      <header className="px-5 pt-12 pb-8 text-center sm:px-8 sm:pt-16">
        <p
          className="mb-3 text-[11px] uppercase tracking-[0.35em]"
          style={{ color: accent }}
        >
          Menu
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight text-[#1a3a5c] sm:text-5xl md:text-6xl">
          {store.name}
        </h1>
        {store.tagline && (
          <p className="mx-auto mt-3 max-w-xl text-base text-[#5c6b7a] sm:text-lg">
            {store.tagline}
          </p>
        )}
        {store.description && (
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#7a8796] sm:text-base">
            {store.description}
          </p>
        )}
      </header>

      <nav
        ref={navRef}
        className="sticky top-0 z-30 border-b border-[#ddd0ba] bg-[#f3ead8]/92 px-4 py-3 backdrop-blur-md"
      >
        <div className="scrollbar-none mx-auto flex max-w-5xl justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
          {sections.map((section) => {
            const id = sectionDomId(section);
            return (
              <CategoryChip
                key={id}
                chipId={id}
                active={activeId === id}
                onClick={() => goTo(id)}
                accent={accent}
              >
                {section.label}
              </CategoryChip>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-8">
        {sections.map((section, i) => (
          <CollageCategoryBoard
            key={sectionDomId(section)}
            sectionId={sectionDomId(section)}
            section={section}
            accent={accent}
            currency={store.currency}
            slug={store.slug}
            indexOffset={offsets[i]}
          />
        ))}
      </main>

      <footer className="border-t border-[#ddd0ba] py-8 text-center text-xs text-[#8a96a3]">
        Powered by SmartMenu
      </footer>
    </div>
  );
}

function CategoryChip({
  children,
  chipId,
  active,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  chipId: string;
  active: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      data-chip={chipId}
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition"
      style={
        active
          ? { backgroundColor: accent, borderColor: accent, color: "#faf6ef" }
          : { backgroundColor: "#faf6ef", borderColor: "#d8ccb6", color: "#5c6b7a" }
      }
    >
      {children}
    </button>
  );
}
