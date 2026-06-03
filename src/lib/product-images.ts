import { db } from "@/db";
import {
  menuItems,
  productImages,
  type MenuItem,
  type ProductImage,
  type ProductImageKind,
} from "@/db/schema";
import type { MenuItemWithImages } from "@/lib/product-image-display";
import { saveBuffer, saveUpload } from "@/lib/uploads";
import { and, asc, eq, inArray, max } from "drizzle-orm";

export type { MenuItemWithImages } from "@/lib/product-image-display";

export async function fetchImagesByMenuItemIds(
  menuItemIds: string[]
): Promise<Map<string, ProductImage[]>> {
  const map = new Map<string, ProductImage[]>();
  if (menuItemIds.length === 0) return map;

  const rows = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.menuItemId, menuItemIds))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));

  for (const row of rows) {
    const list = map.get(row.menuItemId) ?? [];
    list.push(row);
    map.set(row.menuItemId, list);
  }
  return map;
}

export async function loadMenuItemWithImages(
  itemId: string,
  storeId: string
): Promise<MenuItemWithImages | null> {
  const [item] = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, itemId), eq(menuItems.storeId, storeId)));

  if (!item) return null;

  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.menuItemId, itemId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));

  return { ...item, images };
}

async function nextSortOrder(menuItemId: string, kind: ProductImageKind) {
  const [row] = await db
    .select({ max: max(productImages.sortOrder) })
    .from(productImages)
    .where(
      and(
        eq(productImages.menuItemId, menuItemId),
        eq(productImages.kind, kind)
      )
    );
  return (row?.max ?? -1) + 1;
}

export async function addProductImage(
  menuItemId: string,
  storeId: string,
  kind: ProductImageKind,
  file: File
): Promise<MenuItemWithImages | null> {
  const item = await loadMenuItemWithImages(menuItemId, storeId);
  if (!item) return null;

  const subdir =
    kind === "enhanced"
      ? `dishes/${storeId}/enhanced`
      : `dishes/${storeId}`;
  const url = await saveUpload(file, subdir);
  const sortOrder = await nextSortOrder(menuItemId, kind);

  const [image] = await db
    .insert(productImages)
    .values({ menuItemId, url, kind, sortOrder })
    .returning();

  if (kind === "original") {
    await db
      .update(menuItems)
      .set({ originalImageUrl: url })
      .where(eq(menuItems.id, menuItemId));
  } else {
    await db
      .update(menuItems)
      .set({ enhancedImageUrl: url })
      .where(eq(menuItems.id, menuItemId));
  }

  return {
    ...item,
    images: [...item.images, image],
    ...(kind === "original"
      ? { originalImageUrl: url }
      : { enhancedImageUrl: url }),
  };
}

export async function addProductImageFromBuffer(
  menuItemId: string,
  storeId: string,
  buffer: Buffer
): Promise<MenuItemWithImages | null> {
  const item = await loadMenuItemWithImages(menuItemId, storeId);
  if (!item) return null;

  const url = await saveBuffer(
    buffer,
    `dishes/${storeId}/enhanced`,
    ".png"
  );
  const sortOrder = await nextSortOrder(menuItemId, "enhanced");

  const [image] = await db
    .insert(productImages)
    .values({
      menuItemId,
      url,
      kind: "enhanced",
      sortOrder,
    })
    .returning();

  await db
    .update(menuItems)
    .set({ enhancedImageUrl: url })
    .where(eq(menuItems.id, menuItemId));

  return {
    ...item,
    images: [...item.images, image],
    enhancedImageUrl: url,
  };
}

export async function deleteProductImage(
  menuItemId: string,
  storeId: string,
  imageId: string
): Promise<MenuItemWithImages | null> {
  const item = await loadMenuItemWithImages(menuItemId, storeId);
  if (!item) return null;

  const target = item.images.find((img) => img.id === imageId);
  if (!target) return null;

  await db.delete(productImages).where(eq(productImages.id, imageId));

  const remaining = item.images.filter((img) => img.id !== imageId);
  const updates: Partial<MenuItem> = {};

  if (item.displayImageId === imageId) {
    updates.displayImageId = null;
  }

  const originals = remaining.filter((i) => i.kind === "original");
  const enhanced = remaining.filter((i) => i.kind === "enhanced");
  updates.originalImageUrl = originals.at(-1)?.url ?? null;
  updates.enhancedImageUrl = enhanced.at(-1)?.url ?? null;

  const [updated] = await db
    .update(menuItems)
    .set(updates)
    .where(eq(menuItems.id, menuItemId))
    .returning();

  if (!updated) return null;

  return { ...updated, images: remaining };
}

export async function setDisplayImage(
  menuItemId: string,
  storeId: string,
  displayImageId: string | null
): Promise<MenuItemWithImages | null> {
  const item = await loadMenuItemWithImages(menuItemId, storeId);
  if (!item) return null;

  if (displayImageId) {
    const exists = item.images.some((img) => img.id === displayImageId);
    if (!exists) return null;
  }

  const [updated] = await db
    .update(menuItems)
    .set({ displayImageId })
    .where(eq(menuItems.id, menuItemId))
    .returning();

  if (!updated) return null;
  return { ...updated, images: item.images };
}

export async function migrateLegacyProductImages(): Promise<void> {
  const items = await db.select().from(menuItems);

  for (const item of items) {
    const existing = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.menuItemId, item.id))
      .limit(1);

    if (existing.length > 0) continue;

    const legacy: { url: string; kind: ProductImageKind }[] = [];
    if (item.originalImageUrl) {
      legacy.push({ url: item.originalImageUrl, kind: "original" });
    }
    if (
      item.enhancedImageUrl &&
      item.enhancedImageUrl !== item.originalImageUrl
    ) {
      legacy.push({ url: item.enhancedImageUrl, kind: "enhanced" });
    }

    if (legacy.length === 0) continue;

    let displayImageId: string | null = item.displayImageId ?? null;
    const inserted: ProductImage[] = [];

    for (let i = 0; i < legacy.length; i++) {
      const [row] = await db
        .insert(productImages)
        .values({
          menuItemId: item.id,
          url: legacy[i]!.url,
          kind: legacy[i]!.kind,
          sortOrder: i,
        })
        .returning();
      inserted.push(row);
    }

    if (!displayImageId) {
      const enhanced = inserted.find((img) => img.kind === "enhanced");
      const original = inserted.find((img) => img.kind === "original");
      displayImageId = enhanced?.id ?? original?.id ?? null;
    }

    await db
      .update(menuItems)
      .set({ displayImageId })
      .where(eq(menuItems.id, item.id));
  }
}