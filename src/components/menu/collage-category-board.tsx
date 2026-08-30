import type { CategoryDTO, ProductDTO } from "@/shared/types";
import { CollageDish } from "@/components/menu/collage-dish";
import { splitCategoryTitle } from "@/lib/menu-badges";

type CategorySection = {
  category: CategoryDTO | null;
  items: ProductDTO[];
  label: string;
};

/**
 * One category as a continuous run of alternating dish rows.
 *
 * No pagination: the whole menu is a single scroll, so this renders inline
 * with every other section and carries an id for the sticky nav to jump to.
 */
export function CollageCategoryBoard({
  section,
  sectionId,
  accent,
  currency,
  slug,
  /** Continues the left/right alternation across category boundaries. */
  indexOffset = 0,
}: {
  section: CategorySection;
  sectionId: string;
  accent: string;
  currency: string;
  slug: string;
  indexOffset?: number;
}) {
  const title = splitCategoryTitle(section.label);

  return (
    <section
      id={sectionId}
      /* scroll-mt clears the sticky nav when jumped to from a chip */
      className="menu-category-section scroll-mt-24 py-10 sm:py-14"
    >
      <header className="mb-8 text-center sm:mb-12">
        <h2
          className="font-[family-name:var(--font-script)] text-4xl leading-none sm:text-5xl md:text-6xl"
          style={{ color: accent }}
        >
          {title.primary}
        </h2>
        {title.secondary && (
          <p className="mt-1 font-[family-name:var(--font-script)] text-2xl text-[#8a96a3] sm:text-3xl">
            {title.secondary}
          </p>
        )}
        <div
          className="mx-auto mt-4 h-px w-24 opacity-40"
          style={{ backgroundColor: accent }}
        />
      </header>

      <div className="space-y-10 sm:space-y-14">
        {section.items.map((item, i) => (
          <CollageDish
            key={item.id}
            item={item}
            slug={slug}
            currency={currency}
            accent={accent}
            index={indexOffset + i}
          />
        ))}
      </div>
    </section>
  );
}

export type { CategorySection };
