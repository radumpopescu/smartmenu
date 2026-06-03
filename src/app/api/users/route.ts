import { db } from "@/db";
import { users, userStores } from "@/db/schema";
import { requireSuperadmin } from "@/lib/api-auth";
import { assignUserToStore } from "@/lib/stores";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(["superadmin", "operator"]).default("operator"),
  storeIds: z.array(z.string()).optional(),
});

export async function GET() {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth.error;

  const allUsers = await db.select().from(users).orderBy(users.email);
  const assignments = await db.select().from(userStores);

  const byUser = Object.fromEntries(
    allUsers.map((u) => [u.id, [] as string[]])
  );
  for (const a of assignments) {
    byUser[a.userId]?.push(a.storeId);
  }

  return NextResponse.json({
    users: allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      storeIds: byUser[u.id] ?? [],
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const hash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: hash,
      name: parsed.data.name ?? null,
      role: parsed.data.role,
    })
    .returning();

  if (parsed.data.storeIds?.length) {
    for (const storeId of parsed.data.storeIds) {
      await assignUserToStore(user.id, storeId);
    }
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        storeIds: parsed.data.storeIds ?? [],
      },
    },
    { status: 201 }
  );
}