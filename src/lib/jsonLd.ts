import { site, faq } from "../config/site";

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
        "@type": ["LocalBusiness", "HealthAndBeautyBusiness"],
        "@id": orgId,
        name: site.name,
        legalName: site.legalName,
        description: site.description,
        url: base,
        slogan: site.tagline,
        priceRange: site.priceRange,
        inLanguage: site.lang,
        email: site.contact.email,
        telephone: site.contact.phone,
        areaServed: site.contact.areaServed,
        address: {
          "@type": "PostalAddress",
          addressLocality: site.contact.city,
          addressCountry: "IS",
        },
        founder: { "@id": personId },
        employee: { "@id": personId },
        sameAs: Object.values(site.social),
        makesOffer: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Einkaþjálfun fyrir pabba",
              serviceType: "Personal training",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Æfingaprógram fyrir pabba",
              serviceType: "Fitness program",
            },
          },
        ],
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
