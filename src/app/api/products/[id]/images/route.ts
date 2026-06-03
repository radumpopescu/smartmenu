import { requireApiActiveStore } from "@/lib/api-auth";
import { addProductImage, loadMenuItemWithImages } from "@/lib/product-images";
import {
  PRODUCT_IMAGE_KINDS,
  type ProductImageKind,
} from "@/db/schema";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const item = await loadMenuItemWithImages(id, auth.storeId);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("image");
  const kindRaw = String(formData.get("kind") ?? "original");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Image required" }, { status: 400 });
  }

  if (!PRODUCT_IMAGE_KINDS.includes(kindRaw as ProductImageKind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const item = await addProductImage(
    id,
    auth.storeId,
    kindRaw as ProductImageKind,
    file
  );

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}