import { clerkClient } from "@clerk/react-router/server";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Form, Link } from "react-router";
import { z } from "zod";

import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  cancelClaim,
  grantAccess,
  listUsers,
  markClaimPaid,
  revokeAccess,
  sendClaim,
} from "~/lib/admin.server";
import { requireAdmin } from "~/lib/auth.server";
import { formatDate } from "~/lib/format";
import { formatKennitala } from "~/lib/kennitala";
import {
  attentionRank,
  funnel,
  inInvoicingQueue,
  lastSeenLabel,
  type MemberStatus,
  nextStep,
} from "~/lib/members";
import { GOAL_LABELS, type HealthFlagName } from "~/lib/onboarding";

import type { Route } from "./+types/admin";

/**
 * Aron's ops page: counts across the top, then one table of everyone who has
 * signed up, ordered by what he has to do — send a claim, mark one paid — with
 * the action on the row. A row expands for the details a claim needs
 * (kennitala, phone) and the health notes he should read before opening access.
 *
 * Inside the member layout for its chrome, which lets admins through without a
 * questionnaire. The page itself is gated on `users.is_admin` by `requireAdmin`
 * — the layout's guard alone would admit every member.
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

const days = z.coerce.number().int().min(1).max(366);

const actionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("send"), userId: z.uuid(), days }),
  z.object({ intent: z.literal("paid"), claimId: z.uuid() }),
  z.object({ intent: z.literal("cancel"), claimId: z.uuid() }),
  z.object({
    intent: z.literal("grant"),
    userId: z.uuid(),
    days,
    seenUntil: z
      .string()
      .transform((value) => (value.length === 0 ? null : new Date(value)))
      .refine((value) => value === null || !Number.isNaN(value.getTime())),
  }),
  z.object({ intent: z.literal("revoke"), userId: z.uuid() }),
]);

type ActionResult = { readonly notice: string };

const STALE = "Þetta hafði þegar verið skráð — listinn sýnir stöðuna eins og hún er núna.";

export async function action(args: Route.ActionArgs): Promise<ActionResult> {
  await requireAdmin(args);

  const parsed = actionSchema.safeParse(Object.fromEntries(await args.request.formData()));

  if (!parsed.success) {
    return { notice: "Fjöldi daga þarf að vera á milli 1 og 366." };
  }

  const input = parsed.data;

  const now = new Date();

  if (input.intent === "send") {
    return (await sendClaim(input.userId, input.days, now)) === "sent"
      ? { notice: `Krafa skráð send, fyrir ${input.days} daga.` }
      : { notice: "Það er þegar krafa úti fyrir þennan meðlim." };
  }

  if (input.intent === "paid") {
    return (await markClaimPaid(input.claimId, now)) === "paid"
      ? { notice: "Krafa greidd — aðgangur opnaður." }
      : { notice: STALE };
  }

  if (input.intent === "cancel") {
    await cancelClaim(input.claimId);

    return { notice: "Hætt við kröfuna." };
  }

  if (input.intent === "revoke") {
    await revokeAccess(input.userId);

    return { notice: "Aðgangur afturkallaður." };
  }

  const result = await grantAccess(input.userId, input.days, input.seenUntil, now);

  if (result === "stale") {
    return { notice: STALE };
  }

  if (result === "unknown") {
    return { notice: "Þessi meðlimur fannst ekki." };
  }

  return { notice: `Aðgangur opnaður í ${input.days} daga, án kröfu.` };
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Umsjón — Innri hringurinn" }, { name: "robots", content: "noindex, nofollow" }];
}

type DashboardUser = Route.ComponentProps["loaderData"]["users"][number];

const FLAG_LABELS = {
  chronicCondition: "Langvinnur sjúkdómur",
  medication: "Lyf",
  eatingDisorder: "Saga um átröskun",
  injury: "Meiðsli",
} satisfies Record<HealthFlagName, string>;

const flagsOf = (answers: DashboardUser["answers"]): string[] =>
  answers === null
    ? []
    : [
        { on: answers.flaggedChronicCondition, label: FLAG_LABELS.chronicCondition },
        { on: answers.flaggedMedication, label: FLAG_LABELS.medication },
        { on: answers.flaggedEatingDisorder, label: FLAG_LABELS.eatingDisorder },
        { on: answers.flaggedInjury, label: FLAG_LABELS.injury },
      ].flatMap((flag) => (flag.on ? [flag.label] : []));

const ACCESS_LABELS = {
  pending: "Bíður eftir kröfu",
  expiring: "Rennur út",
  active: "Virkur",
  lapsed: "Útrunninn",
} satisfies Record<MemberStatus, string>;

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

function DaysField({ id, defaultValue = 30 }: { id: string; defaultValue?: number }) {
  return (
    <>
      <Label htmlFor={id} className="sr-only">
        Dagar
      </Label>

      <Input
        id={id}
        name="days"
        type="number"
        inputMode="numeric"
        min={1}
        max={366}
        defaultValue={defaultValue}
        className="h-8 w-16"
      />
    </>
  );
}

/** The one thing to do about this person right now, on their row. */
function RowAction({ user }: { user: DashboardUser }) {
  const step = nextStep(user);

  if (step === "awaitPayment" && user.openClaim !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted">
          Send {formatDate(user.openClaim.sentAt)} · {user.openClaim.days} d.
        </span>

        <Form method="post">
          <input type="hidden" name="intent" value="paid" />
          <input type="hidden" name="claimId" value={user.openClaim.id} />
          <Button type="submit">Greitt</Button>
        </Form>

        <Form method="post">
          <input type="hidden" name="intent" value="cancel" />
          <input type="hidden" name="claimId" value={user.openClaim.id} />
          <Button type="submit" variant="ghost">
            Hætta við
          </Button>
        </Form>
      </div>
    );
  }

  if (step === "sendClaim") {
    return (
      <Form method="post" className="flex items-center gap-2">
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="userId" value={user.id} />
        <DaysField id={`send-days-${user.id}`} />

        {/* An active member can be sent next month's claim early, but it is
            not what Aron came here to do — so it does not shout. */}
        <Button type="submit" variant={user.status === "active" ? "outline" : "default"}>
          Krafa send
        </Button>
      </Form>
    );
  }

  return <span className="text-text-muted">—</span>;
}

