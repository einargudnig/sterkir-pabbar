# Sterkir pabbar

Three packages, one repo, no workspace tooling:

| Path      | What                            | Deployed to                       |
| --------- | ------------------------------- | --------------------------------- |
| `src/`    | Astro landing page, static      | `sterkirpabbar.is`                |
| `innri/`  | React Router v8 members' area   | `sterkir-pabbar-innri.vercel.app` |
| `studio/` | Sanity Studio, content for both | `sterkirpabbar.sanity.studio`     |

The members' area is live on `app.sterkirpabbar.is`. The directory and Vercel project are still named `innri` — internal names, deliberately not renamed.
Infrastructure, env vars and deploy gotchas: `docs/solutions/deployment.md`.

Design decisions live in `docs/solutions/`. Read `inner-circle.md` before working on
`innri/`. UI copy is Icelandic; code and comments are English.

## Verify with one command

```bash
bun run check    # oxlint + oxfmt + astro check + innri typecheck + tests + build
```

It fails on lint, type, test **and build** breakage. Run it before saying anything is done —
do not substitute "the diff looks right".

The build step is not optional padding: it is the only thing that catches a **server-only
module referenced by client**. Importing anything from a `*.server.ts` file into a component
typechecks fine and fails the Vercel build. Values that components need live in plain modules
(`app/lib/categories.ts`), not next to the Sanity client.

```bash
bun run types:sanity   # after ANY change to studio/schemas/
```

Deploying the members' area from the CLI runs from the **repo root**, not `innri/` — see
`docs/solutions/deployment.md`. Pushing to GitHub deploys both projects on its own.

## Invariants

**The landing page is revenue. Leave it alone.** `src/` is out of scope until phase 7 of the
inner-circle plan. It is static, SEO-critical and converts cold traffic.

**`src/styles/global.css` is the canonical design system.** `innri/app/app.css` copies its
`@font-face` and `@theme` blocks verbatim and then maps shadcn's semantic tokens
(`--background`, `--primary`, …) onto those brand values. New token? Add it to `global.css`
first, then copy. `@shadcn/lint` rejects any styling that escapes the tokens.

**The members' area is dark-only.** There is no light palette. Never use `dark:` variants.

**Types are generated, never written.** Drizzle for database columns, `sanity typegen` for
content shapes, Zod for anything crossing a trust boundary. If you find yourself hand-writing
a type that mirrors a schema, you are working around the wrong thing.

**Nothing reads `process.env` directly.** Add keys to `serverEnvSchema` in
`innri/app/lib/env.server.ts` and parse at the boundary.

**Do not extend `scripts/fetch-content.mjs`.** That build-time bake serves the marketing site
only. Members' area content is queried from Sanity at request time in loaders, so Aron never
triggers a rebuild to fix a typo.

**Money and access, once phase 6 lands:** a browser redirect never grants access, and neither
does a webhook body. Repeat does not sign its webhooks, so a delivery is only a nudge: the
handler checks a shared-secret header, then re-fetches the subscription from Repeat's API with
the server key and writes _that_ to the mirror. `requireActiveAccess` reads the local Postgres
mirror, never a live Repeat call.

**Three gate levels, defined in `innri/app/lib/auth.server.ts`.** Public is `/sign-in` and
`/sign-up`. Signed-in-only is `/subscribe`, `/onboarding` and `/admin` — they sit outside the
member layout on purpose, because a paywall people cannot reach is not a paywall, so they call
`requireUserId` themselves. Everything under `layouts/member.tsx` is gated by that layout's
loader. A new route under the layout inherits the guard; a new route outside it does not.

**Never reintroduce `resolve.tsconfigPaths` in `innri/vite.config.ts`.** It discovers the repo
root's tsconfig, which extends `astro/tsconfigs/strict` — fine locally, fatal on Vercel where
only `innri/` dependencies install. The `~` alias is declared explicitly for this reason.

## Lint scope

`oxlint.config.ts` runs three rule sets. The strict two apply to `innri/**` only:

- **anti-slop** (vendored, `tools/oxlint/anti-slop/`) — rejects low-evidence TypeScript. Its
  messages tell you what to do instead; follow them rather than reaching for `as`.
- **@shadcn/lint** — rejects off-token styling. Off inside `innri/app/components/ui/**`, which
  _is_ the design system rather than a consumer of it.

`src/` and `studio/` carry a violation backlog from before these rules existed. That cleanup is
deliberately not in the critical path — do not fix it as a side quest.

## Testing

Five modules carry the real risk and deserve thorough tests; they are listed in
`docs/solutions/inner-circle.md`. Repo-wide coverage chasing is explicitly rejected — do not
add component unit tests to raise a number.

## Not here on purpose

ESLint and Prettier (oxlint and oxfmt replace them) · Turborepo or workspaces · a separate API
service — React Router loaders, actions and resource routes are the backend.
