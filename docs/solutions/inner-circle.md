# Innri hringurinn — paid members' area

**Status:** approved 2026-09-15 · **Owner:** Einar · **Client:** Aron

A paid subscription members' area at `app.sterkirpabbar.is`. New members answer a
health-screened questionnaire, receive stored macro targets and a pre-built training plan
matched to their goal and chosen frequency, and get a dashboard with their plan, their
macros, and Aron's tips library.

Commissioned by Aron on 2026-09-14. This is **paid work** — billed through Gigover at
8,000 ISK/hr. That reverses the constraint that drove earlier decisions on this repo.

## Scope

**Building:** everything in Phases below.

**Explicitly not building:**

- The AI assistant (_"Sterkir pabbar gervigreindin"_) — deferred to a separate phase, priced
  separately, and gated on the legal question below.
- Mux — videos go to unlisted Vimeo/YouTube for v1.
- A separate API service — React Router loaders/actions are the backend.
- Monorepo tooling — sibling directories, as `studio/` already is.
- ESLint, Prettier — oxlint and oxfmt replace them.
- A component-level unit test suite or coverage gates on UI code.
- Any change to the Astro landing page beyond the sales section in Phase 7.

## Shape

```
sterkirpabbar.is        Astro, static, marketing + sales section  (unchanged)
app.sterkirpabbar.is    React Router v8 app on Vercel  (innri/)   (new)
studio/                 Sanity Studio, content for both
```

```
                    sterkirpabbar.is  (Astro, static)
                                  │
                                  ▼
               app.sterkirpabbar.is   (React Router v8, Vercel)
                    │           │            │
          ┌─────────┘           │            └──────────┐
          ▼                     ▼                       ▼
       Clerk                Postgres                 Sanity
    (identity)         (subscription mirror,     (plans, exercises,
                        answers, macros)          articles, copy)
                            ▲
                            │ webhook = nudge only (unsigned, secret header)
                            │ → re-fetch GET /subscriptions/{uuid}/
                         Repeat  (repeat.is/api/v1 — /orders/, /subscriptions/)
```

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| App        | React Router v8 (framework mode), Vercel, in `innri/`         |
| Hosting    | Two Vercel projects — see `docs/solutions/deployment.md`      |
| Auth       | Clerk (`@clerk/react-router`) — email + password, plus Google |
| Database   | Neon Postgres + Drizzle                                       |
| Content    | Sanity, queried server-side in loaders                        |
| Payments   | Repeat (`repeat.is`) — real recurring subscriptions           |
| Email      | Resend — **held**, see Open questions                         |
| Components | shadcn/ui on Base UI (the default since July 2026)            |
| Validation | Zod — env vars, form parsing, webhook payloads                |

## Key decisions

1. **The Astro landing page stays.** It is static, SEO-critical, converts cold traffic, and
   Aron already edits it through the Studio. The members' area is stateful and app-shaped.
   Splitting them keeps each on the right runtime and keeps the revenue page out of harm's way.

2. **Subdomain, not a path rewrite.** Preview deploys work normally — which matters most on
   the payment flow — and Clerk behind a proxy with a basename is a known time sink.

3. **No separate API service.** Loaders and actions are server code; resource routes cover
   webhooks and cron. A second service would add CORS, service-to-service auth, a network
   hop and duplicated types, for no benefit at one client and one developer.

4. **Repeat for payments, real subscriptions — not a 30-day pass.** Stripe does not support
   Iceland (verified on stripe.com/global). Rapyd's hosted page would have meant building the
   billing state machine by hand (~30–40h). Repeat runs the recurring billing, daily retries,
   failure rules, cancellation policy and customer emails, on top of whichever Icelandic
   acquirer Aron signs with. Replaced Kling on 2026-09-22. See
   `docs/solutions/payments-iceland.md`.

5. **Subscription state is mirrored into Postgres, fetched — never pushed.** Webhooks and a
   reconciliation cron both trigger a server-side `GET` of the subscription from Repeat, and
   only that response is written. `requireActiveAccess` reads only the local mirror, never a
   live Repeat call. Keeps access fast, keeps it working through a Repeat outage, and means we
   own the customer list rather than renting it.

6. **Macros are stored as a snapshot, not recomputed on read.** If the formula changes later,
   existing members' numbers must not silently shift under them — and there needs to be an
   audit trail if someone disputes their targets.

