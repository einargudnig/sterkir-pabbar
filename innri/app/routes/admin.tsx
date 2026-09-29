import { UserButton } from "@clerk/react-router";
import { clerkClient } from "@clerk/react-router/server";
import { Form } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type AdminMember, grantAccess, listUsers, revokeAccess } from "~/lib/admin.server";
import { requireAdmin } from "~/lib/auth.server";
import { formatDate } from "~/lib/format";
import { formatKennitala } from "~/lib/kennitala";
import {
  EXPIRING_WITHIN_DAYS,
  funnel,
  inInvoicingQueue,
  lastSeenLabel,
  type MemberStatus,
} from "~/lib/members";
import { GOAL_LABELS, type HealthFlagName } from "~/lib/onboarding";

import type { Route } from "./+types/admin";

/**
 * Aron's ops page: an overview of everyone who has signed up, then the
 * invoicing queue — who is waiting for their first claim, whose access runs out
 * soon, and a button to mark a claim paid.
 *
 * Outside the member layout — Aron does not pay for his own product — and
 * gated on `users.is_admin` by `requireAdmin`.
 */
export async function loader(args: Route.LoaderArgs) {
  await requireAdmin(args);

  const now = new Date();

  const everyone = await listUsers(now);

  const lastActive = await lastActiveByClerkId(
    args,
    everyone.map((user) => user.clerkUserId),
  );

  return {
    now,
    lastSeenAvailable: lastActive !== null,
    users: everyone.map((user) => ({
      ...user,
      lastActiveAt: lastActive?.get(user.clerkUserId) ?? null,
    })),
  };
}

/** Clerk caps `getUserList` filters; 100 ids per request stays well inside it. */
const CLERK_PAGE = 100;

/**
 * When each user last had a session, from Clerk — the app keeps no activity
 * log of its own. Null when Clerk cannot be reached: the dashboard still
 * renders, with "last seen" marked unavailable, because an outage at Clerk must
 * not stop Aron from marking a claim paid.
 */
const lastActiveByClerkId = async (
  args: Route.LoaderArgs,
  clerkIds: readonly string[],
): Promise<Map<string, Date> | null> => {
  const chunks = Array.from({ length: Math.ceil(clerkIds.length / CLERK_PAGE) }, (_, index) =>
    clerkIds.slice(index * CLERK_PAGE, (index + 1) * CLERK_PAGE),
  );

  try {
    const pages = await Promise.all(
      chunks.map((userId) => clerkClient(args).users.getUserList({ userId, limit: CLERK_PAGE })),
    );

    return new Map(
      pages
        .flatMap((page) => page.data)
        .flatMap((user) =>
          user.lastActiveAt === null ? [] : [[user.id, new Date(user.lastActiveAt)] as const],
        ),
    );
  } catch (error) {
    console.error("admin: Clerk user list failed", error);

    return null;
  }
};

const actionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("grant"),
    userId: z.uuid(),
    days: z.coerce.number().int().min(1).max(366),
    seenUntil: z
      .string()
      .transform((value) => (value.length === 0 ? null : new Date(value)))
      .refine((value) => value === null || !Number.isNaN(value.getTime())),
  }),
  z.object({ intent: z.literal("revoke"), userId: z.uuid() }),
]);

type ActionResult = { readonly notice: string };

export async function action(args: Route.ActionArgs): Promise<ActionResult> {
  await requireAdmin(args);

  const parsed = actionSchema.safeParse(Object.fromEntries(await args.request.formData()));

  if (!parsed.success) {
    return { notice: "Fjöldi daga þarf að vera á milli 1 og 366." };
  }

  const input = parsed.data;

  if (input.intent === "revoke") {
    await revokeAccess(input.userId);

    return { notice: "Aðgangur afturkallaður. Meðlimurinn bíður aftur eftir kröfu." };
  }

  const result = await grantAccess(input.userId, input.days, input.seenUntil, new Date());

  if (result === "stale") {
    return { notice: "Þetta hafði þegar verið skráð — listinn sýnir stöðuna eins og hún er núna." };
  }

  if (result === "unknown") {
    return { notice: "Þessi meðlimur fannst ekki." };
  }

  return { notice: `Aðgangur opnaður í ${input.days} daga.` };
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Umsjón — Innri hringurinn" }, { name: "robots", content: "noindex, nofollow" }];
}

