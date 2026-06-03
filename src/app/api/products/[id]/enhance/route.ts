import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { enhanceDishImage, type ImageProvider } from "@/lib/image-enhance";
import { requireApiActiveStore } from "@/lib/api-auth";
import {
  addProductImageFromBuffer,
  loadMenuItemWithImages,
} from "@/lib/product-images";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  provider: z.enum(["nano-banana", "openai"]),
  sourceImageId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const [item] = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.storeId, auth.storeId)));

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const withImages = await loadMenuItemWithImages(id, auth.storeId);
  if (!withImages) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let sourceUrl: string | null = null;
  if (parsed.data.sourceImageId) {
    const source = withImages.images.find(
      (img) => img.id === parsed.data.sourceImageId
    );
    if (!source || source.kind !== "original") {
      return NextResponse.json(
        { error: "Select a valid original photo to enhance" },
        { status: 400 }
      );
    }
    sourceUrl = source.url;
  } else {
    const originals = withImages.images.filter((i) => i.kind === "original");
    sourceUrl =
      originals.at(-1)?.url ?? item.originalImageUrl ?? null;
  }

  if (!sourceUrl) {
    return NextResponse.json(
      { error: "Upload an original photo first" },
      { status: 400 }
    );
  }

  try {
    const buffer = await enhanceDishImage(
      sourceUrl,
      parsed.data.provider as ImageProvider
    );
    const updated = await addProductImageFromBuffer(id, auth.storeId, buffer);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ item: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Enhancement failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}