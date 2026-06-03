import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { requireApiActiveStore } from "@/lib/api-auth";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      categoryId: z.string().nullable(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

export async function PATCH(request: Request) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.items.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const ids = parsed.data.items.map((i) => i.id);
  const existing = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(
      and(
        eq(menuItems.storeId, auth.storeId),
        inArray(menuItems.id, ids)
      )
    );

  if (existing.length !== ids.length) {
    return NextResponse.json({ error: "Invalid product ids" }, { status: 400 });
  }

  const categoryIds = [
    ...new Set(
      parsed.data.items
        .map((i) => i.categoryId)
        .filter((id): id is string => id != null)
    ),
  ];

  if (categoryIds.length > 0) {
    const { categories } = await import("@/db/schema");
    const cats = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.storeId, auth.storeId),
          inArray(categories.id, categoryIds)
        )
      );
    if (cats.length !== categoryIds.length) {
      return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    }
  }

  await db.transaction((tx) => {
    for (const row of parsed.data.items) {
      tx.update(menuItems)
        .set({
          categoryId: row.categoryId,
          sortOrder: row.sortOrder,
        })
        .where(
          and(eq(menuItems.id, row.id), eq(menuItems.storeId, auth.storeId))
        );
    }
  });

  const updated = await db
    .select()
    .from(menuItems)
    .where(
      and(eq(menuItems.storeId, auth.storeId), inArray(menuItems.id, ids))
    );

  return NextResponse.json({ items: updated });
}