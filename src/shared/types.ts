/**
 * Wire types — the shapes that cross between server and browser.
 *
 * CLIENT-SAFE: pure type declarations with no imports at all, so a client
 * component can name a response shape without pulling `db/schema` (and
 * therefore drizzle) into the browser bundle.
 *
 * `src/server/dto` builds these from rows and is checked against them, so the
 * two cannot drift.
 */

export type ProductImageKind = "original" | "enhanced";
export type UserRole = "superadmin" | "operator";

export type ProductImageDTO = {
  id: string;
  url: string;
  kind: ProductImageKind;
  sortOrder: number;
};

export type ProductDTO = {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  priceCents: number | null;
  priceLabel: string | null;
  tags: string[];
  published: boolean;
  hidden: boolean;
  sortOrder: number;
  displayImageId: string | null;
  images: ProductImageDTO[];
  /** Computed server-side: the photo the public menu would actually show. */
  displayImageUrl: string | null;
};

export type CategoryDTO = {
  id: string;
  name: string;
  sortOrder: number;
};

export type StoreDTO = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  accentColor: string | null;
  currency: string;
  published: boolean;
};

export type UserDTO = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  storeIds: string[];
};

export type MenuBoardDTO = {
  categories: CategoryDTO[];
  items: ProductDTO[];
};

export type PublicMenuDTO = {
  store: StoreDTO;
  categories: CategoryDTO[];
  items: ProductDTO[];
};
