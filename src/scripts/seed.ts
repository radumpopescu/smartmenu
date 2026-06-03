import bcrypt from "bcryptjs";
import { db, sqlite } from "@/db";
import { users, restaurants, categories, menuItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

async function main() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  try {
    migrate(db, { migrationsFolder });
  } catch {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS restaurants (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        tagline TEXT,
        description TEXT,
        accent_color TEXT DEFAULT '#c9a962',
        published INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL
      );
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        description TEXT,
        price_cents INTEGER,
        price_label TEXT,
        tags TEXT,
        original_image_url TEXT,
        enhanced_image_url TEXT,
        published INTEGER DEFAULT 1 NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
    `);
  }

  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "changeme";
  const hash = await bcrypt.hash(password, 12);

  const existing = await db.select().from(users).where(eq(users.email, email));
  let userId: string;

  if (existing.length === 0) {
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: hash, name: "Admin" })
      .returning();
    userId = user.id;
    console.log(`Created admin: ${email}`);
  } else {
    userId = existing[0].id;
    await db
      .update(users)
      .set({ passwordHash: hash })
      .where(eq(users.id, userId));
    console.log(`Updated admin password: ${email}`);
  }

  const [existingRestaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.userId, userId));

  if (!existingRestaurant) {
    const [restaurant] = await db
      .insert(restaurants)
      .values({
        userId,
        name: "Bistro Luna",
        slug: "bistro-luna",
        tagline: "Seasonal plates · Evening service",
        description: "A demo restaurant showcasing SmartMenu.",
        published: true,
        accentColor: "#c9a962",
      })
      .returning();

    const [starters] = await db
      .insert(categories)
      .values({ restaurantId: restaurant.id, name: "To Start", sortOrder: 0 })
      .returning();

    const [mains] = await db
      .insert(categories)
      .values({ restaurantId: restaurant.id, name: "Mains", sortOrder: 1 })
      .returning();

    await db.insert(menuItems).values([
      {
        restaurantId: restaurant.id,
        categoryId: starters.id,
        name: "Burrata & Heirloom Tomatoes",
        description:
          "Creamy burrata, basil oil, aged balsamic, grilled sourdough.",
        priceCents: 1600,
        tags: JSON.stringify(["vegetarian"]),
        sortOrder: 0,
      },
      {
        restaurantId: restaurant.id,
        categoryId: starters.id,
        name: "Charred Octopus",
        description: "Romesco, crispy potatoes, smoked paprika.",
        priceCents: 2100,
        tags: JSON.stringify(["gluten-free"]),
        sortOrder: 1,
      },
      {
        restaurantId: restaurant.id,
        categoryId: mains.id,
        name: "Duck Confit",
        description: "Cherry gastrique, wilted greens, pommes sarladaise.",
        priceCents: 3400,
        sortOrder: 0,
      },
      {
        restaurantId: restaurant.id,
        categoryId: mains.id,
        name: "Wild Mushroom Risotto",
        description: "Porcini stock, parmesan, truffle finish.",
        priceCents: 2800,
        tags: JSON.stringify(["vegetarian"]),
        sortOrder: 1,
      },
    ]);

    console.log(`Demo restaurant: /${restaurant.slug}`);
  }

  console.log("Seed complete.");
}

main().catch(console.error);