import { parseTags } from "@/lib/utils";

export type MarketingBadge = "new" | "bestseller";

export function getMarketingBadges(tags: string | null): MarketingBadge[] {
  const tokens = parseTags(tags).map((t) => t.toLowerCase().trim());
  const badges: MarketingBadge[] = [];

  if (
    tokens.some((t) =>
      ["bestseller", "best-seller", "best seller"].includes(t)
    )
  ) {
    badges.push("bestseller");
  }
  if (tokens.includes("new")) {
    badges.push("new");
  }

  return badges;
}

export function getDisplayMarketingBadges(
  tags: string | null,
  sortOrder: number
): MarketingBadge[] {
  const fromTags = getMarketingBadges(tags);
  if (fromTags.length > 0) return fromTags;

  if (sortOrder === 0) return ["bestseller"];
  if (sortOrder === 1) return ["new"];
  return [];
}

export function splitCategoryTitle(name: string) {
  const parts = name.split(/\s*[\/|]\s*/).map((p) => p.trim()).filter(Boolean);
  return {
    primary: parts[0] ?? name,
    secondary: parts[1] ?? null,
  };
}