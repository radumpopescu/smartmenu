import fs from "fs/promises";
import path from "path";

export type LoadedPrompt = {
  text: string;
  sourceFile: string;
};

const PROMPTS_DIR =
  process.env.PROMPTS_DIR ?? path.join(process.cwd(), "prompts");

const FALLBACKS: Record<string, string> = {
  "menu-extraction-system.txt": `You are a restaurant menu digitization expert. Extract every menu item from the image with high accuracy.

Return ONLY valid JSON (no markdown) matching this schema:
{
  "restaurantName": string | null,
  "categories": [
    {
      "name": string,
      "items": [
        {
          "name": string,
          "description": string | null,
          "priceCents": number | null,
          "priceLabel": string | null,
          "tags": string[]
        }
      ]
    }
  ]
}

Rules:
- priceCents: convert prices to integer minor units (bani for RON: 25,50 lei → 2550). Use null if unclear.
- priceLabel: use for ranges or "MP" / "Preț la cerere" instead of priceCents.
- Assume Romanian lei when currency is not shown on the menu.
- Preserve original language and spelling.
- Include all sections visible on the menu.
- tags: use only these ids when applicable: vegetarian, vegan, gluten-free, dairy-free, spicy, contains-nuts, contains-fish, contains-eggs`,
  "menu-extraction-user.txt":
    "Extract the full menu from this image. Return JSON only.",
  "dish-enhancement.txt": `BACKGROUND REMOVAL ONLY — edit this existing photograph, do NOT generate a new image.

You are performing a photo cutout/masking task on the attached dish photo. The food must look like the SAME photograph with the backdrop erased — not a re-render, not a re-plate, not a stylized remake.

ABSOLUTE RULES — do not break these:
- Copy the dish exactly: same shapes, sizes, colors, textures, imperfections, and arrangement.
- Same bowl/plate: identical color, glaze, rim, angle, and reflections.
- Same food geometry: if eggs are irregular, broken, or flat in the original, keep them that way. Do NOT make eggs rounder, puffier, taller, or more symmetrical.
- Same garnishes and portions: do NOT add, remove, move, or duplicate any ingredient.
- Do NOT add extra sauce, oil pools, spice dust, steam, crumbs, or props.
- Do NOT apply beauty filters, studio relighting, HDR, gloss, plastic smoothing, or "AI food photography" styling.
- Do NOT change the camera angle, crop, zoom, or perspective.

Your ONLY allowed edits:
1. Delete the background → fully transparent alpha (PNG).
2. Keep the dish, bowl/plate, utensils, and all food pixels intact.
3. Clean cutout edges: no white halos, gray fringing, or leftover backdrop.
4. Optional: a very subtle, semi-transparent contact shadow directly under the bowl/plate only.

Forbidden outputs:
- Regenerated food that looks "prettier" but different from the source
- Oversaturated colors, waxy textures, or fake shine on eggs/sauce
- Crowded or rearranged composition
- Any change to what the dish actually looks like in the original photo

Output: PNG with transparent background. The result should be indistinguishable from the original photo except the background is gone.`,
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