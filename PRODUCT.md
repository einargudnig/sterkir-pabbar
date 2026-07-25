# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Icelandic fathers who have not trained regularly in years. They are time-poor,
often carrying accumulated aches rather than an injury, and are motivated by
being able and present for their kids — not by aesthetics or competition.

They are **not gym people**. They arrive already braced for something that will
make them feel out of place, and they decide quickly whether this is "for
someone like me."

The primary job: find a way to get stronger that survives a week that falls
apart — sleepless nights, work, kids — without needing an hour a day or a gym
membership.

## Product Purpose

Personal training and training programs built for fathers. Success is a client
who is still training months later, with more energy after a long day and a
back and knees that hold up.

The single conversion goal of the site is booking the **free intro chat**
(`ókeypis spjall`). Nothing else on the page is asked of the visitor.

## Positioning

**Aron is a dad training dads.** He lives the constraint he programs around, so
the programming comes from inside the problem rather than from a textbook.
Training is designed _around_ a chaotic family week, not in spite of it —
30–45 minutes, 2–3 times a week, built to keep going when the week collapses.

A neighbouring trainer can copy the schedule but cannot truthfully claim the
same vantage point.

## Operating Context

**Online-first and nationwide.** Confirmed at init; the local-business framing
the code originally carried has been removed:

- **Æfingaprógram** (app-delivered programs) is the main business and the tier
  that scales beyond the capital area. It serves dads anywhere in Iceland.
- **Einkaþjálfun 1:1** is the smaller premium tier.
- **Pabbahópur** is a small fixed peer group.

Consequences future work must respect:

- The service area is **Iceland**, not `Höfuðborgarsvæðið`. The site now emits
  `ProfessionalService` with `areaServed: Ísland` and no `PostalAddress`;
  do not reintroduce a `LocalBusiness` type or a street address.
- The offering hierarchy now matches: **Æfingaprógram is the featured tier**,
  taking the large panel and the primary button. It is the main business, the
  lowest-friction entry point, and the only tier available outside the capital
  area. Einkaþjálfun 1:1 and Pabbahópur follow as lighter rows in ascending
  price order.
- Tier tags state availability rather than popularity — "Um allt land",
  "Á staðnum", "Mest aðhald" — so a visitor outside Reykjavík can tell at a
  glance which options are actually open to him. **If Aron wants the 1:1 tier
  featured for margin reasons, that is his call to reverse; the reasoning above
  is why it is not the default.**

## Capabilities and Constraints

- Astro 7 static site, Tailwind v4 `@theme` tokens, effectively zero client JS
  (a nav toggle only). No backend, no forms, no booking system yet.
- Icelandic only (`lang="is"`). Fonts are self-hosted and must cover latin-ext
  for full Icelandic glyph coverage (þ, ð, æ, ö, á…).
- Copy and JSON-LD are both generated from `src/config/site.ts`, so visible
  text and structured data cannot drift apart. Preserve that property.
- SEO/AEO matters — this is how dads find it.

**Confirmed contact facts:**

- Email **aron@sterkirpabbar.is**, phone **+354 456 7890**.
- The free chat is booked by email. `site.bookingUrl` is a `mailto:` with the
  subject "Ég vil bóka ókeypis spjall" prefilled; the three offering CTAs use
  `enquiryHref()` to prefill the tier name instead. All CTA destinations resolve
  through `src/lib/booking.ts` — there is exactly one place to change when a
  real booking system arrives.

**Still undecided. Do not treat as true and do not invent values:**

- Final domain (`sterkirpabbar.is` is unconfirmed)
- City / whether a physical address should appear at all, given online-first.
- Legal entity name / kennitala.
- Whether a booking tool (Calendly, Noona, a form) replaces the mailto.

## Brand Commitments

- Name **Sterkir pabbar**; tagline **"Verðum sterkari saman"**.
- The **crest** — a single continuous-line drawing of a father flexing with a
  child on his shoulders (`public/logo/crest-*.webp`, alpha-masked so it can be
  recoloured at any scale). This is the strongest identity asset the brand has.
- **Orbitron** carries the wordmark, inherited from the current identity.
  Note: it draws a slashed zero, so it cannot set numerals.
- Voice: Icelandic plain speech. Short sentences, no English loanwords, no
  exclamation marks, no hype. The register of a friend who happens to be a
  trainer.

## Evidence on Hand

**The site currently has almost no real evidence. All of the following are
placeholder and must not be presented, cited, or reasoned about as fact:**

- **Testimonials** — "Gunnar" and "Kristján" were invented. They have been
  **removed** from the site along with the section that rendered them. Do not
  reinstate them; only real, permissioned quotes go back in.
- **Pricing** — 9.900 / 14.900 / 24.900 kr per month are provisional.
- **Credential** — "ÍAK einkaþjálfari" is unconfirmed.

**Absences future work must not paper over:**

- No photography of Aron or any client exists. The design must hold on
  typography, the crest, and texture alone, and must not leave holes shaped
  like a missing photo.
- No case studies, results data, client count, or press.

## Product Principles

1. **Credibility over persuasion.** This audience is braced for a sales pitch.
   Overclaiming loses them faster than underclaiming.
2. **Lower the cost of the first step.** Every decision is measured against
   whether it makes the free chat easier to say yes to.
3. **Design around the collapsed week.** The product's promise is that it
   survives real life; anything implying ideal conditions contradicts it.
4. **Never fabricate evidence.** Given how little real proof exists, invented
   proof is the fastest way to destroy the trust this positioning depends on.
5. **Reachable from anywhere in Iceland.** Online-first is the business;
   local-only framing shrinks the market.

## Accessibility & Inclusion

WCAG AA contrast minimum. All motion must degrade under
`prefers-reduced-motion`. Full Icelandic glyph coverage is a hard requirement.
