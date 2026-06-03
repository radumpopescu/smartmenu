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
- Assume Romanian lei (RON) when currency is not shown on the menu.
- Preserve original language and spelling.
- Include all sections visible on the menu.
- tags: dietary hints only (vegan, gluten-free, spicy, etc.)`,
  "menu-extraction-user.txt":
    "Extract the full menu from this image. Return JSON only.",
  "dish-enhancement.txt": `Professional food photography retouch of this exact dish photo.

CRITICAL — preserve fidelity:
- The dish must remain the SAME food: same ingredients, portions, plating, garnishes, and identity.
- Do NOT replace, reimagine, or stylize into a different meal. No AI fantasy food.
- Do NOT add extra elements that were not in the original photo.

Improve only:
- Lighting (balanced, appetizing, natural)
- Color accuracy and subtle contrast
- Sharpness and noise reduction
- Background: clean neutral surface or soft blur; remove clutter
- Framing: centered hero shot, restaurant menu quality

Style: high-end restaurant menu photography — elegant, honest, mouth-watering, never over-processed or plastic-looking.`,
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