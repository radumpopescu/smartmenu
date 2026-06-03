import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { requireApiActiveStore } from "@/lib/api-auth";
import { saveUpload } from "@/lib/uploads";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.storeId, auth.storeId)));

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
    `dishes/${auth.storeId}/enhanced`
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
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const [item] = await db
    .update(menuItems)
    .set({ enhancedImageUrl: null })
    .where(and(eq(menuItems.id, id), eq(menuItems.storeId, auth.storeId)))
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}