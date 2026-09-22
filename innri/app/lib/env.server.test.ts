import { describe, expect, it } from "vitest";

import { EnvError, parseEnv } from "./env.server";

const valid = {
  NODE_ENV: "production",
  APP_URL: "https://innri.sterkirpabbar.is",
  CLERK_SECRET_KEY: "sk_test_example",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_test_example",
  DATABASE_URL: "postgresql://user:pw@host/db",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_example",
  SANITY_PROJECT_ID: "abc123",
  SANITY_READ_TOKEN: "sk_sanity_example",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("parseEnv", () => {
  it("returns a typed environment when every value is valid", () => {
    const env = parseEnv(valid);

    expect(env.NODE_ENV).toBe("production");
    expect(env.APP_URL).toBe("https://innri.sterkirpabbar.is");
  });

  it("defaults NODE_ENV to development", () => {
    const { NODE_ENV: _omitted, ...withoutNodeEnv } = valid;
    const env = parseEnv(withoutNodeEnv);

    expect(env.NODE_ENV).toBe("development");
  });

  /**
   * The draft cookie's signature is what makes the age gate and the health
   * acknowledgement mean anything, so a short secret has to fail at the
   * boundary rather than produce a cookie anyone can forge.
   */
  it("rejects a SESSION_SECRET too short to sign with", () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(EnvError);
  });

  it("rejects a missing APP_URL", () => {
    expect(() => parseEnv({})).toThrow(EnvError);
  });

  it("rejects an APP_URL that is not absolute", () => {
    expect(() => parseEnv({ ...valid, APP_URL: "innri.sterkirpabbar.is" })).toThrow(EnvError);
  });

  /**
   * The trailing slash matters: Kling's return URLs and Clerk's redirects are
   * built by concatenation, so `https://host//subscribe` would 404 in production
   * only — never in dev, where the origin is typed by hand.
   */
  it("rejects a trailing slash on APP_URL", () => {
    expect(() => parseEnv({ ...valid, APP_URL: "https://innri.sterkirpabbar.is/" })).toThrow(
      EnvError,
    );
  });

  it("rejects a Clerk secret key that is really a publishable key", () => {
    expect(() => parseEnv({ ...valid, CLERK_SECRET_KEY: "pk_test_oops" })).toThrow(EnvError);
  });

  it("rejects a webhook secret that is not a signing secret", () => {
    expect(() => parseEnv({ ...valid, CLERK_WEBHOOK_SIGNING_SECRET: "sk_live_wrong" })).toThrow(
      EnvError,
    );
  });

  it("reports every problem at once rather than the first", () => {
    try {
      parseEnv({ ...valid, NODE_ENV: "staging", APP_URL: "not-a-url" });

      expect.unreachable("parseEnv should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);

      if (error instanceof EnvError) {
        expect(error.missing).toContain("NODE_ENV");
        expect(error.missing).toContain("APP_URL");
      }
    }
  });
});
