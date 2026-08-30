import { and, eq, max, sql } from "drizzle-orm";
import { categories, menuItems } from "@/db/schema";
import type { Database } from "@/server/db";
import type { Actor } from "@/server/actor";
import { AppError } from "@/server/errors";
import { requireStoreScope } from "@/server/services/guard";
import { toCategoryDTO, type CategoryDTO } from "@/server/dto";
import type { z } from "zod";
import type {
  categoryCreateSchema,
  categoryUpdateSchema,
  categoryReorderSchema,
} from "@/shared/schemas";

export class CategoryService {
  private constructor(private db: Database) {}

  static make(ctx: { var: { db: Database } }) {
    return new CategoryService(ctx.var.db);
  }

  async list(actor: Actor, storeId: string): Promise<CategoryDTO[]> {
    requireStoreScope(actor, storeId, "products.read");
    const rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.storeId, storeId))
      .orderBy(categories.sortOrder);
    return rows.map(toCategoryDTO);
  }

  async create(
    actor: Actor,
    storeId: string,
    input: z.infer<typeof categoryCreateSchema>
  ): Promise<CategoryDTO> {
    requireStoreScope(actor, storeId, "categories.write");

    const [row] = await this.db
      .select({ max: max(categories.sortOrder) })
      .from(categories)
      .where(eq(categories.storeId, storeId));

    const [created] = await this.db
      .insert(categories)
      .values({
        storeId,
        name: input.name.trim(),
        sortOrder: (row?.max ?? -1) + 1,
      })
      .returning();

    return toCategoryDTO(created);
  }

  async rename(
    actor: Actor,
    storeId: string,
    categoryId: string,
    input: z.infer<typeof categoryUpdateSchema>
  ): Promise<CategoryDTO> {
    requireStoreScope(actor, storeId, "categories.write");
    if (input.name === undefined) {
      throw AppError.invalid("Nothing to update");
    }

    const [updated] = await this.db
      .update(categories)
      .set({ name: input.name.trim() })
      .where(and(eq(categories.id, categoryId), eq(categories.storeId, storeId)))
      .returning();

    if (!updated) throw AppError.notFound("Category not found");
    return toCategoryDTO(updated);
  }

  async remove(actor: Actor, storeId: string, categoryId: string): Promise<void> {
    requireStoreScope(actor, storeId, "categories.write");

    const [cat] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.storeId, storeId)));
    if (!cat) throw AppError.notFound("Category not found");

    const [count] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(menuItems)
      .where(eq(menuItems.categoryId, categoryId));

    if ((count?.n ?? 0) > 0) {
      throw AppError.conflict(
        "Category is not empty. Move or delete its products first."
      );
    }

    await this.db.delete(categories).where(eq(categories.id, categoryId));
  }

  /** See ProductService.reorder for why this is not a transaction. */
  async reorder(
    actor: Actor,
    storeId: string,
    input: z.infer<typeof categoryReorderSchema>
  ): Promise<CategoryDTO[]> {
    requireStoreScope(actor, storeId, "categories.write");

    const storeCats = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.storeId, storeId));

    const ids = new Set(storeCats.map((c) => c.id));
    if (
      input.orderedIds.length !== ids.size ||
      !input.orderedIds.every((id) => ids.has(id))
    ) {
      throw AppError.invalid("orderedIds must match this store's categories exactly");
    }

    for (const [index, id] of input.orderedIds.entries()) {
      await this.db
        .update(categories)
        .set({ sortOrder: index })
        .where(and(eq(categories.id, id), eq(categories.storeId, storeId)));
    }

    return this.list(actor, storeId);
  }
}
