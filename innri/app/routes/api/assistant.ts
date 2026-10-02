import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { z } from "zod";

import {
  assistantInstructions,
  assistantTools,
  generationSettings,
  messagesToday,
  recordUsage,
} from "~/lib/assistant.server";
import { serverEnv } from "~/lib/env.server";
import { requireActiveAccess } from "~/lib/gates.server";

import type { Route } from "./+types/assistant";

/**
 * The members' AI assistant endpoint, called by the chat bubble.
 *
 * A resource route runs its own action and nothing else — no layout loader, so
 * the paid layout's gate does NOT cover it. The `requireActiveAccess` call below
 * is the only thing between this endpoint and the internet, and it must stay
 * the first line.
 *
 * Who is asking comes from the session, never from the body. The body supplies
 * only the conversation, and only its text survives: the browser holds the
 * history, so tool results in it could be forged, and they are dropped.
 */

/** Enough context for a follow-up question; bounded so the cost per turn is too. */
const HISTORY = 12;

/** A question, not a document. */
const MAX_CHARS = 2000;

const textOnly = (messages: readonly UIMessage[]): UIMessage[] =>
  messages.slice(-HISTORY).flatMap((message) => {
    const parts = message.parts.filter((part) => part.type === "text");

    return (message.role === "user" || message.role === "assistant") && parts.length > 0
      ? [{ ...message, parts }]
      : [];
  });

/** The transport's envelope. The messages inside are validated by the AI SDK. */
const bodySchema = z.object({ messages: z.array(z.unknown()).max(100) });

const tooLong = (messages: readonly UIMessage[]) =>
  messages.some((message) =>
    message.parts.some((part) => part.type === "text" && part.text.length > MAX_CHARS),
  );

const sumTokens = (
  steps: readonly { readonly usage: LanguageModelUsage }[],
  key: "inputTokens" | "outputTokens",
) =>
  steps.length === 0 ? undefined : steps.reduce((total, step) => total + (step.usage[key] ?? 0), 0);

export async function action(args: Route.ActionArgs) {
  const user = await requireActiveAccess(args);
  const env = serverEnv();

  if (!env.ASSISTANT_ENABLED) {
    return Response.json({ error: "disabled" }, { status: 503 });
  }

  if ((await messagesToday(user.id)) >= env.ASSISTANT_DAILY_LIMIT) {
    return Response.json({ error: "limit" }, { status: 429 });
  }

  const body = bodySchema.safeParse(await args.request.json().catch(() => null));

  if (!body.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const parsed = await safeValidateUIMessages({ messages: body.data.messages });

  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const messages = textOnly(parsed.data);

  if (messages.at(-1)?.role !== "user" || tooLong(messages)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const startedAt = Date.now();

  const result = streamText({
    model: env.ASSISTANT_MODEL,
    instructions: await assistantInstructions(),
    messages: await convertToModelMessages(messages),
    tools: assistantTools(user.id),
    ...generationSettings,
    timeout: { totalMs: 45_000 },
    abortSignal: args.request.signal,

    onEnd: async ({ totalUsage }) => {
      await recordUsage({
        userId: user.id,
        model: env.ASSISTANT_MODEL,
        outcome: "answered",
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
        durationMs: Date.now() - startedAt,
      });
    },

    /**
     * A closed tab, a stop press or the timeout skips onEnd and onError, and an unrecorded message is
     * one the daily limit never sees. Usage covers finished steps only; the
     * step in flight when the member left is billed but not counted here.
     */
    onAbort: async ({ steps }) => {
      await recordUsage({
        userId: user.id,
        model: env.ASSISTANT_MODEL,
        outcome: "aborted",
        inputTokens: sumTokens(steps, "inputTokens"),
        outputTokens: sumTokens(steps, "outputTokens"),
        durationMs: Date.now() - startedAt,
      });
    },

    /** Logged without the conversation: the error, not what the member asked. */
    onError: async ({ error }) => {
      console.error("assistant: generation failed", error);

      await recordUsage({
        userId: user.id,
        model: env.ASSISTANT_MODEL,
        outcome: "failed",
        durationMs: Date.now() - startedAt,
      });
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
