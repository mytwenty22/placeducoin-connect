import { useState } from "react";
import { Ticket, Check } from "lucide-react";
import { logStatEvent } from "@/lib/stats-tracking";

export function CouponButton({
  commerceId,
  compact = false,
  className = "",
}: {
  commerceId: string | undefined;
  compact?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const sizeClass = compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  if (revealed) {
    return (
      <p
        className={`inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 font-bold text-white ${sizeClass} ${className}`}
      >
        <Check className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />{" "}
        {compact ? "Coupon prêt" : "Coupon prêt — présentez cet écran en caisse"}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setRevealed(true);
        void logStatEvent(commerceId, "coupon_open");
      }}
      className={`inline-flex items-center gap-1.5 rounded-xl bg-primary font-bold text-primary-foreground hover:bg-navy-soft ${sizeClass} ${className}`}
    >
      <Ticket className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> Voir mon coupon
    </button>
  );
}
