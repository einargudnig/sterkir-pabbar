/**
 * Google Analytics for the members' area, behind the same consent model as the
 * landing page: every storage type starts denied, and only the consent banner
 * grants `analytics_storage`.
 *
 * Production host only. Preview deployments and local dev never define `gtag`,
 * so test sessions stay out of the numbers and the banner never shows there.
 */
const GA_ID = "G-66J34LSM16";

const PRODUCTION_HOST = "app.sterkirpabbar.is";

export const CONSENT_KEY = "sp-analytics-consent";

export type ConsentChoice = "granted" | "denied";

/**
 * Inlined into <head> by root.tsx, so it runs before hydration and before the
 * first pageview. gtag.js only reads `arguments` objects off the dataLayer,
 * which is why `gtag` is a plain function rather than an arrow.
 */
export const GTAG_BOOTSTRAP = `
(function () {
  if (location.hostname !== "${PRODUCTION_HOST}") return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied"
  });
  try {
    if (localStorage.getItem("${CONSENT_KEY}") === "granted") {
      gtag("consent", "update", { analytics_storage: "granted" });
    }
  } catch (e) {}
  gtag("js", new Date());
  gtag("config", "${GA_ID}");
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=${GA_ID}";
  document.head.appendChild(s);
})();
`;

declare global {
  interface Window {
    gtag?: (
      command: "consent",
      action: "update",
      params: { analytics_storage: ConsentChoice },
    ) => void;
  }
}

export const analyticsActive = (): boolean => window.gtag !== undefined;

export const storedConsent = (): ConsentChoice | null => {
  try {
    const value = localStorage.getItem(CONSENT_KEY);

    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
};

export const saveConsent = (choice: ConsentChoice) => {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice still applies to this page.
  }

  window.gtag?.("consent", "update", { analytics_storage: choice });
};
