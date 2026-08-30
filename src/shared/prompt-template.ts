/**
 * CLIENT-SAFE prompt templating.
 *
 * Pure string work, no filesystem — the admin modal renders a per-dish prompt
 * in the browser from the template the server sent, so copying a prompt costs
 * no round trip.
 */

/** Values a prompt template may interpolate. */
export type PromptVars = Record<string, string | null | undefined>;

/**
 * Fill `{{name}}`-style placeholders.
 *
 * A line whose placeholders are all blank is dropped entirely, so a dish with
 * no description does not ship a dangling label or a stray empty line to the
 * model.
 */
export function renderPrompt(text: string, vars: PromptVars): string {
  const out: string[] = [];

  for (const line of text.split("\n")) {
    const placeholders = [...line.matchAll(/\{\{(\w+)\}\}/g)];
    if (placeholders.length === 0) {
      out.push(line);
      continue;
    }

    const allBlank = placeholders.every((m) => !vars[m[1]!]?.toString().trim());
    const isOnlyPlaceholders =
      line.replace(/\{\{\w+\}\}/g, "").trim() === "";
    if (allBlank && isOnlyPlaceholders) continue;

    out.push(
      line.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
        (vars[key] ?? "").toString().trim()
      )
    );
  }

  return out.join("\n");
}

/** Variables the dish-enhancement template understands. */
export function dishPromptVars(item: {
  name: string;
  description: string | null;
}): PromptVars {
  return { name: item.name, description: item.description };
}
