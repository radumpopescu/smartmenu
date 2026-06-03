/**
 * One-off: point every menu item at the same enhanced image URL (no file copy).
 * Uses the sole enhanced image in product_images, or falls back to legacy column.
 */
import { db } from "@/db";
import { menuItems, productImages } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const [source] = await db
    .select()
    .from(productImages)
    .where(eq(productImages.kind, "enhanced"))
    .limit(1);

  let sharedUrl: string | null = source?.url ?? null;

  if (!sharedUrl) {
    const legacyRows = await db
      .select({ url: menuItems.enhancedImageUrl })
      .from(menuItems);
    sharedUrl =
      legacyRows.find((r) => r.url != null && r.url !== "")?.url ?? null;
  }

  if (!sharedUrl) {
    console.error("No enhanced image found in the database.");
    process.exit(1);
  }

  console.log(`Assigning enhanced URL to all products:\n${sharedUrl}`);

  const items = await db.select().from(menuItems);
  let updated = 0;

  for (const item of items) {
    await db
      .delete(productImages)
      .where(
        and(
          eq(productImages.menuItemId, item.id),
          eq(productImages.kind, "enhanced")
        )
      );

    const [image] = await db
      .insert(productImages)
      .values({
        menuItemId: item.id,
        url: sharedUrl,
        kind: "enhanced",
        sortOrder: 0,
      })
      .returning();

    await db
      .update(menuItems)
      .set({
        enhancedImageUrl: sharedUrl,
        displayImageId: image.id,
      })
      .where(eq(menuItems.id, item.id));

    updated++;
    console.log(`  ✓ ${item.name}`);
  }

  console.log(`\nDone. Updated ${updated} products.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});