import type { UserRole } from "@/db/schema";

/**
 * Scopes are coarse and verb-shaped.
 *
 * The rule that matters: the *method* enforces them, not just the route.
 * Route middleware is defense in depth, never the only line — the
 * in-process (RSC / server action) path never runs it.
 */
export const SCOPES = [
  "store.read",
  "store.write",
  "products.read",
  "products.write",
  "categories.write",
  "menu.import",
  "admin.stores.write",
  "admin.users.write",
] as const;

export type Scope = (typeof SCOPES)[number];

const OPERATOR_SCOPES: Scope[] = [
  "store.read",
  "store.write",
  "products.read",
  "products.write",
  "categories.write",
  "menu.import",
];

const SUPERADMIN_SCOPES: Scope[] = [
  ...OPERATOR_SCOPES,
  "admin.stores.write",
  "admin.users.write",
];

export function scopesForRole(role: UserRole): Scope[] {
  return role === "superadmin" ? [...SUPERADMIN_SCOPES] : [...OPERATOR_SCOPES];
}

/**
 * The caller, as a discriminated union rather than a nullable user id.
 *
 * Anonymous is a first-class case, so "logged out" can never be confused
 * with "logged in but no permissions".
 */
export type Actor =
  | { kind: "anonymous" }
  | {
      kind: "user";
      userId: string;
      email: string;
      name: string | null;
      role: UserRole;
      scopes: Scope[];
      /** Stores this actor may touch. Superadmins get every store id. */
      storeIds: string[];
      isSuperadmin: boolean;
    };

export const ANONYMOUS: Actor = { kind: "anonymous" };

export function isUser(
  actor: Actor
): actor is Extract<Actor, { kind: "user" }> {
  return actor.kind === "user";
}

export function hasScope(actor: Actor, scope: Scope): boolean {
  return actor.kind === "user" && actor.scopes.includes(scope);
}

export function canAccessStore(actor: Actor, storeId: string): boolean {
  return actor.kind === "user" && actor.storeIds.includes(storeId);
}
