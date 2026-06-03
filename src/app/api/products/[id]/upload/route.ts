import { requireApiActiveStore } from "@/lib/api-auth";
import { addProductImage } from "@/lib/product-images";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Image required" }, { status: 400 });
  }

  const item = await addProductImage(id, auth.storeId, "original", file);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}