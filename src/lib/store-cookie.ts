import { cookies } from "next/headers";

export const ACTIVE_STORE_COOKIE = "smartmenu_active_store";

export async function getActiveStoreIdFromCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACTIVE_STORE_COOKIE)?.value;
}