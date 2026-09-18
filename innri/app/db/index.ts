import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Database client.
 *
 * `DATABASE_URL` is Neon's POOLED connection, provisioned by the Vercel
 * integration. Two things follow from that and neither is optional:
 *
 *   prepare: false   Neon's pooler runs PgBouncer in transaction mode, which
 *                    does not support prepared statements. Leaving this on
 *                    produces "prepared statement already exists" only under
 *                    concurrency — so it passes locally and fails in production.
 *
 *   max: 1           Serverless instances are many and short-lived. A large
 *                    pool per instance multiplies out to far more connections
 *                    than Neon allows; the pooler is what does the pooling.
 *
 * Migrations run against DATABASE_URL_UNPOOLED instead — see drizzle.config.ts.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Run `vercel env pull` to fetch it from the Neon integration.",
  );
}

const client = postgres(connectionString, { prepare: false, max: 1 });

export const db = drizzle(client, { schema });

export { schema };
