import { beforeEach, describe, expect, it } from "vitest";

import { createMember, resetDatabase } from "../../test/db";
import { db } from "~/db";
import { assistantUsage } from "~/db/schema";

import { messagesToday, recordUsage } from "./assistant.server";

/**
 * The daily limit is the only hard stop on what the assistant costs, so the
 * count it rests on is tested against real rows: which day, whose rows, and
 * whether a failed call still uses up a message.
 */

const now = new Date("2026-10-15T12:00:00Z");

const used = (userId: string, createdAt: Date, outcome: "answered" | "failed" = "answered") =>
  db.insert(assistantUsage).values({ userId, model: "test/model", outcome, createdAt });

beforeEach(async () => {
  await resetDatabase();
});

describe("messagesToday", () => {
  it("counts from midnight Icelandic time, which is UTC midnight", async () => {
    const member = await createMember();

    await used(member.id, new Date("2026-10-14T23:59:59Z"));
    await used(member.id, new Date("2026-10-15T00:00:00Z"));
    await used(member.id, new Date("2026-10-15T11:00:00Z"));

    expect(await messagesToday(member.id, now)).toBe(2);
  });

  it("counts only the member's own messages", async () => {
    const member = await createMember();
    const other = await createMember();

    await used(other.id, new Date("2026-10-15T10:00:00Z"));

    expect(await messagesToday(member.id, now)).toBe(0);
  });

  it("counts a failed call, so an outage does not hand out unlimited retries", async () => {
    const member = await createMember();

    await used(member.id, new Date("2026-10-15T10:00:00Z"), "failed");

    expect(await messagesToday(member.id, now)).toBe(1);
  });
});

describe("recordUsage", () => {
  it("stores cost and outcome, with no column for the conversation", async () => {
    const member = await createMember();

    await recordUsage({
      userId: member.id,
      model: "openai/gpt-6-sol",
      outcome: "answered",
      inputTokens: 4200,
      outputTokens: 180,
      durationMs: 2100,
    });

    const [row] = await db.select().from(assistantUsage);

    expect(row).toMatchObject({ inputTokens: 4200, outputTokens: 180, outcome: "answered" });
    expect(Object.keys(row ?? {}).sort()).toEqual(
      [
        "createdAt",
        "durationMs",
        "id",
        "inputTokens",
        "model",
        "outcome",
        "outputTokens",
        "userId",
      ].sort(),
    );
  });
});