function Details({ user }: { user: DashboardUser }) {
  const { answers } = user;

  const flags = flagsOf(answers);

  return (
    <div className="grid gap-6 px-4 py-5 sm:grid-cols-2">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm text-text-soft">
        <dt className="text-text-muted">Kennitala</dt>
        <dd className="col-span-2 font-mono">
          {user.kennitala === null ? "—" : formatKennitala(user.kennitala)}
        </dd>

        <dt className="text-text-muted">Netfang</dt>
        <dd className="col-span-2">{user.email ?? "—"}</dd>

        <dt className="text-text-muted">Sími</dt>
        <dd className="col-span-2">{user.phone ?? "—"}</dd>

        <dt className="text-text-muted">Plan</dt>
        <dd className="col-span-2">
          {answers === null
            ? "—"
            : `${GOAL_LABELS[answers.goal].label}, ${answers.sessionsPerWeek}× í viku`}
        </dd>

        <dt className="text-text-muted">Síðast greitt</dt>
        <dd className="col-span-2">
          {user.lastPaidClaim?.paidAt
            ? `${formatDate(user.lastPaidClaim.paidAt)} · ${user.lastPaidClaim.days} d.`
            : "—"}
        </dd>
      </dl>

      <div className="grid content-start gap-4">
        {(flags.length > 0 || answers?.limitations) && (
          <div className="border-l-2 border-bronze-deep pl-4 text-sm text-text-soft">
            {flags.length > 0 && <p>Heilsa: {flags.join(", ")}</p>}

            {answers?.limitations && <p className="mt-1">„{answers.limitations}“</p>}
          </div>
        )}

        {/* Access without a claim — comping a friend, or a payment that
            arrived some other way. Guarded by the end date the page showed. */}
        <Form method="post" className="flex items-center gap-2">
          <input type="hidden" name="intent" value="grant" />
          <input type="hidden" name="userId" value={user.id} />
          <input
            type="hidden"
            name="seenUntil"
            value={user.accessGrantedUntil?.toISOString() ?? ""}
          />
          <DaysField id={`grant-days-${user.id}`} />

          <Button type="submit" variant="outline">
            Opna aðgang án kröfu
          </Button>
        </Form>

        {user.accessGrantedUntil !== null && (
          <Form method="post">
            <input type="hidden" name="intent" value="revoke" />
            <input type="hidden" name="userId" value={user.id} />

            <Button type="submit" variant="ghost" size="sm">
              Afturkalla aðgang
            </Button>
          </Form>
        )}
      </div>
    </div>
  );
}

