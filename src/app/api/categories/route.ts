import { db } from "@/db";
import { categories, menuItems } from "@/db/schema";
import { requireApiActiveStore } from "@/lib/api-auth";
import { eq, max, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

export async function GET() {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.storeId, auth.storeId))
    .orderBy(categories.sortOrder);

  return NextResponse.json({ categories: cats });
}

export async function POST(request: Request) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [row] = await db
    .select({ max: max(categories.sortOrder) })
    .from(categories)
    .where(eq(categories.storeId, auth.storeId));

  const sortOrder = (row?.max ?? -1) + 1;

  const [category] = await db
    .insert(categories)
    .values({
      storeId: auth.storeId,
      name: parsed.data.name.trim(),
      sortOrder,
    })
    .returning();

  return NextResponse.json({ category });
}

export async function PATCH(request: Request) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const storeCats = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.storeId, auth.storeId));

  const storeCatIds = new Set(storeCats.map((c) => c.id));
  if (
    parsed.data.orderedIds.length !== storeCatIds.size ||
    !parsed.data.orderedIds.every((id) => storeCatIds.has(id))
  ) {
    return NextResponse.json(
      { error: "orderedIds must match store categories exactly" },
      { status: 400 }
    );
  }

  await db.transaction((tx) => {
    parsed.data.orderedIds.forEach((id, index) => {
      tx.update(categories)
        .set({ sortOrder: index })
        .where(
          and(eq(categories.id, id), eq(categories.storeId, auth.storeId))
        );
    });
  });

  const updated = await db
    .select()
    .from(categories)
    .where(eq(categories.storeId, auth.storeId))
    .orderBy(categories.sortOrder);

  return NextResponse.json({ categories: updated });
}