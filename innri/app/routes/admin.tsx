import { UserButton } from "@clerk/react-router";
import { Form } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type AdminMember, grantAccess, listMembers, revokeAccess } from "~/lib/admin.server";
import { requireAdmin } from "~/lib/auth.server";
import { formatDate } from "~/lib/format";
import { formatKennitala } from "~/lib/kennitala";
import { EXPIRING_WITHIN_DAYS, type MemberStatus } from "~/lib/members";
import { GOAL_LABELS, type HealthFlagName } from "~/lib/onboarding";

import type { Route } from "./+types/admin";

/**
 * Aron's ops page for manual invoicing: who is waiting for their first claim,
 * whose access runs out soon, and a button to mark a claim paid.
 *
 * Outside the member layout — Aron does not pay for his own product — and
 * gated on `users.is_admin` by `requireAdmin`.
 */
export async function loader(args: Route.LoaderArgs) {
  await requireAdmin(args);

  return { members: await listMembers(new Date()) };
}

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

export default function Admin({ loaderData, actionData }: Route.ComponentProps) {
  const { members } = loaderData;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-title text-text">Umsjón</h1>

        <UserButton />
      </div>

      <p className="mt-2 text-text-soft">
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
          <section key={section.status} className="mt-12">
            <h2 className="font-mark text-xs uppercase tracking-mark text-text-muted">
              {section.title} · {inSection.length}
            </h2>

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
