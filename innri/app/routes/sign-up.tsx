import { SignUp } from "@clerk/react-router";

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

      <p className="mt-3 mb-8 text-text-soft">Búðu til aðgang. Þú velur áskrift í næsta skrefi.</p>

      <SignUp signInUrl="/sign-in" forceRedirectUrl="/" />
    </main>
  );
}
