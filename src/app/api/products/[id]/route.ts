import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { requireApiActiveStore } from "@/lib/api-auth";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  priceCents: z.number().nullable().optional(),
  priceLabel: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.tags) updates.tags = JSON.stringify(parsed.data.tags);

  const [item] = await db
    .update(menuItems)
    .set(updates)
    .where(
      and(eq(menuItems.id, id), eq(menuItems.storeId, auth.storeId))
    )
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  await db
    .delete(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.storeId, auth.storeId)));

  return NextResponse.json({ ok: true });
}