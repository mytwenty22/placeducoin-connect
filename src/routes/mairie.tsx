import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { Building2, LogOut, Megaphone, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmailPasswordLogin } from "@/components/EmailPasswordLogin";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/mairie")({
  head: () => ({
    meta: [
      { title: "Espace Compagnon Mairie — PlaceDuCoin" },
      {
        name: "description",
        content:
          "Accès gratuit pour les agents municipaux : publiez alertes, travaux et événements sur la page de votre commune.",
      },
      { property: "og:title", content: "Espace Compagnon Mairie — PlaceDuCoin" },
      {
        property: "og:description",
        content: "Publiez gratuitement les informations officielles de votre commune.",
      },
    ],
  }),
  component: MairieSpace,
});

type NoticeType = "Événement" | "Travaux" | "Information";
const TYPES: NoticeType[] = ["Événement", "Travaux", "Information"];

type Profile = { role: "mairie" | "pro" | "admin"; ville_id: string | null };
type Ville = { id: string; nom: string };
type InfoMairie = {
  id: string;
  titre: string;
  corps: string | null;
  type: NoticeType;
  date_info: string | null;
  created_by: string;
};

function MairieSpace() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!authChecked) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <EmailPasswordLogin
          heading="Connexion Mairie"
          icon={<Building2 className="h-5 w-5 text-mairie" />}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <MairieDashboard userId={session.user.id} />
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}

function MairieDashboard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, ville_id")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const villeId = profileQuery.data?.ville_id ?? null;

  const villeQuery = useQuery({
    queryKey: ["ville", villeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("villes")
        .select("id, nom")
        .eq("id", villeId)
        .single();
      if (error) throw error;
      return data as Ville;
    },
    enabled: !!villeId,
  });

  const noticesQuery = useQuery({
    queryKey: ["infos-mairie", villeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Infos_Mairie")
        .select("id, titre, corps, type, date_info, created_by")
        .eq("ville_id", villeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InfoMairie[];
    },
    enabled: !!villeId,
  });

  const publishMutation = useMutation({
    mutationFn: async (notice: {
      titre: string;
      corps: string;
      date_info: string;
      type: NoticeType;
    }) => {
      const { error } = await supabase.from("Infos_Mairie").insert({
        ville_id: villeId,
        created_by: userId,
        titre: notice.titre,
        corps: notice.corps,
        date_info: notice.date_info || "Aujourd'hui",
        type: notice.type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infos-mairie", villeId] });
      toast.success("Publication en ligne sur la page de la commune");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("Infos_Mairie").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["infos-mairie", villeId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (profileQuery.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (profileQuery.isError) {
    return (
      <div className="surface-card space-y-3 p-5 text-center">
        <p className="text-sm text-foreground">
          Erreur lors du chargement du profil : {(profileQuery.error as Error).message}
        </p>
      </div>
    );
  }

  if (profileQuery.data?.role !== "mairie" || !villeId) {
    return (
      <div className="surface-card space-y-3 p-5 text-center">
        <p className="text-sm text-foreground">
          Ce compte n'a pas les droits Mairie, ou n'est rattaché à aucune commune.
        </p>
        <div className="flex justify-center">
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 rounded-2xl bg-gradient-navy p-5 text-primary-foreground">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mairie">
          <Building2 className="h-5 w-5 text-mairie-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-extrabold">Espace Mairie</h1>
          <p className="text-sm text-primary-foreground/70">
            Mairie {villeQuery.data ? `de ${villeQuery.data.nom}` : ""} · accès gratuit dédié aux
            agents municipaux
          </p>
        </div>
        <SignOutButton variant="on-dark" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PublishForm
          onPublish={(n) => publishMutation.mutate(n)}
          pending={publishMutation.isPending}
        />

        <section>
          <h2 className="font-display text-lg font-extrabold text-foreground">
            Publications en ligne
          </h2>
          <div className="mt-4 space-y-3">
            {noticesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : null}
            {noticesQuery.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune publication pour le moment.</p>
            ) : null}
            {noticesQuery.data?.map((n) => (
              <article key={n.id} className="surface-card border-l-4 border-l-mairie p-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 shrink-0 text-mairie" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-mairie">
                    {n.type} · Info Officielle
                  </span>
                  {n.created_by === userId ? (
                    <button
                      type="button"
                      aria-label={`Retirer ${n.titre}`}
                      onClick={() => deleteMutation.mutate(n.id)}
                      className="ml-auto text-muted-foreground hover:text-promo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <h3 className="mt-2 text-base font-bold text-foreground">{n.titre}</h3>
                {n.corps ? <p className="mt-1 text-sm text-muted-foreground">{n.corps}</p> : null}
                {n.date_info ? (
                  <p className="mt-2 text-xs text-muted-foreground">{n.date_info}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function PublishForm({
  onPublish,
  pending,
}: {
  onPublish: (notice: {
    titre: string;
    corps: string;
    date_info: string;
    type: NoticeType;
  }) => void;
  pending: boolean;
}) {
  const [titre, setTitre] = useState("");
  const [corps, setCorps] = useState("");
  const [dateInfo, setDateInfo] = useState("");
  const [type, setType] = useState<NoticeType>("Événement");

  return (
    <form
      className="surface-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titre.trim()) return;
        onPublish({ titre, corps, date_info: dateInfo, type });
        setTitre("");
        setCorps("");
        setDateInfo("");
      }}
    >
      <h2 className="font-display text-lg font-extrabold text-foreground">
        Publier une alerte ou un événement
      </h2>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              type === t
                ? "border-transparent bg-mairie text-mairie-foreground"
                : "border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Titre
        </span>
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ex : Marché de Noël ce samedi"
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-mairie"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Message
        </span>
        <textarea
          rows={4}
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          placeholder="Détails pratiques pour les habitants et les commerçants…"
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-mairie"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Date / période
        </span>
        <input
          value={dateInfo}
          onChange={(e) => setDateInfo(e.target.value)}
          placeholder="Samedi 5 déc."
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-mairie"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-mairie py-3 text-sm font-bold text-mairie-foreground disabled:opacity-60"
      >
        {pending ? "Publication…" : "Publier gratuitement"}
      </button>
    </form>
  );
}

function SignOutButton({ variant = "on-light" }: { variant?: "on-dark" | "on-light" }) {
  const cls =
    variant === "on-dark"
      ? "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15"
      : "bg-secondary text-foreground hover:bg-secondary/70";
  return (
    <button
      type="button"
      onClick={() => supabase.auth.signOut()}
      className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${cls}`}
    >
      <LogOut className="h-3.5 w-3.5" /> Déconnexion
    </button>
  );
}
