/**
 * Turns whatever video link Aron pastes into Sanity into an embeddable player.
 *
 * He copies links from the YouTube app, the browser address bar or Vimeo's
 * share sheet, so one exercise may be `youtube.com/shorts/…` and the next
 * `youtu.be/…`. The Studio validator (`studio/schemas/validators.ts`) only
 * checks the host; this decides what the member actually sees.
 *
 * `null` means "no player" — the page then shows "Myndband kemur", the same
 * as an exercise with no link, rather than a broken iframe.
 */
export type VideoEmbed = {
  src: string;
  /** Shorts are filmed on a phone, 9:16. A 16:9 frame letterboxes them to a sliver. */
  vertical: boolean;
};

const YOUTUBE_ID = /^[\w-]{11}$/u;

const youtubeEmbed = (id: string | undefined, vertical: boolean): VideoEmbed | null => {
  if (!id || !YOUTUBE_ID.test(id)) return null;

  return {
    src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`,
    vertical,
  };
};

const vimeoEmbed = (id: string | undefined, hash: string | null): VideoEmbed | null => {
  if (!id || !/^\d+$/u.test(id)) return null;

  const query = new URLSearchParams({ autoplay: "1", playsinline: "1" });

  // Unlisted Vimeo videos only play with their privacy hash.
  if (hash) query.set("h", hash);

  return { src: `https://player.vimeo.com/video/${id}?${query.toString()}`, vertical: false };
};

export const toVideoEmbed = (url: string): VideoEmbed | null => {
  let parsed: URL;

  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^(www|m)\./u, "");

  const [first, second, third] = parsed.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return youtubeEmbed(first, false);

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (first === "watch") return youtubeEmbed(parsed.searchParams.get("v") ?? undefined, false);

    if (first === "shorts") return youtubeEmbed(second, true);

    if (first === "embed" || first === "live") return youtubeEmbed(second, false);

    return null;
  }

  if (host === "vimeo.com") return vimeoEmbed(first, second ?? parsed.searchParams.get("h"));

  if (host === "player.vimeo.com" && first === "video") {
    return vimeoEmbed(second, third ?? parsed.searchParams.get("h"));
  }

  return null;
};
