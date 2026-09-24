import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The brand palette has a colour named `base` — the page background — so
 * Tailwind compiles a bare `text-base` to `color: var(--color-base)` instead of
 * the 16px size shadcn means by it. Text written with it is invisible on every
 * page. It shipped once in the input fields: members typed into boxes that
 * showed nothing. Use `text-(length:--text-base)` for the size.
 */

const APP_DIR = join(import.meta.dirname, "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return path.endsWith(".tsx") ? [path] : [];
  });

const BARE_TEXT_BASE = /(?<![\w:/-])text-base(?![\w.-])/u;

describe("text-base", () => {
  it("is never used bare, because it renders text in the background colour", () => {
    const offenders = sourceFiles(APP_DIR).filter((file) =>
      BARE_TEXT_BASE.test(readFileSync(file, "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});
