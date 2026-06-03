import { eq } from "drizzle-orm";
import { db } from "@/db";
import { restaurants, categories, menuItems } from "@/db/schema";

export async function getRestaurantBySlug(slug: string) {
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.slug, slug))
    .limit(1);
  return restaurant ?? null;
}

export async function getRestaurantForUser(userId: string) {
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.userId, userId))
    .limit(1);
  return restaurant ?? null;
}

export async function getPublishedMenu(slug: string) {
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant || !restaurant.published) return null;

  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.restaurantId, restaurant.id))
    .orderBy(categories.sortOrder);

  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.restaurantId, restaurant.id))
    .orderBy(menuItems.sortOrder);

  const publishedItems = items.filter((i) => i.published);

  return { restaurant, categories: cats, items: publishedItems };
}

export async function getFullMenuForAdmin(restaurantId: string) {
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.restaurantId, restaurantId))
    .orderBy(categories.sortOrder);

  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.restaurantId, restaurantId))
    .orderBy(menuItems.sortOrder);

  return { categories: cats, items };
}