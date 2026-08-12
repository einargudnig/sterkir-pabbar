/**
 * Single source of truth for content + business facts.
 * Drives both the visible copy AND the JSON-LD structured data,
 * so the two can never drift apart (important for AEO correctness).
 *
 * The copy itself now lives in `src/content/content.json`, which is written by
 * `scripts/fetch-content.mjs` from Sanity before every build and committed to
 * the repo as a fallback. The build reads the JSON synchronously — nothing here
 * talks to the network — so a Sanity outage can never break a deploy.
 *
 * The export shapes below are unchanged from when this file held the copy as
 * literals. Components import `{ hero }`, `{ method }`, `{ faq }` and so on and
 * do not know or care where the strings came from.
 *
 * Everything defined as a constant in THIS file rather than read from `content`
 * is deliberately not client-editable: structural facts, the conversion path,
 * and anything whose value has consequences beyond the words on screen.
 */

import content from "../content/content.json";

export const site = {
  name: "Sterkir pabbar",
  legalName: "Sterkir pabbar", // TODO(client): official ehf./kt. name if different
  tagline: content.general.tagline,
  domain: "https://sterkirpabbar.is", // TODO(client): confirm final domain
  locale: "is_IS",
  lang: "is",

  // Short description reused in <meta description> and schema.
  description: content.general.description,

  contact: {
    email: content.contact.email,
    // Stored in full international form so the tel: link works from abroad;
    // Footer strips the spaces to produce tel:+3544567890.
    phone: (content.contact.phone || null) as string | null,
    // Confirmed by Aron. Not rendered anywhere — the site is online-first and
    // must not read as a capital-area gym — but it is true, so it lives here.
    city: content.contact.city,
    // The business is online-first and nationwide (see PRODUCT.md). Anything
    // narrower than this tells 60% of Icelandic fathers the service isn't
    // theirs — which is why it is NOT editable from the CMS.
    areaServed: "Ísland",
  },

  /**
   * The single destination for every call to action on the site.
   *
   * Derived from the contact email rather than stored separately: when Aron
   * changes his address in the CMS, every CTA follows it. Storing the mailto as
   * its own editable field would let the two drift, and a booking link pointing
   * at a dead mailbox fails silently at the highest-intent moment on the page.
   *
   * TODO(client): swap for a real booking link (Calendly, Noona, a form) when
   * one exists — nothing else needs to change.
   */
  bookingUrl:
    `mailto:${content.contact.email}?subject=${encodeURIComponent("Ég vil bóka ókeypis spjall")}` as
      | string
      | null,

  // Empty strings are coerced to null so the Footer can skip the link entirely
  // and `sameAs` never emits a blank URL into the structured data.
  social: {
    instagram: (content.social?.instagram || null) as string | null,
    facebook: (content.social?.facebook || null) as string | null,
  },

  // The coach behind it — feeds the Person schema + About section.
  coach: {
    name: content.coach.name,
    role: content.coach.role,
    // Aron's own words, supplied by him. Do not paraphrase — this is the only
    // fully verifiable evidence on the site.
    bio: content.coach.bio,
    credentials: content.coach.credentials, // TODO(client): confirm real certification
  },

  priceRange: "$$", // schema hint, not shown to users

  // Build credit. Rendered once, in the footer's bottom rule — quiet enough
  // that it never competes with the client's own name above it.
  credit: {
    label: "Búið til af",
    name: "einargudni.com",
    url: "https://einargudni.com",
  },
} as const;

/**
 * Not client-editable: every href here is an in-page anchor that must match an
 * `id` in a component. A renamed nav item is cosmetic; a renamed anchor is a
 * dead link, and the CMS cannot check that the target still exists.
 */
export const nav = [
  { label: "Aðferð", href: "#adferd" },
  { label: "Pakkar", href: "#thjalfun" },
  { label: "Spurningar", href: "#spurningar" },
] as const;

