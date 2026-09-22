import { describe, expect, it } from "vitest";

import { formatDate } from "./format";

describe("formatDate", () => {
  it("writes an Icelandic date", () => {
    expect(formatDate(new Date("2026-10-01T00:00:00Z"))).toBe("1. október 2026");
  });

  /** Iceland is UTC all year; a late-evening instant must not roll forward. */
  it("reads the date in UTC", () => {
    expect(formatDate(new Date("2026-12-31T23:59:59Z"))).toBe("31. desember 2026");
  });
});
