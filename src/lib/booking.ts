import { site } from "../config/site";

/**
 * Resolves the destination for every call to action on the site.
 *
 * There is exactly one conversion goal — booking the free intro chat — so there
 * is exactly one place that decides where the button goes. Before this existed,
 * six CTAs pointed at two different targets and one of them was `href="#"`,
 * which silently scrolled the visitor back to the top of the page at the single
 * highest-intent moment on the surface.
 */

const CONTACT_ANCHOR = "#hafa-samband";

/** True when no real booking destination has been configured yet. */
export const isBookingUnresolved = site.bookingUrl === null;

/**
 * Where the primary CTA should point. Falls back to the contact section so the
 * button is never inert, but that fallback is a holding pattern, not a
 * conversion path — see the build guard below.
 */
export const bookingHref = site.bookingUrl ?? CONTACT_ANCHOR;

/**
 * Fails the build when a launch build is attempted with no real destination.
 *
 * Run `LAUNCH=1 bun run build` to enforce it. Ordinary dev and preview builds
 * only warn, so the site stays workable while the destination is outstanding.
 */
/**
 * A tier-specific enquiry link.
 *
 * The three offering CTAs used to share one label and one destination, so the
 * comparison the section asks the visitor to make was functionally inert — he
 * paid the full cost of choosing and the choice changed nothing. Naming the
 * tier in the subject line makes it mean something, and saves him explaining
 * which package he was looking at.
 */
export const enquiryHref = (tier: string) =>
  `mailto:${site.contact.email}?subject=${encodeURIComponent(`Fyrirspurn: ${tier}`)}`;

export const assertBookingConfigured = () => {
  if (!isBookingUnresolved) return;

  const message =
    "site.bookingUrl is null — every CTA falls back to scrolling to #hafa-samband, " +
    "which does not convert. Set a real booking URL, mailto: or tel: in src/config/site.ts.";

  if (import.meta.env.LAUNCH === "1") {
    throw new Error(`[booking] BLOCKING: ${message}`);
  }
  console.warn(`[booking] WARNING: ${message}`);
};
