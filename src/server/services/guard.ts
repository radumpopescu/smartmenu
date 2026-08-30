import { AppError } from "@/server/errors";
import { canAccessStore, hasScope, type Actor, type Scope } from "@/server/actor";

export type UserActor = Extract<Actor, { kind: "user" }>;

/**
 * The enforcement primitives every service method starts with.
 *
 * These live in the service layer on purpose. Route middleware does not run
 * on the in-process (RSC / server action) path, so a check that exists only
 * there is absent for half the callers.
 *
 * Each returns the user id so the caller can use it for audit logging.
 */

export function requireUser(actor: Actor): UserActor {
  if (actor.kind !== "user") throw AppError.unauthorized();
  return actor;
}

export function requireScope(actor: Actor, scope: Scope): UserActor {
  const user = requireUser(actor);
  if (!hasScope(user, scope)) {
    throw AppError.forbidden(`Missing required scope: ${scope}`);
  }
  return user;
}

/** Scope *and* tenancy — the pair that matters for anything store-owned. */
export function requireStoreScope(
  actor: Actor,
  storeId: string,
  scope: Scope
): UserActor {
  const user = requireScope(actor, scope);
  if (!canAccessStore(user, storeId)) {
    throw AppError.forbidden("You do not have access to this store");
  }
  return user;
}
