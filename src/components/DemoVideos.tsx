import { embeddableVideos, type DemoVideo } from "@/lib/video-embed";

/**
 * Vidéos de démonstration SpotLocal en format vertical 9:16 : côte à côte s'il y en a plusieurs,
 * centrée et de largeur limitée s'il n'y en a qu'une.
 */
export function DemoVideos({
  videos,
  className = "",
}: {
  videos: DemoVideo[];
  className?: string;
}) {
  const items = embeddableVideos(videos);
  if (items.length === 0) return null;
  const layout = items.length > 1 ? "grid-cols-2" : "mx-auto max-w-[260px] grid-cols-1";

  return (
    <div className={`grid gap-3 ${layout} ${className}`}>
      {items.map((video) => (
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
