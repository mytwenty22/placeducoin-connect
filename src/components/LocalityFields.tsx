import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchCommunesByPostalCode, locateAddress } from "@/lib/communes";
import type { LocalityValue } from "@/lib/locality";

const NEW_QUARTIER = "__new__";
const selectCls =
  "mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy";
const labelCls = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function LocalityFields({
  value,
  onChange,
  adresse,
  initialVilleId,
}: {
  value: LocalityValue;
  onChange: (value: LocalityValue) => void;
  adresse: string;
  initialVilleId?: string;
}) {
  // Les effets ci-dessous sont asynchrones : on lit toujours la dernière valeur, pas celle
  // capturée au moment où l'effet a démarré.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const communesQuery = useQuery({
    queryKey: ["communes", value.codePostal],
    queryFn: () => fetchCommunesByPostalCode(value.codePostal),
    enabled: /^\d{5}$/.test(value.codePostal),
    staleTime: 24 * 3600 * 1000,
  });

  const initialVilleQuery = useQuery({
    queryKey: ["ville-insee", initialVilleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("villes")
        .select("insee_code")
        .eq("id", initialVilleId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.insee_code as string | null) ?? null;
    },
    enabled: !!initialVilleId,
  });

  // Présélection de la commune : la seule du code postal, sinon celle déjà enregistrée sur la
  // fiche si elle fait partie de la liste.
  const communes = communesQuery.data;
  const initialInsee = initialVilleQuery.data ?? null;
  // Tant que la commune de la fiche n'est pas connue, on ne présélectionne rien : sinon le
  // quartier déjà enregistré serait effacé avant d'avoir pu être reconnu comme toujours valable.
  const initialPending = !!initialVilleId && initialVilleQuery.isPending;
  useEffect(() => {
    if (!communes || initialPending) return;
    const current = valueRef.current;
    const codes = communes.map((c) => c.code);
    if (current.insee && codes.includes(current.insee)) return;
    const next =
      codes.length === 1
        ? codes[0]!
        : initialInsee && codes.includes(initialInsee)
          ? initialInsee
          : "";
    if (next === current.insee) return;
    // Passage de "aucune commune" à la commune initiale : le quartier enregistré reste valable.
    const keepQuartier = !current.insee && next === initialInsee;
    onChangeRef.current({
      ...current,
      insee: next,
      ...(keepQuartier ? {} : { quartierId: null, newQuartier: null }),
    });
  }, [communes, initialInsee, initialPending]);

  // Détection depuis l'adresse : tant que le code postal n'est pas renseigné, on le déduit de
  // l'adresse saisie (Base Adresse Nationale), avec la commune correspondante.
  useEffect(() => {
    if (/^\d{5}$/.test(valueRef.current.codePostal)) return;
    const timer = window.setTimeout(async () => {
      const found = await locateAddress(adresse);
      const current = valueRef.current;
      if (!found || /^\d{5}$/.test(current.codePostal)) return;
      onChangeRef.current({
        codePostal: found.codePostal,
        insee: found.insee,
        quartierId: null,
        newQuartier: null,
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [adresse]);

  const villeQuery = useQuery({
    queryKey: ["ville-by-insee", value.insee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("villes")
        .select("id")
        .eq("insee_code", value.insee)
        .maybeSingle();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
    enabled: !!value.insee,
  });
  const villeId = villeQuery.data ?? null;

  const quartiersQuery = useQuery({
    queryKey: ["quartiers", villeId, value.codePostal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quartiers")
        .select("id, nom")
        .eq("ville_id", villeId!)
        .eq("code_postal", value.codePostal)
        .order("nom");
      if (error) throw error;
      return data as { id: string; nom: string }[];
    },
    enabled: !!villeId,
  });

  const selectedCommune = communes?.find((c) => c.code === value.insee);
  const quartierSelectValue = value.newQuartier !== null ? NEW_QUARTIER : (value.quartierId ?? "");

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelCls}>Code postal *</span>
        <input
          inputMode="numeric"
          value={value.codePostal}
          onChange={(e) =>
            onChange({
              codePostal: e.target.value.replace(/[^\d]/g, "").slice(0, 5),
              insee: "",
              quartierId: null,
              newQuartier: null,
            })
          }
          placeholder="33000"
          className={selectCls}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Rempli automatiquement depuis l'adresse si vous la saisissez d'abord.
        </span>
      </label>

      {communesQuery.isError ? (
        <p className="text-xs text-promo">
          Référentiel des communes indisponible, réessayez dans un instant.
        </p>
      ) : null}
      {communes && communes.length === 0 ? (
        <p className="text-xs text-promo">Aucune commune ne correspond à ce code postal.</p>
      ) : null}

      {communes && communes.length > 1 ? (
        <label className="block">
          <span className={labelCls}>Commune *</span>
          <select
            required
            value={value.insee}
            onChange={(e) =>
              onChange({ ...value, insee: e.target.value, quartierId: null, newQuartier: null })
            }
            className={selectCls}
          >
            <option value="">Choisir une commune</option>
            {communes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
      ) : selectedCommune ? (
        <p className="rounded-xl bg-secondary px-3 py-2.5 text-sm text-foreground">
          Commune : <strong>{selectedCommune.nom}</strong> ({selectedCommune.codeDepartement})
        </p>
      ) : null}

      {value.insee ? (
        <div className="space-y-2">
          <label className="block">
            <span className={labelCls}>Quartier / secteur</span>
            <select
              value={quartierSelectValue}
              onChange={(e) =>
                onChange(
                  e.target.value === NEW_QUARTIER
                    ? { ...value, quartierId: null, newQuartier: "" }
                    : { ...value, quartierId: e.target.value || null, newQuartier: null },
                )
              }
              className={selectCls}
            >
              <option value="">
                {quartiersQuery.isLoading ? "Chargement…" : "Non précisé (toute la commune)"}
              </option>
              {(quartiersQuery.data ?? []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nom}
                </option>
              ))}
              <option value={NEW_QUARTIER}>+ Ajouter un quartier/secteur</option>
            </select>
          </label>
          {value.newQuartier !== null ? (
            <label className="block">
              <span className={labelCls}>Nom du nouveau quartier/secteur</span>
              <input
                autoFocus
                maxLength={60}
                value={value.newQuartier}
                onChange={(e) => onChange({ ...value, newQuartier: e.target.value })}
                placeholder="Ex : Les Chartrons, Caudéran, Centre-bourg"
                className={selectCls}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Il sera proposé aux autres commerçants et associations de ce code postal.
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
