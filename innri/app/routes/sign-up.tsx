import { SignUp } from "@clerk/react-router";

import { PRIVACY_URL } from "~/lib/links";

import type { Route } from "./+types/sign-up";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Nýskráning — Innri hringurinn" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function Nyskraning() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-16">
      <span className="crest-mark mb-6 w-10" aria-hidden="true" />

      <h1 className="font-display text-title text-text">Nýskráning</h1>

      <p className="mt-3 mb-8 text-text-soft">
        Búðu til aðgang. Svo tekur við stuttur spurningalisti sem setur saman planið þitt.
      </p>

      <SignUp signInUrl="/sign-in" forceRedirectUrl="/" />

      <p className="mt-6 text-xs text-text-muted">
        Svörin þín, þar á meðal heilsufarsupplýsingar, eru geymd eins og lýst er í{" "}
        <a href={PRIVACY_URL} className="underline underline-offset-2 hover:text-text">
          persónuverndarstefnunni
        </a>
        .
      </p>
    </main>
  );
}
