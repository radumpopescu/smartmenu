import { auth } from "@/auth";
import { getActiveStoreIdFromCookie } from "@/lib/store-cookie";
import {
  getAuthContext,
  resolveActiveStoreId,
  type AuthContext,
} from "@/lib/stores";
import type { Store } from "@/db/schema";
import { redirect } from "next/navigation";

export type AdminContext = AuthContext & {
  activeStoreId: string | null;
  activeStore: Store | null;
};

export async function requireAdminContext(): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");

  const ctx = await getAuthContext(session.user.id);
  if (!ctx) redirect("/admin/login");

  const cookieStoreId = await getActiveStoreIdFromCookie();
  const activeStoreId = resolveActiveStoreId(ctx, cookieStoreId);
  const activeStore =
    ctx.stores.find((s) => s.id === activeStoreId) ?? null;

  return { ...ctx, activeStoreId, activeStore };
}

export async function requireActiveStore(): Promise<
  AdminContext & { activeStoreId: string; activeStore: Store }
> {
  const admin = await requireAdminContext();
  if (!admin.activeStoreId || !admin.activeStore) {
    throw new Error("NO_STORE");
  }
  return admin as AdminContext & {
    activeStoreId: string;
    activeStore: Store;
  };
}