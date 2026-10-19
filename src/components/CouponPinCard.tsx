import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const DEFAULT_PIN = "1234";

// Code PIN à 4 chiffres du commerce : il permet de valider un coupon en caisse quand la
// vérification GPS échoue (position refusée, imprécise, client annoncé trop loin…). Stocké hors de
// la table publique commerces, lu et modifié uniquement via les RPC réservées au propriétaire.
export function CouponPinCard({ commerceId }: { commerceId: string }) {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState("");

  const pinQuery = useQuery({
    queryKey: ["commerce-pin", commerceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_commerce_pin", {
        p_commerce_id: commerceId,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (pin: string) => {
      const { error } = await supabase.rpc("set_commerce_pin", {
        p_commerce_id: commerceId,
        p_pin: pin,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setDraft("");
      toast.success("Code commerçant mis à jour.");
      await queryClient.invalidateQueries({ queryKey: ["commerce-pin", commerceId] });
    },
    onError: () => toast.error("Impossible d'enregistrer le code. Réessayez."),
  });

  const pin = pinQuery.data;
  const isDefault = pin === DEFAULT_PIN;

  return (
    <section className="surface-card p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-navy" />
        <h3 className="font-display text-base font-extrabold text-foreground">
          Code commerçant (validation des coupons)
        </h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Si la géolocalisation du client échoue, il peut valider son coupon avec ce code à 4 chiffres
        : saisissez-le vous-même sur son téléphone pour qu'il reste confidentiel.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-2xl font-black tracking-[0.4em] text-foreground">
          {pinQuery.isLoading ? "…" : pin ? (visible ? pin : "••••") : "—"}
        </span>
        {pin ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {visible ? "Masquer" : "Afficher"}
          </button>
        ) : null}
      </div>
      {isDefault ? (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Vous utilisez le code par défaut (1234), connu de tous : choisissez votre propre code.
        </p>
      ) : null}
      {pinQuery.isError ? (
        <p className="mt-2 text-xs text-red-600">Impossible de charger le code.</p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{4}$/.test(draft)) saveMutation.mutate(draft);
        }}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Nouveau code"
          aria-label="Nouveau code commerçant (4 chiffres)"
          className="w-36 rounded-xl border border-input bg-background px-3 py-2 text-center font-mono text-sm tracking-[0.3em] text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={draft.length !== 4 || saveMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enregistrer
        </button>
      </form>
    </section>
  );
}
