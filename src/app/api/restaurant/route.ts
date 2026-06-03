import { auth } from "@/auth";
import { db } from "@/db";
import { restaurants } from "@/db/schema";
import { getRestaurantForUser } from "@/lib/restaurant";
import { slugify } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  accentColor: z.string().optional(),
  published: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurant = await getRestaurantForUser(session.user.id);
  return NextResponse.json({ restaurant });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let restaurant = await getRestaurantForUser(session.user.id);
  if (!restaurant) {
    const slug = slugify(parsed.data.name ?? "my-restaurant");
    const [created] = await db
      .insert(restaurants)
      .values({
        userId: session.user.id,
        name: parsed.data.name ?? "My Restaurant",
        slug,
      })
      .returning();
    restaurant = created;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.slug) updates.slug = slugify(parsed.data.slug);
  if (parsed.data.tagline !== undefined) updates.tagline = parsed.data.tagline;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.accentColor) updates.accentColor = parsed.data.accentColor;
  if (parsed.data.published !== undefined)
    updates.published = parsed.data.published;

  const [updated] = await db
    .update(restaurants)
    .set(updates)
    .where(eq(restaurants.id, restaurant.id))
    .returning();

  return NextResponse.json({ restaurant: updated });
}