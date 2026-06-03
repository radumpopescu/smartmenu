import { auth } from "@/auth";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { getFullMenuForAdmin, getRestaurantForUser } from "@/lib/restaurant";
import { saveUpload } from "@/lib/uploads";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurant = await getRestaurantForUser(session.user.id);
  if (!restaurant) {
    return NextResponse.json({ categories: [], items: [] });
  }

  const menu = await getFullMenuForAdmin(restaurant.id);
  return NextResponse.json(menu);
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  priceCents: z.number().optional(),
  priceLabel: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurant = await getRestaurantForUser(session.user.id);
  if (!restaurant) {
    return NextResponse.json({ error: "No restaurant" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "");
    const description = formData.get("description");
    const categoryId = formData.get("categoryId");
    const priceCents = formData.get("priceCents");
    const image = formData.get("image");

    let originalImageUrl: string | undefined;
    if (image instanceof File && image.size > 0) {
      originalImageUrl = await saveUpload(image, `dishes/${restaurant.id}`);
    }

    const [item] = await db
      .insert(menuItems)
      .values({
        restaurantId: restaurant.id,
        name,
        description: description ? String(description) : null,
        categoryId: categoryId ? String(categoryId) : null,
        priceCents: priceCents ? Number(priceCents) : null,
        originalImageUrl: originalImageUrl ?? null,
      })
      .returning();

    return NextResponse.json({ item });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [item] = await db
    .insert(menuItems)
    .values({
      restaurantId: restaurant.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      categoryId: parsed.data.categoryId ?? null,
      priceCents: parsed.data.priceCents ?? null,
      priceLabel: parsed.data.priceLabel ?? null,
      tags: parsed.data.tags?.length
        ? JSON.stringify(parsed.data.tags)
        : null,
    })
    .returning();

  return NextResponse.json({ item });
}