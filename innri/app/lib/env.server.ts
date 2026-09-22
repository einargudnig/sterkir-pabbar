import { z } from "zod";

/**
 * Server environment, parsed once at the boundary.
 *
 * Nothing in the app reads `process.env` directly — an agent (or a person) that
 * invents `PROCESS_ENV_KLING_KEY` gets a type error instead of `undefined` at
 * runtime. Each phase adds its own keys here as it lands:
 *
 *   phase 6  KLING_SECRET_KEY, KLING_WEBHOOK_SECRET
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /**
   * Public origin of the members' area, no trailing slash. Clerk redirects and
   * Kling's webhook and return URLs are all built from it, so it must be the
   * real origin rather than inferred from the request — a forwarded Host header
   * is attacker-controlled.
   */
  APP_URL: z
    .url({ message: "APP_URL must be an absolute URL, e.g. https://innri.sterkirpabbar.is" })
    .refine((value) => !value.endsWith("/"), {
      message: "APP_URL must not have a trailing slash",
    }),

  /**
   * Written by `clerk init` into .env.local. The publishable key is also read
   * by the browser bundle as VITE_CLERK_PUBLISHABLE_KEY; it is declared here so
   * a server boot with a half-configured environment fails loudly rather than
   * rendering a sign-in box that can never complete.
   */
  CLERK_SECRET_KEY: z
    .string()
    .min(1)
    .startsWith("sk_", { message: "CLERK_SECRET_KEY must start with sk_" }),

  VITE_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .startsWith("pk_", { message: "VITE_CLERK_PUBLISHABLE_KEY must start with pk_" }),

  /**
   * Verifies Clerk's webhook signatures. Without it the sync endpoint would
   * accept anything posted to it, and that endpoint writes to `users`.
   */
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).startsWith("whsec_", {
    message: "CLERK_WEBHOOK_SIGNING_SECRET must start with whsec_",
  }),

  /** Server-side Sanity reads. */
  SANITY_PROJECT_ID: z.string().min(1),

  SANITY_READ_TOKEN: z.string().min(1),

  /**
   * Signs the onboarding draft cookie.
   *
   * The wizard keeps a member's part-finished answers in a cookie rather than a
   * draft table, so the cookie is the only thing asserting that they confirmed
   * being over 18 and acknowledged the health warning. Unsigned, those two
   * could be handed to the server by anyone willing to edit a cookie.
   */
  SESSION_SECRET: z.string().min(32, { message: "SESSION_SECRET must be at least 32 characters" }),

  /** Neon's pooled connection, provisioned by the Vercel integration. */
  DATABASE_URL: z
    .string()
    .min(1)
    .startsWith("postgres", { message: "DATABASE_URL must be a postgres:// connection string" }),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

type EnvSource = Readonly<Record<string, string | undefined>>;

export class EnvError extends Error {
  readonly missing: readonly string[];

  constructor(message: string, missing: readonly string[]) {
    super(message);

    this.name = "EnvError";
    this.missing = missing;
  }
}

/**
 * Parses an environment source, reporting *every* problem at once.
 *
 * Zod stops at nothing here deliberately: a deploy that is missing three
 * variables should say so in one go rather than failing three times, each after
 * a fresh build.
 */
export const parseEnv = (source: EnvSource): ServerEnv => {
  const result = serverEnvSchema.safeParse(source);

  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join(".");

    return key.length > 0 ? `${key}: ${issue.message}` : issue.message;
  });

  const keys = result.error.issues
    .map((issue) => issue.path.join("."))
    .filter((key) => key.length > 0);

  throw new EnvError(`Invalid server environment:\n  ${problems.join("\n  ")}`, keys);
};

let cached: ServerEnv | null = null;

/**
 * The parsed environment, read at the first request that needs it.
 *
 * Memoised rather than parsed at import time: a serverless instance imports
 * this module during the build as well as at runtime, and a build has no reason
 * to hold the production secrets. The first real request is the boundary.
 */
export const serverEnv = (): ServerEnv => {
  cached ??= parseEnv(process.env);

  return cached;
};
