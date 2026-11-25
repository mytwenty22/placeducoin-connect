import { useEffect, useState } from "react";
import { Heart, Tag } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { readStoredIntention, saveIntention, type Intention } from "@/lib/local-support";

const OPTIONS: { value: Intention; label: string; icon: typeof Tag }[] = [
  { value: "offres", label: "Je viens pour les offres", icon: Tag },
  { value: "quartier", label: "Je fais vivre mon quartier", icon: Heart },
];

/** Deux entrées équivalentes vers la carte / liste des commerces ; le choix est facultatif. */
export function IntentionButtons() {
  const { session } = useSession();
  const [chosen, setChosen] = useState<Intention | null>(null);

  // Après le montage (rendu serveur identique pour tous) : métadonnées du compte, sinon navigateur.
  useEffect(() => {
    const fromAccount = session?.user.user_metadata?.["intention"];
    setChosen(
      fromAccount === "offres" || fromAccount === "quartier" ? fromAccount : readStoredIntention(),
    );
  }, [session]);

  function choose(value: Intention) {
    setChosen(value);
    void saveIntention(value, Boolean(session)).catch(() => {});
    document.getElementById("resultats")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={chosen === value}
          onClick={() => choose(value)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
            chosen === value
              ? "bg-card text-navy"
              : "bg-white/10 text-primary-foreground ring-1 ring-white/25 hover:bg-white/20"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