7. **Questionnaire frequency options are driven by which plans exist in Sanity.** Aron controls
   launch scope by publishing. He can launch with 2 plans instead of 10, and the app never
   shows an option that leads nowhere. This is the mitigation for the biggest risk below.

8. **Types are generated from their sources, never written.** Drizzle for DB, `sanity typegen`
   for content, Zod for anything crossing a trust boundary. Agent-authored code cannot drift
   from the schema if the schema is the only place the types come from.

## Routes

Paths and filenames are English; every word a member reads on the page is Icelandic.

```
/                     redirect: signed out → /sign-in
                                no subscription → /subscribe
                                onboarding incomplete → /onboarding
                                else → /dashboard
/sign-in              Clerk sign-in
/sign-up              Clerk sign-up
/subscribe            subscription state + Repeat card widget → order
/onboarding           wizard; step in the URL (?step=health|measurements|goal|frequency)
/dashboard            redirects to the first tab
/dashboard/workouts   Mínar æfingar
/dashboard/macros     Mín macros
/articles             Fróðleikur index
/articles/:slug       article
/settings             account, cancel subscription
/admin                Aron — manual grant, comps, fix failed payments

/api/repeat/webhook   secret-header checked, re-fetches from Repeat, updates the mirror
/api/cron/repeat-sync reconciles every mirrored subscription (Repeat never retries a webhook)
/api/clerk/webhook    user created/deleted → sync users table
```

Three gate levels, defined in `innri/app/lib/auth.server.ts`:

| Level            | Routes                                | Enforced by                    |
| ---------------- | ------------------------------------- | ------------------------------ |
| public           | `/sign-in`, `/sign-up`                | —                              |
| signed in        | `/subscribe`, `/onboarding`, `/admin` | `requireUserId` in each loader |
| signed in + paid | everything under `layouts/member.tsx` | the layout loader              |

The middle level exists because those routes must stay reachable to someone who has not paid
yet — that is the point of a paywall — so they sit outside the member layout and guard
themselves. `/dashboard` repeats the check despite being inside the layout: layout and child
loaders run in parallel, so without it the index redirect wins the race and a signed-out
visitor takes two hops to `/sign-in` instead of one.

## Data model

Implemented in `innri/app/db/schema.ts`; migration `drizzle/0000_*.sql` generated offline.