const SECTIONS = [
  {
    status: "pending",
    title: "Bíða eftir kröfu",
    empty: "Enginn í röðinni.",
  },
  {
    status: "expiring",
    title: `Renna út innan ${EXPIRING_WITHIN_DAYS} daga`,
    empty: "Enginn að renna út.",
  },
  {
    status: "lapsed",
    title: "Útrunnir",
    empty: "Enginn útrunninn.",
  },
  {
    status: "active",
    title: "Virkir",
    empty: "Enginn virkur ennþá.",
  },
] as const satisfies readonly {
  readonly status: MemberStatus;
  readonly title: string;
  readonly empty: string;
}[];

/** Oldest first: the one who has waited longest, or runs out soonest, is next. */
const sortKey = (member: AdminMember): number =>
  (member.status === "pending" ? member.readyAt : member.accessGrantedUntil)?.getTime() ?? 0;

const FLAG_LABELS = {
  chronicCondition: "Langvinnur sjúkdómur",
  medication: "Lyf",
  eatingDisorder: "Saga um átröskun",
  injury: "Meiðsli",
} satisfies Record<HealthFlagName, string>;

const flagsOf = (answers: NonNullable<AdminMember["answers"]>): string[] =>
  [
    { on: answers.flaggedChronicCondition, label: FLAG_LABELS.chronicCondition },
    { on: answers.flaggedMedication, label: FLAG_LABELS.medication },
    { on: answers.flaggedEatingDisorder, label: FLAG_LABELS.eatingDisorder },
    { on: answers.flaggedInjury, label: FLAG_LABELS.injury },
  ].flatMap((flag) => (flag.on ? [flag.label] : []));

function MemberCard({ member }: { member: AdminMember }) {
  const { answers } = member;

  const flags = answers === null ? [] : flagsOf(answers);

  return (
    <li className="rounded-xl border border-line-soft bg-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-text">{member.name ?? member.email ?? "Nafnlaus"}</p>

        <p className="text-xs text-text-muted">
          {member.accessGrantedUntil === null
            ? member.readyAt === null
              ? ""
              : `Skráði sig ${formatDate(member.readyAt)}`
            : `Aðgangur til ${formatDate(member.accessGrantedUntil)}`}
        </p>
      </div>

      <dl className="mt-3 grid gap-1 text-sm text-text-soft sm:grid-cols-4 sm:gap-x-4">
        <dt className="text-text-muted">Kennitala</dt>
        <dd className="font-mono sm:col-span-3">
          {member.kennitala === null ? "—" : formatKennitala(member.kennitala)}
        </dd>

        <dt className="text-text-muted">Netfang</dt>
        <dd className="sm:col-span-3">{member.email ?? "—"}</dd>

        <dt className="text-text-muted">Sími</dt>
        <dd className="sm:col-span-3">{member.phone ?? "—"}</dd>

        {answers !== null && (
          <>
            <dt className="text-text-muted">Plan</dt>
            <dd className="sm:col-span-3">
              {GOAL_LABELS[answers.goal].label}, {answers.sessionsPerWeek}× í viku
            </dd>
          </>
        )}
      </dl>

      {(flags.length > 0 || (answers?.limitations ?? null) !== null) && (
        <div className="mt-3 border-l-2 border-bronze-deep pl-4 text-sm text-text-soft">
          {flags.length > 0 && <p>Heilsa: {flags.join(", ")}</p>}

          {answers?.limitations && <p className="mt-1">„{answers.limitations}“</p>}
        </div>
      )}

      <Form method="post" className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="intent" value="grant" />
        <input type="hidden" name="userId" value={member.id} />
        <input
          type="hidden"
          name="seenUntil"
          value={member.accessGrantedUntil?.toISOString() ?? ""}
        />

        <div className="grid gap-1.5">
          <Label htmlFor={`days-${member.id}`}>Dagar</Label>

          <Input
            id={`days-${member.id}`}
            name="days"
            type="number"
            inputMode="numeric"
            min={1}
            max={366}
            defaultValue={30}
            className="h-11 w-20"
          />
        </div>

        <Button type="submit" size="touch">
          {member.status === "pending" ? "Greitt — opna aðgang" : "Greitt — framlengja"}
        </Button>
      </Form>

      {member.accessGrantedUntil !== null && (
        <Form method="post" className="mt-2">
          <input type="hidden" name="intent" value="revoke" />
          <input type="hidden" name="userId" value={member.id} />

          <Button type="submit" variant="ghost" size="sm">
            Afturkalla aðgang
          </Button>
        </Form>
      )}
    </li>
  );
}

