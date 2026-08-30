/**
 * Row -> wire mappers.
 *
 * The shapes themselves live in `@/shared/types` so the browser can import
 * them; this module owns the conversion and is the only place that decides
 * what is exposed. Rows are never serialized directly: `users` carries a
 * password hash, and menu items carry deprecated image columns.
 */
import type {
  Category,
  MenuItem,
  ProductImage,
  Store,
  UserRole,
} from "@/db/schema";
import { getPublicMenuImageUrl } from "@/lib/product-image-display";
import type {
  CategoryDTO,
  ProductDTO,
  ProductImageDTO,
  StoreDTO,
  UserDTO,
} from "@/shared/types";

export type {
  CategoryDTO,
  ProductDTO,
  ProductImageDTO,
  StoreDTO,
  UserDTO,
} from "@/shared/types";

/**
 * Compile-time guard: the hand-written wire enums must stay in step with the
 * schema's. If a kind or role is added to the database and not to
 * `@/shared/types`, this stops building.
 */
type _KindsMatch = ProductImage["kind"] extends ProductImageDTO["kind"]
  ? ProductImageDTO["kind"] extends ProductImage["kind"]
    ? true
    : never
  : never;
type _RolesMatch = UserRole extends UserDTO["role"]
  ? UserDTO["role"] extends UserRole
    ? true
    : never
  : never;
const _kinds: _KindsMatch = true;
const _roles: _RolesMatch = true;
void _kinds;
void _roles;

/** Tags are stored as a JSON string; the wire shape is an array. */
export function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function toImageDTO(img: ProductImage): ProductImageDTO {
  return { id: img.id, url: img.url, kind: img.kind, sortOrder: img.sortOrder };
}

export function toProductDTO(
  item: MenuItem,
  images: ProductImage[]
): ProductDTO {
  return {
    id: item.id,
    storeId: item.storeId,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    priceCents: item.priceCents,
    priceLabel: item.priceLabel,
    tags: parseTags(item.tags),
    published: item.published,
    hidden: item.hidden,
    sortOrder: item.sortOrder,
    displayImageId: item.displayImageId,
    images: images.map(toImageDTO),
    displayImageUrl: getPublicMenuImageUrl(item, images),
  };
}

export function toCategoryDTO(c: Category): CategoryDTO {
  return { id: c.id, name: c.name, sortOrder: c.sortOrder };
}

export function toStoreDTO(s: Store): StoreDTO {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    tagline: s.tagline,
    description: s.description,
    accentColor: s.accentColor,
    currency: s.currency,
    published: s.published,
  };
}

export function toUserDTO(
  u: { id: string; email: string; name: string | null; role: UserRole },
  storeIds: string[]
): UserDTO {
  // Note the omission: passwordHash never crosses this boundary.
  return { id: u.id, email: u.email, name: u.name, role: u.role, storeIds };
}
