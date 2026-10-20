// Logo SpotLocal (tracés dans lib/spotlocal-logo, mêmes que public/logo.svg et les icônes PWA).
import { LOCAL, MARK, SPOT, WORDMARK_BOX } from "@/lib/spotlocal-logo";

const WORDMARK_VIEWBOX = `0 ${WORDMARK_BOX.y} ${WORDMARK_BOX.width} ${WORDMARK_BOX.height}`;

/** Symbole seul, couleur héritée (currentColor). */
export function SpotLocalMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="12 7 40 51.2" aria-hidden="true" className={className}>
      <path fill="currentColor" fillRule="evenodd" d={MARK} />
    </svg>
  );
}

/** Logotype « SpotLocal » : « Spot » en currentColor, « Local » via localClassName. */
export function SpotLocalWordmark({
  className = "",
  localClassName = "fill-promo",
}: {
  className?: string;
  localClassName?: string;
}) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} role="img" aria-label="SpotLocal" className={className}>
      <path fill="currentColor" d={SPOT} />
      <path className={localClassName} d={LOCAL} />
    </svg>
  );
}
