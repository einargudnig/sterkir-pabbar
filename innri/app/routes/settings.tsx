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
import type { CancellationPreview, RepeatSubscription } from "~/lib/repeat";
import { cancelSubscription, getSubscription, previewCancellation } from "~/lib/repeat.server";
import { applySubscription, requireActiveAccess } from "~/lib/subscription.server";

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

/**
 * Subscription details are read live from Repeat here — unlike the paid gate,
 * which never calls Repeat. This page only DESCRIBES the subscription, so a
 * Repeat outage costs the description, not anyone's access.
 */
const readSubscription = async (id: string | null, wantsToCancel: boolean) => {
  if (!id) {
    return { subscription: null, preview: null, unavailable: false };
  }

  try {
    const [subscription, preview] = await Promise.all([
      getSubscription(id),
      wantsToCancel ? previewCancellation(id) : Promise.resolve(null),
    ]);

    return { subscription, preview, unavailable: false };
  } catch (error) {
    console.error("settings: subscription read failed", error);

    return { subscription: null, preview: null, unavailable: true };
  }
};

export async function loader(args: Route.LoaderArgs) {
  const user = await requireActiveAccess(args);
  const params = new URL(args.request.url).searchParams;

  const [account, answers, billing] = await Promise.all([
    readAccount(args, user.clerkUserId),
    latestOnboarding(user.id),
    readSubscription(user.repeatSubscriptionId, params.has("uppsogn")),
  ]);

  return { account, answers: answers ?? null, editing: params.has("maelingar"), ...billing };
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

  if (!user.repeatSubscriptionId) {
    return redirect("/settings");
  }

  /**
   * Through Repeat's cancel endpoint, so Aron's notice period and commitment
   * decide when it ends, and the confirmation email goes out from Repeat. The
   * response carries the updated subscription, which is written straight to the
   * mirror rather than waiting for the webhook.
   */
  const result = await cancelSubscription(user.repeatSubscriptionId);

  await applySubscription(user, result.subscription);

  return redirect("/settings");
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Stillingar — Innri hringurinn" }];
}

const outcomeText = (preview: CancellationPreview): string => {
  switch (preview.outcome) {
    case "IMMEDIATE":
      return "Áskriftinni lýkur strax og aðgangurinn að innri hringnum lokast um leið.";
    case "SCHEDULED":
      return preview.effective_date
        ? `Þú heldur aðgangi til ${formatDate(new Date(preview.effective_date))}. Eftir það er ekkert rukkað.`
        : "Þú heldur aðgangi út tímabilið sem þú hefur greitt fyrir.";
    case "AFTER_COMMITMENT_COUNT":
      return "Áskriftin er með binditíma. Henni lýkur sjálfkrafa þegar binditímanum lýkur.";
  }
};

const SubscriptionStatus = ({ subscription }: { readonly subscription: RepeatSubscription }) => {
  if (!subscription.active) {
    return <p className="text-sm text-text-muted">Áskriftin er ekki virk.</p>;
  }

  if (subscription.is_paused) {
    return <p className="text-sm text-text-soft">Áskriftin er í hléi. Ekkert er rukkað á meðan.</p>;
  }

  if (subscription.resign_date) {
    return (
      <p className="text-sm text-text-soft">
        Uppsögn skráð. Þú heldur aðgangi til {formatDate(new Date(subscription.resign_date))}.
      </p>
    );
  }

  if (subscription.wants_to_cancel) {
    return (
      <p className="text-sm text-text-soft">
        Uppsögn skráð. Áskriftinni lýkur þegar binditímanum lýkur.
      </p>
    );
  }

  const nextCharge = subscription.upcoming_charge_dates[0];

  return (
    <p className="text-sm text-text-soft">
      Virk mánaðaráskrift.
      {nextCharge && ` Næsta greiðsla ${formatDate(new Date(`${nextCharge}T00:00:00Z`))}.`}
    </p>
  );
};

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
  const { account, answers, editing, subscription, preview, unavailable } = loaderData;

  const errors: StepErrors = actionData?.errors ?? {};

  const canCancel =
    subscription?.active === true &&
    !subscription.is_paused &&
    !subscription.resign_date &&
    !subscription.wants_to_cancel;

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

      <section className="mt-8">
        <h2 className="text-sm text-text-soft">Áskrift</h2>

        <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
          {unavailable && (
            <p className="text-sm text-text-muted">
              Ekki tókst að sækja upplýsingar um áskriftina. Aðgangurinn þinn er óbreyttur — reyndu
              aftur eftir smástund.
            </p>
          )}

          {!unavailable && !subscription && (
            <p className="text-sm text-text-muted">Aðgangur veittur handvirkt. Engin áskrift.</p>
          )}

          {subscription && <SubscriptionStatus subscription={subscription} />}

          {canCancel && !preview && (
            <Link
              to="?uppsogn"
              preventScrollReset
              className={buttonVariants({ variant: "outline", className: "mt-4" })}
            >
              Segja upp áskrift
            </Link>
          )}

          {canCancel && preview && (
            <div className="mt-4 rounded-lg border border-line bg-sunken p-4">
              <p className="text-sm text-text">{outcomeText(preview)}</p>

              <div className="mt-4 flex flex-wrap gap-3">
                <Form method="post">
                  <Button type="submit" name="intent" value="cancel" variant="destructive">
                    Staðfesta uppsögn
                  </Button>
                </Form>

                <Link to="." preventScrollReset className={buttonVariants({ variant: "ghost" })}>
                  Hætta við
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
