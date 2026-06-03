import { db } from "@/db";
import { stores } from "@/db/schema";
import { requireApiActiveStore } from "@/lib/api-auth";
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
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ store: auth.store });
}

export async function PATCH(request: Request) {
  const auth = await requireApiActiveStore();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
    .update(stores)
    .set(updates)
    .where(eq(stores.id, auth.storeId))
    .returning();

  return NextResponse.json({ store: updated });
}