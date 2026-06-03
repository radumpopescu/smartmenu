import { db } from "@/db";
import { categories, menuItems } from "@/db/schema";
import { requireApiActiveStore } from "@/lib/api-auth";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
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

  const [category] = await db
    .update(categories)
    .set({ name: parsed.data.name?.trim() })
    .where(
      and(eq(categories.id, id), eq(categories.storeId, auth.storeId))
    )
    .returning();

  if (!category) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ category });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const [cat] = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.id, id), eq(categories.storeId, auth.storeId))
    );

  if (!cat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [count] = await db
    .select({ n: sql<number>`count(*)` })
    .from(menuItems)
    .where(eq(menuItems.categoryId, id));

  if ((count?.n ?? 0) > 0) {
    return NextResponse.json(
      { error: "Category is not empty. Move or delete products first." },
      { status: 400 }
    );
  }

  await db.delete(categories).where(eq(categories.id, id));

  return NextResponse.json({ ok: true });
}