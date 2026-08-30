import { getActiveStoreIdFromCookie } from "@/lib/store-cookie";
import { AppError, ErrorCode } from "@/server/errors";
import type { Actor } from "@/server/actor";

/**
 * Which store this request acts on.
 *
 * The cookie is a *preference*, never an authorization: a value the actor
 * cannot access falls back to their first store rather than being honored.
 */
export function pickActiveStoreId(
  actor: Actor,
  preferred?: string | null
): string | null {
  if (actor.kind !== "user" || actor.storeIds.length === 0) return null;
  if (preferred && actor.storeIds.includes(preferred)) return preferred;
  return actor.storeIds[0] ?? null;
}

export async function resolveActiveStoreId(actor: Actor): Promise<string> {
  if (actor.kind !== "user") throw AppError.unauthorized();
  const preferred = await getActiveStoreIdFromCookie();
  const storeId = pickActiveStoreId(actor, preferred);
  if (!storeId) {
    throw new AppError(
      ErrorCode.NO_STORE_SELECTED,
      "No store is selected or assigned to you"
    );
  }
  return storeId;
}
