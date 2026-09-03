import { Star } from "lucide-react";

export function GoogleRatingStars({
  rating,
  reviewCount,
  className = "",
  textClassName = "text-foreground",
  mutedTextClassName = "text-muted-foreground",
}: {
  rating?: number | undefined;
  reviewCount?: number | undefined;
  className?: string;
  textClassName?: string;
  mutedTextClassName?: string;
}) {
  if (rating === undefined) return null;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <div className="flex items-center">
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i < Math.round(rating);
          return (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/30"
              }`}
            />
          );
        })}
      </div>
      <span className={`text-xs font-bold ${textClassName}`}>{rating.toFixed(1)}</span>
      {reviewCount !== undefined ? (
        <span className={`text-xs ${mutedTextClassName}`}>({reviewCount} avis)</span>
      ) : null}
    </div>
  );
}