const ACCESS_LABELS = {
  pending: "Bíður eftir kröfu",
  expiring: "Rennur út",
  active: "Virkur",
  lapsed: "Útrunninn",
} satisfies Record<MemberStatus, string>;

type DashboardUser = Route.ComponentProps["loaderData"]["users"][number];

/** A member who never reached the queue has no access to speak of, not a pending claim. */
const accessLabel = (user: DashboardUser): string =>
  inInvoicingQueue(user) ? ACCESS_LABELS[user.status] : "Enginn aðgangur";

function Overview({ users }: { users: readonly DashboardUser[] }) {
  const counts = funnel(users.map((user) => ({ ...user, answered: user.answers !== null })));

  const tiles = [
    { label: "Skráðir", value: counts.signedUp },
    { label: "Svöruðu spurningalista", value: counts.answered },
    { label: "Tilbúnir að byrja", value: counts.ready },
    { label: "Með aðgang", value: counts.withAccess },
  ];

  return (
    <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-line-soft bg-raised p-4">
          <dt className="text-sm text-text-muted">{tile.label}</dt>
          <dd className="mt-1 font-display text-title text-text">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function UsersTable({
  users,
  now,
  lastSeenAvailable,
}: {
  users: readonly DashboardUser[];
  now: Date;
  lastSeenAvailable: boolean;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-mark text-xs uppercase tracking-mark text-text-muted">
        Allir notendur · {users.length}
      </h2>

      {!lastSeenAvailable && (
        <p className="mt-3 text-sm text-text-muted">
          Náði ekki í Clerk — „síðast virkur“ vantar í bili.
        </p>
      )}

      {/* Scrolls sideways on a phone rather than squeezing five columns into
          390px; Aron reads this at a desk, the queue below is the phone part. */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-line-soft">
        <table className="w-full min-w-xl text-left text-sm">
          <thead className="bg-sunken text-text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Notandi
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Skráður
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Spurningalisti
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Aðgangur
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Síðast virkur
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line-soft">
            {users.map((user) => (
              <tr key={user.id} className="text-text-soft">
                <td className="px-4 py-3">
                  <p className="text-text">{user.name ?? user.email ?? "Nafnlaus"}</p>
                  {user.name !== null && user.email !== null && (
                    <p className="text-xs text-text-muted">{user.email}</p>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3">{formatDate(user.createdAt)}</td>

                <td className="whitespace-nowrap px-4 py-3">
                  {user.answers === null ? (
                    <span className="text-text-muted">Ekki lokið</span>
                  ) : (
                    `Lokið ${formatDate(user.answers.completedAt)}`
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <p>{accessLabel(user)}</p>
                  {user.accessGrantedUntil !== null && (
                    <p className="text-xs text-text-muted">
                      til {formatDate(user.accessGrantedUntil)}
                    </p>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  {lastSeenAvailable ? lastSeenLabel(user.lastActiveAt, now) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Admin({ loaderData, actionData }: Route.ComponentProps) {
  const { users, now, lastSeenAvailable } = loaderData;

  const members = users.filter(inInvoicingQueue);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-title text-text">Umsjón</h1>

        <UserButton />
      </div>

      <Overview users={users} />

      <UsersTable users={users} now={now} lastSeenAvailable={lastSeenAvailable} />

      <h2 className="mt-16 font-display text-subtitle text-text">Rukkun</h2>

      <p className="mt-2 max-w-2xl text-text-soft">
        Sendu kröfu í heimabanka, og merktu hana greidda hér þegar hún berst.
      </p>

      {actionData?.notice && (
        <p role="status" className="mt-6 border-l-2 border-bronze pl-4 text-sm text-text-soft">
          {actionData.notice}
        </p>
      )}

      {SECTIONS.map((section) => {
        const inSection = members
          .filter((member) => member.status === section.status)
          .sort((a, b) =>
            section.status === "lapsed" ? sortKey(b) - sortKey(a) : sortKey(a) - sortKey(b),
          );

        return (
          <section key={section.status} className="mt-10 max-w-2xl">
            <h3 className="font-mark text-xs uppercase tracking-mark text-text-muted">
              {section.title} · {inSection.length}
            </h3>

            {inSection.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">{section.empty}</p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {inSection.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
