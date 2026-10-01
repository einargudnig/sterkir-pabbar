import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

/**
 * The members' AI assistant, as a bubble in the corner of every paid page.
 *
 * The conversation lives in this component's state and nowhere else: closing
 * the panel keeps it while the member moves between pages, a reload clears it,
 * and the server stores none of the text — see `api/assistant.ts`.
 */

const CONTACT = "mailto:info@sterkirpabbar.is";

/** Opens the member's own mail app. They see and send it; nothing is shared for them. */
const REPORT = `${CONTACT}?subject=${encodeURIComponent("Vandamál í aðstoðarmanni")}`;

/** The route answers 429 with `{"error":"limit"}`; the transport surfaces the body. */
const errorText = (error: Error) =>
  error.message.includes('"limit"')
    ? "Þú hefur náð hámarki spurninga í dag. Prófaðu aftur á morgun."
    : "Eitthvað fór úrskeiðis. Reyndu aftur eftir smástund.";

const transport = new DefaultChatTransport({ api: "/api/assistant" });

export const AssistantChat = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({ transport });
  const end = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  const send = () => {
    const text = input.trim();

    if (text.length === 0 || busy) {
      return;
    }

    void sendMessage({ text });
    setInput("");
  };

  if (!open) {
    return (
      <div className="fixed right-4 bottom-4 z-20 shadow-lg">
        <Button size="lg" onClick={() => setOpen(true)}>
          <MessageCircle aria-hidden="true" />
          Spyrja
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label="Aðstoðarmaður"
      className="fixed inset-x-4 bottom-4 z-20 flex h-136 max-h-4/5 flex-col rounded-xl border border-line-soft bg-raised shadow-lg sm:left-auto sm:w-96"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line-soft p-4">
        <div>
          <h2 className="text-sm text-text">Aðstoðarmaður</h2>

          <p className="mt-1 text-xs text-text-muted">
            Gervigreind sem svarar út frá efni Arons og þínu plani. Getur skjátlast og breytir engu.
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(false)}
          aria-label="Loka aðstoðarmanni"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-text-muted">
            Spurðu um æfingarnar, næringuna eða vefinn. Til dæmis: „Hvað á ég að gera ef ég missi af
            æfingu?“
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-8 rounded-lg bg-base px-3 py-2 text-sm text-text"
                : "mr-4 text-sm text-text-soft"
            }
          >
            {message.parts.map((part, index) =>
              part.type === "text" ? (
                <p key={`${message.id}-${index}`} className="whitespace-pre-wrap">
                  {part.text}
                </p>
              ) : null,
            )}
          </div>
        ))}

        {status === "submitted" && <p className="text-sm text-text-muted">Augnablik…</p>}

        {error && (
          <p role="alert" className="border-l-2 border-bronze pl-3 text-sm text-text-soft">
            {errorText(error)}
          </p>
        )}

        <div ref={end} />
      </div>

      <form
        className="border-t border-line-soft p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            maxLength={2000}
            rows={1}
            placeholder="Skrifaðu spurningu…"
            aria-label="Spurning"
            className="min-h-10"
          />

          <Button type="submit" size="icon" disabled={busy} aria-label="Senda">
            <Send aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <p className="mt-2 flex gap-4 text-xs text-text-muted">
          <a href={CONTACT} className="underline-offset-2 hover:text-text hover:underline">
            Hafa samband við Aron
          </a>

          <a href={REPORT} className="underline-offset-2 hover:text-text hover:underline">
            Tilkynna vandamál
          </a>
        </p>
      </form>
    </section>
  );
};
