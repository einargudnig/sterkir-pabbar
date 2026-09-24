import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { ACTIVITY_LABELS, ACTIVITY_VALUES, SEX_LABELS, SEX_VALUES } from "~/lib/onboarding";
import type { OnboardingDraft, StepErrors } from "~/lib/onboarding-draft.server";

/**
 * The inputs behind the macro calculation, shared by the wizard's last step and
 * the measurements form in Stillingar. One component so both submit the same
 * field names to the same schema — `submitStep("measurements", …)`.
 */

export function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function ChoiceRow({
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

type Measurements = Pick<
  OnboardingDraft,
  "weightKg" | "heightCm" | "age" | "sex" | "activityLevel"
>;

export function MeasurementFields({
  defaults,
  errors,
}: {
  defaults: Measurements;
  errors: StepErrors;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="weightKg">Þyngd (kg)</Label>

          <Input
            id="weightKg"
            name="weightKg"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={defaults.weightKg}
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
            defaultValue={defaults.heightCm}
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
            defaultValue={defaults.age}
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
          <RadioGroup name="sex" defaultValue={defaults.sex}>
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
          <RadioGroup name="activityLevel" defaultValue={defaults.activityLevel}>
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
