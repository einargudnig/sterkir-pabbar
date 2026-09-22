import { Form, Link, redirect } from "react-router";

import { Button, buttonVariants } from "~/components/ui/button";
import { formatDate } from "~/lib/format";
import type { CancellationPreview, RepeatSubscription } from "~/lib/repeat";
import { cancelSubscription, getSubscription, previewCancellation } from "~/lib/repeat.server";
import { applySubscription, requireActiveAccess } from "~/lib/subscription.server";

import type { Route } from "./+types/settings";

/**
 * Subscription details are read live from Repeat here — unlike the paid gate,
 * which never calls Repeat. This page only DESCRIBES the subscription, so a
 * Repeat outage costs the description, not anyone's access.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireActiveAccess(args);
  const wantsToCancel = new URL(args.request.url).searchParams.has("uppsogn");

  if (!user.repeatSubscriptionId) {
    return { subscription: null, preview: null, unavailable: false };
  }

  const id = user.repeatSubscriptionId;

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
}

export async function action(args: Route.ActionArgs) {
  const user = await requireActiveAccess(args);

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

export default function Stillingar({ loaderData }: Route.ComponentProps) {
  const { subscription, preview, unavailable } = loaderData;

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

        <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
          <p className="text-sm text-text-muted">
            Netfang og lykilorð verða hér þegar Clerk tengist (fasi 1).
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm text-text-soft">Mínar upplýsingar</h2>

        <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
          <p className="text-sm text-text-soft">
            Þyngd, hæð, aldur og virkni. Breytist þeim eru næringarviðmiðin reiknuð upp á nýtt.
          </p>

          <Button variant="outline" className="mt-4" disabled>
            Uppfæra mælingar
          </Button>
        </div>
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
                  <Button type="submit" variant="destructive">
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
