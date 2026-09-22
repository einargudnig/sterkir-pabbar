import { Form, Link, redirect } from "react-router";

import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { requireUser } from "~/lib/auth.server";
import {
  ACTIVITY_LABELS,
  ACTIVITY_VALUES,
  GOAL_LABELS,
  GOAL_VALUES,
  HEALTH_FLAGS,
  isStep,
  SEX_LABELS,
  SEX_VALUES,
  type Step,
  stepsFor,
} from "~/lib/onboarding";
import {
  clearedDraftHeader,
  draftHeader,
  firstIncompleteStep,
  needsAcknowledgement,
  type OnboardingDraft,
  readDraft,
  type StepErrors,
  submitStep,
} from "~/lib/onboarding-draft.server";
import { completeOnboarding, hasCompletedOnboarding } from "~/lib/onboarding.server";
import { availableFrequenciesQuery, sanity } from "~/lib/sanity.server";

import type { Route } from "./+types/onboarding";

/**
 * The onboarding wizard — the first thing a paying member does, and the only
 * screen where the product asks for something before giving anything.
 *
 * Two things shape every decision here. The members are fathers who have not
 * trained in years and who arrive braced for something that will make them feel
 * out of place, so each step says why it is asking rather than just asking. And
 * the whole thing works without JavaScript: the step is a URL, every navigation
 * is a link or a form post, so a bad connection on a phone loses nothing.
 */

export async function loader(args: Route.LoaderArgs) {
  const user = await requireUser(args);

  /**
   * Already a member. Re-running the wizard would append a second set of
   * answers and quietly reassign their plan, so the way back in is the
   * measurements form in Stillingar rather than this URL.
   */
  if (await hasCompletedOnboarding(user.id)) {
    return redirect("/dashboard/workouts");
  }

  const draft = await readDraft(args.request);

  const steps = stepsFor(needsAcknowledgement(draft));

  const url = new URL(args.request.url);

  const requested = url.searchParams.get("step");

  const furthest = firstIncompleteStep(draft);

  /**
   * Backwards is always allowed; forwards past an unanswered step is not. A
   * hand-edited `?step=frequency` would otherwise reach a dead end three
   * clicks later, at the one moment a member is least forgiving.
   */
  const step: Step =
    isStep(requested) &&
    steps.includes(requested) &&
    steps.indexOf(requested) <= steps.indexOf(furthest)
      ? requested
      : furthest;

  /**
   * Only frequencies with a published plan behind them, for the goal this
   * member actually chose. Aron controls launch scope by publishing: an option
   * never appears without a plan behind it.
   */
  const frequencies =
    step === "frequency" && draft.goal !== undefined
      ? await sanity.fetch(availableFrequenciesQuery, { goal: draft.goal })
      : [];

  /**
   * Set by the action when the chosen plan vanished between loading the last
   * step and submitting it. A query parameter rather than a flash message
   * because it has to survive the redirect that carries them back here.
   */
  const planMissing = url.searchParams.get("vantar") === "plan";

  return { step, steps, draft, frequencies, planMissing };
}

