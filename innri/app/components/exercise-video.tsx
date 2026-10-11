import { Play, X } from "lucide-react";
import { useState } from "react";

import type { VideoEmbed } from "~/lib/video";

/**
 * The player loads on tap, not with the page. A session lists up to eight
 * exercises, and eight YouTube iframes cost a phone several megabytes of
 * script before the member has looked at the first set.
 */
export const ExerciseVideo = ({ embed, name }: { embed: VideoEmbed; name: string }) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-1 mt-2 flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-text-soft transition-colors hover:text-text"
      >
        <Play className="size-4" aria-hidden="true" />
        Sjá myndband
      </button>
    );
  }

  return (
    <div className="mt-3">
      <div
        className={
          embed.vertical
            ? "mx-auto aspect-9/16 w-full max-w-xs overflow-hidden rounded-lg bg-background"
            : "aspect-video w-full overflow-hidden rounded-lg bg-background"
        }
      >
        <iframe
          src={embed.src}
          title={`Myndband: ${name}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="-ml-1 mt-1 flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-text-soft transition-colors hover:text-text"
      >
        <X className="size-4" aria-hidden="true" />
        Loka myndbandi
      </button>
    </div>
  );
};
