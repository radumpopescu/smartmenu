import { eq } from "drizzle-orm";
import { users, userStores } from "@/db/schema";
import type { Database } from "@/server/db";
import type { Actor } from "@/server/actor";
import { AppError } from "@/server/errors";
import { requireScope } from "@/server/services/guard";
import { toUserDTO, type UserDTO } from "@/server/dto";
import { StoreService } from "@/server/services/store-service";
import bcrypt from "bcryptjs";
import type { z } from "zod";
import type { userCreateSchema, userStoresSchema } from "@/shared/schemas";

export class UserService {
  private constructor(
    private db: Database,
    private storeService: StoreService
  ) {}

  /**
   * ctx composed from this service's own needs plus its dependency's, so the
   * type stays honest when either changes.
   */
  static make(ctx: Parameters<typeof StoreService.make>[0] & { var: { db: Database } }) {
    return new UserService(ctx.var.db, StoreService.make(ctx));
  }

  async list(actor: Actor): Promise<UserDTO[]> {
    requireScope(actor, "admin.users.write");

    const all = await this.db.select().from(users).orderBy(users.email);
    const assignments = await this.db.select().from(userStores);

    const byUser = new Map<string, string[]>();
    for (const a of assignments) {
      byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a.storeId]);
    }

    return all.map((u) => toUserDTO(u, byUser.get(u.id) ?? []));
  }

  async create(
    actor: Actor,
    input: z.infer<typeof userCreateSchema>
  ): Promise<UserDTO> {
    requireScope(actor, "admin.users.write");

    const email = input.email.toLowerCase();
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (existing) throw AppError.conflict("That email is already registered");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const [user] = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: input.name ?? null,
        role: input.role,
      })
      .returning();

    const storeIds = input.storeIds ?? [];
    for (const storeId of storeIds) {
      await this.storeService.assignUser(user.id, storeId);
    }

    return toUserDTO(user, storeIds);
  }

  async setStores(
    actor: Actor,
    userId: string,
    input: z.infer<typeof userStoresSchema>
  ): Promise<UserDTO> {
    requireScope(actor, "admin.users.write");

    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw AppError.notFound("User not found");

    await this.storeService.clearAssignments(userId);
    for (const storeId of input.storeIds) {
      await this.storeService.assignUser(userId, storeId);
    }

    return toUserDTO(user, input.storeIds);
  }

  /** Dev-only account list behind the quick-login dropdown. */
  async listForDevLogin(): Promise<UserDTO[]> {
    const all = await this.db.select().from(users).orderBy(users.email);
    return all.map((u) => toUserDTO(u, []));
  }
}