const COLUMNS = ["Notandi", "Spurningalisti", "Aðgangur", "Síðast virkur", "Næsta skref"];

function UsersTable({
  users,
  now,
  lastSeenAvailable,
}: {
  users: readonly DashboardUser[];
  now: Date;
  lastSeenAvailable: boolean;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });

  const ordered = [...users].sort((a, b) => attentionRank(a) - attentionRank(b));

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
          390px. */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-line-soft">
        <table className="w-full min-w-2xl text-left text-sm">
          <thead className="bg-sunken text-text-muted">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          {ordered.map((user) => {
            const expanded = open.has(user.id);

            const flagged = flagsOf(user.answers).length > 0;

            return (
              <tbody key={user.id} className="border-t border-line-soft">
                <tr className="text-text-soft">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(user.id)}
                      aria-expanded={expanded}
                      aria-controls={`details-${user.id}`}
                      className="flex items-start gap-2 text-left"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={`mt-0.5 size-4 shrink-0 text-text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
                      />

                      <span>
                        <span className="block text-text">
                          {user.name ?? user.email ?? "Nafnlaus"}
                        </span>

                        <span className="block text-xs text-text-muted">
                          Skráður {formatDate(user.createdAt)}
                        </span>

                        {/* So a flag is seen before access is opened, not
                            only if Aron happens to expand the row. */}
                        {flagged && (
                          <span className="mt-1 block text-xs text-bronze">
                            Heilsufar — sjá nánar
                          </span>
                        )}
                      </span>
                    </button>
                  </td>

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

                  <td className="whitespace-nowrap px-4 py-3">
                    <RowAction user={user} />
                  </td>
                </tr>

                {expanded && (
                  <tr id={`details-${user.id}`} className="bg-sunken">
                    <td colSpan={COLUMNS.length}>
                      <Details user={user} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}

export default function Admin({ loaderData, actionData }: Route.ComponentProps) {
  const { users, now, lastSeenAvailable } = loaderData;

  return (
    <>
      <h1 className="font-display text-title text-text">Umsjón</h1>

      <p className="mt-2 max-w-2xl text-text-soft">
        Sendu kröfu í heimabanka og merktu hana senda hér. Merktu hana greidda þegar hún berst — þá
        opnast aðgangurinn.
      </p>

      <Overview users={users} />

      {actionData?.notice && (
        <p role="status" className="mt-8 border-l-2 border-bronze pl-4 text-sm text-text-soft">
          {actionData.notice}
        </p>
      )}

      <UsersTable users={users} now={now} lastSeenAvailable={lastSeenAvailable} />

      <section className="mt-12 rounded-xl border border-line-soft bg-raised p-5">
        <h2 className="text-sm text-text-soft">Spurningalistinn</h2>

        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Farðu sjálfur í gegnum spurningalistann eins og nýr meðlimur. Þegar þú klárar færðu planið
          sem svörin þín velja, og getur farið aftur í gegn hvenær sem er.
        </p>

        <Link
          to="/onboarding"
          className={buttonVariants({ variant: "outline", className: "mt-4" })}
        >
          Fara í gegnum spurningalistann
        </Link>
      </section>
    </>
  );
}
