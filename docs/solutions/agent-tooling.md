# Agent-friendly foundation (Phase 0)

**Status:** approved 2026-09-15 · **Scope:** 10–16h

The goal is not "more linting." It is that an agent working in this repo **cannot invent
things that already have a source of truth**, and **can verify its own work in one command**.

## The strategy

Four of the items below do the same job by different means — closing off the places where an
agent guesses instead of reading:

| Source of truth                              | Enforced by                               |
| -------------------------------------------- | ----------------------------------------- |
| Database columns                             | Drizzle schema-in-TS                      |
| Sanity content shapes                        | `sanity typegen generate`                 |
| Env vars and external payloads               | Zod, parsed not assumed                   |
| Design tokens                                | `@shadcn/lint` against the `@theme` block |
| Type escape hatches (`as`, `unknown`, `any`) | anti-slop oxlint rules                    |

This is stronger than instructions in `CLAUDE.md`, because it is deterministic. A rule an agent
must follow is a suggestion; a type error is a wall.

The single highest-leverage item is the plainest one: **`bun run check`**. An agent that can
verify its own work in one call behaves very differently from one that has to guess whether it
is done.

## Lint stack

```
oxlint 1.83
├── anti-slop          (vendored, tools/oxlint/anti-slop/)  → rejects low-evidence TS
├── @shadcn/lint 0.1.0 (pinned exactly)                     → rejects off-token styling
└── existing config                                          → correctness/suspicious/perf
```

One linter, one config file, one command. Both plugins are oxlint plugins, so they stack.

**anti-slop** — [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop). Rejects
unjustified type assertions, `unknown` leaking through function signatures, Reflect-based
property access, module mocking, and similar escape hatches. Designed to be **vendored into
the repo** rather than installed as a dependency, so the rules are readable and tunable.

**@shadcn/lint** — [`shadcn-ui/lint`](https://github.com/shadcn-ui/lint). Agent-first design
system linter. Catches restyling unstyled components via `className`, raw colors
(`bg-pink-500`), arbitrary values (`p-[13px]`), inline styles and `<style>`, unknown Tailwind
classes, and non-static component classes. Requires **oxlint ≥ 1.80** — the repo was on 1.75,
hence the bump. It is **v0.1.0**, so pin the exact version and expect churn.

### Why the design lint matters here specifically

`src/styles/global.css` already carries a full Tailwind v4 `@theme` block: semantic surfaces
(`--color-base`, `--color-raised`, `--color-sunken`), a text ramp, the bronze accent scale,
`--font-display` / `--font-sans` / `--font-mark`, a fluid type scale, custom easings and
spacing tokens.

`shadcn init` with Base UI ships its own token vocabulary — `--background`, `--foreground`,
`--primary`, `--muted`. An agent building the members' area in a fresh directory will reach for
those, because that is what every shadcn example uses. The app then quietly ends up looking
like default shadcn while the landing page looks like Sterkir pabbar, and nobody notices until
Aron does.

**Therefore:** the `@theme` block is copied verbatim into the app's stylesheet, and
`src/styles/global.css` is marked canonical in a comment. One copied file, one source of truth,
lint enforcing that nothing outside the tokens gets used. No workspace tooling.

## Everything in Phase 0

| Item             | What                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| oxlint           | Bump 1.75 → 1.83 (required by `@shadcn/lint`), re-run against the Astro site |
| anti-slop        | Vendored at `tools/oxlint/anti-slop/`, wired into `oxlint.config.ts`         |
| @shadcn/lint     | Installed pinned at 0.1.0, wired into `oxlint.config.ts`                     |
| oxfmt            | Already present — extend config to cover the app directory                   |
| TypeScript       | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`           |
| Vitest           | Config, setup, coverage thresholds on the five modules that matter           |
| shadcn           | `init` with Base UI (the default since July 2026), `shadcn mcp` registered   |
| Zod              | Env validation, onboarding form parsing, webhook payload parsing             |
| Drizzle          | Schema in TS — DB types flow into the app rather than being hand-written     |
| `sanity typegen` | Wired into the build so content types are generated, never hallucinated      |
| pstack           | Verification-loop skills installed                                           |
| Repo `CLAUDE.md` | Project-specific agent instructions — the repo currently has none            |
| `bun run check`  | oxlint + typecheck + vitest in one command                                   |

## Testing philosophy

Coverage-chasing is explicitly rejected. On a ~120h project a broad unit suite over UI
components buys little and rots fast. Five modules deserve thorough tests because they are the
ones that hurt when wrong — they are listed in `inner-circle.md`. Plus one Playwright smoke
test. That is a small number of tests carrying almost all the risk.

## Deliberately not included

- **ESLint** — oxlint replaces it, 50–100× faster.
- **Prettier** — oxfmt replaces it.
- **Turborepo / workspaces** — three packages built by one person. `studio/` has coexisted
  without them since August. Revisit only if the copied `@theme` block starts drifting.
- **Running `@shadcn/lint` over the Astro site** — worth doing eventually, but expect a
  violation backlog on 2,400 lines written before the rule existed. Its own task, after the
  app ships. Not in the critical path of a paid build.

## Reference

- anti-slop — https://github.com/dmmulroy/anti-slop
- @shadcn/lint — https://github.com/shadcn-ui/lint
- shadcn Base UI default — https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- pstack (Claude Code port) — https://github.com/michael-denyer/pstack-claude

## What phase 0 actually did

`.oxlintrc.json` was replaced by **`oxlint.config.ts`** — anti-slop registers as a local JS
plugin via `jsPlugins`, which the JSON format cannot express.

**The strict rule sets are scoped to `innri/**` by an override.** Turning them on repo-wide
surfaced ~44 pre-existing violations in `src/` and `studio/`, almost all
`require-readable-spacing`. A wall of errors an agent is told to ignore is worse than no wall,
so new code is held to the standard and the backlog stays a deliberate, separate task.

**A second override turns the design rules off inside `innri/app/components/ui/**`.** shadcn's
own `button.tsx` uses arbitrary values like `rounded-[min(var(--radius-md),10px)]` — those
files define the design system rather than consume it. anti-slop stays on there.

**`shadcn/no-raw-colors` allows five classes**: `text-hero`, `text-display`, `text-title`,
`text-subtitle`, `text-lead`. Tailwind shares the `text-` prefix between font size and text
colour, so the `--text-*` size tokens read as undeclared colours. Allowing exactly those five
keeps the raw palette out.

**`shadcn init` had to be repaired.** It shipped a white/neutral-grey palette, and
`--font-sans: 'Geist Variable'` in an `@theme inline` block silently overrode Hanken Grotesk.
`innri/app/app.css` now maps shadcn's semantic names onto brand values instead, with the Geist
import and dependency removed. This is exactly the drift the lint exists to catch — it caught it
on the stock React Router welcome template too.

**pstack: verification skills only.** `create-verification-skill`,
`maintain-verification-skill`, `principle-prove-it-works` and `show-me-your-work` are installed.
`setup-pstack` writes per-role model panels to the **global** `~/.claude/` and is Einar's call,
not a project decision — it is installed but not run.
