import { PortableText } from "@portabletext/react";
import { Link } from "react-router";

import { CATEGORY_LABELS } from "~/lib/categories";
import { articleBySlugQuery, sanity } from "~/lib/sanity.server";

import type { Route } from "./+types/article";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.article.title ?? "Grein"} — Innri hringurinn` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const article = await sanity.fetch(articleBySlugQuery, { slug: params.slug });

  if (!article) {
    throw new Response("Greinin fannst ekki", { status: 404 });
  }

  return { article };
}

/**
 * The Studio only offers the styles rendered here — normal, h2, blockquote,
 * two list kinds, bold and italic. Anything else cannot be authored, so there
 * is nothing to fall back to.
 */
const components = {
  block: {
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="mt-4 text-text-soft">{children}</p>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mt-8 font-display text-subtitle text-text">{children}</h2>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="mt-6 border-l-2 border-bronze pl-4 text-text-soft italic">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mt-4 list-disc pl-5 text-text-soft">{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mt-4 list-decimal pl-5 text-text-soft">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => <li className="mt-1">{children}</li>,
    number: ({ children }: { children?: React.ReactNode }) => <li className="mt-1">{children}</li>,
  },
};

export default function Article({ loaderData }: Route.ComponentProps) {
  const { article } = loaderData;

  return (
    <article className="max-w-prose">
      <Link
        to="/articles"
        className="font-mark text-xs uppercase tracking-mark text-text-muted transition-colors hover:text-text-soft"
      >
        ← Fróðleikur
      </Link>

      <p className="mt-6 font-mark text-xs uppercase tracking-mark text-text-muted">
        {CATEGORY_LABELS[article.category] ?? article.category}
      </p>

      <h1 className="mt-2 font-display text-title text-text">{article.title}</h1>

      {article.body && <PortableText value={article.body} components={components} />}
    </article>
  );
}
