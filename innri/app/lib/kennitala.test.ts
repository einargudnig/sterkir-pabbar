import { describe, expect, it } from "vitest";

import { hasValidCheckDigit, normalizeKennitala, parseKennitala } from "./kennitala";

describe("normalizeKennitala", () => {
  it("accepts the hyphenated, spaced and bare forms as the same number", () => {
    expect(normalizeKennitala("010130-2989")).toBe("0101302989");
    expect(normalizeKennitala(" 010130 2989 ")).toBe("0101302989");
    expect(normalizeKennitala("0101302989")).toBe("0101302989");
  });

  it("rejects anything that is not ten digits", () => {
    expect(normalizeKennitala("010130-298")).toBeNull();
    expect(normalizeKennitala("01013029890")).toBeNull();
    expect(normalizeKennitala("01o1302989")).toBeNull();
    expect(normalizeKennitala("")).toBeNull();
  });
});

describe("hasValidCheckDigit", () => {
  it("accepts numbers whose ninth digit matches", () => {
    expect(hasValidCheckDigit("0101302989")).toBe(true);
    expect(hasValidCheckDigit("1203894599")).toBe(true);
    expect(hasValidCheckDigit("2411781299")).toBe(true);
  });

  /** 11 − (sum mod 11) = 11 is written as a check digit of 0. */
  it("accepts a check digit of 0", () => {
    expect(hasValidCheckDigit("0101801209")).toBe(true);
  });

  it("rejects a single mistyped digit", () => {
    expect(hasValidCheckDigit("0101302979")).toBe(false);
    expect(hasValidCheckDigit("0101312989")).toBe(false);
  });

  /** 11 − (sum mod 11) = 10 has no digit, so no ninth digit can be right. */
  it("rejects first eight digits that can have no valid check digit", () => {
    for (let ninth = 0; ninth <= 9; ninth += 1) {
      expect(hasValidCheckDigit(`01018018${ninth}9`)).toBe(false);
    }
  });
});

describe("parseKennitala", () => {
  it("returns the bare digits for a valid personal number", () => {
    expect(parseKennitala("010130-2989")).toEqual({ ok: true, kennitala: "0101302989" });
  });

  it("names the reason, so the member is told what to fix", () => {
    expect(parseKennitala("12345")).toEqual({ ok: false, reason: "format" });
    expect(parseKennitala("010130-2979")).toEqual({ ok: false, reason: "checksum" });
    expect(parseKennitala("460207-0889")).toEqual({ ok: false, reason: "company" });
  });
});
