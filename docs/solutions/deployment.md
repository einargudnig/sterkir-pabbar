# Deployment and environments

**Status:** live as of 2026-09-16 · members' area v1 launched 2026-10-02

## What is deployed where

| Project                      | Vercel project         | Root dir | URL                                 |
| ---------------------------- | ---------------------- | -------- | ----------------------------------- |
| Landing page (Astro)         | `sterkir-pabbar`       | `.`      | https://sterkirpabbar.is            |
| Members' area (React Router) | `sterkir-pabbar-innri` | `innri`  | https://app.sterkirpabbar.is        |
| Sanity Studio                | — (Sanity-hosted)      | `studio` | https://sterkirpabbar.sanity.studio |

Both Vercel projects live under the **`einargudni`** scope, not `maul`. The work team also
appears in `vercel teams ls` and is sometimes the active scope — pass `--scope einargudni`
explicitly rather than relying on whichever is current.

Database: **Neon**, provisioned through the Vercel marketplace integration on the `innri`
project. It injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` into **Production
only**. Preview, Development and local dev run against a separate Neon branch — see
[Databases](#databases).

## Three things that broke, and will again

**1. `resolve.tsconfigPaths` picks up the repo root's tsconfig.**

The root `tsconfig.json` extends `astro/tsconfigs/strict`. That resolves locally because the
root `node_modules` has Astro — but the `innri` project's root directory is `innri/`, so only
its dependencies install and the build dies with `Tsconfig not found astro/tsconfigs/strict`.

Fixed by declaring the `~` alias explicitly in `innri/vite.config.ts` instead of discovering
it. **Do not reintroduce `resolve.tsconfigPaths` in this repo.** It is the archetypal
locally-green, remotely-red failure.

**2. CLI deploys must run from the repo root, not from `innri/`.**

`vercel deploy` uploads the working directory, then the project's `rootDirectory: innri`
applies on top — so deploying from `innri/` makes Vercel look for `innri/innri`. The setting
has to stay for GitHub-triggered deploys, so CLI deploys pass the project through instead:

```bash
cd /path/to/sterkir-pabbar
VERCEL_ORG_ID=team_psapSlkaGMMGCr5CMg3XzbK8 \
VERCEL_PROJECT_ID=prj_BQ7kwV8jrPJoJksHMPXS9KCmWlCn \
vercel deploy --prod --yes --scope einargudni
```

**3. `*.server.ts` imported by a component fails only at build time.**

Typecheck and tests both pass; the Vercel build fails with `Server-only module referenced by
client`. `bun run check` now runs `bun run build` for exactly this reason. Anything a component
needs goes in a plain module — see `app/lib/categories.ts`, which exists because the category
labels sat next to the Sanity client and took the token's module into the browser bundle.

**4. A wildcard-resolved subdomain breaks the moment you add a child record under it.**

`app.sterkirpabbar.is` resolved only via the zone's `*` ALIAS — there was no explicit record
for it. Adding Clerk's five CNAMEs at `clerk.app`, `accounts.app`, `clkmail.app` and the two
`_domainkey.app` names created `app.sterkirpabbar.is` as an **empty non-terminal** node, and
per RFC 4592 a wildcard does not match a name that exists as a node in the zone. The subdomain
stopped resolving and the app went dark, with no error anywhere and nothing wrong in Vercel.

Fixed by adding the explicit record the wildcard had been standing in for:

```bash
vercel dns add sterkirpabbar.is app CNAME cname.vercel-dns-016.com. --scope einargudni
```

**Before adding any record under a subdomain, check the subdomain itself has an explicit
record.** `dig +short <name> @ns1.vercel-dns.com` against the authoritative nameserver — local
resolvers cache the negative answer afterwards and will lie to you for a while.

**5. Deployment-specific URLs are SSO-protected; the production alias is not.**

`https://sterkir-pabbar-innri-<hash>-einargudni.vercel.app` bounces to a Vercel login.
`https://app.sterkirpabbar.is` does not. Send Aron the custom domain — a deployment URL looks
broken to anyone without Vercel access.

**6. A dependency Node cannot load passes the whole of `bun run check`.**

`@teamrepeat/card-token` is ESM with extensionless relative imports (`./useCardToken`). Vite
resolves those; Node's ESM loader does not. Left external, the server bundle's top-level
import throws at boot — every route down, not only the one that uses it. Typecheck, tests and
the build were all green.

