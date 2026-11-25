import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const QUICK_AMOUNTS = [15, 30, 50] as const;
export const MAX_SUPPORT_AMOUNT = 500;

type DeclareResponse = {
  status: "saved" | "already_declared" | "invalid_amount" | "no_activation" | "too_late";
};

/**
 * Encart facultatif affiché après la validation d'un coupon : le client indique combien il a
 * dépensé, ce qui alimente son compteur « soutien local » sur /compte.
 */
export function SupportAmountPrompt({
  promoId,
  shopName,
  onSaved,
  onSkip,
}: {
  promoId: string;
  shopName: string;
  /** Montant enregistré (ou déjà présent) : l'encart peut disparaître. */
  onSaved: () => void;
  /** « Passer » : le client ne souhaite pas déclarer de montant pour ce passage. */
  onSkip: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  const customValue = custom.trim() === "" ? null : Number(custom.replace(",", "."));
  const amount = customValue ?? selected;
  const valid =
    amount !== null && Number.isFinite(amount) && amount >= 1 && amount <= MAX_SUPPORT_AMOUNT;

  async function submit() {
    if (!valid || amount === null) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("declarer_soutien", {
      p_promo_id: promoId,
      p_montant: amount,
    });
    setBusy(false);
    if (error) {
      // Message Supabase réel (fonction absente, droits, réseau…) pour faciliter le diagnostic.
      console.error("declarer_soutien a échoué", error);
      toast.error(`Impossible d'enregistrer votre soutien : ${error.message}`);
      return;
    }
    const result = data as DeclareResponse;
    switch (result.status) {
      case "saved":
        toast.success("Merci pour votre soutien au commerce local !");
        await queryClient.invalidateQueries({ queryKey: ["soutien-local-total"] });
        onSaved();
        return;
      case "already_declared":
        toast.info("Votre soutien pour ce passage est déjà enregistré.");
        onSaved();
        return;
      case "too_late":
        toast.error("Le montant ne peut plus être déclaré : la validation date de plus de 24 h.");
        onSkip();
        return;
      case "no_activation":
        toast.error("Aucune validation de coupon trouvée pour cette offre sur votre compte.");
        return;
      default:
        toast.error(`Indiquez un montant entre 1 et ${MAX_SUPPORT_AMOUNT} €.`);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="mt-3 rounded-2xl border border-border bg-card p-4 text-left"
    >
      <p className="text-sm font-semibold text-foreground">
        Combien avez-vous dépensé chez {shopName} ?
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {QUICK_AMOUNTS.map((value) => {
          const active = customValue === null && selected === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSelected(value);
                setCustom("");
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
                active
                  ? "bg-navy text-primary-foreground ring-navy"
                  : "bg-card text-foreground ring-border hover:bg-secondary"
              }`}
            >
              {value} €
            </button>
          );
        })}
        <label className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm ring-1 ring-border focus-within:ring-navy">
          <span className="sr-only">Autre montant en euros</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={MAX_SUPPORT_AMOUNT}
            step="any"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Autre"
            className="w-16 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
          <span className="text-muted-foreground">€</span>
        </label>
      </div>
      {customValue !== null && !valid ? (
        <p className="mt-2 text-xs text-red-600">
          Indiquez un montant entre 1 et {MAX_SUPPORT_AMOUNT} €.
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          disabled={!valid || busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Valider mon soutien
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Passer
        </button>
      </div>
    </form>
  );
}
