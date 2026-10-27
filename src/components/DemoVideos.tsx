import { PRO_TUTORIAL_VIDEOS, toVideoEmbedUrl } from "@/lib/video-embed";

/** Vidéos de démonstration intégrables (liens non reconnus écartés). */
export const DEMO_VIDEOS = PRO_TUTORIAL_VIDEOS.flatMap(({ title, url }) => {
  const embedUrl = toVideoEmbedUrl(url);
  return embedUrl ? [{ title, embedUrl }] : [];
});

/** Vidéos de démonstration SpotLocal en format vertical 9:16, côte à côte. */
export function DemoVideos({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {DEMO_VIDEOS.map((video) => (
        <div
          key={video.embedUrl}
          className="aspect-[9/16] overflow-hidden rounded-xl bg-gradient-navy shadow-md"
        >
          <iframe
            src={video.embedUrl}
            title={video.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      ))}
    </div>
  );
}