The fix was bundling it via `resolve.noExternal` in `innri/vite.config.ts` (the package went
with Repeat on 2026-09-29). **Not `ssr.noExternal`**: the Vercel preset builds its own server
environment (`ssrBundle_nodejs_…`) and top-level `ssr.*` only configures the default one —
which is also why the `@clerk/react-router` entry there has never taken effect (Clerk loads
fine as an external, so it was left as is).

After adding any dependency that renders on the server, check the bundle actually loads:

```bash
cd innri/build/server/nodejs_*/ && node -e "import('./index.js')"
# "DATABASE_URL is not set" means every import resolved. Anything else is the bug.
```

## Environment variables

Never committed. `innri/.env.local` is gitignored; `vercel env pull` refreshes it.

| Variable                                                                                     | Where it comes from                                             | Which projects                                                 |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PG*`, `POSTGRES_*`                                 | Neon integration, Production only; Preview/Development by hand  | innri                                                          |
| `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`                                             | `clerk init`                                                    | innri                                                          |
| `VITE_CLERK_SIGN_IN_URL`, `VITE_CLERK_SIGN_UP_URL`, and their `_FALLBACK_REDIRECT_URL` pairs | `clerk init`                                                    | innri                                                          |
| `SESSION_SECRET`                                                                             | set by hand, 32+ characters; signs the questionnaire cookie     | innri                                                          |
| `APP_URL`                                                                                    | set by hand — `https://app.sterkirpabbar.is`, no trailing slash | innri                                                          |
| `SANITY_READ_TOKEN`                                                                          | Sanity manage, **Viewer** permission                            | **both** — landing page reads it at build time, app at runtime |
| `SANITY_PROJECT_ID`, `SANITY_DATASET`                                                        | root `.env`                                                     | landing page                                                   |

Everything the server needs is declared in `innri/app/lib/env.server.ts` and parsed at the
boundary. Nothing reads `process.env` directly except the database client and that schema.

**AI assistant.** `ASSISTANT_ENABLED` is the kill switch. It is off unless set to `true`,
and off also hides the bubble. `ASSISTANT_MODEL` defaults to `openai/gpt-6-sol`, and
`ASSISTANT_DAILY_LIMIT` to 30.

- **Gateway auth needs no variable on Vercel:** the AI SDK uses the deployment's OIDC
  token. Locally that token expires after about 12 hours. Pull a fresh one, or set
  `AI_GATEWAY_API_KEY`.
- **Free Gateway credits refuse OpenAI models** with a 403, "Free tier users do not have
  access to this model". The team needs paid credits, or a bring-your-own OpenAI key in the
  Gateway settings. The key also decides who is billed.

**`innri/.env.local` points at the production database.** The dev server is not affected:
it reads `.env.development.local`, which wins in development. Bun and drizzle-kit can still
pick up `.env.local`, so pass `DATABASE_URL_UNPOOLED` explicitly for any migration.

## Databases

Three, and it matters which one a command reaches:

| Database                 | Host                     | Used by                                          |
| ------------------------ | ------------------------ | ------------------------------------------------ |
| Neon branch `main`       | `ep-green-pond-…`        | Production deploys only                          |
| Neon branch `dev`        | `ep-jolly-sky-…`         | Preview deploys, `bun run dev`, dev migrations   |
| Throwaway local Postgres | `127.0.0.1`, random port | integration tests, created and deleted every run |

Neon project `crimson-math-82418529`. `dev` (`br-solitary-boat-aw2u514u`) was branched from
`main` on 2026-09-23, data included.

