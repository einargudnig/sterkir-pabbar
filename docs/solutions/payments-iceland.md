# Taking card payments from Iceland

**Status:** decided 2026-09-15, revised 2026-09-22 · **Decision:** Repeat (was Kling)

## Stripe is not an option

Stripe does not support Iceland as a merchant country. Verified against
[stripe.com/global](https://stripe.com/global) on 2026-09-15: the supported list covers
Norway, Denmark, Sweden, Finland, Liechtenstein and Gibraltar — **Iceland is the Nordic gap**,
and it is not in the invite-only preview tier either (that is India and Indonesia).

There is no workaround. There is no merchant account to open.

## What was considered

**Rapyd Europe hf.** (the former Valitor) — the domestic incumbent. Its **Web Payments Page**
is a hosted checkout: MerchantID + VerificationCode, redirect carrying a `DigitalSignature`
hash, card data never touching our server. Docs at `specs.valitor.is` and
`valitorpay.github.io`. Viable, and a fallback if Repeat does not work out — Repeat can also sit on top of it.

Two traps if we ever use it: the docs offer MD5 or SHA256 — **use SHA256**; and access must be
granted only on the verified `PaymentSuccessfulServerSideURL` callback, **never** the browser
redirect.

It has no subscription engine. `CreateVirtualCardOnly` gives saved cards, but scheduling,
retries, dunning, cancellation and proration would all be ours to build — roughly 30–40h of
the most bug-prone money-touching code in the project. That is what pushed the original design
toward a 30-day pass instead of a real subscription.

**Teya** (the former Borgun) — the other domestic acquirer. Never evaluated in depth as a
billing engine — it has none — but it is one of the acquirers Repeat runs on, and the likelier
of the two for Aron to sign with.

**Merchant-of-record platforms** (Paddle, Polar) — would handle VSK, but **seller** eligibility
for Iceland could not be confirmed. Their published country lists are _buyer_ lists, which is a
different thing. Fees also run 4–5% against ~1.5%, and payouts would likely land in EUR rather
than ISK — awkward for an Icelandic consumer product priced in krónur. Do not rely on one
without written confirmation of seller eligibility.

## Decision: Repeat

[repeat.is](https://repeat.is) — an Icelandic subscription-commerce platform with a real
billing engine. It replaced Kling on 2026-09-22, Einar's call, before any phase 6 code existed.
Docs are agent-readable: `repeat.is/llms.txt`, per-topic Markdown under `repeat.is/docs/*.md`,
OpenAPI at `repeat.is/api/v1/schema/`.

- **Recurring billing** in a nightly job: monthly/yearly on the signup day or a fixed day
  1–28, failed charges retried daily up to 15 times, and **failure rules** (Reglur) Aron
  configures — e.g. after N failures convert to a bank claim, after M cancel.
- **Cancellation policy** — notice counted in charges, commitment periods, a self-service
  cancel funnel with win-back offers — enforced by Repeat, including through the API.
- **Headless checkout**: `@teamrepeat/card-token` renders a PCI-safe card iframe with 3-D
  Secure inside it; the backend charges with `POST /orders/` and a full-tier key. Hosted sales
  pages and checkout deep links exist too.
- **Customer emails**: order confirmation, cancellation, payment-failure reminders with a
  hosted card-update page. Probably removes the need for Resend in phase 6.
- **Bank claims** (krafa í banka) as a fallback or alternative to card — but not self-serve:
  a signed contract via `repeat@repeat.is`.
- **API keys** come in three tiers (public / read-only / full), sent as `x-api-key`.

**Repeat is not the acquirer.** Aron signs with Teya, Straumur, Rapyd, Valitor, Verifone or
OnPay directly — both Straumur and Teya accept a personal kennitala, so the ehf. is not a
prerequisite. **Test mode** is Straumur's switch in shop settings, with Visa test card
4917610000000000, 03/30, CVC 737, so phase 6 is still not blocked on paperwork.

**Pricing:** per calendar month on paid revenue. Free under 10,001 kr; a 4,080 kr minimum
below 30,000 kr; above that the cheapest of fixed fee + 3.5% / 2% / 1% applies automatically.
Acquirer fees on top, billed by the acquirer. No setup fee. Bank claims, SMS and custom theming
are separate monthly extras.

## What Repeat changes in the design

**Webhooks are not signed and not retried.** The docs recommend a secret custom header per
event and say to treat webhooks as a nudge with the GET API as the source of truth. Each
delivery carries `X-Repeat-Delivery-Id`; a dashboard replay carries a fresh one plus
`X-Repeat-Replay: true`. This is why the handler re-fetches rather than trusts, and why a
reconciliation cron exists — the full reasoning is in `inner-circle.md`, "Payments switched to
Repeat".

**No `past_due` state.** A subscription stays `active` through the retry window until a failure
rule deactivates it. How long a non-paying member keeps access is therefore **Aron's Reglur
setting**, not our code — it needs choosing deliberately, not left at "retry 15 days, never
cancel".

**Default failure rules — chosen 2026-09-22, Aron may change them.** Einar asked for a sane
default rather than an open question:

- **Retries:** `retry_payment_count` = **7** (Repeat's default is 15). One attempt per day.
- **Reglur:** trigger _payment attempt failed_, condition _failed attempts ≥ 7_, action
  **cancel the subscription**.
- **Reminders:** payment-failure email on, at most every **3 days** (default 7), so a member
  hears at least twice inside the window. The email links to Repeat's hosted card-update page.
- **No bank-claim conversion** — claims need a signed contract Aron does not have yet.

So a member whose card stops working keeps access for about a week, gets two or three
reminders, and is then canceled by Repeat. `GRACE_DAYS = 8` in `innri/app/lib/repeat.ts` is
that week plus one day for the nightly sync; **change both together**. A week is the
conventional window for a monthly consumer subscription: long enough to survive an expired
card and a payday, short enough that "free month by not paying" does not work.

**Product settings** that the code assumes:

- One SUBSCRIPTION product, monthly, ISK, VAT 24% (Repeat's default — confirm with the
  accountant). Its uuid is `REPEAT_PRODUCT_UUID`; its price is what `/subscribe` shows.
- **Cancel policy: deactivate just before the next payment**, so a member who cancels keeps what
  they paid for. Cancel notice 0, no commitment period.
- Automation on, base date = the customer's signup day.

**Two traps in the API:**

- `PATCH /subscriptions/{uuid}/` with `active: false` is an admin kill switch — it skips the
  cancel notice, the commitment and the cancellation statistics. A member's cancel goes through
  `POST /subscriptions/{uuid}/cancel/`.
- Card payments' legacy `amount` is ISK ×100. Read `amount_major` (whole krónur).

**The card widget (`@teamrepeat/card-token` 1.1.0) — read before trusting it.** It is one
~50-line component, pinned to an exact version:

- Its `message` listener **does not check `event.origin`**, so any frame could post it a
  token. Harmless for us: the server charges the token through Repeat, and a token that is not
  real simply fails. Worth an upstream report.
- It registers the listener once on mount and keeps the callbacks it was given then.
  `/subscribe` reads the name through a ref for this reason.
- It is not loadable by Node as an external — see `deployment.md`, pitfall 6.

## Kling — chosen 2026-09-15, replaced 2026-09-22

[kling.is](https://kling.is/subscriptions) offered `/v1/subscriptions` with a
`trialing → active → past_due → canceled` lifecycle, HMAC-SHA256 signed webhooks
(`X-Kling-Signature`), and 1.5% on subscriptions. Concerns at the time: no legal entity or
kennitala on their site, and `docs.kling.is` served a Traefik default certificate. The
`subscription_status` enum still carries Kling's four states — remapped when phase 6 starts.

## Consequences

This is why the design uses **real recurring subscriptions rather than a 30-day pass**. The
pass was only ever a workaround for not having a billing engine. Auto-renewal is what makes a
fitness subscription work — people go quiet in week three and come back in week six.

## Architectural mitigation — required regardless

Repeat will be holding the card tokens behind the client's recurring revenue. So:

- Mirror the subscription into our Postgres — fetched from Repeat's API, never from a pushed
  body.
- `requireActiveAccess` reads **only** the local mirror — never a live Repeat call.

That keeps access fast, keeps it working through a Repeat outage, and means we own the customer
list and the access truth rather than renting them.

## Spike checklist — before Phase 6

Build the real flow in Straumur test mode. Ask `hjalp@repeat.is`:

1. **Legal entity and kennitala** — cross-check against fyrirtækjaskrá.
2. ~~Does an order's `external_ref` carry over to the subscription?~~ No longer blocking:
   `POST /orders/` returns `subscriptions_created`, and checkout writes that id to the member
   directly. `external_ref` remains a fallback lookup. Still worth confirming.
3. **What does `POST /orders/` return for a declined card?** The code assumes a non-2xx means
   nothing was charged, and treats a timeout as "unknown" (the member is told not to retry, and
   the paywall looks up their email in Repeat before showing the form again). Confirm both with
   the test card and a decline test card.
4. **Card widget on preview deploys** — it only works on domains listed in shop settings. Can a
   wildcard like `*.vercel.app` be listed, or does the payment flow only test on production?
5. **What does `upcoming_charge_dates` do after a failed charge?** Decides whether it can back a
   fail-closed `current_period_end`.
6. **Data portability** — if Aron leaves or Repeat folds, can subscriptions and card tokens move
   to another provider or the acquirer, and in what format?
7. **Merchant of record and VSK** — presumably Aron, since he holds the acquirer agreement.
   Confirm, and confirm how VAT on the product is reported.
