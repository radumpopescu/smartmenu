import { parseTags } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Leaf,
  Sprout,
  WheatOff,
  MilkOff,
  Flame,
  Nut,
  Fish,
  Egg,
} from "lucide-react";

export const DIETARY_BADGES = [
  { id: "vegetarian", label: "Vegetarian", Icon: Leaf },
  { id: "vegan", label: "Vegan", Icon: Sprout },
  { id: "gluten-free", label: "Gluten-free", Icon: WheatOff },
  { id: "dairy-free", label: "Dairy-free", Icon: MilkOff },
  { id: "spicy", label: "Spicy", Icon: Flame },
  { id: "contains-nuts", label: "Contains nuts", Icon: Nut },
  { id: "contains-fish", label: "Contains fish", Icon: Fish },
  { id: "contains-eggs", label: "Contains eggs", Icon: Egg },
] as const;

export type DietaryBadgeId = (typeof DIETARY_BADGES)[number]["id"];

const BADGE_IDS = new Set<string>(DIETARY_BADGES.map((b) => b.id));

const ALIASES: Record<string, DietaryBadgeId> = {
  veg: "vegetarian",
  veggie: "vegetarian",
  "gluten free": "gluten-free",
  gf: "gluten-free",
  "dairy free": "dairy-free",
  "lactose-free": "dairy-free",
  hot: "spicy",
  picant: "spicy",
  nuts: "contains-nuts",
  nut: "contains-nuts",
  "contains nuts": "contains-nuts",
  fish: "contains-fish",
  seafood: "contains-fish",
  eggs: "contains-eggs",
  egg: "contains-eggs",
};

export function getDietaryBadge(id: string) {
  return DIETARY_BADGES.find((b) => b.id === id);
}

function normalizeToken(raw: string): DietaryBadgeId | null {
  const key = raw.toLowerCase().trim();
  if (BADGE_IDS.has(key)) return key as DietaryBadgeId;
  const dashed = key.replace(/\s+/g, "-");
  if (BADGE_IDS.has(dashed)) return dashed as DietaryBadgeId;
  return ALIASES[key] ?? ALIASES[dashed] ?? null;
}

/** Map stored/imported tags to known badge ids (stable catalog order). */
export function parseDietaryBadgeIds(tags: string | null): DietaryBadgeId[] {
  const tokens = parseTags(tags);
  const found = new Set<DietaryBadgeId>();
  for (const t of tokens) {
    const id = normalizeToken(t);
    if (id) found.add(id);
  }
  return DIETARY_BADGES.filter((b) => found.has(b.id)).map((b) => b.id);
}

export function dietaryBadgeIdsToTags(ids: DietaryBadgeId[]): string[] {
  return ids.filter((id) => BADGE_IDS.has(id));
}