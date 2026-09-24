import { clerkClient } from "@clerk/react-router/server";
import RepeatCardTokenWidget from "@teamrepeat/card-token";
import { useRef, useState } from "react";
import { redirect, useNavigation, useSubmit } from "react-router";
import { z } from "zod";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { requireUser } from "~/lib/auth.server";
import { serverEnv } from "~/lib/env.server";
import { formatWholeNumber } from "~/lib/format";
import { createOrder, getProduct, getSubscription, RepeatError } from "~/lib/repeat.server";
import {
  adoptSubscription,
  applySubscription,
  canEnter,
  claimCheckout,
  recoverSubscription,
  releaseCheckout,
} from "~/lib/subscription.server";

import type { Route } from "./+types/subscribe";

/**
 * The paywall: Repeat's card widget, then an order our server places.
 *
 * The widget is an iframe on repeat.is — card number and 3-D Secure never touch
 * this page — and hands back a token. The action charges it with `POST
 * /orders/` and writes the mirror from the subscription Repeat created, so the
 * member is in before any webhook arrives.
 *
 * The price comes from the product in Repeat, where Aron sets it. If it cannot
 * be read there is no widget: nobody is asked for a card without seeing what it
 * will be charged.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireUser(args);

  if (canEnter(user, new Date())) {
    throw redirect("/");
  }

  const env = serverEnv();
  const clerkUser = await clerkClient(args).users.getUser(user.clerkUserId);
  const email = clerkUser.primaryEmailAddress?.emailAddress;

  /**
   * Before asking for a card, ask Repeat whether this member has already paid —
   * see `recoverSubscription`. If Repeat cannot be reached, there is no widget
   * either: showing a card form we could not check against is how someone pays
   * twice.
   */
  const recovered = email
    ? await recoverSubscription(user, email).then(
        () => true,
        (error: Error) => {
          console.error("subscribe: recovery check failed", error);

          return false;
        },
      )
    : true;

  if (recovered && canEnter(await requireUser(args), new Date())) {
    throw redirect("/");
  }

  const product = recovered
    ? await getProduct(env.REPEAT_PRODUCT_UUID).catch((error: Error) => {
        console.error("subscribe: product read failed", error);

        return null;
      })
    : null;

  return {
    shopUuid: env.REPEAT_SHOP_UUID,
    price: product?.price ?? null,
    name: clerkUser.fullName ?? "",
    paused: user.subscriptionStatus === "paused",
  };
}

const checkoutSchema = z.object({
  cardToken: z.string().min(1),
  name: z.string().trim().min(2).max(200),
});

type ActionResult = { readonly error: string };

export async function action(args: Route.ActionArgs): Promise<ActionResult | Response> {
  const user = await requireUser(args);

  if (canEnter(user, new Date())) {
    return redirect("/");
  }

  const form = checkoutSchema.safeParse(Object.fromEntries(await args.request.formData()));

  if (!form.success) {
    return { error: "Nafn vantar. Sláðu inn fullt nafn og reyndu aftur." };
  }

  const clerkUser = await clerkClient(args).users.getUser(user.clerkUserId);
  const email = clerkUser.primaryEmailAddress?.emailAddress;

  if (!email) {
    return { error: "Netfang vantar á aðganginn þinn. Bættu því við í Stillingum." };
  }

  if (!(await claimCheckout(user.id))) {
    return { error: "Greiðsla er þegar í vinnslu. Bíddu augnablik og endurhlaðaðu síðuna." };
  }

  let order;

  try {
    order = await createOrder({
      cardToken: form.data.cardToken,
      email,
      name: form.data.name,
      userId: user.id,
    });
  } catch (error) {
    console.error("subscribe: order failed", error);

    /**
     * Repeat answered with an error: the order was refused, so trying again
     * is safe. Anything else — a timeout, a dropped connection, a response we
     * could not parse — means we do not know whether the card was charged.
     * The claim is then left to expire instead of released, so a member
     * cannot pay twice in the two minutes it takes to find out.
     */
    if (error instanceof RepeatError) {
      await releaseCheckout(user.id);

      return { error: "Greiðslan tókst ekki. Athugaðu kortaupplýsingarnar og reyndu aftur." };
    }

    return {
      error:
        "Við fengum ekki svar frá greiðslugáttinni. Ekki reyna aftur strax — athugaðu hvort kvittun hafi borist í tölvupósti, eða hafðu samband við okkur.",
    };
  }

  const subscriptionId = order.subscriptions_created[0];

  if (!subscriptionId) {
    console.error("subscribe: order created without a subscription", order.uuid);

    return { error: `Eitthvað fór úrskeiðis. Hafðu samband og vísaðu í pöntun ${order.uuid}.` };
  }

  /**
   * The charge has happened. From here on, a failure must not look like a
   * failed payment, or the member pays again. The id is written first, with no
   * network in the way; if the read after it fails, the loader re-syncs from
   * the id on the next visit.
   */
  try {
    await adoptSubscription(user.id, subscriptionId);

    const subscription = await getSubscription(subscriptionId);

    await applySubscription({ ...user, repeatSubscriptionId: subscriptionId }, subscription);
  } catch (error) {
    console.error("subscribe: post-order sync failed", order.uuid, error);
  } finally {
    await releaseCheckout(user.id);
  }

  return redirect("/");
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Áskrift — Innri hringurinn" }];
}

