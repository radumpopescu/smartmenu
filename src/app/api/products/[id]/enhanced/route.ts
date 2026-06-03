import { auth } from "@/auth";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { getRestaurantForUser } from "@/lib/restaurant";
import { saveUpload } from "@/lib/uploads";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const restaurant = await getRestaurantForUser(session.user.id);
  if (!restaurant) {
    return NextResponse.json({ error: "No restaurant" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(menuItems)
    .where(
      and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurant.id))
    );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Image required" }, { status: 400 });
  }

  const enhancedImageUrl = await saveUpload(
    file,
    `dishes/${restaurant.id}/enhanced`
  );

  const [item] = await db
    .update(menuItems)
    .set({ enhancedImageUrl })
    .where(eq(menuItems.id, id))
    .returning();

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const restaurant = await getRestaurantForUser(session.user.id);
  if (!restaurant) {
    return NextResponse.json({ error: "No restaurant" }, { status: 400 });
  }

  const [item] = await db
    .update(menuItems)
    .set({ enhancedImageUrl: null })
    .where(
      and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurant.id))
    )
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}