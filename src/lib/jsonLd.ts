import { site, faq, offerings } from "../config/site";

/**
 * Builds a JSON-LD @graph for AEO / rich results.
 * Nodes are cross-linked by @id so engines resolve them as one entity.
 */
export const buildJsonLd = () => {
  const base = site.domain;
  const orgId = `${base}/#business`;
  const personId = `${base}/#coach`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: site.name,
        inLanguage: site.lang,
        publisher: { "@id": orgId },
      },
      {
        /**
         * Was `LocalBusiness` with a `PostalAddress` and
         * `areaServed: "Höfuðborgarsvæðið"`. The business is online-first and
         * nationwide, so that combination told search engines this was a
         * capital-area gym — shrinking the market before a visitor ever
         * clicked. `ProfessionalService` carries the offer without asserting a
         * storefront.
         */
        "@type": ["ProfessionalService", "HealthAndBeautyBusiness"],
        "@id": orgId,
        name: site.name,
        legalName: site.legalName,
        description: site.description,
        url: base,
        slogan: site.tagline,
        priceRange: site.priceRange,
        inLanguage: site.lang,
        email: site.contact.email,
        // Only emitted once a real number exists — never a placeholder.
        ...(site.contact.phone ? { telephone: site.contact.phone } : {}),
        areaServed: { "@type": "Country", name: site.contact.areaServed },
        founder: { "@id": personId },
        employee: { "@id": personId },
        sameAs: Object.values(site.social),
        /**
         * Generated from `offerings` so the structured data can never disagree
         * with the prices on the page. `price` is parsed out of the display
         * string rather than duplicated as a number — one place to edit.
         */
        makesOffer: offerings.map((o) => ({
          "@type": "Offer",
          name: o.name,
          price: o.price.replace(/[^\d]/g, ""),
          priceCurrency: "ISK",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: o.price.replace(/[^\d]/g, ""),
            priceCurrency: "ISK",
            unitCode: "MON",
          },
          itemOffered: {
            "@type": "Service",
            name: o.name,
            description: o.summary,
            serviceType: "Fitness program",
            provider: { "@id": orgId },
          },
        })),
      },
      {
        "@type": "Person",
        "@id": personId,
        name: site.coach.name,
        jobTitle: site.coach.role,
        description: site.coach.bio,
        worksFor: { "@id": orgId },
      },
      {
        "@type": "FAQPage",
        "@id": `${base}/#faq`,
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
};
