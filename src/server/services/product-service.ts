import { and, asc, eq, inArray, max } from "drizzle-orm";
import {
  menuItems,
  productImages,
  categories,
  type MenuItem,
  type ProductImage,
  type ProductImageKind,
} from "@/db/schema";
import type { Database } from "@/server/db";
import type { Actor } from "@/server/actor";
import { AppError } from "@/server/errors";
import { requireStoreScope } from "@/server/services/guard";
import { toProductDTO, type ProductDTO } from "@/server/dto";
import { saveBuffer, saveUpload } from "@/lib/uploads";
import type { z } from "zod";
import type {
  productCreateSchema,
  productUpdateSchema,
  productReorderSchema,
} from "@/shared/schemas";

type CreateInput = z.infer<typeof productCreateSchema>;
type UpdateInput = z.infer<typeof productUpdateSchema>;
type ReorderInput = z.infer<typeof productReorderSchema>;

/**
 * Products (menu items) and their photos.
 *
 * Stateless — Worker isolates are recycled unpredictably, so an instance
 * cache produces bugs that only reproduce under load.
 */
export class ProductService {
  private constructor(private db: Database) {}

  /**
   * The only construction path. The ctx type is composed from what this
   * service actually reads, so removing a dependency narrows the type and
   * the compiler finds every now-unnecessary field.
   */
  static make(ctx: { var: { db: Database } }) {
    return new ProductService(ctx.var.db);
  }

  // ---------- reads ----------

