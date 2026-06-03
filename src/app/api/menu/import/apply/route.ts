import { auth } from "@/auth";
import { db } from "@/db";
import { categories, menuItems } from "@/db/schema";
import { getRestaurantForUser } from "@/lib/restaurant";
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurant = await getRestaurantForUser(session.user.id);
  if (!restaurant) {
    return NextResponse.json(
      { error: "Create a restaurant profile first" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { extracted, replaceExisting } = parsed.data;

  if (replaceExisting) {
    await db
      .delete(menuItems)
      .where(eq(menuItems.restaurantId, restaurant.id));
    await db
      .delete(categories)
      .where(eq(categories.restaurantId, restaurant.id));
  }

  let categoryOrder = 0;
  let itemOrder = 0;
  const created = { categories: 0, items: 0 };

  for (const cat of extracted.categories as ExtractedMenu["categories"]) {
    const [category] = await db
      .insert(categories)
      .values({
        restaurantId: restaurant.id,
        name: cat.name,
        sortOrder: categoryOrder++,
      })
      .returning();

    created.categories++;

    for (const item of cat.items) {
      await db.insert(menuItems).values({
        restaurantId: restaurant.id,
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