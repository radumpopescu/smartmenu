import { auth } from "@/auth";
import { ACTIVE_STORE_COOKIE } from "@/lib/store-cookie";
import { assertStoreAccess } from "@/lib/stores";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ storeId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await assertStoreAccess(session.user.id, parsed.data.storeId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, storeId: parsed.data.storeId });
  res.cookies.set(ACTIVE_STORE_COOKIE, parsed.data.storeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}