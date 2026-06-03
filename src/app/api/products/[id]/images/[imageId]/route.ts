import { requireApiActiveStore } from "@/lib/api-auth";
import { deleteProductImage } from "@/lib/product-images";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id, imageId } = await params;
  const item = await deleteProductImage(id, auth.storeId, imageId);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}