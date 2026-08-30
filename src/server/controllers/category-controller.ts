import type { Ctx } from "@/server/context";
import { resolveActiveStoreId } from "@/server/active-store";
import { CategoryService } from "@/server/services/category-service";
import type { z } from "zod";
import type {
  categoryCreateSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
} from "@/shared/schemas";

export class CategoryController {
  private constructor(private ctx: Ctx, private categories: CategoryService) {}

  static make(ctx: Ctx) {
    return new CategoryController(ctx, CategoryService.make(ctx));
  }

  private get actor() {
    return this.ctx.var.actor;
  }

  async list() {
    const storeId = await resolveActiveStoreId(this.actor);
    return { categories: await this.categories.list(this.actor, storeId) };
  }

  async create(input: z.infer<typeof categoryCreateSchema>) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { category: await this.categories.create(this.actor, storeId, input) };
  }

  async rename(id: string, input: z.infer<typeof categoryUpdateSchema>) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { category: await this.categories.rename(this.actor, storeId, id, input) };
  }

  async remove(id: string) {
    const storeId = await resolveActiveStoreId(this.actor);
    await this.categories.remove(this.actor, storeId, id);
    return { ok: true as const };
  }

  async reorder(input: z.infer<typeof categoryReorderSchema>) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { categories: await this.categories.reorder(this.actor, storeId, input) };
  }
}
