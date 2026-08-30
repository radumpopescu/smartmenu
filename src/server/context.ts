import { db as localDb } from "@/db";
import type { Database } from "@/server/db";
import { ANONYMOUS, scopesForRole, type Actor } from "@/server/actor";
import { users, userStores, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

/**
 * The request context services are built from.
 *
 * `var` holds request-scoped values; on Cloudflare `env` would carry the
 * bindings. Services declare the slice of this they need in their own
 * `make(ctx)` signature, so nothing receives a god-object.
 */
export type Ctx = {
  var: { db: Database; actor: Actor };
};

/** Fail closed: an absent ENVIRONMENT resolves to production, never dev. */
export function environment(): "development" | "production" {
  return process.env.NODE_ENV === "development" ? "development" : "production";
}

/**
 * Build the Actor from a user id.
 *
 * Superadmins hold every store id; operators hold only their assignments.
 * Putting store ids on the actor is what lets policies stay pure — no
 * policy has to reach for the database to answer "may they touch this store".
 */
export async function actorFromUserId(
  db: Database,
  userId: string
): Promise<Actor> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return ANONYMOUS;

  /**
   * Ordered by name in both branches: `storeIds[0]` is the default active
   * store when no cookie applies, so an unordered read would make the
   * landing store depend on insertion order.
   */
  let storeIds: string[];
  if (user.role === "superadmin") {
    const all = await db
      .select({ id: stores.id })
      .from(stores)
      .orderBy(stores.name);
    storeIds = all.map((s) => s.id);
  } else {
    const assigned = await db
      .select({ storeId: userStores.storeId, name: stores.name })
      .from(userStores)
      .innerJoin(stores, eq(userStores.storeId, stores.id))
      .where(eq(userStores.userId, userId))
      .orderBy(stores.name);
    storeIds = assigned.map((a) => a.storeId);
  }

  return {
    kind: "user",
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    scopes: scopesForRole(user.role),
    storeIds,
    isSuperadmin: user.role === "superadmin",
  };
}

/**
 * Resolve the caller from the session, racing a timeout.
 *
 * Public pages resolve an actor for context but do not need one to render, so
 * a hung session lookup must not hold the page hostage. Falling back to
 * anonymous is fail-safe: scope checks then see no scopes and deny.
 */
export async function resolveActor(db: Database): Promise<Actor> {
  const lookup = (async (): Promise<Actor> => {
    const session = await auth();
    if (!session?.user?.id) return ANONYMOUS;
    return actorFromUserId(db, session.user.id);
  })();

  const timeout = new Promise<Actor>((resolve) =>
    setTimeout(() => resolve(ANONYMOUS), 3000)
  );

  try {
    return await Promise.race([lookup, timeout]);
  } catch {
    return ANONYMOUS;
  }
}

export function createContext(actor: Actor, db: Database = localDb): Ctx {
  return { var: { db, actor } };
}

/**
 * The in-process bridge — path B.
 *
 * Server components and server actions never touch the HTTP router, so no
 * route middleware runs for them. This mirrors what the middleware chain
 * builds (db client + resolved actor) so both paths converge on the same
 * service layer with the same enforcement.
 */
export async function withServices<T>(
  fn: (ctx: Ctx) => Promise<T>
): Promise<T> {
  const actor = await resolveActor(localDb);
  return fn(createContext(actor, localDb));
}
