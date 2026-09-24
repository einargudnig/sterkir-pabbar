import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

/**
 * Global setup for the integration project: a throwaway Postgres, migrated
 * with the same files production runs, gone when the run ends.
 *
 * A real server rather than a fake because what these tests guard is SQL —
 * the conditional UPDATE that stops a double charge, the unique index that
 * logs a delivery once, the transaction that writes a member all-or-nothing.
 * A fake would test the fake.
 *
 * Runs Postgres 18, the major version Neon runs, when Homebrew's
 * `postgresql@18` is installed; otherwise whatever `initdb` is on PATH. Set
 * TEST_PG_BIN to a directory of Postgres binaries to choose one explicitly, or
 * TEST_DATABASE_URL to use a server you already run.
 */

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const HOMEBREW_PG_18 = "/opt/homebrew/opt/postgresql@18/bin";

const binary = (name: "initdb" | "pg_ctl") => {
  const dir = process.env.TEST_PG_BIN ?? (existsSync(HOMEBREW_PG_18) ? HOMEBREW_PG_18 : null);

  return dir === null ? name : join(dir, name);
};

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      // SAFETY: `listen` on a TCP port always yields an AddressInfo, never a pipe name.
      const { port } = server.address() as AddressInfo;

      server.close(() => resolve(port));
    });
  });

const startCluster = async () => {
  const dir = mkdtempSync(join(tmpdir(), "innri-pg-"));
  const port = await freePort();

  try {
    execFileSync(
      binary("initdb"),
      ["-D", dir, "-U", "postgres", "--auth=trust", "--no-locale", "-E", "UTF8"],
      {
        stdio: "ignore",
      },
    );

    execFileSync(
      binary("pg_ctl"),
      [
        "-D",
        dir,
        "-l",
        join(dir, "server.log"),
        "-o",
        `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -F`,
        "-w",
        "start",
      ],
      { stdio: "ignore" },
    );
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });

    throw new Error(
      "Integration tests need a local Postgres: `brew install postgresql@18`, or set " +
        "TEST_PG_BIN to a directory holding initdb and pg_ctl, or TEST_DATABASE_URL to a local server.",
      { cause: error },
    );
  }

  const stop = () => {
    execFileSync(binary("pg_ctl"), ["-D", dir, "-m", "immediate", "stop"], { stdio: "ignore" });
    rmSync(dir, { recursive: true, force: true });
  };

  return { url: `postgres://postgres@127.0.0.1:${port}/postgres`, stop };
};

export default async function setup(project: TestProject) {
  const external = process.env.TEST_DATABASE_URL;
  const cluster = external === undefined ? await startCluster() : null;
  const url = external ?? cluster?.url ?? "";

  const client = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(client), {
      migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
    });
  } finally {
    await client.end();
  }

  project.provide("databaseUrl", url);

  return () => cluster?.stop();
}