  private async imagesFor(itemIds: string[]): Promise<Map<string, ProductImage[]>> {
    const map = new Map<string, ProductImage[]>();
    if (itemIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(productImages)
      .where(inArray(productImages.menuItemId, itemIds))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
    for (const row of rows) {
      const list = map.get(row.menuItemId) ?? [];
      list.push(row);
      map.set(row.menuItemId, list);
    }
    return map;
  }

  /** Loads a row scoped to the store, so a foreign id reads as "not found". */
  private async loadRow(itemId: string, storeId: string): Promise<MenuItem> {
    const [item] = await this.db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, itemId), eq(menuItems.storeId, storeId)));
    if (!item) throw AppError.notFound("Product not found");
    return item;
  }

  private async toDTO(item: MenuItem): Promise<ProductDTO> {
    const map = await this.imagesFor([item.id]);
    return toProductDTO(item, map.get(item.id) ?? []);
  }

  async list(actor: Actor, storeId: string): Promise<ProductDTO[]> {
    requireStoreScope(actor, storeId, "products.read");
    const items = await this.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.storeId, storeId))
      .orderBy(menuItems.sortOrder);
    const map = await this.imagesFor(items.map((i) => i.id));
    return items.map((i) => toProductDTO(i, map.get(i.id) ?? []));
  }

  async get(actor: Actor, storeId: string, itemId: string): Promise<ProductDTO> {
    requireStoreScope(actor, storeId, "products.read");
    return this.toDTO(await this.loadRow(itemId, storeId));
  }

  // ---------- writes ----------

  async create(
    actor: Actor,
    storeId: string,
    input: CreateInput
  ): Promise<ProductDTO> {
    requireStoreScope(actor, storeId, "products.write");

    if (input.categoryId) {
      await this.assertCategoryInStore(storeId, input.categoryId);
    }

    const [item] = await this.db
      .insert(menuItems)
      .values({
        storeId,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        priceCents: input.priceCents ?? null,
        priceLabel: input.priceLabel ?? null,
        tags: input.tags?.length ? JSON.stringify(input.tags) : null,
      })
      .returning();

    return this.toDTO(item);
  }

  async update(
    actor: Actor,
    storeId: string,
    itemId: string,
    input: UpdateInput
  ): Promise<ProductDTO> {
    requireStoreScope(actor, storeId, "products.write");
    await this.loadRow(itemId, storeId);

    if (input.categoryId) {
      await this.assertCategoryInStore(storeId, input.categoryId);
    }

    if (input.displayImageId) {
      const [img] = await this.db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.id, input.displayImageId),
            eq(productImages.menuItemId, itemId)
          )
        );
      if (!img) {
        throw AppError.invalid("Display image does not belong to this product", [
          { path: "displayImageId", message: "NOT_ON_PRODUCT" },
        ]);
      }
    }

    const updates: Partial<MenuItem> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
    if (input.priceCents !== undefined) updates.priceCents = input.priceCents;
    if (input.priceLabel !== undefined) updates.priceLabel = input.priceLabel;
    if (input.published !== undefined) updates.published = input.published;
    if (input.hidden !== undefined) updates.hidden = input.hidden;
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
    if (input.displayImageId !== undefined) {
      updates.displayImageId = input.displayImageId;
    }
    if (input.tags !== undefined) {
      updates.tags = input.tags.length ? JSON.stringify(input.tags) : null;
    }

    const [item] = await this.db
      .update(menuItems)
      .set(updates)
      .where(and(eq(menuItems.id, itemId), eq(menuItems.storeId, storeId)))
      .returning();

    if (!item) throw AppError.notFound("Product not found");
    return this.toDTO(item);
  }

  async remove(actor: Actor, storeId: string, itemId: string): Promise<void> {
    requireStoreScope(actor, storeId, "products.write");
    await this.loadRow(itemId, storeId);
    await this.db
      .delete(menuItems)
      .where(and(eq(menuItems.id, itemId), eq(menuItems.storeId, storeId)));
  }

  /**
   * Persist drag-and-drop order.
   *
   * Sequential awaited statements rather than `db.transaction()`: D1 has no
   * interactive transactions, and the previous implementation passed
   * un-executed query builders to a sync transaction callback, which silently
   * wrote nothing at all.
   */
  async reorder(
    actor: Actor,
    storeId: string,
    input: ReorderInput
  ): Promise<ProductDTO[]> {
    requireStoreScope(actor, storeId, "products.write");
    if (input.items.length === 0) return [];

    const ids = input.items.map((i) => i.id);
    const existing = await this.db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.storeId, storeId), inArray(menuItems.id, ids)));

    if (existing.length !== ids.length) {
      throw AppError.invalid("One or more products are not in this store");
    }

    const categoryIds = [
      ...new Set(
        input.items.map((i) => i.categoryId).filter((id): id is string => id != null)
      ),
    ];
    if (categoryIds.length > 0) {
      const cats = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(eq(categories.storeId, storeId), inArray(categories.id, categoryIds))
        );
      if (cats.length !== categoryIds.length) {
        throw AppError.invalid("One or more categories are not in this store");
      }
    }

    for (const row of input.items) {
      await this.db
        .update(menuItems)
        .set({ categoryId: row.categoryId, sortOrder: row.sortOrder })
        .where(and(eq(menuItems.id, row.id), eq(menuItems.storeId, storeId)));
    }

    return this.list(actor, storeId);
  }

  private async assertCategoryInStore(storeId: string, categoryId: string) {
    const [cat] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.storeId, storeId)));
    if (!cat) {
      throw AppError.invalid("Category does not belong to this store", [
        { path: "categoryId", message: "NOT_IN_STORE" },
      ]);
    }
  }

  // ---------- images ----------

  private async nextSortOrder(menuItemId: string, kind: ProductImageKind) {
    const [row] = await this.db
      .select({ max: max(productImages.sortOrder) })
      .from(productImages)
      .where(
        and(
          eq(productImages.menuItemId, menuItemId),
          eq(productImages.kind, kind)
        )
      );
    return (row?.max ?? -1) + 1;
  }

  /**
   * Keep the deprecated `originalImageUrl` / `enhancedImageUrl` columns in
   * step with `product_images`. They are still the fallback for rows that
   * predate the table, so they cannot drift until that data is migrated.
   */
  private async syncLegacyUrls(itemId: string) {
    const map = await this.imagesFor([itemId]);
    const images = map.get(itemId) ?? [];
    const original = images.filter((i) => i.kind === "original").at(-1)?.url ?? null;
    const enhanced = images.filter((i) => i.kind === "enhanced").at(-1)?.url ?? null;
    await this.db
      .update(menuItems)
      .set({ originalImageUrl: original, enhancedImageUrl: enhanced })
      .where(eq(menuItems.id, itemId));
  }

  async addImage(
    actor: Actor,
    storeId: string,
    itemId: string,
    kind: ProductImageKind,
    file: File
  ): Promise<ProductDTO> {
    requireStoreScope(actor, storeId, "products.write");
    await this.loadRow(itemId, storeId);

    const subdir =
      kind === "enhanced" ? `dishes/${storeId}/enhanced` : `dishes/${storeId}`;
    const url = await saveUpload(file, subdir);
    const sortOrder = await this.nextSortOrder(itemId, kind);

    await this.db
      .insert(productImages)
      .values({ menuItemId: itemId, url, kind, sortOrder })
      .returning();

    await this.syncLegacyUrls(itemId);
    return this.toDTO(await this.loadRow(itemId, storeId));
  }

  async addImageFromBuffer(
    actor: Actor,
    storeId: string,
    itemId: string,
    buffer: Buffer
  ): Promise<ProductDTO> {
    requireStoreScope(actor, storeId, "products.write");
    await this.loadRow(itemId, storeId);

    const url = await saveBuffer(buffer, `dishes/${storeId}/enhanced`, ".png");
    const sortOrder = await this.nextSortOrder(itemId, "enhanced");

    await this.db
      .insert(productImages)
      .values({ menuItemId: itemId, url, kind: "enhanced", sortOrder })
      .returning();

    await this.syncLegacyUrls(itemId);
    return this.toDTO(await this.loadRow(itemId, storeId));
  }

  async removeImage(
    actor: Actor,
    storeId: string,
    itemId: string,
    imageId: string
  ): Promise<ProductDTO> {
    requireStoreScope(actor, storeId, "products.write");
    const item = await this.loadRow(itemId, storeId);

    const map = await this.imagesFor([itemId]);
    const target = (map.get(itemId) ?? []).find((img) => img.id === imageId);
    if (!target) throw AppError.notFound("Image not found on this product");

    await this.db.delete(productImages).where(eq(productImages.id, imageId));

    if (item.displayImageId === imageId) {
      await this.db
        .update(menuItems)
        .set({ displayImageId: null })
        .where(eq(menuItems.id, itemId));
    }

    await this.syncLegacyUrls(itemId);
    return this.toDTO(await this.loadRow(itemId, storeId));
  }

  /** Resolve which stored photo an enhance request should read. */
  async resolveEnhanceSource(
    actor: Actor,
    storeId: string,
    itemId: string,
    sourceImageId?: string
  ): Promise<string> {
    requireStoreScope(actor, storeId, "products.write");
    const item = await this.loadRow(itemId, storeId);
    const images = (await this.imagesFor([itemId])).get(itemId) ?? [];

    if (sourceImageId) {
      const source = images.find((img) => img.id === sourceImageId);
      if (!source || source.kind !== "original") {
        throw AppError.invalid("Select a valid original photo to enhance", [
          { path: "sourceImageId", message: "NOT_AN_ORIGINAL" },
        ]);
      }
      return source.url;
    }

    const url =
      images.filter((i) => i.kind === "original").at(-1)?.url ??
      item.originalImageUrl ??
      null;
    if (!url) throw AppError.invalid("Upload an original photo first");
    return url;
  }
}
