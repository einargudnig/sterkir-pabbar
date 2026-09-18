import { ClerkProvider } from "@clerk/react-router";
import { clerkMiddleware, rootAuthLoader } from "@clerk/react-router/server";
import { shadcn } from "@clerk/ui/themes";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const middleware = [clerkMiddleware()];

export const loader = (args: Parameters<typeof rootAuthLoader>[0]) => rootAuthLoader(args);

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon-32.png", type: "image/png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>

      <body>
        {children}

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Clerk's URLs are Icelandic because members see them. Setting them here rather
 * than per-component means every redirect Clerk performs on its own — an
 * expired session, a verification link, a bounce out of a protected route —
 * lands on the Icelandic path instead of the English default.
 *
 * The shadcn theme reads the same CSS variables app.css maps onto the brand, so
 * Clerk's screens pick up the espresso surfaces and bronze accent rather than
 * shipping their own palette.
 */
type ClerkAppearance = NonNullable<React.ComponentProps<typeof ClerkProvider>["appearance"]>;

/**
 * SAFETY: `@clerk/ui` declares `cssLayerName?: string` rather than
 * `string | undefined`, which this project's `exactOptionalPropertyTypes`
 * rejects. The value is Clerk's own published theme object handed straight back
 * to Clerk, so it is correct at runtime — the mismatch is in their declaration,
 * not in this value. Typed off the public prop rather than importing BaseTheme
 * from `@clerk/ui/dist/internal`.
 */
const clerkAppearance = { theme: shadcn } as ClerkAppearance;

export default function App() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <ClerkProvider
      loaderData={loaderData}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={clerkAppearance}
    >
      <Outlet />
    </ClerkProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Eitthvað fór úrskeiðis";
  let details = "Óvænt villa kom upp. Reyndu aftur eftir smá stund.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Síðan fannst ekki" : "Villa";

    details =
      error.status === 404 ? "Slóðin sem þú baðst um er ekki til." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-gutter pt-16">
      <h1 className="font-display text-title text-text">{message}</h1>

      <p className="mt-4 text-text-soft">{details}</p>

      {stack && (
        <pre className="mt-8 w-full overflow-x-auto rounded bg-sunken p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
