import fs from "fs/promises";
import path from "path";

export type LoadedPrompt = {
  text: string;
  sourceFile: string;
};

export {
  renderPrompt,
  dishPromptVars,
  type PromptVars,
} from "@/shared/prompt-template";

const PROMPTS_DIR =
  process.env.PROMPTS_DIR ?? path.join(process.cwd(), "prompts");

/**
 * Safety net only. The files in `prompts/` are tracked in git and are the
 * source of truth; these fire only if one has been deleted. They are kept
 * deliberately short — a long duplicate would silently drift out of step with
 * the real prompt — and the loader reports "(fallback)" as the source so the
 * admin UI shows when one was used.
 */
const FALLBACKS: Record<string, string> = {
  "menu-extraction-system.txt": `You are a restaurant menu digitization expert. Extract every menu item from the image with high accuracy.

Return ONLY valid JSON (no markdown) matching this schema:
{
  "restaurantName": string | null,
  "categories": [
    { "name": string, "items": [ { "name": string, "description": string | null, "priceCents": number | null, "priceLabel": string | null, "tags": string[] } ] }
  ]
}

Rules:
- priceCents: convert prices to integer minor units (bani for RON: 25,50 lei -> 2550). Use null if unclear.
- priceLabel: use for ranges or "MP" / "Pret la cerere" instead of priceCents.
- Assume Romanian lei when currency is not shown on the menu.
- Preserve original language and spelling.
- Include all sections visible on the menu.
- tags: use only these ids when applicable: vegetarian, vegan, gluten-free, dairy-free, spicy, contains-nuts, contains-fish, contains-eggs`,

  "menu-extraction-user.txt":
    "Extract the full menu from this image. Return JSON only.",

  "dish-enhancement.txt": `Cut the dish out of the attached photo and return it on a fully transparent background.

This is a masking job on an existing photograph, not image generation. Keep the plate and everything on it exactly as photographed — same shapes, colours, textures, portions, angle and lighting. Erase everything else (table, background, props, hands, text) to a real alpha channel, not white or grey.

Do not beautify, relight, tidy, or re-plate the food. Do not add steam, sauce, or garnish. Cut edges tight with no white halo. Do not add a drop shadow — the layout adds its own.

Output: one PNG, transparent background, highest resolution available.`,
};

async function loadPromptFile(filename: string): Promise<LoadedPrompt> {
  const sourceFile = path.join("prompts", filename);
  const fullPath = path.join(PROMPTS_DIR, filename);
  try {
    const text = (await fs.readFile(fullPath, "utf8")).trim();
    return { text, sourceFile };
  } catch {
    const text = FALLBACKS[filename];
    if (!text) throw new Error(`Unknown prompt file: ${filename}`);
    return { text, sourceFile: `${sourceFile} (fallback)` };
  }
}

export async function getMenuExtractionSystemPrompt(): Promise<LoadedPrompt> {
  return loadPromptFile("menu-extraction-system.txt");
}

export async function getMenuExtractionUserPrompt(): Promise<LoadedPrompt> {
  return loadPromptFile("menu-extraction-user.txt");
}

export async function getDishEnhancementPrompt(): Promise<LoadedPrompt> {
  return loadPromptFile("dish-enhancement.txt");
}

/** All prompts for admin UI / debugging */
export async function getAllPrompts() {
  const [menuSystem, menuUser, dishEnhancement] = await Promise.all([
    getMenuExtractionSystemPrompt(),
    getMenuExtractionUserPrompt(),
    getDishEnhancementPrompt(),
  ]);
  return { menuSystem, menuUser, dishEnhancement };
}

export type PromptLogSnapshot = Record<
  string,
  { text: string; sourceFile: string }
>;

export function promptsToLogSnapshot(
  entries: Record<string, LoadedPrompt>
): PromptLogSnapshot {
  const out: PromptLogSnapshot = {};
  for (const [key, p] of Object.entries(entries)) {
    out[key] = { text: p.text, sourceFile: p.sourceFile };
  }
  return out;
}
