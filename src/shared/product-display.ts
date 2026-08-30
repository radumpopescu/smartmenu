/**
 * CLIENT-SAFE display helpers over the product wire type.
 */
import type { ProductDTO } from "@/shared/types";

/**
 * What the admin grid shows for a product.
 *
 * Falls back past `displayImageUrl` because that is null when
 * `displayImageId` points at an image that has since been deleted. The public
 * menu deliberately shows nothing in that case; the admin should still show
 * the photo that exists, so the operator can see what to fix.
 */
export function adminPreviewUrl(item: ProductDTO): string | null {
  if (item.displayImageUrl) return item.displayImageUrl;
  const enhanced = item.images.filter((i) => i.kind === "enhanced").at(-1);
  return enhanced?.url ?? item.images.at(-1)?.url ?? null;
}
