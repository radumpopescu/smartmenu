import { db } from "@/db";
import {
  stores,
  categories,
  menuItems,
  userStores,
  users,
  type Store,
  type UserRole,
} from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

export type AuthContext = {
  user: AuthUser;
  stores: Store[];
  storeIds: string[];
  isSuperadmin: boolean;
};

export async function getAuthContext(userId: string): Promise<AuthContext | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  if (user.role === "superadmin") {
    const allStores = await db.select().from(stores).orderBy(stores.name);
    return {
      user: authUser,
      stores: allStores,
      storeIds: allStores.map((s) => s.id),
      isSuperadmin: true,
    };
  }

  const assignments = await db
    .select({ storeId: userStores.storeId })
    .from(userStores)
    .where(eq(userStores.userId, userId));

  const storeIds = assignments.map((a) => a.storeId);
  if (storeIds.length === 0) {
    return { user: authUser, stores: [], storeIds: [], isSuperadmin: false };
  }

  const assignedStores = await db
    .select()
    .from(stores)
    .where(inArray(stores.id, storeIds));

  assignedStores.sort((a, b) => a.name.localeCompare(b.name));

  return {
    user: authUser,
    stores: assignedStores,
    storeIds,
    isSuperadmin: false,
  };
}

export function resolveActiveStoreId(
  ctx: AuthContext,
  preferredStoreId?: string | null
): string | null {
  if (ctx.storeIds.length === 0) return null;
  if (
    preferredStoreId &&
    ctx.storeIds.includes(preferredStoreId)
  ) {
    return preferredStoreId;
  }
  return ctx.stores[0]?.id ?? null;
}

export async function assertStoreAccess(
  userId: string,
  storeId: string
): Promise<AuthContext> {
  const ctx = await getAuthContext(userId);
  if (!ctx) throw new Error("Unauthorized");
  if (!ctx.storeIds.includes(storeId)) {
    throw new Error("Forbidden");
  }
  return ctx;
}

export async function getStoreBySlug(slug: string) {
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.slug, slug))
    .limit(1);
  return store ?? null;
}

export async function getPublishedMenu(slug: string) {
  const store = await getStoreBySlug(slug);
  if (!store || !store.published) return null;

  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.storeId, store.id))
    .orderBy(categories.sortOrder);

  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.storeId, store.id))
    .orderBy(menuItems.sortOrder);

  const publishedItems = items.filter((i) => i.published);

  return { store, restaurant: store, categories: cats, items: publishedItems };
}

export async function getFullMenuForAdmin(storeId: string) {
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.storeId, storeId))
    .orderBy(categories.sortOrder);

  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.storeId, storeId))
    .orderBy(menuItems.sortOrder);

  return { categories: cats, items };
}

export async function assignUserToStore(userId: string, storeId: string) {
  await db
    .insert(userStores)
    .values({ userId, storeId })
    .onConflictDoNothing();
}

export async function removeUserFromStore(userId: string, storeId: string) {
  await db
    .delete(userStores)
    .where(and(eq(userStores.userId, userId), eq(userStores.storeId, storeId)));
}

export async function getStoreAssignments(storeId: string) {
  return db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(userStores)
    .innerJoin(users, eq(userStores.userId, users.id))
    .where(eq(userStores.storeId, storeId));
}