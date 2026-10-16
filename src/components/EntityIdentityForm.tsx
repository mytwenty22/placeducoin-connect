import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveIdentity, type EntityType } from "@/lib/entity-id";

export type IdentifierInput = { identifier: string; pending: boolean };

/** Champs SIRET / RNA, sans logique d'enregistrement : partagés par l'inscription et le profil. */
export function IdentifierFields({
  entityType,
  value,
  onChange,
  allowPending,
}: {
  entityType: EntityType;
  value: IdentifierInput;
  onChange: (value: IdentifierInput) => void;
  allowPending: boolean;
}) {
  const isAssociation = entityType === "association";
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isAssociation ? "N° RNA ou N° SIRET *" : "N° SIRET (14 chiffres) *"}
        </span>
        <input
          value={value.identifier}
          disabled={!isAssociation && allowPending && value.pending}
          onChange={(e) => onChange({ ...value, identifier: e.target.value })}
          placeholder={isAssociation ? "W123456789" : "123 456 789 00012"}
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy disabled:opacity-50"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          {isAssociation
            ? "RNA : la lettre W suivie de 9 chiffres, indiqué sur votre récépissé de déclaration en préfecture."
            : "Indiqué sur votre extrait Kbis ou sur annuaire-entreprises.data.gouv.fr."}
        </span>
      </label>
      {!isAssociation && allowPending ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={value.pending}
            onChange={(e) =>
              onChange({
                identifier: e.target.checked ? "" : value.identifier,
                pending: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-input"
          />
          En cours d'immatriculation
        </label>
      ) : null}
    </div>
  );
}

/** Formulaire autonome qui enregistre l'identifiant sur la ligne profiles de l'utilisateur. */
export function EntityIdentityForm({
  userId,
  entityType,
  title,
  description,
  submitLabel = "Enregistrer",
  onSaved,
}: {
  userId: string;
  entityType: EntityType;
  title: string;
  description: string;
  submitLabel?: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<IdentifierInput>({ identifier: "", pending: false });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const resolved = resolveIdentity(entityType, value, { allowPending: false });
      if (!resolved.ok) throw new Error(resolved.error);
      const { error } = await supabase.from("profiles").update(resolved.patch).eq("id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Identifiant enregistré.");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="surface-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
    >
      <div className="flex items-center gap-2">
        <BadgeCheck className="h-5 w-5 shrink-0 text-navy" />
        <h2 className="font-display text-lg font-extrabold text-foreground">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <IdentifierFields
        entityType={entityType}
        value={value}
        onChange={setValue}
        allowPending={false}
      />
      <button
        type="submit"
        disabled={saveMutation.isPending}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {saveMutation.isPending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
