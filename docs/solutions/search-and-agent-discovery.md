# Search and agent discovery

Plan for issue #31: rank sterkirpabbar.is higher in Google and get it found and cited by AI
assistants (ChatGPT, Claude, Perplexity, Google AI Overviews). Written 2026-10-01.

## Where we stand

The technical base is already good. It was built for this during the July design pass:

| Area                   | State                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Redirects              | `www` and `http` both 308 to `https://sterkirpabbar.is/`                                                                |
| Canonical, robots meta | Set in `src/layouts/Layout.astro`; 404 is `noindex` with no JSON-LD                                                     |
| Structured data        | `@graph` of `WebSite`, `ProfessionalService` (nationwide, with `Offer`s generated from the prices), `Person`, `FAQPage` |
| AI crawlers            | `robots.txt` explicitly allows GPTBot, OAI-SearchBot, PerplexityBot, Google-Extended, ClaudeBot                         |
| Members' area          | `noindex, nofollow`, so it never competes with the landing page                                                         |
| Language, fonts, JS    | `lang="is"`, self-hosted fonts, effectively zero client JS                                                              |

The gaps are visibility and substance, not markup:

1. **We have no data.** `site.googleSiteVerification` is `null`, so Search Console has never
   been connected. We do not know what Google has indexed or what anyone searches to find us.
2. **The `<title>` targets nothing anyone searches.** It is `Sterkir pabbar — Verðum sterkari
saman.`: the brand plus the slogan. It also ends in a stray period, because the CMS tagline
   carries one. The meta description does carry the right terms (einkaþjálfun, fjarþjálfun).
3. **One URL, ~740 words.** A single page can rank for the brand name and maybe one or two
   phrases. Every other query a dad types has no page to land on.
4. **No outside signals.** No Google Business Profile, no links from other Icelandic sites, and
   `sameAs` holds only what is in the CMS social fields.
5. **Thin evidence.** `PRODUCT.md` lists it: no photo of Aron, no real testimonials, credential
   unconfirmed. Google's quality guidelines and AI answer engines both weigh exactly this, and
   it is the same gap that hurts conversion.

Not measured yet: Core Web Vitals. The PageSpeed API quota was exhausted during the audit; it
is the first item in phase A.

## What not to spend time on

- **`llms.txt`.** The weekly SEO/AEO research has tracked it since July. Adoption does not
  correlate with being cited, the major AI crawlers fetch HTML directly, and Google does not
  support it. It is a 10-minute file, so add it when touching `public/` anyway. It is not a
  lever.
- **More JSON-LD.** The graph is already complete for a business this shape.
- **FAQ rich results.** Google has shown FAQ snippets only for government and health sites
  since 2023. The `FAQPage` node is still worth keeping, because AI engines read it. But
  `docs/leidbeiningar.md` tells Aron the questions "birtast líka beint í Google", which is no
  longer true. Correct that line.

## Plan

Ordered by leverage per hour, and arranged around the rule that `src/` is out of scope until
phase 7 of the inner-circle plan.

### Phase A: no code (do now)

1. **Search Console: add a domain property, verified by DNS TXT record** in the Vercel DNS zone.
   This beats the meta tag: it covers `www` and `app.` too and needs no deploy. Submit
   `sitemap.xml`. Leave `googleSiteVerification` as `null`.
2. **Bing Webmaster Tools.** Import from Search Console in one click. ChatGPT search draws
   heavily on Bing's index, so this is the cheapest step for agent discovery.
3. **Baseline measurements.** Run Lighthouse on mobile and record LCP, CLS and the scores here.
   Then ask ChatGPT, Perplexity, Claude and Google a fixed set of prompts and record whether
   Sterkir pabbar appears (see Measurement).
4. **Google Business Profile** as a service-area business with the address hidden, service
   area set to Ísland, the category personal trainer, and the website linked. This feeds the
   brand knowledge panel and Maps. It stays consistent with the online-first rule in
   `PRODUCT.md`, because no address is shown.
5. **Make sure every profile points home.** Aron's Instagram and Facebook bios should link to
   `sterkirpabbar.is`, and the CMS social fields should be filled in so `sameAs` links the
   entity both ways.

### Phase B: small `src/` fixes (needs a deliberate exception, like #30)

1. **Title with a search term.** For example `Sterkir pabbar — Fjarþjálfun og einkaþjálfun
fyrir pabba`, under 60 characters. Build it in `Layout.astro` rather than from the tagline,
   which also drops the stray trailing period. Aron approves the wording.
2. **Remove the stale `TODO(client): confirm final domain`** in `src/config/site.ts`. The
   domain is live.
3. **Add `lastmod` to `sitemap.xml`**, so crawlers know when to recrawl after a content change.

### Phase C: content (lands with phase 7)

This is the real ranking work: give dads' actual questions a page each.

1. **Keyword research before writing.** Search Console data from phase A, plus Google
   autocomplete and "people also ask" in Icelandic. Candidate themes include fjarþjálfun,
   einkaþjálfun fyrir byrjendur, æfa heima, bakverkir, and tími til að æfa með börn. Choose by
   what Search Console shows, not by guesses.
2. **Public articles on the marketing site.** Fróðleikur already exists in Sanity for members.
   Publishing a chosen subset as `/frodleikur/<slug>` pages, each with its own title,
   description, `Article` JSON-LD and Aron as author, multiplies the queries the site can
   answer. **Open decision:** the static site gets content from `scripts/fetch-content.mjs`,
   which `CLAUDE.md` says must not be extended for the members' area. Public articles are
   marketing content, so they arguably belong in that bake. Decide this explicitly; don't let
   it happen by accident.
3. **Real evidence on the page:** a photo of Aron, permissioned testimonials, and a confirmed
   credential. These raise rankings and conversion together.
4. **FAQ copy written to be quoted.** Self-contained answers that make sense without the
   question, with prices and the online-nationwide fact in plain words. That is what AI
   answer engines lift.

### Phase D: outside signals (ongoing, mostly Aron)

- Interviews and guest spots on Icelandic podcasts and parenting or health media, each with a
  link to the site.
- Mosfellsbær local press and sports clubs: a "local dad trains dads" story.
- Partners such as physiotherapists or gyms who would refer clients.

One good link from an Icelandic `.is` news site is worth more than everything in phase B.

## Measurement

Review monthly. Write the numbers into this file so the trend is visible.

| Signal                                  | Source                      | Phase-A baseline |
| --------------------------------------- | --------------------------- | ---------------- |
| Indexed pages, coverage errors          | Search Console              | (not measured)   |
| Impressions and clicks, brand vs. other | Search Console, Performance | (not measured)   |
| Average position for 5 tracked queries  | Search Console              | (not measured)   |
| Bing impressions                        | Bing Webmaster Tools        | (not measured)   |
| AI mention rate, fixed prompt set       | Manual, 4 engines           | (not measured)   |
| LCP / CLS (mobile)                      | Lighthouse                  | (not measured)   |
| Free-chat enquiries per month           | Aron's inbox                | (not measured)   |

Fixed AI prompt set (keep it unchanged so the months compare):

- "Hvar get ég fengið fjarþjálfun fyrir pabba á Íslandi?"
- "Einkaþjálfari fyrir feður sem hafa ekki æft lengi"
- "Sterkir pabbar"
- "Online fitness coaching for dads in Iceland"

The last number is the one that matters. Rankings that do not turn into booked chats are not
the goal.
