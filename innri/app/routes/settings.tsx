import { useClerk } from "@clerk/react-router";
import { clerkClient } from "@clerk/react-router/server";
import { Form, Link, redirect, useNavigation } from "react-router";

import { MeasurementFields } from "~/components/measurement-fields";
import { Button, buttonVariants } from "~/components/ui/button";
import { formatDate } from "~/lib/format";
import {
  ACTIVITY_LABELS,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  SEX_LABELS,
} from "~/lib/onboarding";
import { submitStep, type StepErrors } from "~/lib/onboarding-draft.server";
import { latestOnboarding, updateMeasurements } from "~/lib/onboarding.server";
import { requireActiveAccess } from "~/lib/gates.server";

import type { Route } from "./+types/settings";

/**
 * Email and password belong to Clerk, so they are read from Clerk here and
 * changed in Clerk's own profile screen. A Clerk outage costs this line of the
 * page, not the rest of it.
 */
const readAccount = async (args: Route.LoaderArgs, clerkUserId: string) => {
  try {
    const clerkUser = await clerkClient(args).users.getUser(clerkUserId);

    return {
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      hasPassword: clerkUser.passwordEnabled,
    };
  } catch (error) {
    console.error("settings: account read failed", error);

    return null;
  }
};

export async function loader(args: Route.LoaderArgs) {
  const user = await requireActiveAccess(args);
  const params = new URL(args.request.url).searchParams;

  const [account, answers] = await Promise.all([
    readAccount(args, user.clerkUserId),
    latestOnboarding(user.id),
  ]);

  return {
    account,
    answers: answers ?? null,
    editing: params.has("maelingar"),
    /** Null for an admin, whose access does not come from a grant. */
    paidUntil:
      user.isAdmin || user.accessGrantedUntil === null ? null : formatDate(user.accessGrantedUntil),
  };
}

export async function action(args: Route.ActionArgs) {
  const user = await requireActiveAccess(args);
  const formData = await args.request.formData();

  if (formData.get("intent") === "measurements") {
    const submission = submitStep("measurements", formData);

    if (!submission.ok) {
      return { errors: submission.errors };
    }

    const result = await updateMeasurements(user.id, submission.patch);

    /** The whole reason to change these is the new numbers, so show them. */
    return redirect(result.ok ? "/dashboard/macros" : "/settings");
  }

  return redirect("/settings");
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Stillingar — Innri hringurinn" }];
}

type Loaded = Route.ComponentProps["loaderData"];

const AccountSection = ({ account }: { readonly account: Loaded["account"] }) => {
  const clerk = useClerk();

  return (
    <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
      {account === null ? (
        <p className="text-sm text-text-muted">
          Ekki tókst að sækja netfangið þitt. Reyndu aftur eftir smástund.
        </p>
      ) : (
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-text-muted">Netfang</dt>
            <dd className="text-text">{account.email ?? "Ekkert netfang skráð"}</dd>
          </div>

          <div>
            <dt className="text-text-muted">Lykilorð</dt>
            <dd className="text-text">
              {account.hasPassword ? "••••••••" : "Ekkert lykilorð sett"}
            </dd>
          </div>
        </dl>
      )}

      {/* Clerk's own profile screen: it owns email verification and password
          rules, and re-implementing either here would be a second, weaker copy. */}
      <Button variant="outline" className="mt-4" onClick={() => clerk.openUserProfile()}>
        Breyta netfangi eða lykilorði
      </Button>
    </div>
  );
};

type Answers = NonNullable<Loaded["answers"]>;

const answerRows = (answers: Answers): readonly (readonly [string, string])[] => [
  ["Markmið", GOAL_LABELS[answers.goal].label],
  ["Aðstaða", answers.equipment ? EQUIPMENT_LABELS[answers.equipment].label : "—"],
  ["Reynsla", answers.experience ? EXPERIENCE_LABELS[answers.experience].label : "—"],
  ["Æfingar", `${answers.sessionsPerWeek} sinnum í viku`],
  ["Þyngd", `${answers.weightKg} kg`],
  ["Hæð", `${answers.heightCm} cm`],
  ["Aldur", `${answers.age} ára`],
  ["Kyn", SEX_LABELS[answers.sex]],
  ["Virkni", ACTIVITY_LABELS[answers.activityLevel].label],
];

const AnswersSection = ({
  answers,
  editing,
  errors,
}: {
  readonly answers: Answers;
  readonly editing: boolean;
  readonly errors: StepErrors;
}) => {
  const navigation = useNavigation();

  if (!editing) {
    return (
      <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
        <dl className="grid gap-2 text-sm">
          {answerRows(answers).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-6">
              <dt className="text-text-muted">{label}</dt>
              <dd className="text-text">{value}</dd>
            </div>
          ))}
        </dl>

        <Link
          to="?maelingar"
          preventScrollReset
          className={buttonVariants({ variant: "outline", className: "mt-4" })}
        >
          Uppfæra mælingar
        </Link>
      </div>
    );
  }

  return (
    <Form method="post" className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
      <p className="mb-6 text-sm text-text-soft">
        Þyngd, hæð, aldur og virkni. Breytist þær eru næringarviðmiðin reiknuð upp á nýtt.
        Æfingaplanið helst óbreytt.
      </p>

      <MeasurementFields defaults={answers} errors={errors} />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          type="submit"
          name="intent"
          value="measurements"
          disabled={navigation.state === "submitting"}
        >
          Vista og reikna upp á nýtt
        </Button>

        <Link to="." preventScrollReset className={buttonVariants({ variant: "ghost" })}>
          Hætta við
        </Link>
      </div>
    </Form>
  );
};

export default function Stillingar({ loaderData, actionData }: Route.ComponentProps) {
  const { account, answers, editing, paidUntil } = loaderData;

  const errors: StepErrors = actionData?.errors ?? {};

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-title text-text">Stillingar</h1>

      <section className="mt-8">
        <h2 className="text-sm text-text-soft">Aðgangur</h2>

        <AccountSection account={account} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm text-text-soft">Mínar upplýsingar</h2>

        {answers === null ? (
          <p className="mt-3 text-sm text-text-muted">Engin svör skráð.</p>
        ) : (
          <AnswersSection
            answers={answers}
            editing={editing || actionData !== undefined}
            errors={errors}
          />
        )}
      </section>

      {paidUntil !== null && (
        <section className="mt-8">
          <h2 className="text-sm text-text-soft">Greiðslur</h2>

          <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
            <p className="text-sm text-text-soft">
              Aðgangurinn þinn er greiddur til {paidUntil}. Aron sendir þér nýja kröfu í
              heimabankann áður en hann rennur út.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
