import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { sanity } from "~/lib/sanity.server";

/**
 * A local HTTP server standing in for Sanity's query API, with the real client
 * pointed at it through the client's own `config()`.
 *
 * The app's GROQ, its parameter encoding and the client's response handling
 * all run for real; only the content is invented. A 5xx is retried with the
 * client's own backoff — its retry policy is fixed at `createClient` — so a
 * test of Sanity being down takes a few seconds, as the real outage would.
 */

/** The shape of a plan as far as `completeOnboarding` reads it. `_id` may be null to break it. */
export type FakePlan = {
  readonly _id: string | null;
  readonly title: string;
  readonly goal: string;
  readonly sessionsPerWeek: number;
};

type QueryResult = { readonly result: FakePlan | null } | { readonly status: number };

export type SanityQuery = {
  readonly query: string;
  readonly params: ReadonlyMap<string, string>;
};

export const startFakeSanity = async () => {
  const queries: SanityQuery[] = [];

  let next: QueryResult = { result: null };

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://fake-sanity");
    const params = new Map<string, string>();

    for (const [key, value] of url.searchParams) {
      if (key.startsWith("$")) {
        params.set(key.slice(1), value);
      }
    }

    queries.push({ query: url.searchParams.get("query") ?? "", params });

    if ("status" in next) {
      response.writeHead(next.status, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Unavailable" }));

      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ result: next.result, ms: 1 }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  // SAFETY: `listen` on a TCP port always yields an AddressInfo, never a pipe name.
  const { port } = server.address() as AddressInfo;

  sanity.config({
    apiHost: `http://127.0.0.1:${port}`,
    useProjectHostname: false,
    useCdn: false,
  });

  return {
    /** What the next queries return, as the `result` Sanity would send. */
    respondWith: (result: FakePlan | null) => {
      next = { result };
    },

    /** Makes every query fail with this HTTP status. */
    failWith: (status: number) => {
      next = { status };
    },

    queries,

    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};
