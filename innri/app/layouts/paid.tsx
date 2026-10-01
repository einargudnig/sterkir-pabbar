import { Outlet } from "react-router";

import { AssistantChat } from "~/components/assistant-chat";
import { serverEnv } from "~/lib/env.server";
import { requireActiveAccess } from "~/lib/gates.server";

import type { Route } from "./+types/paid";

/**
 * The paid half of the member area — the plan and the macros. Nested inside
 * the member layout, which only asks for a finished questionnaire.
 *
 * The guard is this loader, so a route added under this layout is paid-only by
 * existing here. Its redirect also beats the child loaders, which run in
 * parallel: a member without access gets sent to the preview, and the plan the
 * child fetched is never serialized to them.
 */
export async function loader(args: Route.LoaderArgs) {
  await requireActiveAccess(args);

  /** The kill switch hides the bubble too, not just the endpoint behind it. */
  return { assistantEnabled: serverEnv().ASSISTANT_ENABLED };
}

export default function PaidLayout({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Outlet />

      {loaderData.assistantEnabled && <AssistantChat />}
    </>
  );
}
