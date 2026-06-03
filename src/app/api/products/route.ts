import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { requireApiActiveStore } from "@/lib/api-auth";
import { getFullMenuForAdmin } from "@/lib/stores";
import { saveUpload } from "@/lib/uploads";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const menu = await getFullMenuForAdmin(auth.storeId);
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
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

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
      originalImageUrl = await saveUpload(image, `dishes/${auth.storeId}`);
    }

    const [item] = await db
      .insert(menuItems)
      .values({
        storeId: auth.storeId,
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
      storeId: auth.storeId,
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