**Preview never touches production — since 2026-09-30.** Until then the Neon integration fed
one `DATABASE_URL` to all three Vercel environments, while Preview used Clerk's **dev**
instance: signing in to a preview with a test account wrote rows to the production database
for Clerk users that production's Clerk has never heard of. Now the integration is connected
to Production only (Vercel → Storage → `neon-erin-island` → the project's connection), and
Preview and Development hold the `dev` branch's two strings, added by hand. The pairing is
the point: dev Clerk with the dev database, live Clerk with production. If the integration is
ever reconnected, check it did not grab Preview back: `vercel env ls | rg DATABASE_URL`.

**How `dev` is selected locally.** `innri/.env.development.local` holds the branch's two connection
strings. The React Router Vite plugin loads env files with Vite's `loadEnv`, where that file
outranks `.env.local`, and `vercel env pull` rewrites only `.env.local`, so the override
survives a pull. Two ways it silently stops working:

- A `DATABASE_URL` exported in your shell beats every env file. `env | rg DATABASE_URL`
  should print nothing.
- drizzle-kit reads neither file. It only loads a plain `.env`, which this project does not
  have — hence the explicit commands below.

**Migrations**, after `bun run db:generate`:

```bash
cd innri
bun --env-file=.env.development.local run db:migrate      # dev branch
DATABASE_URL_UNPOOLED="$(npx neonctl connection-string main --project-id crimson-math-82418529)" \
  bun run db:migrate                                      # production, asked of Neon by name
```

Plain `bun run db:migrate` gets an empty URL and fails, which is the point: nothing reaches
production without saying so. `.env.local` no longer holds production's URL — `vercel env
pull` fills it from Development, which is the `dev` branch — so production's string comes from
Neon, named `main`, at the moment of use.

**Additive migrations by default** (new tables, new nullable columns, new enum values). A drop
or rename on production is its own deliberate change, never a side effect. Order, every time:

1. `bun run db:generate` and read the SQL it wrote.
2. Migrate `dev`, then run the app against it and check the change works.
3. Snapshot production: `npx neonctl branches create --project-id crimson-math-82418529
--parent main --name pre-<migration>` — an instant copy to restore from.
4. Migrate production, then check the `drizzle.__drizzle_migrations` row count went up by one.
5. Delete the snapshot branch once the deploy that needs it is live and healthy.

**Resetting `dev`** to production's current state: `npx neonctl branches reset dev --parent
--project-id crimson-math-82418529` (needs `npx neonctl auth` once).

**Tests** never touch Neon. `innri/test/postgres.ts` starts a fresh Postgres, preferring
Homebrew's `postgresql@18` to match Neon's major version, and `test/integration-env.ts`
refuses any host that is not localhost.

## Open risks

**The Sanity dataset is public** — decided 2026-09-16, reasoning in `docs/decisions.md`.
Anyone with the project id (visible in the Studio URL) can read exercise names, sets, reps,
cues, article text, and video URLs. If the videos need protecting, the money goes to the video
host, not Sanity:

- **Vimeo** domain-level privacy restricts embedding to our domains. Check which plan it needs.
- **Mux** signed playback tokens expire, so a shared link dies. Strongest, pay-as-you-go.

`SANITY_READ_TOKEN` is set in both Vercel projects anyway: harmless on a public dataset, and
nothing changes if the dataset ever goes private.

**Watch the CAA records.** The zone restricts certificate issuance to `pki.goog`,
`sectigo.com` and `letsencrypt.org`. Any new service that issues its own certificate under
`sterkirpabbar.is` needs its authority on that list, or issuance fails.

**Vercel's bun cannot parse `bun.lock`** (`Unknown lockfile version`) and falls back. Builds
succeed, so this is noted rather than fixed.

## When port 5432 is blocked

Some networks (Einar's included, intermittently) drop outbound TCP 5432, so `psql`, Drizzle
Studio and anything using the `postgres` driver hang with `CONNECT_TIMEOUT`. HTTPS to the same
Neon host works fine, so it is a firewall rather than Neon.

Neon exposes SQL over HTTPS on the same host, which gets through:

```bash
curl -s "https://$NEON_HOST/sql" \
  -H "Content-Type: application/json" \
  -H "Neon-Connection-String: $DATABASE_URL" \
  -d '{"query":"select count(*) from users","params":[]}'
```

Diagnose the difference before assuming the database is down:
`nc -z -w8 $NEON_HOST 5432` versus `curl -o /dev/null -w '%{http_code}' https://$NEON_HOST`.
A hang on the first with a response on the second is this, not an outage.

## Commands

```bash
bun run check                  # lint + format + astro check + typecheck + tests + build
cd innri && bun --env-file=.env.development.local run db:migrate # apply migrations to the dev branch — production: see Databases
cd studio && bun run deploy    # publish the Studio
bun run types:sanity           # regenerate content types after a schema change
```
