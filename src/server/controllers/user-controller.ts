import type { Ctx } from "@/server/context";
import { UserService } from "@/server/services/user-service";
import type { z } from "zod";
import type { userCreateSchema, userStoresSchema } from "@/shared/schemas";

export class UserController {
  private constructor(private ctx: Ctx, private users: UserService) {}

  static make(ctx: Ctx) {
    return new UserController(ctx, UserService.make(ctx));
  }

  private get actor() {
    return this.ctx.var.actor;
  }

  async list() {
    return { users: await this.users.list(this.actor) };
  }

  async create(input: z.infer<typeof userCreateSchema>) {
    return { user: await this.users.create(this.actor, input) };
  }

  async setStores(userId: string, input: z.infer<typeof userStoresSchema>) {
    return { user: await this.users.setStores(this.actor, userId, input) };
  }
}
