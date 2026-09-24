import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { db } from "~/db";
import { users } from "~/db/schema";

/** Empties every table. `users` cascades to everything that references it. */
export const resetDatabase = async () => {
  await db.execute(sql`truncate table users, repeat_events cascade`);
};

type MemberFields = Omit<typeof users.$inferInsert, "clerkUserId">;

export const createMember = async (fields: MemberFields = {}) => {
  const [row] = await db
    .insert(users)
    .values({ clerkUserId: `user_${randomUUID()}`, ...fields })
    .returning();

  if (!row) {
    throw new Error("Member insert returned no row.");
  }

  return row;
};

/** The member as the database holds them now, not as the test last saw them. */
export const reload = async (id: string) => {
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });

  if (!row) {
    throw new Error(`Member ${id} is gone.`);
  }

  return row;
};
