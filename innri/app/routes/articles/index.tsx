import { Link } from "react-router";

import { CATEGORY_LABELS } from "~/lib/categories";
import { articlesQuery, sanity } from "~/lib/sanity.server";

import type { Route } from "./+types/index";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Fróðleikur — Innri hringurinn" }];
}

export async function loader(_args: Route.LoaderArgs) {
  const articles = await sanity.fetch(articlesQuery);

  return { articles };
}

export default function Articles({ loaderData }: Route.ComponentProps) {
  const { articles } = loaderData;

  if (articles.length === 0) {
    return (
      <div className="max-w-prose">
        <h1 className="font-display text-title text-text">Fróðleikur</h1>

        <p className="mt-4 text-text-soft">
          Hér bætast við greinar jafnt og þétt. Engin komin enn.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1 className="font-display text-title text-text">Fróðleikur</h1>

        <p className="mt-2 text-text-soft">Stutt svör við því sem flestir spyrja að.</p>
      </header>

      <ul className="mt-8 grid gap-4">
        {articles.map((article) => (
          <li key={article._id}>
            <Link
              to={`/articles/${article.slug}`}
              className="block rounded-xl border border-line-soft bg-raised p-5 transition-colors hover:border-bronze-dim"
            >
              <p className="font-mark text-xs uppercase tracking-mark text-text-muted">
                {CATEGORY_LABELS[article.category] ?? article.category}
              </p>

              <h2 className="mt-2 font-display text-subtitle text-text">{article.title}</h2>

              <p className="mt-2 text-sm text-text-soft">{article.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