- `users` — `clerk_user_id` unique, plus the Repeat mirror: `subscription_status`
  (`trialing|active|past_due|canceled` — Kling's lifecycle, remapped in phase 6),
  `current_period_end`, `repeat_subscription_id`,
  and `is_admin`. Also `access_granted_until`, kept **separate** from `current_period_end` so a
  later webhook cannot silently wipe a manual grant Aron made.
- `onboarding` — goal, sessions_per_week, weight_kg, height_cm, age, sex, activity_level, and
  the four health flags as explicit boolean columns plus `confirmed_adult`.
- `macro_targets` — kcal, protein_g, carbs_g, fat_g, `formula_version`, and the
  `onboarding_id` the numbers were computed from.
- `plan_assignments` — sanity_plan_id, assigned_at.
- `repeat_events` — `repeat_delivery_id` unique, webhook_type, amount_isk, raw `payload`
  jsonb. An audit log, **not** the idempotency strategy — see Payments switched to Repeat.

Three refinements made while implementing:

1. **`onboarding`, `macro_targets` and `plan_assignments` are append-only.** Changing weight or
   goal writes a new row; the latest is current. Without this, the inputs that produced a past
   target are lost, and "why did the app tell me 1,800 kcal in October" is unanswerable. These
   are health numbers, so it has to be answerable.
2. **`formula_version` on every macro row.** Bumped whenever the formula, deficit or safety
   floor changes, so an old number traces to the rules in force when it was given.
3. **`payments` became `kling_events`, now `repeat_events`.** It logs the whole subscription
   lifecycle, not just payments — a deactivation matters as much as a capture.

`amount_isk` is whole krónur. ISK has no minor unit, so there is no ×100 and no rounding to get
wrong — do not copy the store-money-in-cents habit from Stripe examples.

Activity multipliers: kyrrseta 1.2 · létt virkni 1.375 · miðlungs virkni 1.55 · mikil virkni 1.725.
Each gets a plain-language example — "moderate activity" means nothing to someone who has not
trained in years.

**Open, for Einar, alongside the calorie floor:** `sex` has a third value `annad`, which
Mifflin-St Jeor has no constant for. What the formula does with it is a decision, not a default.

## Sanity — new document types

Implemented in `studio/schemas/`, registered, and extracted — `bun run types:sanity` now emits
16 types into `innri/app/lib/sanity.types.ts`.

- `exercise` — name, muscleGroup, cue (140 chars), videoUrl
- `trainingPlan` — goal, sessionsPerWeek, intro, sessions[] → exercise refs + sets/reps/note
- `article` — title, slug, category, excerpt, portable-text body
- `siteContent` — still to extend with inner-circle sales copy (phase 7)

Two validators guard silent breaks, in the spirit of the existing `validators.ts`:

- **`planCombinationMustBeUnique`** — the app finds a plan by querying one exact
  goal + sessionsPerWeek pair. Two published plans sharing a pair means the query returns both
  and a member could get a plan Aron did not mean, with nothing visibly wrong. Checked against
  published documents only, so two drafts may coexist while he writes.
- **`videoUrlMustBeEmbeddable`** — a Google Drive or Dropbox share URL looks fine in the Studio
  and renders as a broken player for every member. Vimeo and YouTube only.

Queried at request time in loaders. **Do not** extend `scripts/fetch-content.mjs` to these —
that build-time bake stays for the marketing site only, so Aron never triggers a rebuild to
fix a typo.

## Phases

| #   | Phase                                                                              | Hours        |
| --- | ---------------------------------------------------------------------------------- | ------------ |
| 0   | ✅ Agent-friendly foundation — `docs/solutions/agent-tooling.md`                   | 10–16        |
| 1   | ✅ App skeleton — Clerk, Neon, schema, deployed (DNS still pending)                | 10–14        |
| 2   | 🔶 Sanity schemas + Studio deployed + guide updated; app still on placeholder data | 8–12         |
| 3   | Onboarding — health screen, metrics, macro calc, plan assignment                   | 12–18        |
| 4   | Inner circle — Mínar æfingar / Mín macros / Fróðleikur, video embeds               | 20–28        |
| 5   | Admin page — manual grant, comps, ops tooling                                      | 3–4          |
| 6   | 🔶 Repeat — built and unit-tested; not yet run against a Repeat shop               | 12–18        |
| 7   | Landing page sales section + Sanity fields                                         | 6–10         |
| 8   | QA, mobile, handover                                                               | 10–14        |
|     | **Total**                                                                          | **91–135 h** |

At 8,000 ISK/hr: **728,000 – 1,080,000 ISK**. Resend held, AI assistant excluded.

Phases 0–5 are unblocked and fully specified. Phase 6 waits on the Repeat spike.

## Tests that matter

Not coverage — these five carry almost all the risk:

1. **Macro calculation** — property tests on the floors: no input combination may produce a
   target below the safety floor.
2. **Repeat webhook trust** — a missing or wrong secret header is rejected, and a body
   claiming `active: true` for a subscription Repeat's API says is inactive grants nothing.
3. **Webhook idempotency** — the same delivery, and a dashboard replay of it (which arrives
   with a fresh delivery id), must leave the mirror exactly as one delivery would.
4. **`requireActiveAccess`** — across `trialing`/`active`/`past_due`/`canceled` and the exact
   period boundary.
5. **Plan assignment** — including when no published plan exists for the chosen frequency.

Plus **one** Playwright smoke test: signup → subscribe → onboarding → dashboard.

## Risks

**Biggest: Aron does not produce the content.** 10 plans and 40–60 exercise videos, from a
working PT with two children. The product is an empty shell without them, and this is the
likeliest assumption to fail. Mitigated by decision 7 — he can launch with 3×/week only, which
cuts filming load by ~80%.

**Sanity outage breaks the core product** for paying members. Accepted, mitigated by the Sanity
CDN. Escalation if it ever bites: snapshot the assigned plan into Postgres at assignment time,
at the cost of plan updates no longer propagating.

**Repeat does not sign or retry webhooks.** A lost `subscription_deactivated` would leave a
lapsed member with access indefinitely. Mitigated by decision 5: the reconciliation cron
bounds that to one sync interval, and access is never granted from a delivery body.

**Repeat holds the client's recurring revenue.** It is not the acquirer — Aron signs with
Teya or Straumur directly — but the card tokens live with Repeat. Mitigated architecturally by
decision 5; data portability is a spike question.

**Scale is not a risk.** At 10x this is still a few thousand rows and cached CDN reads. The
binding constraint is Aron's filming schedule, not infrastructure.

**Rollback is cheap.** The Astro site is untouched, the app is a separate Vercel project, and
`current_period_end` is one column. The only irreversible part is money actually taken.

## Open questions

| Open                                                                          | Owner             | Blocks                      |
| ----------------------------------------------------------------------------- | ----------------- | --------------------------- |
| Repeat spike — see `payments-iceland.md`                                      | Einar, 2–3h       | Phase 6                     |
| Trial period yes/no                                                           | Aron              | Phase 6                     |
| Monthly price + VSK treatment                                                 | Aron + accountant | Go-live                     |
| Legal position on prescribing macros in Iceland                               | Aron              | Go-live, disclaimer wording |
| Resend — likely unneeded: Repeat sends receipts, dunning, cancellation emails | Einar             | Nothing                     |
| ehf./kennitala — still `TODO(client)` in `src/config/site.ts`                 | Aron              | Go-live                     |
| 40–60 exercise videos                                                         | Aron              | Phase 4 content             |

## Written by Einar, not the agent

The macro calculation in Phase 3. Mifflin-St Jeor and the activity multiplier are mechanical;
the deficit percentage, the surplus, protein per kg, and above all **the hard calorie floor
below which the app refuses to go** are judgment calls with health consequences. They should
reflect what Aron actually believes as a coach.

## Corrections found during phase 0

- **React Router v8, not v7.** `create-react-router` scaffolds v8.4.0. `@clerk/react-router`
  3.6.24 declares `react-router: ^7.9.0 || ^8.3.0`, so the auth plan is unaffected.
- **The package directory is `innri/`, not `app/`.** React Router uses `app/` for its own
  routes, so a package named `app/` would give `app/app/routes/`.
- **Phase 0 came in at the low end.** Tooling, scaffold, brand bridge and the verification loop
  are done; the 10–16h estimate holds with room to spare.

## Progress — 2026-09-16

**Done:** phase 0 in full. Phase 1: Clerk wired with all three gate levels verified against a
running server, Neon provisioned and migrated (5 tables, 4 enums live), app deployed and
reachable at https://sterkir-pabbar-innri.vercel.app. Phase 2: the three Sanity document types
are written, deployed to the Studio, and documented for Aron in `docs/leidbeiningar.md`.

**Not done in phase 2:** the app still reads `innri/app/lib/placeholder.server.ts`. Swapping
the screens onto real GROQ queries is the next task, and it deletes that file.

**Launch target is 1 October**, confirmed by Einar after the scope was questioned. The full
plan below stands; the binding constraint remains Aron's filming, and the guide now tells him
to start with one plan — 3× per week, fat loss, roughly 18 exercises — rather than all ten.

**Sanity stays on the free plan and the dataset stays public** — private datasets need Growth
($15/user/month). The reasoning is in `docs/solutions/deployment.md`: a private dataset would
not have protected the videos, which any member can copy out of the page regardless. The money
belongs at the video host (Vimeo domain privacy or Mux signed URLs) before public launch, not
at the CMS. Accepted risk until then: plan text is scrapeable.

## Phase 2 complete — 2026-09-16

The app reads Sanity. `placeholder.server.ts` is deleted.

- `innri/app/lib/sanity.server.ts` holds the client and four `defineQuery` GROQ queries, all
  typed by `sanity typegen` — `AvailableFrequenciesQueryResult` comes back as
  `Array<1 | 2 | 3 | 4 | 5>`, derived from the schema rather than written by hand.
- `perspective: "published"` is set explicitly. With a token Sanity can return drafts, so
  without it a member would see Aron's half-written plan as he typed it.
- The onboarding wizard renders only frequencies that have a published plan. Verified live: it
  returns `[3]`, because the seed publishes one plan.
- Empty states are real, not defensive: before Aron publishes anything, "Planið þitt er í
  smíðum" is what a paying member should see instead of a blank page.

**Seed data** lives at `studio/seed/inner-circle.ndjson` — 9 exercises, 1 plan, 3 articles,
imported with `sanity dataset import`. The exercises are generic and genuinely useful to keep;
the plan is titled "(sýnidæmi)" and its intro tells Aron to delete it. Macros are still
hardcoded in `dashboard/macros.tsx`, marked for phase 3, because they come from Postgres
rather than Sanity.

## Phase 1 verified end to end — 2026-09-18

Clerk production live on `app.sterkirpabbar.is` serving `pk_live`; dev banner gone. The full
identity chain was confirmed against production rather than inferred:

1. User created in the production Clerk instance via the Backend API
2. `user.created` webhook delivered to `/api/clerk/webhook`
3. Signature verified — unsigned and forged-signature requests both rejected 401
4. Row upserted into Neon with the email attached

Test account: `einar+prufa@maul.is`, user id `user_3JVNS6y9mxztej7oAvyfoY33CKQ`. Delete it
before launch rather than leaving a known-credential account in production.

`requireUser` also creates the row on first authenticated request, so a missed or delayed
webhook cannot leave a paying member without one.

## Phase 3 complete — 2026-09-22

Onboarding writes. `onboarding`, `macro_targets` and `plan_assignments` all get a row, in one
transaction, and the dashboard reads them instead of placeholders.

**The draft lives in a signed cookie, not a draft table.** `onboarding` is documented as one
row per _completed_ run with every column NOT NULL, and a partial answer set has nowhere to go
in it. The alternatives were a nullable mirror table or no resume at all. The cookie keeps the
schema as designed, means no half-answered health data is stored for anyone who opened the
wizard and thought better of it, and still resumes across a closed tab. The accepted cost: a
member who switches device restarts. Four steps, all about their own body, so nothing to look
up. It is signed because it is the only thing asserting the member confirmed being 18 —
unsigned, the age gate is decoration. `SESSION_SECRET` is in all three Vercel environments.

**Any health flag shows an acknowledgement, then proceeds** — Einar's call, taken against the
alternative of withholding macros from anyone with eating-disorder history. The
eating-disorder branch adds a paragraph saying the plan works without looking at the calorie
numbers. `onboarding.acknowledged_health_at` (migration 0001) records _when_ it was accepted:
an acknowledgement nobody stored is not evidence, and without the column the decision is
indistinguishable from ignoring the flags.

**`FORMULA` in `app/lib/macros.ts` holds v1 conservative defaults, not Aron's numbers.**
1.500 kcal floor, 20% deficit, 10% surplus, 1,8 g/kg protein, 25% fat, and `annad` as the
midpoint of the two Mifflin-St Jeor constants. They are grouped in one block with their
reasoning so replacing them is a five-line edit. **Still needs Aron's sign-off before launch**,
and `formula_version` must be bumped when it comes.

A protein ceiling of 40% of calories was added while implementing: 250 kg at 1,8 g/kg is 450 g
of protein, which is 1.800 kcal on its own — above the floor, leaving negative carbohydrate.
`macros.test.ts` sweeps the entire input space and asserts no member can be sent below the
floor, given a negative macro, or shown a split that does not reconcile to their total.

**Validation and persistence are separate modules.** `onboarding-draft.server.ts` holds the Zod
schemas and the step machine and imports no database; `onboarding.server.ts` holds the writes.
The split was forced by a test — `anti-slop/no-module-mocking` rules out faking a connection,
so the only way to test the step machine is for it not to need one.

### Three defects found by driving the real app, not by reading the diff

1. **Unchecked radios were invisible.** `--input` resolves to `line-soft`, which measures
   **1.05:1** against `bg-raised` — WCAG 1.4.11 asks 3:1 for a control boundary. Nobody could
   see the radio until they tapped it. Fixed to `border-bronze-deep` in `input.tsx` and
   `radio-group.tsx`: 4.29:1 on radios, 4.75:1 on text fields.

   **Do not fix this by remapping `--input`.** That was the first attempt and it broke the
   sign-in screen: Clerk's `shadcn` theme reads `--input` as the FILL of its fields while
   shadcn's own components read it as a BORDER, so the email field rendered solid bronze. One
   token, two meanings across the two systems — the fix belongs in the components, where only
   one of them is listening.

2. **`toLocaleString("is-IS")` cannot be used in a component.** Chrome builds ship partial ICU;
   where `is-IS` is missing the call does not throw, it silently returns `en-GB`, so a member
   saw "1,812" where the server rendered "1.812" — wrong for an Icelandic reader _and_ a React
   hydration mismatch. `app/lib/format.ts` does it deterministically. Do not reintroduce
   locale-dependent formatting in rendered output.
3. **Orbitron was setting digits** in the macro shares and in sets × reps, against the rule in
   `.impeccable.md` — it draws a slashed zero, so "30%" reads "3Ø%". Both now use the body font.

`Button` gained a `touch` size (h-11). The other sizes are desktop densities; `default` is 32px,
below the 44px a phone needs for a primary action taken one-handed in the evening.

**Verified end to end against live Neon, live Sanity and a real Clerk session**, not inferred:
age gate blocks, acknowledgement cannot be skipped, five field errors report at once, the
Icelandic decimal comma is accepted, back preserves answers, choosing muscle gain reaches the
"í smíðum" empty state with no dead button, completion writes three rows and clears the cookie,
and every member route redirects an un-onboarded member to the wizard.

**Still open:** Aron's formula numbers; `/settings` still cannot edit measurements, so a member
who changes weight has no way to rewrite it yet (the append-only schema is ready for it).

## Payments switched to Repeat — 2026-09-22

Einar's call: Kling is out, [Repeat](https://repeat.is) is in. Phase 6 has not started, so the
code change was renames only — `kling_events` → `repeat_events`, `kling_subscription_id` →
`repeat_subscription_id` (migration `0002_repeat.sql`, pure `RENAME`s). The provider comparison
and the spike list are in `payments-iceland.md`. What changes in the phase 6 design:

**The webhook is a nudge, not a message.** Repeat does not sign deliveries — its docs say to
authenticate with a custom header you configure per event. So the handler (1) rejects anything
without `REPEAT_WEBHOOK_SECRET` in that header, compared in constant time, (2) logs the delivery,
(3) takes only the subscription uuid from the body and `GET`s `/subscriptions/{uuid}/` with the
server key, and (4) writes that response to the mirror — against the user named by the
_fetched_ record's `external_ref`, or the row that already holds that subscription id, never
by anything in the body. A forged body — even one carrying the right secret — can at most make
us re-read the truth. This is stronger than HMAC, not weaker:
an HMAC'd body is still the provider's claim at send time; the `GET` is its state now.

**Idempotency comes from overwrite, not from dedupe.** Every delivery attempt has its own
`X-Repeat-Delivery-Id`, and a dashboard replay gets a fresh one, so a unique delivery id cannot
stop the same news being applied twice. It does not need to: writing the fetched state is
idempotent by construction.

**A reconciliation cron is required, not optional.** Repeat never retries a failed delivery.
`/api/cron/repeat-sync` (Vercel cron) re-fetches every mirrored subscription. That bounds a lost
`subscription_deactivated` to one sync interval.

**Checkout is headless, on our page.** `@teamrepeat/card-token` renders Repeat's PCI-safe card
iframe (3-D Secure inside it); our action receives only a token and calls `POST /orders/` with
the server key, the Clerk email, and `external_ref` = `users.id`. We create the order, so we
know whose it is — no matching a Repeat customer to a Clerk user by email after the fact. The
mirror is written from the order response before the redirect, so a new member never waits on a
webhook to get in. The hosted checkout (`/repeat_checkout/<shop>/`) is the fallback; its cost is
exactly that email-matching problem. **New dependency — needs Einar's OK.**

**The status enum is Kling's lifecycle and does not fit.** Repeat has `active`, `is_paused`,
`wants_to_cancel`/`resign_date` and deactivation; there is no `past_due` — a subscription stays
active through up to 15 daily retries until one of Aron's failure rules (Reglur) cancels it.
Proposed mapping, decided when phase 6 starts: `active` → active, `is_paused` → a new `paused`
value (no access), inactive → canceled; `trialing` only if Aron wants a trial. A scheduled
cancellation keeps access until `resign_date`, which is what Repeat itself does.

**Cancel from `/settings`** goes through `POST /subscriptions/{uuid}/cancel/` — never
`PATCH active: false`, which Repeat documents as an admin kill switch that skips the notice
period, the commitment and Aron's cancellation statistics. `GET` on the same path previews the
outcome, which is what the confirm dialog should show.

**Repeat also has a gated-content library with HLS video** (`REPEAT_MEDIA`, bearer = an active
subscription uuid). That would answer the video-privacy gap in `deployment.md` without Mux.
Noted, not adopted — content stays in Sanity.

## Phase 6 built — 2026-09-22

Built against Repeat's documented API. **Not yet run against a real Repeat shop** — none exists
yet — so the paths that talk to Repeat are verified by unit tests and by reading the OpenAPI
schema, not by a live order. The rejection paths (401 without the secret or bearer, 400 on a
junk body, signed-out redirects) were driven against a local production build.

- **Paid gate is live in code.** `requireActiveAccess` (in `subscription.server.ts`) guards the
  member layout and the entry redirect. The rule itself is `hasActiveAccess` in
  `app/lib/access.ts`: admin, a live manual grant, or `active` with the lease running. Once
  this merges, **everyone without one of those is sent to `/subscribe`** — including the test
  account.
- **The status enum is now `active | paused | canceled`** (migration `0003`). `current_period_end`
  is a lease: next charge + `GRACE_DAYS`, or the scheduled cancellation date. If sync stops,
  access runs out on its own.
- **Checkout** (`/subscribe`): Repeat's card widget → our action → `POST /orders/` with
  `external_ref = users.id` → the new subscription id written first, then fetched and mirrored.
  The price shown comes from the Repeat product; no price, no widget.
- **Double charges** are guarded three ways: an atomic `checkout_claimed_at` claim (Repeat has
  no idempotency key, and the codebase never holds a transaction across a network call); a
  timeout is reported as "unknown, do not retry" with the claim left to expire; and the paywall
  asks Repeat for active subscriptions under the member's email before showing the form.
- **Webhook** (`/api/repeat/webhook`) and **nightly sweep** (`/api/cron/repeat-sync`) exactly as
  designed above. `shouldApply` stops a re-subscriber's old subscription from overwriting the
  new one.
- **Cancel** in `/settings`: a preview from Repeat's dry-run endpoint, then `POST …/cancel/`.
- **Failure rules:** default chosen — 7 daily retries, then cancel. See `payments-iceland.md`.

**To go live:** create the Repeat shop and product, set the five env vars, apply migrations
`0002` and `0003` to Neon, configure the webhooks (`deployment.md`, "Repeat dashboard setup"),
then run one real order with the test card end to end.

## Testing window before Repeat — 2026-09-24

No Repeat shop exists yet, so every signed-in tester would stop at `/subscribe`. Einar's call:
bypass the paywall so Aron and testers can use sign-up → questionnaire → plan now.

`OPEN_ACCESS_UNTIL` (optional, ISO datetime) lets every signed-in member through until that
instant. It is a **date, not a flag**, so if nobody remembers to unset it, the paywall closes
on its own rather than giving the product away after launch. The check is `isOpenAccess` in
`app/lib/access.ts`, kept apart from `hasActiveAccess` so the rule that launches is untouched;
`canEnter` in `subscription.server.ts` combines the two. To hook Repeat in: unset the variable,
then delete `isOpenAccess` and `canEnter`.

## Questionnaire matches Aron's brief — 2026-09-24

Aron asked for goal, frequency, experience, equipment and limitations. The wizard now asks all
five, in two parts:

1. **Planið þitt** — goal → training (equipment + experience) → frequency → health → acknowledge
2. **Næringin** — measurements, introduced as used only for the macro calculation

**Equipment picks the plan; experience does not.** A plan is now found by goal + equipment +
frequency. Making experience a fourth key would multiply Aron's filming load (2 goals × 3
frequencies × 3 levels × 3 equipment = 54 plans) when the biggest risk is already that he will
not produce 10. Experience is recorded — it is what an AI assistant would adjust a plan by later.
Equipment comes before frequency because frequencies are offered per goal + equipment. With
only one equipment option published, the step states what the plan assumes instead of asking a
one-option question, and submits it as a hidden field.

**Limitations are free text on the health step**, optional, 500 characters, stored in
`onboarding.limitations` for Aron to read. Nothing acts on it; the admin page that would show it
is still inert.

`equipment` and `experience` are **nullable** columns (migration `0004`): rows completed before
the questions existed have no honest answer, and backfilling one would invent it.
`completeOnboarding` refuses any new draft without both.

**Plans without an `equipment` field are gym plans.** Every GROQ query and the Studio's
uniqueness validator use `coalesce(equipment, "raektarstod")`, so the seed plan already in the
dataset keeps working with no content migration.
