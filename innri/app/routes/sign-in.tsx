import { SignIn } from "@clerk/react-router";

import type { Route } from "./+types/sign-in";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Innskráning — Innri hringurinn" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function Innskraning() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-16">
      <span className="crest-mark mb-6 w-10" aria-hidden="true" />

      <h1 className="font-display text-title text-text">Innskráning</h1>

      <p className="mt-3 mb-8 text-text-soft">Skráðu þig inn til að komast í innri hringinn.</p>

      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/" />
    </main>
  );
}
