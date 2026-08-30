import { redirect } from "next/navigation";
import { withServices, type Ctx } from "@/server/context";
import { pickActiveStoreId } from "@/server/active-store";
import { getActiveStoreIdFromCookie } from "@/lib/store-cookie";
import { StoreService } from "@/server/services/store-service";
import type { StoreDTO } from "@/server/dto";
import type { Actor } from "@/server/actor";

export type AdminPageContext = {
  ctx: Ctx;
  actor: Extract<Actor, { kind: "user" }>;
  stores: StoreDTO[];
  activeStoreId: string | null;
  activeStore: StoreDTO | null;
  isSuperadmin: boolean;
};

/**
 * Page-level entry to the in-process path.
 *
 * Server components get the same actor and services the HTTP API does. The
 * redirect here is a convenience, not the security boundary — every service
 * method re-checks the actor regardless of how it was reached.
 */
export async function requireAdminPage(): Promise<AdminPageContext> {
  const result = await withServices(async (ctx) => {
    const actor = ctx.var.actor;
    if (actor.kind !== "user") return null;

    const stores = await StoreService.make(ctx).listForActor(actor);
    const preferred = await getActiveStoreIdFromCookie();
    const activeStoreId = pickActiveStoreId(actor, preferred);

    return {
      ctx,
      actor,
      stores,
      activeStoreId,
      activeStore: stores.find((s) => s.id === activeStoreId) ?? null,
      isSuperadmin: actor.isSuperadmin,
    } satisfies AdminPageContext;
  });

  if (!result) redirect("/admin/login");
  return result;
}

/** Public menu — no actor required, publication state is the only gate. */
export async function loadPublicMenu(slug: string) {
  return withServices((ctx) => StoreService.make(ctx).publicMenu(slug));
}
