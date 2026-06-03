import { auth } from "@/auth";
import { getActiveStoreIdFromCookie } from "@/lib/store-cookie";
import {
  assertStoreAccess,
  getAuthContext,
  resolveActiveStoreId,
} from "@/lib/stores";
import type { Store } from "@/db/schema";
import { NextResponse } from "next/server";

type SessionResult =
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string };

async function getSessionUserId(): Promise<SessionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, userId: session.user.id };
}

export async function requireApiActiveStore(): Promise<
  | { error: NextResponse }
  | {
      userId: string;
      role: string;
      isSuperadmin: boolean;
      store: Store;
      storeId: string;
    }
> {
  const sessionResult = await getSessionUserId();
  if (!sessionResult.ok) return { error: sessionResult.response };

  const userId = sessionResult.userId;
  const ctx = await getAuthContext(userId);
  if (!ctx) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const cookieStoreId = await getActiveStoreIdFromCookie();
  const storeId = resolveActiveStoreId(ctx, cookieStoreId);
  if (!storeId) {
    return {
      error: NextResponse.json(
        { error: "No store selected or assigned" },
        { status: 400 }
      ),
    };
  }

  try {
    await assertStoreAccess(userId, storeId);
  } catch {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const store = ctx.stores.find((s) => s.id === storeId)!;

  return {
    userId,
    role: ctx.user.role,
    isSuperadmin: ctx.isSuperadmin,
    store,
    storeId,
  };
}

export async function requireSuperadmin() {
  const sessionResult = await getSessionUserId();
  if (!sessionResult.ok) return { error: sessionResult.response };

  const ctx = await getAuthContext(sessionResult.userId);
  if (!ctx?.isSuperadmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { userId: sessionResult.userId, ctx };
}