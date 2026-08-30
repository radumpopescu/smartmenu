import type { Ctx } from "@/server/context";
import { resolveActiveStoreId } from "@/server/active-store";
import { ProductService } from "@/server/services/product-service";
import { CategoryService } from "@/server/services/category-service";
import { ImageEnhanceService } from "@/server/services/image-enhance-service";
import { AppError } from "@/server/errors";
import type { ProductImageKind } from "@/db/schema";
import type { ImageProvider } from "@/lib/image-enhance";
import type { z } from "zod";
import type {
  productCreateSchema,
  productReorderSchema,
  productUpdateSchema,
} from "@/shared/schemas";

/**
 * Orchestrates product use cases.
 *
 * Resolves the active store, then delegates. Every service call receives the
 * Actor — the controller never hands down a bare user id, and never assumes
 * the route already checked something.
 */
export class ProductController {
  private constructor(
    private ctx: Ctx,
    private products: ProductService,
    private categories: CategoryService,
    private enhancer: ImageEnhanceService
  ) {}

  static make(ctx: Ctx) {
    return new ProductController(
      ctx,
      ProductService.make(ctx),
      CategoryService.make(ctx),
      ImageEnhanceService.make(ctx)
    );
  }

  private get actor() {
    return this.ctx.var.actor;
  }

  /** The admin products screen: categories and items in one payload. */
  async board() {
    const storeId = await resolveActiveStoreId(this.actor);
    const [categories, items] = await Promise.all([
      this.categories.list(this.actor, storeId),
      this.products.list(this.actor, storeId),
    ]);
    return { categories, items };
  }

  async list() {
    const storeId = await resolveActiveStoreId(this.actor);
    return { items: await this.products.list(this.actor, storeId) };
  }

  async get(itemId: string) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { item: await this.products.get(this.actor, storeId, itemId) };
  }

  async create(input: z.infer<typeof productCreateSchema>) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { item: await this.products.create(this.actor, storeId, input) };
  }

  async update(itemId: string, input: z.infer<typeof productUpdateSchema>) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { item: await this.products.update(this.actor, storeId, itemId, input) };
  }

  async remove(itemId: string) {
    const storeId = await resolveActiveStoreId(this.actor);
    await this.products.remove(this.actor, storeId, itemId);
    return { ok: true as const };
  }

  async reorder(input: z.infer<typeof productReorderSchema>) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { items: await this.products.reorder(this.actor, storeId, input) };
  }

  /** Create with an attached photo — the multipart path from the admin form. */
  async createWithImage(
    input: z.infer<typeof productCreateSchema>,
    file: File | null
  ) {
    const storeId = await resolveActiveStoreId(this.actor);
    const item = await this.products.create(this.actor, storeId, input);
    if (!file) return { item };
    return {
      item: await this.products.addImage(
        this.actor,
        storeId,
        item.id,
        "original",
        file
      ),
    };
  }

  async addImage(itemId: string, kind: ProductImageKind, file: File | null) {
    if (!file) throw AppError.invalid("An image file is required");
    const storeId = await resolveActiveStoreId(this.actor);
    return {
      item: await this.products.addImage(this.actor, storeId, itemId, kind, file),
    };
  }

  async removeImage(itemId: string, imageId: string) {
    const storeId = await resolveActiveStoreId(this.actor);
    return {
      item: await this.products.removeImage(this.actor, storeId, itemId, imageId),
    };
  }

  async enhance(itemId: string, provider: ImageProvider, sourceImageId?: string) {
    const storeId = await resolveActiveStoreId(this.actor);
    return {
      item: await this.enhancer.enhance(
        this.actor,
        storeId,
        itemId,
        provider,
        sourceImageId
      ),
    };
  }
}