export const hero = {
  // The positioning line — the single most important sentence on the page.
  // It promises the outcome, not the activity, and deliberately drops
  // "Sterkari pabbi": the brand name already says it, and repeating it costs a
  // line of the largest type on the page.
  //
  // Capped at 60 characters in the CMS. Above that it wraps to three lines and
  // the hero stops working.
  headline: content.hero.headline,
  // Word rendered in italic serif for editorial emphasis. Hero.astro splits the
  // headline on it, so the CMS enforces that it actually occurs in the headline.
  emphasis: content.hero.emphasis,
  sub: content.hero.sub,
  // href intentionally absent: every CTA destination comes from lib/booking.ts
  primaryCta: { label: content.hero.primaryCtaLabel },
  // The label is editable; the anchor is not — see `nav` above.
  secondaryCta: { label: content.hero.secondaryCtaLabel, href: "#thjalfun" },
  /**
   * The stat rail ("3× æfingar á viku · 30–45 mínútur · 12 vikur") was removed
   * at Aron's request, along with every other fixed prescription on the page.
   * Every prógram is built around the individual, so a standard weekly dose
   * stated as a headline fact contradicted the product. It also cannot be
   * replaced with a different set of numbers — there is no verified data yet.
   */
} as const;

/**
 * Section headings that used to be hardcoded in the components. They are copy,
 * so they belong to the client; they were only ever in the markup because no
 * one had asked to change them yet.
 */
export const sections = {
  offeringsTitle: content.offeringsTitle,
  offeringsLead: content.offeringsLead,
  faqTitle: content.faqTitle,
} as const;

/**
 * Tiers in ascending price order, both delivered online and nationwide.
 *
 * Pabbahópur and Einkaþjálfun 1:1 were removed at Aron's request. What is sold
 * on this page is a prógram: training alone, or training plus nutrition. Aron
 * still does 1:1 and fjarþjálfun (see `coachIntro`), but neither is a packaged
 * tier with a public price, so neither is listed as one.
 *
 * Direct messaging and the weekly check-in are in BOTH tiers, deliberately.
 * They are not an upsell — they are what makes either prógram work.
 *
 * `featured` decides which tier gets the large panel in Offerings.astro. The
 * CMS enforces that exactly one tier carries it: zero leaves the panel empty,
 * two silently renders only the first.
 *
 * `price` is validated against `NN.NNN kr/mán` in the CMS because jsonLd.ts
 * parses the digits out of it for the Offer schema.
 */
export const offerings = content.offerings;

/**
 * The coach section. This is the only genuinely verifiable evidence on the
 * site: Aron's own words, in the first person, with his name attached.
 *
 * Every other proof point is either provisional (pricing, credential) or absent
 * (testimonials, photography). The first paragraph gets the brightest treatment
 * in Coach.astro.
 *
 * Deliberately no credential line. "ÍAK einkaþjálfari" is unconfirmed, and the
 * bio is stronger evidence to this audience than a certificate would be.
 */
export const coachIntro = content.coachIntro;

export const method = content.method;

export const forDads = content.forDads;

/**
 * Testimonials were removed deliberately, not lost.
 *
 * The two that lived here ("Gunnar", "Kristján") were invented placeholders
 * rendered as genuine client quotes. To an audience that arrives braced for a
 * sales pitch, an unverifiable testimonial does not read as neutral — it reads
 * as manufactured, and it retroactively contaminates the FAQ and the method,
 * which are honest.
 *
 * TODO(client): reinstate only with real, permissioned quotes. Until then the
 * coach's own first-person section carries the credibility load, because it is
 * the one piece of evidence on this site that is actually true.
 */

/** Also emitted as FAQPage structured data by jsonLd.ts. */
export const faq = content.faq;

export const finalCta = {
  title: content.finalCta.title,
  body: content.finalCta.body,
  cta: { label: content.finalCta.ctaLabel }, // destination: site.bookingUrl
} as const;
