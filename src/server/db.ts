import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "@/db/schema";

/**
 * The database type services depend on.
 *
 * Deliberately the *base* Drizzle SQLite type in both sync and async modes,
 * not the better-sqlite3 client type. Local dev binds the sync
 * better-sqlite3 driver; Cloudflare D1 binds the async one. Because every
 * service `await`s its queries, the same code satisfies both and moving to
 * D1 is a change in `src/db/index.ts` alone.
 *
 * Two rules keep that promise true:
 *   1. No `db.transaction()`. D1 has no interactive transactions — it has
 *      `batch()`. Write sequential awaited statements instead.
 *   2. No driver-specific escape hatches (`.run()`, `sqlite.pragma`, the raw
 *      handle) below the `src/db` boundary.
 */
export type Database = BaseSQLiteDatabase<"sync" | "async", unknown, typeof schema>;
