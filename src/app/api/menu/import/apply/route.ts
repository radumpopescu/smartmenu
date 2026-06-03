import { db } from "@/db";
import { categories, menuItems } from "@/db/schema";
import { requireApiActiveStore } from "@/lib/api-auth";
import type { ExtractedMenu } from "@/lib/grok";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  extracted: z.object({
    restaurantName: z.string().nullable().optional(),
    categories: z.array(
      z.object({
        name: z.string(),
        items: z.array(
          z.object({
            name: z.string(),
            description: z.string().nullable().optional(),
            priceCents: z.number().nullable().optional(),
            priceLabel: z.string().nullable().optional(),
            tags: z.array(z.string()).optional(),
          })
        ),
      })
    ),
  }),
  replaceExisting: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { extracted, replaceExisting } = parsed.data;
  const storeId = auth.storeId;

  if (replaceExisting) {
    await db.delete(menuItems).where(eq(menuItems.storeId, storeId));
    await db.delete(categories).where(eq(categories.storeId, storeId));
  }

  let categoryOrder = 0;
  let itemOrder = 0;
  const created = { categories: 0, items: 0 };

  for (const cat of extracted.categories as ExtractedMenu["categories"]) {
    const [category] = await db
      .insert(categories)
      .values({
        storeId,
        name: cat.name,
        sortOrder: categoryOrder++,
      })
      .returning();

    created.categories++;

    for (const item of cat.items) {
      await db.insert(menuItems).values({
        storeId,
        categoryId: category.id,
        name: item.name,
        description: item.description ?? null,
        priceCents: item.priceCents ?? null,
        priceLabel: item.priceLabel ?? null,
        tags: item.tags?.length ? JSON.stringify(item.tags) : null,
        sortOrder: itemOrder++,
      });
      created.items++;
    }
  }

  return NextResponse.json({ created });
}