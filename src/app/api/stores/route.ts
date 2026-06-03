import { db } from "@/db";
import { stores, userStores } from "@/db/schema";
import { requireSuperadmin } from "@/lib/api-auth";
import { DEFAULT_CURRENCY, normalizeCurrency } from "@/lib/currency";
import { slugify } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().min(3).max(3).optional(),
});

export async function GET() {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth.error;

  const all = await db.select().from(stores).orderBy(stores.name);
  return NextResponse.json({ stores: all });
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const slug = slugify(parsed.data.slug ?? parsed.data.name);

  const [store] = await db
    .insert(stores)
    .values({
      name: parsed.data.name,
      slug,
      tagline: parsed.data.tagline ?? null,
      description: parsed.data.description ?? null,
      currency: normalizeCurrency(parsed.data.currency ?? DEFAULT_CURRENCY),
    })
    .returning();

  return NextResponse.json({ store }, { status: 201 });
}