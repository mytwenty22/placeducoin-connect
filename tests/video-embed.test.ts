import { describe, expect, it } from "vitest";
import { PRO_TUTORIAL_VIDEOS, toVideoEmbedUrl } from "../src/lib/video-embed";

describe("PRO_TUTORIAL_VIDEOS", () => {
  it("ne contient que des liens intégrables", () => {
    for (const { url } of PRO_TUTORIAL_VIDEOS) expect(toVideoEmbedUrl(url)).not.toBeNull();
  });
});

describe("toVideoEmbedUrl", () => {
  it("convertit les liens YouTube", () => {
    const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";
    expect(toVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(embed);
    expect(toVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(embed);
    expect(toVideoEmbedUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toBe(embed);
    expect(toVideoEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(embed);
  });

  it("convertit les liens Vimeo", () => {
    expect(toVideoEmbedUrl("https://vimeo.com/76979871")).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1",
    );
    expect(toVideoEmbedUrl("https://player.vimeo.com/video/76979871")).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1",
    );
  });

  it("refuse les autres liens", () => {
    expect(toVideoEmbedUrl("")).toBeNull();
    expect(toVideoEmbedUrl("https://example.com/video.mp4")).toBeNull();
    expect(toVideoEmbedUrl("pas une url")).toBeNull();
  });
});
