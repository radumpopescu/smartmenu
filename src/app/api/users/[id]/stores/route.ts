import { requireSuperadmin } from "@/lib/api-auth";
import { assignUserToStore, removeUserFromStore } from "@/lib/stores";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  storeIds: z.array(z.string()),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth.error;

  const { id: userId } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { db } = await import("@/db");
  const { userStores } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  await db.delete(userStores).where(eq(userStores.userId, userId));
  for (const storeId of parsed.data.storeIds) {
    await assignUserToStore(userId, storeId);
  }

  return NextResponse.json({ ok: true, storeIds: parsed.data.storeIds });
}