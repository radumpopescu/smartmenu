import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const USER_ROLES = ["superadmin", "operator"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role").$type<UserRole>().notNull().default("operator"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Store = public menu tenant (table name kept as restaurants for compatibility) */
export const stores = sqliteTable("restaurants", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline"),
  description: text("description"),
  accentColor: text("accent_color").default("#c9a962"),
  currency: text("currency").notNull().default("RON"),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const userStores = sqliteTable(
  "user_stores",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.storeId] })]
);

export const categories = sqliteTable("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  storeId: text("restaurant_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = sqliteTable("menu_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  storeId: text("restaurant_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents"),
  priceLabel: text("price_label"),
  tags: text("tags"),
  originalImageUrl: text("original_image_url"),
  enhancedImageUrl: text("enhanced_image_url"),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const usersRelations = relations(users, ({ many }) => ({
  storeAssignments: many(userStores),
}));

export const storesRelations = relations(stores, ({ many }) => ({
  assignments: many(userStores),
  categories: many(categories),
  menuItems: many(menuItems),
}));

export const userStoresRelations = relations(userStores, ({ one }) => ({
  user: one(users, { fields: [userStores.userId], references: [users.id] }),
  store: one(stores, { fields: [userStores.storeId], references: [stores.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, {
    fields: [categories.storeId],
    references: [stores.id],
  }),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  store: one(stores, {
    fields: [menuItems.storeId],
    references: [stores.id],
  }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;

/** @deprecated use Store */
export type Restaurant = Store;