const included = [
  "Æfingaplan sniðið að markmiði þínu og hversu oft þú kemst",
  "Næringarviðmið reiknuð út frá þínum tölum",
  "Myndbönd frá Aroni af hverri æfingu",
  "Fróðleikur sem bætist við jafnt og þétt",
] as const;

/**
 * Passed to Repeat's iframe as query parameters, so they cannot be CSS
 * variables. Hex conversions of the tokens in src/styles/global.css — change
 * them there first. `errorColor` is `--destructive` from app.css.
 */
const widgetStyles = {
  borderRadius: 8,
  buttonBackground: "#d8a060", // --color-bronze
  buttonColor: "#160f0b", // --color-base
  color: "#f1ece4", // --color-text
  errorColor: "#ef4444", // --destructive
} as const;

export default function Askrift({ loaderData, actionData }: Route.ComponentProps) {
  const submit = useSubmit();
  const navigation = useNavigation();
  const [name, setName] = useState(loaderData.name);
  const [cardError, setCardError] = useState<string | null>(null);

  /**
   * The widget registers its message listener once, on mount, and keeps the
   * callbacks it was given then. Reading the name through a ref is what makes
   * the submitted name the one in the field now, not the one at mount.
   */
  const nameRef = useRef(name);
  nameRef.current = name;

  const charging = navigation.state !== "idle";
  const nameReady = name.trim().length >= 2;
  const error = cardError ?? actionData?.error ?? null;

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <span className="crest-mark mb-6 w-10" aria-hidden="true" />

      <h1 className="font-display text-title text-text">Innri hringurinn</h1>

      <p className="mt-3 text-text-soft">
        Æfingaplan og næringarviðmið byggð fyrir pabba sem hafa ekki æft í nokkur ár — án þess að
        skuldbinda sig í einkaþjálfun.
      </p>

      <ul className="mt-8 grid gap-3">
        {included.map((item) => (
          <li key={item} className="flex gap-3 rounded-lg border border-line-soft bg-raised p-4">
            <span className="mt-2 size-1.5 flex-none rounded-full bg-bronze" />

            <span className="text-sm text-text-soft">{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-xl border border-line bg-sunken p-6">
        <p className="font-mark text-xs uppercase tracking-mark text-text-muted">Mánaðaráskrift</p>

        {loaderData.price === null ? (
          <p className="mt-2 text-sm text-text-muted">
            Ekki tókst að sækja verðið. Reyndu aftur eftir smástund.
          </p>
        ) : (
          <>
            <p className="mt-2 text-title text-text">
              {formatWholeNumber(loaderData.price)} kr.
              <span className="text-sm text-text-muted"> á mánuði</span>
            </p>

            <p className="mt-1 text-xs text-text-muted">
              Endurnýjast sjálfkrafa. Þú getur sagt upp hvenær sem er í Stillingum.
            </p>

            {loaderData.paused && (
              <p className="mt-4 text-sm text-text-soft">
                Áskriftin þín er í hléi. Ný skráning hér hefur nýja áskrift.
              </p>
            )}

            <div className="mt-6 grid gap-2">
              <Label htmlFor="nafn">Fullt nafn</Label>
              <Input
                id="nafn"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={charging}
              />
            </div>

            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}

            {charging ? (
              <p className="mt-6 text-sm text-text-soft" aria-live="polite">
                Greiðsla í vinnslu — ekki loka síðunni.
              </p>
            ) : nameReady ? (
              <div className="mt-6">
                <RepeatCardTokenWidget
                  shopUUID={loaderData.shopUuid}
                  language="is"
                  styles={widgetStyles}
                  onTokenSuccess={(cardToken) => {
                    setCardError(null);
                    void submit({ cardToken, name: nameRef.current }, { method: "post" });
                  }}
                  onTokenError={() =>
                    setCardError("Ekki tókst að vista kortið. Athugaðu upplýsingarnar.")
                  }
                />
              </div>
            ) : (
              <p className="mt-6 text-sm text-text-muted">
                Sláðu inn nafnið þitt til að halda áfram í greiðslu.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
