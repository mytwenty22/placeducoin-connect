import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Retour"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.history.back();
        } else {
          router.navigate({ to: "/" });
        }
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Retour</span>
    </button>
  );
}
