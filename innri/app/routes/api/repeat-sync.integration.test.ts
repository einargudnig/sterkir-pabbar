import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { createMember, reload, resetDatabase } from "../../../test/db";
import { installFakeRepeat } from "../../../test/fake-repeat";
import { serverEnv } from "~/lib/env.server";

import { loader } from "./repeat-sync";

const CRON_URL = "https://app.test/api/cron/repeat-sync";

const cron = (authorization: string | null) =>
  loader({
    request: new Request(CRON_URL, { headers: authorization === null ? {} : { authorization } }),
    url: new URL(CRON_URL),
    pattern: "/api/cron/repeat-sync",
    params: {},
    context: new RouterContextProvider(),
  });

let repeat: ReturnType<typeof installFakeRepeat>;

beforeEach(async () => {
  await resetDatabase();

  repeat = installFakeRepeat();
});

describe("the nightly sync endpoint", () => {
  it("refuses to sweep without Vercel's cron bearer token", async () => {
    await createMember({ repeatSubscriptionId: "sub-1" });

    const missing = await cron(null);
    const wrong = await cron("Bearer not-the-secret");
    const bare = await cron(serverEnv().CRON_SECRET);

    expect([missing.status, wrong.status, bare.status]).toEqual([401, 401, 401]);
    expect(repeat.requests).toEqual([]);
  });

  it("sweeps and reports what it did", async () => {
    const member = await createMember({
      repeatSubscriptionId: "sub-1",
      subscriptionStatus: "active",
    });

    repeat.setSubscription({ uuid: "sub-1", active: false });

    const response = await cron(`Bearer ${serverEnv().CRON_SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checked: 1, applied: 1, failed: [] });
    expect((await reload(member.id)).subscriptionStatus).toBe("canceled");
  });

  it("answers 500 when any subscription failed, so the cron run shows red", async () => {
    await createMember({ repeatSubscriptionId: "sub-1" });

    repeat.failLookup("sub-1");

    const response = await cron(`Bearer ${serverEnv().CRON_SECRET}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ checked: 1, applied: 0, failed: ["sub-1"] });
  });
});
