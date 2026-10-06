import { describe, expect, it } from "vitest";

import { toVideoEmbed } from "./video";

const ID = "Q2atVal4NGs";

const YOUTUBE_SRC = `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0`;

describe("toVideoEmbed — YouTube", () => {
  it("reads a Short as vertical", () => {
    expect(toVideoEmbed(`https://youtube.com/shorts/${ID}`)).toEqual({
      src: YOUTUBE_SRC,
      vertical: true,
    });
    expect(toVideoEmbed(`https://www.youtube.com/shorts/${ID}?feature=share`)?.vertical).toBe(true);
  });

  it("reads every share format of a normal video as the same landscape player", () => {
    const expected = { src: YOUTUBE_SRC, vertical: false };

    expect(toVideoEmbed(`https://www.youtube.com/watch?v=${ID}`)).toEqual(expected);
    expect(toVideoEmbed(`https://m.youtube.com/watch?v=${ID}&t=42s`)).toEqual(expected);
    expect(toVideoEmbed(`https://youtu.be/${ID}?si=abc123`)).toEqual(expected);
    expect(toVideoEmbed(`https://www.youtube.com/embed/${ID}`)).toEqual(expected);
  });

  it("tolerates whitespace pasted around the link", () => {
    expect(toVideoEmbed(`  https://youtu.be/${ID}\n`)?.src).toBe(YOUTUBE_SRC);
  });

  it("refuses links that are not a single video", () => {
    expect(toVideoEmbed("https://www.youtube.com/@sterkirpabbar")).toBeNull();
    expect(toVideoEmbed("https://www.youtube.com/playlist?list=PL123")).toBeNull();
    expect(toVideoEmbed("https://www.youtube.com/watch")).toBeNull();
    expect(toVideoEmbed("https://youtube.com/shorts/")).toBeNull();
  });

  it("refuses an id that would escape the embed path", () => {
    expect(toVideoEmbed("https://www.youtube.com/watch?v=../../evil")).toBeNull();
  });
});

describe("toVideoEmbed — Vimeo", () => {
  it("embeds a public video", () => {
    expect(toVideoEmbed("https://vimeo.com/123456789")).toEqual({
      src: "https://player.vimeo.com/video/123456789?autoplay=1&playsinline=1",
      vertical: false,
    });
  });

  it("keeps the privacy hash of an unlisted video, from either link form", () => {
    const src = "https://player.vimeo.com/video/123456789?autoplay=1&playsinline=1&h=abcdef1234";

    expect(toVideoEmbed("https://vimeo.com/123456789/abcdef1234")?.src).toBe(src);
    expect(toVideoEmbed("https://player.vimeo.com/video/123456789?h=abcdef1234")?.src).toBe(src);
  });

  it("refuses a Vimeo page that is not a video", () => {
    expect(toVideoEmbed("https://vimeo.com/sterkirpabbar")).toBeNull();
  });
});

describe("toVideoEmbed — anything else", () => {
  it("refuses hosts that cannot be embedded and strings that are not URLs", () => {
    expect(toVideoEmbed("https://drive.google.com/file/d/abc/view")).toBeNull();
    expect(toVideoEmbed("youtube.com/shorts/Q2atVal4NGs")).toBeNull();
    expect(toVideoEmbed("")).toBeNull();
  });
});
