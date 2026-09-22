import { describe, expect, it } from "vitest";

import { bearerToken, secretMatches } from "./secret.server";

const secret = "fedcba9876543210fedcba9876543210";

describe("secretMatches", () => {
  it("accepts the configured secret", () => {
    expect(secretMatches(secret, secret)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(secretMatches(null, secret)).toBe(false);
  });

  it("rejects an empty header", () => {
    expect(secretMatches("", secret)).toBe(false);
  });

  it("rejects a wrong secret of the same length", () => {
    expect(secretMatches("0123456789abcdef0123456789abcdef", secret)).toBe(false);
  });

  /** A length mismatch must not throw out of timingSafeEqual. */
  it("rejects a prefix of the secret", () => {
    expect(secretMatches(secret.slice(0, 10), secret)).toBe(false);
  });

  /** An unset expected value must never match an empty presented one. */
  it("rejects everything when no secret is configured", () => {
    expect(secretMatches("", "")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("reads the token from a Bearer header", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
  });

  it.each([null, "", "abc123", "Basic abc123", "Bearer "])("returns null for %j", (header) => {
    expect(bearerToken(header)).toBeNull();
  });
});
