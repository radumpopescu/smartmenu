import { eq } from "drizzle-orm";
import { categories, menuItems } from "@/db/schema";
import type { Database } from "@/server/db";
import type { Actor } from "@/server/actor";
import { AppError, ErrorCode } from "@/server/errors";
import { requireStoreScope } from "@/server/services/guard";
import { extractMenuFromImage, type ExtractedMenu } from "@/lib/grok";
import type { z } from "zod";
import type { importApplySchema } from "@/shared/schemas";

export class MenuImportService {
  private constructor(private db: Database) {}

  static make(ctx: { var: { db: Database } }) {
    return new MenuImportService(ctx.var.db);
  }

  /**
   * Run OCR over a menu photo.
   *
   * Scoped to the active store rather than "any signed-in user": extraction
   * spends real API tokens, so it needs the same gate as applying the result.
   */
  async extract(
    actor: Actor,
    storeId: string,
    buffer: Buffer,
    mime: string
  ): Promise<ExtractedMenu> {
    requireStoreScope(actor, storeId, "menu.import");
    try {
      return await extractMenuFromImage(buffer, mime);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Menu extraction failed";
      throw new AppError(ErrorCode.UPSTREAM_FAILED, message);
    }
  }

  /** Never trust raw model output — the caller validates before this runs. */
  async apply(
    actor: Actor,
    storeId: string,
    input: z.infer<typeof importApplySchema>
  ): Promise<{ categories: number; items: number }> {
    requireStoreScope(actor, storeId, "menu.import");

    if (input.replaceExisting) {
      await this.db.delete(menuItems).where(eq(menuItems.storeId, storeId));
      await this.db.delete(categories).where(eq(categories.storeId, storeId));
    }

    let categoryOrder = 0;
    let itemOrder = 0;
    const created = { categories: 0, items: 0 };

    for (const cat of input.extracted.categories) {
      const [category] = await this.db
        .insert(categories)
        .values({ storeId, name: cat.name, sortOrder: categoryOrder++ })
        .returning();
      created.categories++;

      for (const item of cat.items) {
        await this.db.insert(menuItems).values({
          storeId,
          categoryId: category.id,
          name: item.name,
          description: item.description ?? null,
          priceCents: item.priceCents ?? null,
          priceLabel: item.priceLabel ?? null,
          tags: item.tags?.length ? JSON.stringify(item.tags) : null,
          sortOrder: itemOrder++,
        });
        created.items++;
      }
    }

    return created;
  }
}
