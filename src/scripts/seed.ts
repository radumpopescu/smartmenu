import bcrypt from "bcryptjs";
import { db, sqlite } from "@/db";
import { users, stores, categories, menuItems, userStores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

function runMigrations() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  try {
    migrate(db, { migrationsFolder });
  } catch {
    /* fresh install handled below */
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'operator',
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      tagline TEXT,
      description TEXT,
      accent_color TEXT DEFAULT '#c9a962',
      currency TEXT NOT NULL DEFAULT 'RON',
      published INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_stores (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      PRIMARY KEY (user_id, store_id)
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

  const userCols = sqlite
    .prepare(`PRAGMA table_info(users)`)
    .all() as { name: string }[];
  if (!userCols.some((c) => c.name === "role")) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'operator'`);
  }

  const storeCols = sqlite
    .prepare(`PRAGMA table_info(restaurants)`)
    .all() as { name: string }[];
  if (!storeCols.some((c) => c.name === "currency")) {
    sqlite.exec(
      `ALTER TABLE restaurants ADD COLUMN currency TEXT NOT NULL DEFAULT 'RON'`
    );
    sqlite.exec(`UPDATE restaurants SET currency = 'RON' WHERE currency IS NULL`);
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_stores (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      PRIMARY KEY (user_id, store_id)
    );
  `);

  const restaurantCols = sqlite
    .prepare(`PRAGMA table_info(restaurants)`)
    .all() as { name: string }[];
  if (restaurantCols.some((c) => c.name === "user_id")) {
    sqlite.exec(`
      INSERT OR IGNORE INTO user_stores (user_id, store_id)
      SELECT user_id, id FROM restaurants WHERE user_id IS NOT NULL;
    `);
  }

  if (restaurantCols.some((c) => c.name === "currency")) {
    sqlite.exec(
      `UPDATE restaurants SET currency = 'RON' WHERE currency IS NULL OR currency = ''`
    );
  }
}

function hasLegacyUserIdColumn() {
  const cols = sqlite
    .prepare(`PRAGMA table_info(restaurants)`)
    .all() as { name: string }[];
  return cols.some((c) => c.name === "user_id");
}

async function upsertUser(
  email: string,
  password: string,
  name: string,
  role: "superadmin" | "operator"
) {
  const hash = await bcrypt.hash(password, 12);
  const normalized = email.toLowerCase();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized));

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash: hash, name, role })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(users)
    .values({ email: normalized, passwordHash: hash, name, role })
    .returning();
  return created.id;
}

async function main() {
  runMigrations();

  const superEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const superPassword = process.env.ADMIN_PASSWORD ?? "changeme";
  const superId = await upsertUser(
    superEmail,
    superPassword,
    "Super Admin",
    "superadmin"
  );
  console.log(`Superadmin: ${superEmail}`);

  const operatorId = await upsertUser(
    "operator@example.com",
    "changeme",
    "Store Operator",
    "operator"
  );
  console.log(`Operator: operator@example.com / changeme`);

  let [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.slug, "bistro-luna"));

  if (!store) {
    if (hasLegacyUserIdColumn()) {
      const id = crypto.randomUUID();
      sqlite
        .prepare(
          `INSERT INTO restaurants (id, user_id, name, slug, tagline, description, accent_color, currency, published)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          superId,
          "Bistro Luna",
          "bistro-luna",
          "Seasonal plates · Evening service",
          "A demo store showcasing SmartMenu.",
          "#c9a962",
          "RON",
          1
        );
      [store] = await db.select().from(stores).where(eq(stores.id, id));
    } else {
      [store] = await db
        .insert(stores)
        .values({
          name: "Bistro Luna",
          slug: "bistro-luna",
          tagline: "Seasonal plates · Evening service",
          description: "A demo store showcasing SmartMenu.",
          published: true,
          accentColor: "#c9a962",
          currency: "RON",
        })
        .returning();
    }
    console.log(`Demo store: /${store.slug}`);

    const [starters] = await db
      .insert(categories)
      .values({ storeId: store.id, name: "To Start", sortOrder: 0 })
      .returning();

    const [mains] = await db
      .insert(categories)
      .values({ storeId: store.id, name: "Mains", sortOrder: 1 })
      .returning();

    await db.insert(menuItems).values([
      {
        storeId: store.id,
        categoryId: starters.id,
        name: "Burrata & Heirloom Tomatoes",
        description:
          "Creamy burrata, basil oil, aged balsamic, grilled sourdough.",
        priceCents: 1600,
        tags: JSON.stringify(["vegetarian"]),
        sortOrder: 0,
      },
      {
        storeId: store.id,
        categoryId: starters.id,
        name: "Charred Octopus",
        description: "Romesco, crispy potatoes, smoked paprika.",
        priceCents: 2100,
        tags: JSON.stringify(["gluten-free"]),
        sortOrder: 1,
      },
      {
        storeId: store.id,
        categoryId: mains.id,
        name: "Duck Confit",
        description: "Cherry gastrique, wilted greens, pommes sarladaise.",
        priceCents: 3400,
        sortOrder: 0,
      },
      {
        storeId: store.id,
        categoryId: mains.id,
        name: "Wild Mushroom Risotto",
        description: "Porcini stock, parmesan, truffle finish.",
        priceCents: 2800,
        tags: JSON.stringify(["vegetarian"]),
        sortOrder: 1,
      },
    ]);
  }

  await db
    .insert(userStores)
    .values({ userId: operatorId, storeId: store.id })
    .onConflictDoNothing();

  console.log("Seed complete.");
}

main().catch(console.error);