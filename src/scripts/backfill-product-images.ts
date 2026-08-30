/**
 * One-off backfill: legacy `original_image_url` / `enhanced_image_url` columns
 * into the `product_images` table.
 *
 * This used to run on every render of the admin products page. It is
 * idempotent but not free, and a page render is the wrong place for a data
 * migration. Run it explicitly: `npm run db:backfill-images`.
 */
import { migrateLegacyProductImages } from "@/lib/product-images";

async function main() {
  await migrateLegacyProductImages();
  console.log("Backfill complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
