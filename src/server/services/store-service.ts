import { and, eq, inArray } from "drizzle-orm";
import { categories, menuItems, stores, userStores, type Store } from "@/db/schema";
import type { Database } from "@/server/db";
import type { Actor } from "@/server/actor";
import { AppError } from "@/server/errors";
import { requireScope, requireStoreScope, requireUser } from "@/server/services/guard";
import { toStoreDTO, toCategoryDTO, toProductDTO, type StoreDTO } from "@/server/dto";
import { DEFAULT_CURRENCY, normalizeCurrency } from "@/lib/currency";
import { slugify } from "@/lib/utils";
import type { z } from "zod";
import type { storeCreateSchema, storeUpdateSchema } from "@/shared/schemas";
import { asc } from "drizzle-orm";
import { productImages } from "@/db/schema";

export class StoreService {
  private constructor(private db: Database) {}

  static make(ctx: { var: { db: Database } }) {
    return new StoreService(ctx.var.db);
  }

  /** Stores this actor may act on — the sidebar switcher's source. */
  async listForActor(actor: Actor): Promise<StoreDTO[]> {
    const user = requireUser(actor);
    if (user.storeIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(stores)
      .where(inArray(stores.id, user.storeIds));
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows.map(toStoreDTO);
  }

  async listAll(actor: Actor): Promise<StoreDTO[]> {
    requireScope(actor, "admin.stores.write");
    const rows = await this.db.select().from(stores).orderBy(stores.name);
    return rows.map(toStoreDTO);
  }

  async get(actor: Actor, storeId: string): Promise<StoreDTO> {
    requireStoreScope(actor, storeId, "store.read");
    return toStoreDTO(await this.loadRow(storeId));
  }

  private async loadRow(storeId: string): Promise<Store> {
    const [store] = await this.db.select().from(stores).where(eq(stores.id, storeId));
    if (!store) throw AppError.notFound("Store not found");
    return store;
  }

  async update(
    actor: Actor,
    storeId: string,
    input: z.infer<typeof storeUpdateSchema>
  ): Promise<StoreDTO> {
    requireStoreScope(actor, storeId, "store.write");

    const updates: Partial<Store> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.slug !== undefined) updates.slug = slugify(input.slug);
    if (input.tagline !== undefined) updates.tagline = input.tagline;
    if (input.description !== undefined) updates.description = input.description;
    if (input.accentColor !== undefined) updates.accentColor = input.accentColor;
    if (input.currency !== undefined) {
      updates.currency = normalizeCurrency(input.currency);
    }
    if (input.published !== undefined) updates.published = input.published;

    if (updates.slug) {
      const [clash] = await this.db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.slug, updates.slug));
      if (clash && clash.id !== storeId) {
        throw AppError.conflict("That slug is already taken");
      }
    }

    const [updated] = await this.db
      .update(stores)
      .set(updates)
      .where(eq(stores.id, storeId))
      .returning();

    if (!updated) throw AppError.notFound("Store not found");
    return toStoreDTO(updated);
  }

  async create(
    actor: Actor,
    input: z.infer<typeof storeCreateSchema>
  ): Promise<StoreDTO> {
    requireScope(actor, "admin.stores.write");

    const slug = slugify(input.slug ?? input.name);
    const [clash] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.slug, slug));
    if (clash) throw AppError.conflict("That slug is already taken");

    const [store] = await this.db
      .insert(stores)
      .values({
        name: input.name,
        slug,
        tagline: input.tagline ?? null,
        description: input.description ?? null,
        currency: normalizeCurrency(input.currency ?? DEFAULT_CURRENCY),
      })
      .returning();

    return toStoreDTO(store);
  }

  /** Which stores an actor may switch to, checked before we trust a cookie. */
  assertAccess(actor: Actor, storeId: string) {
    requireStoreScope(actor, storeId, "store.read");
  }

  /**
   * Public menu — the one read path with no actor at all.
   *
   * Anonymous by design: it is the customer-facing page. Publication state is
   * the only gate, so an unpublished store reads as missing.
   */
  async publicMenu(slug: string) {
    const [store] = await this.db
      .select()
      .from(stores)
      .where(eq(stores.slug, slug))
      .limit(1);
    if (!store || !store.published) return null;

    const cats = await this.db
      .select()
      .from(categories)
      .where(eq(categories.storeId, store.id))
      .orderBy(categories.sortOrder);

    const items = await this.db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.storeId, store.id), eq(menuItems.published, true)))
      .orderBy(menuItems.sortOrder);

    const visible = items.filter((i) => !i.hidden);
    const imageRows = visible.length
      ? await this.db
          .select()
          .from(productImages)
          .where(inArray(productImages.menuItemId, visible.map((i) => i.id)))
          .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
      : [];

    const byItem = new Map<string, typeof imageRows>();
    for (const row of imageRows) {
      const list = byItem.get(row.menuItemId) ?? [];
      list.push(row);
      byItem.set(row.menuItemId, list);
    }

    return {
      store: toStoreDTO(store),
      categories: cats.map(toCategoryDTO),
      items: visible.map((i) => toProductDTO(i, byItem.get(i.id) ?? [])),
    };
  }

  async assignUser(userId: string, storeId: string) {
    await this.db
      .insert(userStores)
      .values({ userId, storeId })
      .onConflictDoNothing();
  }

  async clearAssignments(userId: string) {
    await this.db.delete(userStores).where(eq(userStores.userId, userId));
  }
}