export async function action(args: Route.ActionArgs) {
  const user = await requireUser(args);

  const draft = await readDraft(args.request);

  const requested = new URL(args.request.url).searchParams.get("step");

  const step: Step = isStep(requested) ? requested : firstIncompleteStep(draft);

  const submission = submitStep(step, await args.request.formData());

  if (!submission.ok) {
    return { errors: submission.errors };
  }

  const merged: OnboardingDraft = { ...draft, ...submission.patch };

  const steps = stepsFor(needsAcknowledgement(merged));

  const next = steps[steps.indexOf(step) + 1];

  if (next !== undefined) {
    return redirect(`/onboarding?step=${next}`, {
      headers: { "Set-Cookie": await draftHeader(merged) },
    });
  }

  const completion = await completeOnboarding(user.id, merged);

  if (!completion.ok) {
    /**
     * `no-plan` means Aron unpublished the plan between this member loading the
     * step and submitting it. Sending them back to the goal step is the only
     * honest move — the answer they gave no longer leads anywhere.
     */
    return redirect(
      completion.reason === "no-plan"
        ? "/onboarding?step=goal&vantar=plan"
        : `/onboarding?step=${firstIncompleteStep(merged)}`,
      { headers: { "Set-Cookie": await draftHeader(merged) } },
    );
  }

  return redirect("/dashboard/workouts", {
    headers: { "Set-Cookie": await clearedDraftHeader() },
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Upphaf — Innri hringurinn" }];
}

function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function Progress({ step, steps }: { step: Step; steps: readonly Step[] }) {
  const position = steps.indexOf(step);

  return (
    <div className="mb-10">
      <div className="flex gap-1.5" aria-hidden="true">
        {steps.map((item, index) => (
          <span
            key={item}
            className={`h-1 flex-1 rounded-full ${index <= position ? "bg-bronze" : "bg-line-soft"}`}
          />
        ))}
      </div>

      <p className="mt-3 font-mark text-xs uppercase tracking-mark text-text-muted">
        Skref {position + 1} af {steps.length}
      </p>
    </div>
  );
}

/**
 * The whole row is the label, so the tap target is the full width of the
 * screen rather than a 16px box. On a phone, in the evening, that is the
 * difference between answering the question and mis-answering it.
 */
function CheckRow({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-soft bg-raised p-4 transition-colors hover:border-line">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 flex-none accent-bronze"
      />

      <span className="text-sm text-text-soft">{label}</span>
    </label>
  );
}

function ChoiceRow({
  value,
  title,
  detail,
}: {
  value: string;
  title: string;
  detail: string | undefined;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-soft bg-raised p-4 transition-colors hover:border-line">
      <RadioGroupItem value={value} className="mt-1" />

      <span>
        <span className="block text-text">{title}</span>

        {detail !== undefined && <span className="block text-sm text-text-muted">{detail}</span>}
      </span>
    </label>
  );
}

function HealthStep({ draft, errors }: { draft: OnboardingDraft; errors: StepErrors }) {
  return (
    <>
      <h1 className="font-display text-title text-text">Fyrst — heilsan</h1>

      <p className="mt-3 text-text-soft">
        Þetta er ekki formsatriði. Svörin ráða því hvaða næringarviðmið við gefum þér og hvað Aron
        þarf að vita áður en þú byrjar.
      </p>

      <div className="mt-8">
        <CheckRow
          name="confirmedAdult"
          label="Ég er 18 ára eða eldri"
          defaultChecked={draft.confirmedAdult ?? false}
        />

        <div className="mt-1">
          <FieldError message={errors.confirmedAdult} />
        </div>
      </div>

      <p className="mt-8 text-sm text-text-muted">
        Á eitthvað af þessu við um þig? Hakaðu við það sem passar — ekkert af því stoppar þig.
      </p>

      <ul className="mt-3 grid gap-3">
        {HEALTH_FLAGS.map((flag) => (
          <li key={flag.name}>
            <CheckRow
              name={flag.name}
              label={flag.label}
              defaultChecked={draft[flag.name] ?? false}
            />
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-text-muted">
        Svörin eru geymd með þínum upplýsingum. Aron sér þau, enginn annar.
      </p>
    </>
  );
}

function AcknowledgeStep({ draft, errors }: { draft: OnboardingDraft; errors: StepErrors }) {
  return (
    <>
      <h1 className="font-display text-title text-text">Áður en við gefum þér tölur</h1>

      <p className="mt-3 text-text-soft">
        Þú hakaðir við eitthvað sem hefur áhrif á hvað er óhætt fyrir þig. Appið reiknar samt
        viðmiðin — en þau eru reiknuð út frá tölum, ekki út frá þinni sjúkrasögu.
      </p>

      <div className="mt-8 border-l-2 border-bronze-deep pl-5">
        <p className="text-text-soft">
          Byrjaðu á því að senda Aroni skilaboð. Hann fer yfir planið með þér og lagar það sem þarf
          að laga. Ef þú ert á lyfjum, með langvinnan sjúkdóm eða sögu um átröskun skiptir það máli
          hvernig þessum viðmiðum er fylgt.
        </p>

        {draft.eatingDisorder === true && (
          <p className="mt-4 text-text-soft">
            Sögu um átröskun fylgir að kaloríutalning getur verið skaðleg. Þú getur notað
            æfingaplanið án þess að horfa á næringarviðmiðin — og það er fullgild leið.
          </p>
        )}
      </div>

      <div className="mt-8">
        <CheckRow
          name="acknowledged"
          label="Ég hef lesið þetta og ber ábyrgð á eigin heilsu"
          defaultChecked={draft.acknowledgedHealthAt !== undefined}
        />

        <div className="mt-1">
          <FieldError message={errors.acknowledged} />
        </div>
      </div>
    </>
  );
}

function MeasurementsStep({ draft, errors }: { draft: OnboardingDraft; errors: StepErrors }) {
  return (
    <>
      <h1 className="font-display text-title text-text">Mælingar</h1>

      <p className="mt-3 text-text-soft">
        Án þessara talna eru næringarviðmiðin ágiskun. Þú getur breytt þeim hvenær sem er.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="weightKg">Þyngd (kg)</Label>

          <Input
            id="weightKg"
            name="weightKg"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={draft.weightKg}
            aria-invalid={errors.weightKg !== undefined}
            className="h-11"
          />

          <FieldError message={errors.weightKg} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="heightCm">Hæð (cm)</Label>

          <Input
            id="heightCm"
            name="heightCm"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={draft.heightCm}
            aria-invalid={errors.heightCm !== undefined}
            className="h-11"
          />

          <FieldError message={errors.heightCm} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="age">Aldur</Label>

          <Input
            id="age"
            name="age"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={draft.age}
            aria-invalid={errors.age !== undefined}
            className="h-11"
          />

          <FieldError message={errors.age} />
        </div>
      </div>

      <fieldset className="mt-10">
        <legend className="text-sm text-text-soft">Kyn</legend>

        <p className="mt-1 text-xs text-text-muted">
          Formúlan fyrir grunnbrennslu notar þetta. Það er eina ástæðan fyrir spurningunni.
        </p>

        <div className="mt-3">
          <RadioGroup name="sex" defaultValue={draft.sex}>
            {SEX_VALUES.map((value) => (
              <ChoiceRow key={value} value={value} title={SEX_LABELS[value]} detail={undefined} />
            ))}
          </RadioGroup>

          <FieldError message={errors.sex} />
        </div>
      </fieldset>

      <fieldset className="mt-10">
        <legend className="text-sm text-text-soft">Hversu virkur ertu dags daglega?</legend>

        <p className="mt-1 text-xs text-text-muted">
          Utan æfinga. Veldu það sem lýsir venjulegum degi hjá þér.
        </p>

        <div className="mt-3">
          <RadioGroup name="activityLevel" defaultValue={draft.activityLevel}>
            {ACTIVITY_VALUES.map((value) => (
              <ChoiceRow
                key={value}
                value={value}
                title={ACTIVITY_LABELS[value].label}
                detail={ACTIVITY_LABELS[value].example}
              />
            ))}
          </RadioGroup>

          <FieldError message={errors.activityLevel} />
        </div>
      </fieldset>
    </>
  );
}

function GoalStep({
  draft,
  errors,
  planMissing,
}: {
  draft: OnboardingDraft;
  errors: StepErrors;
  planMissing: boolean;
}) {
  return (
    <>
      <h1 className="font-display text-title text-text">Hvert er markmiðið?</h1>

      <p className="mt-3 text-text-soft">
        Þetta ræður næringarviðmiðunum og hvaða plan þú fær. Þú getur skipt um síðar.
      </p>

      {planMissing && (
        <p role="alert" className="mt-6 border-l-2 border-destructive pl-4 text-sm text-text-soft">
          Planið sem þú valdir er ekki lengur í boði. Veldu markmið aftur — við sýnum þér bara það
          sem er til.
        </p>
      )}

      <div className="mt-8">
        <RadioGroup name="goal" defaultValue={draft.goal}>
          {GOAL_VALUES.map((value) => (
            <ChoiceRow
              key={value}
              value={value}
              title={GOAL_LABELS[value].label}
              detail={GOAL_LABELS[value].description}
            />
          ))}
        </RadioGroup>

        <FieldError message={errors.goal} />
      </div>
    </>
  );
}

function FrequencyStep({
  draft,
  errors,
  frequencies,
}: {
  draft: OnboardingDraft;
  errors: StepErrors;
  frequencies: readonly number[];
}) {
  return (
    <>
      <h1 className="font-display text-title text-text">Hversu oft viltu æfa?</h1>

      <p className="mt-3 text-text-soft">
        Veldu það sem þú treystir þér til í verstu viku mánaðarins, ekki þeirri bestu.
      </p>

      {frequencies.length === 0 ? (
        /**
         * Aron has published no plan for this goal yet. An empty radio group
         * with a dead "Áfram" button would read as a broken app, so this says
         * what is actually true and offers the one move that works.
         */
        <div className="mt-8 border-l-2 border-bronze-deep pl-5">
          <p className="text-text-soft">
            Planið fyrir þetta markmið er í smíðum. Aron er að taka það upp núna.
          </p>

          <p className="mt-3 text-sm text-text-muted">
            Veldu annað markmið í bili, eða komdu aftur — við sendum þér skilaboð þegar planið er
            komið inn.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <RadioGroup
            name="sessionsPerWeek"
            defaultValue={
              draft.sessionsPerWeek === undefined ? undefined : String(draft.sessionsPerWeek)
            }
          >
            {frequencies.map((count) => (
              <ChoiceRow
                key={count}
                value={String(count)}
                title={`${count} sinnum í viku`}
                detail={undefined}
              />
            ))}
          </RadioGroup>

          <FieldError message={errors.sessionsPerWeek} />
        </div>
      )}
    </>
  );
}

export default function Onboarding({ loaderData, actionData }: Route.ComponentProps) {
  const { step, steps, draft, frequencies, planMissing } = loaderData;

  const errors: StepErrors = actionData?.errors ?? {};

  const position = steps.indexOf(step);

  const previous = position > 0 ? steps[position - 1] : undefined;

  const isLast = position === steps.length - 1;

  const canContinue = step !== "frequency" || frequencies.length > 0;

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <span className="crest-mark mb-8 w-10" aria-hidden="true" />

      <Progress step={step} steps={steps} />

      <Form method="post" action={`/onboarding?step=${step}`}>
        {step === "health" && <HealthStep draft={draft} errors={errors} />}

        {step === "acknowledge" && <AcknowledgeStep draft={draft} errors={errors} />}

        {step === "measurements" && <MeasurementsStep draft={draft} errors={errors} />}

        {step === "goal" && <GoalStep draft={draft} errors={errors} planMissing={planMissing} />}

        {step === "frequency" && (
          <FrequencyStep draft={draft} errors={errors} frequencies={frequencies} />
        )}

        <div className="mt-12 flex items-center justify-between gap-4">
          {previous === undefined ? (
            <span />
          ) : (
            /**
             * Back navigates, so it is a link and must announce as one. Base
             * UI's Button puts `role="button"` on whatever it renders, which
             * tells a screen reader this performs an action rather than going
             * somewhere — so this takes the variants and skips the component.
             */
            <Link
              to={`/onboarding?step=${previous}`}
              className={buttonVariants({ variant: "ghost", size: "touch" })}
            >
              Til baka
            </Link>
          )}

          {canContinue && (
            <Button type="submit" size="touch">
              {isLast ? "Sjá planið mitt" : "Áfram"}
            </Button>
          )}
        </div>
      </Form>
    </main>
  );
}
