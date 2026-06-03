import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { enhanceDishImage, type ImageProvider } from "@/lib/image-enhance";
import { requireApiActiveStore } from "@/lib/api-auth";
import { saveBuffer } from "@/lib/uploads";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  provider: z.enum(["nano-banana", "openai"]),
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

  if (!item.originalImageUrl) {
    return NextResponse.json(
      { error: "Upload an original photo first" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const buffer = await enhanceDishImage(
      item.originalImageUrl,
      parsed.data.provider as ImageProvider
    );
    const enhancedImageUrl = await saveBuffer(
      buffer,
      `dishes/${auth.storeId}/enhanced`,
      ".png"
    );

    const [updated] = await db
      .update(menuItems)
      .set({ enhancedImageUrl })
      .where(eq(menuItems.id, id))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Enhancement failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}