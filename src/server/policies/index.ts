/**
 * Pure authorization predicates — (actor, resource) -> allowed | denied.
 *
 * No I/O, so these are trivially unit-testable and safe to call from
 * anywhere. Services turn a `false` here into an AppError.
 */
import { canAccessStore, hasScope, type Actor, type Scope } from "@/server/actor";
import type { MenuItem, Store } from "@/db/schema";

export function canReadStore(actor: Actor, store: Pick<Store, "id">): boolean {
  return canAccessStore(actor, store.id);
}

export function canWriteStore(actor: Actor, store: Pick<Store, "id">): boolean {
  return canAccessStore(actor, store.id) && hasScope(actor, "store.write");
}

export function canWriteProducts(actor: Actor, storeId: string): boolean {
  return canAccessStore(actor, storeId) && hasScope(actor, "products.write");
}

export function canWriteCategories(actor: Actor, storeId: string): boolean {
  return canAccessStore(actor, storeId) && hasScope(actor, "categories.write");
}

export function canImportMenu(actor: Actor, storeId: string): boolean {
  return canAccessStore(actor, storeId) && hasScope(actor, "menu.import");
}

export function canManageStores(actor: Actor): boolean {
  return hasScope(actor, "admin.stores.write");
}

export function canManageUsers(actor: Actor): boolean {
  return hasScope(actor, "admin.users.write");
}

/** A product is only reachable through a store the actor already holds. */
export function ownsProduct(
  actor: Actor,
  item: Pick<MenuItem, "storeId">
): boolean {
  return canAccessStore(actor, item.storeId);
}

export function requiredScopeMissing(actor: Actor, scope: Scope): boolean {
  return !hasScope(actor, scope);
}
