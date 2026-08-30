import type { Ctx } from "@/server/context";
import { resolveActiveStoreId } from "@/server/active-store";
import { StoreService } from "@/server/services/store-service";
import type { z } from "zod";
import type { storeCreateSchema, storeUpdateSchema } from "@/shared/schemas";

export class StoreController {
  private constructor(private ctx: Ctx, private stores: StoreService) {}

  static make(ctx: Ctx) {
    return new StoreController(ctx, StoreService.make(ctx));
  }

  private get actor() {
    return this.ctx.var.actor;
  }

  async active() {
    const storeId = await resolveActiveStoreId(this.actor);
    return { store: await this.stores.get(this.actor, storeId) };
  }

  async updateActive(input: z.infer<typeof storeUpdateSchema>) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { store: await this.stores.update(this.actor, storeId, input) };
  }

  async mine() {
    return { stores: await this.stores.listForActor(this.actor) };
  }

  async listAll() {
    return { stores: await this.stores.listAll(this.actor) };
  }

  async create(input: z.infer<typeof storeCreateSchema>) {
    return { store: await this.stores.create(this.actor, input) };
  }

  /** Validate a store switch before the route is allowed to set the cookie. */
  async assertSwitchable(storeId: string) {
    this.stores.assertAccess(this.actor, storeId);
    return { ok: true as const, storeId };
  }

  async publicMenu(slug: string) {
    return this.stores.publicMenu(slug);
  }
}
