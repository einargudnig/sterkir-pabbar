# Deployment and environments

**Status:** live as of 2026-09-16

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
project. It injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` automatically.

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

It is bundled via `resolve.noExternal` in `innri/vite.config.ts`. **Not `ssr.noExternal`**: the
Vercel preset builds its own server environment (`ssrBundle_nodejs_…`) and top-level `ssr.*`
only configures the default one — which is also why the `@clerk/react-router` entry there has
never taken effect (Clerk loads fine as an external, so it was left as is).

After adding any dependency that renders on the server, check the bundle actually loads:

```bash
cd innri/build/server/nodejs_*/ && node -e "import('./index.js')"
# "DATABASE_URL is not set" means every import resolved. Anything else is the bug.
```

## Environment variables

Never committed. `innri/.env.local` is gitignored; `vercel env pull` refreshes it.

| Variable                                                                                     | Where it comes from                                             | Which projects                                                 |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PG*`, `POSTGRES_*`                                 | Neon integration, injected                                      | innri                                                          |
| `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`                                             | `clerk init`                                                    | innri                                                          |
| `VITE_CLERK_SIGN_IN_URL`, `VITE_CLERK_SIGN_UP_URL`, and their `_FALLBACK_REDIRECT_URL` pairs | `clerk init`                                                    | innri                                                          |
| `APP_URL`                                                                                    | set by hand — `https://app.sterkirpabbar.is`, no trailing slash | innri                                                          |
| `SANITY_READ_TOKEN`                                                                          | Sanity manage, **Viewer** permission                            | **both** — landing page reads it at build time, app at runtime |
| `SANITY_PROJECT_ID`, `SANITY_DATASET`                                                        | root `.env`                                                     | landing page                                                   |
| `REPEAT_API_KEY`                                                                             | Repeat → API og vefkrókar, **Læst efni** (full) tier            | innri                                                          |
| `REPEAT_SHOP_UUID`, `REPEAT_PRODUCT_UUID`                                                    | Repeat dashboard URLs — the shop, and the one subscription      | innri                                                          |
| `REPEAT_WEBHOOK_SECRET`                                                                      | generate: `openssl rand -hex 32`; same value in Repeat's header | innri                                                          |
| `CRON_SECRET`                                                                                | generate: `openssl rand -hex 32`; Vercel sends it to the cron   | innri                                                          |

Everything the server needs is declared in `innri/app/lib/env.server.ts` and parsed at the
boundary. Nothing reads `process.env` directly except the database client and that schema.

**The five Repeat/cron keys are required.** Until they are set, every request fails at the env
boundary — locally too. Set them in all three Vercel environments before merging phase 6.

## Repeat dashboard setup

1. **Stillingar → domains:** add `app.sterkirpabbar.is` (and `localhost:5173` for dev). The card
   widget only renders on listed domains. Preview deploys are behind Vercel SSO anyway.
2. **Straumur, test mode on** until go-live. Test card 4917610000000000, 03/30, CVC 737.
3. **API og vefkrókar → webhooks:** for each of `subscription_created`,
   `subscription_deactivated`, `cancellation_requested`, `cancellation_revoked`,
   `next_date_changed`, `subscription_transaction_created` and `payment_attempted`, set the URL
   to `https://app.sterkirpabbar.is/api/repeat/webhook` and add a custom header
   `x-webhook-secret: <REPEAT_WEBHOOK_SECRET>`. Use the test-fire button on one; it should show
   200 in the delivery log.
4. **The product** and **failure rules** — the defaults are in `payments-iceland.md`.

The nightly reconciliation runs from `innri/vercel.json` at 05:00 UTC, after Repeat's own
nightly billing job. A cron on the Hobby plan runs at most once a day, which is all it needs.

## Open risks

**The Sanity dataset is public, and stays that way — decided 2026-09-16.**

Private datasets require Sanity's Growth plan ($15/user/month); the free tier is public-only,
permanently. We are staying free.

What that exposes to anyone who knows the project id (discoverable from the Studio URL):
exercise names, sets, reps, cues, article text, and video URLs.

**Why we are not paying to close it.** The differentiated asset is Aron on video, and a
private dataset would not have protected it — any paying member can read the video URL out of
the page and share it. That is a far likelier leak than someone reverse-engineering a project
id. Paying Sanity would buy protection against the low-value threat (plan text, which is
largely commodity) while leaving the real asset exposed to the likely one.

**Where the money should go instead**, before any public launch: a video host that enforces
access.

- **Vimeo** domain-level privacy restricts embedding to `sterkirpabbar.is`. Check the account
  for which plan it needs — published sources disagree on whether it is all-plans or
  Standard-and-up.
- **Mux** signed playback tokens expire, so a shared link dies. Strongest option, pay-as-you-go,
  already named in `inner-circle.md` as the at-scale choice.

`SANITY_READ_TOKEN` is set in both Vercel projects anyway. It is harmless on a public dataset
and means nothing has to change if the dataset ever does go private.

**Accepted risk:** a competitor could scrape the training plans. Judged low-value and unlikely
against the cost. Aron should be told in one sentence so it is his call too — he may consider
his programming to be the product.

**Clerk is on a development instance.** Dev instances are rate-limited and show development UI.
Must be switched before taking real money.

Getting out of dev mode requires a **custom domain** — Clerk production needs five DNS records
(Frontend API, accounts portal, DKIM/email) and cannot run on `*.vercel.app`. That is why
`app.sterkirpabbar.is` exists now rather than after launch.

Remaining steps, from `clerk deploy status`:

1. `clerk deploy` — interactive, needs a human terminal. Creates the production instance and
   emits the five DNS records.
2. Add those records to the Vercel DNS zone for `sterkirpabbar.is`.
3. Wait for Clerk to verify.
4. Swap `pk_live_` / `sk_live_` into the Vercel env and redeploy.

**Google sign-in breaks on that switch.** Development instances use Clerk's shared OAuth
credentials; production needs our own Google OAuth app with the new callback URL.
`clerk deploy status` reports it separately under `oauth`. Email + password alone is a fine
launch configuration if that is not worth the detour this week.

**Watch the CAA records.** The zone restricts certificate issuance to `pki.goog`,
`sectigo.com` and `letsencrypt.org`. Vercel uses Let'"'"'s Encrypt, which is allowed — the
wildcard `*.sterkirpabbar.is` certificate already covered `app.` with no wait. If Clerk'"'"'s
certificate authority is not on that list, its subdomains will fail to issue. This is the most
likely explanation for the August apex certificate problem.

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
cd innri && bun run db:migrate # apply migrations (uses DATABASE_URL_UNPOOLED)
cd studio && bun run deploy    # publish the Studio
bun run types:sanity           # regenerate content types after a schema change
```
