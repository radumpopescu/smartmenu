import type { MenuItem, ProductImage } from "@/db/schema";

export type MenuItemWithImages = MenuItem & { images: ProductImage[] };

export type PublicMenuItem = MenuItem & { publicImageUrl: string | null };

export function getPublicMenuImageUrl(
  item: Pick<
    MenuItem,
    "displayImageId" | "enhancedImageUrl" | "originalImageUrl"
  >,
  images: ProductImage[]
): string | null {
  if (images.length > 0) {
    if (item.displayImageId) {
      const selected = images.find((img) => img.id === item.displayImageId);
      return selected?.url ?? null;
    }
    const enhanced = images.filter((i) => i.kind === "enhanced");
    if (enhanced.length > 0) return enhanced[enhanced.length - 1]!.url;
    return images[images.length - 1]?.url ?? null;
  }
  return item.enhancedImageUrl ?? item.originalImageUrl ?? null;
}

export function getAdminPreviewImageUrl(
  item: Pick<
    MenuItem,
    "displayImageId" | "enhancedImageUrl" | "originalImageUrl"
  >,
  images: ProductImage[]
): string | null {
  const publicUrl = getPublicMenuImageUrl(item, images);
  if (publicUrl) return publicUrl;
  if (images.length === 0) {
    return item.enhancedImageUrl ?? item.originalImageUrl ?? null;
  }
  const enhanced = images.filter((i) => i.kind === "enhanced");
  if (enhanced.length > 0) return enhanced[enhanced.length - 1]!.url;
  return images[images.length - 1]?.url ?? null;
}

export function attachImagesToMenuItems(
  items: MenuItem[],
  imageMap: Map<string, ProductImage[]>
): MenuItemWithImages[] {
  return items.map((item) => ({
    ...item,
    images: imageMap.get(item.id) ?? [],
  }));
}

export function attachPublicImageUrls(
  items: MenuItem[],
  imageMap: Map<string, ProductImage[]>
): PublicMenuItem[] {
  return items.map((item) => ({
    ...item,
    publicImageUrl: getPublicMenuImageUrl(
      item,
      imageMap.get(item.id) ?? []
    ),
  }));
}