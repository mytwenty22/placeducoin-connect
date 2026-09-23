import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame, Heart, HeartOff, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmailPasswordLogin } from "@/components/EmailPasswordLogin";
import { useSession } from "@/hooks/use-session";
import { useToggleFavorite } from "@/hooks/use-favorites";
import { supabase } from "@/lib/supabase";
import { getSiteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/compte")({
  // `redirect` : page à rouvrir après la connexion (ex. la fiche commerce d'où le client vient).
  // Limité aux chemins internes ("/…" mais pas "//…") pour ne pas servir de redirection ouverte.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = search["redirect"];
    return typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")
      ? { redirect }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Mon compte — SpotLocal" },
      {
        name: "description",
        content: "Retrouvez vos commerces favoris et leurs offres du moment.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const { session, ready } = useSession();

  useEffect(() => {
    if (session && redirect) router.history.push(redirect);
  }, [session, redirect, router]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {!ready ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : session ? (
          <AccountDashboard userId={session.user.id} email={session.user.email ?? ""} />
        ) : (
          <ClientAuthGate />
        )}
      </main>
    </div>
  );
}

function ClientAuthGate() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="space-y-3">
      {mode === "login" ? (
        <EmailPasswordLogin
          heading="Connexion à mon compte"
          icon={<User className="h-5 w-5 text-navy" />}
          accentClass="focus:border-navy"
          buttonClass="bg-primary text-primary-foreground"
          showForgotPassword
        />
      ) : (
        <ClientSignupForm />
      )}
      <button
        type="button"
        onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
        className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {mode === "login"
          ? "Pas encore de compte ? Créer mon compte"
          : "Déjà un compte ? Se connecter"}
      </button>
      <p className="mx-auto max-w-sm text-center text-xs text-muted-foreground">
        Un compte gratuit permet d'enregistrer vos commerces favoris et d'activer les offres en
        caisse. Vous êtes commerçant ?{" "}
        <Link to="/pro" className="font-semibold text-navy hover:underline">
          Espace Pro
        </Link>
      </p>
    </div>
  );
}

function ClientSignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="surface-card mx-auto max-w-sm space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${getSiteUrl()}/compte` },
        });
        setLoading(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data.session) {
          toast.success("Compte créé — vérifiez votre boîte mail pour confirmer votre adresse.");
        }
      }}
    >
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-navy" />
        <h1 className="font-display text-lg font-extrabold text-foreground">Créer mon compte</h1>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Email
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mot de passe
        </span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Création…" : "Créer le compte"}
      </button>
    </form>
  );
}

type FavoriteRow = {
  commerce_id: string;
  commerces: FavoriteCommerce | FavoriteCommerce[] | null;
};
type FavoriteCommerce = {
  id: string;
  slug: string;
  nom: string;
  trade: string;
  photo_url: string | null;
  logo_url: string | null;
  site_actif: boolean;
  villes: { nom: string } | { nom: string }[] | null;
  promos: { id: string; titre: string; kind: string; valide_jusqu_a: string }[] | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function AccountDashboard({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const toggle = useToggleFavorite(userId);

  const favoritesQuery = useQuery({
    queryKey: ["favoris-list", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favoris")
        .select(
          "commerce_id, commerces(id, slug, nom, trade, photo_url, logo_url, site_actif, villes(nom), promos(id, titre, kind, valide_jusqu_a))",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as FavoriteRow[]).flatMap((row) => {
        const commerce = first(row.commerces);
        return commerce ? [commerce] : [];
      });
    },
  });

  const favorites = favoritesQuery.data ?? [];

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-extrabold text-foreground">Mon compte</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.navigate({ to: "/" });
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <LogOut className="h-3.5 w-3.5" /> Se déconnecter
        </button>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-foreground">
          <Heart className="h-5 w-5 fill-red-500 text-red-500" /> Mes favoris
        </h2>

        {favoritesQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
        ) : favoritesQuery.isError ? (
          <p className="mt-4 text-sm text-foreground">
            Erreur lors du chargement de vos favoris : {(favoritesQuery.error as Error).message}
          </p>
        ) : favorites.length === 0 ? (
          <div className="surface-card mt-4 flex flex-col items-center gap-2 p-8 text-center">
            <HeartOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas encore de favori. Touchez le cœur sur la fiche d'un commerce pour le
              retrouver ici.
            </p>
            <Link to="/" className="text-sm font-semibold text-navy hover:underline">
              Découvrir les commerces
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {favorites.map((commerce) => {
              const activePromo = (commerce.promos ?? [])
                .filter(
                  (p) =>
                    p.kind !== "evenement" && new Date(p.valide_jusqu_a).getTime() > Date.now(),
                )
                .sort(
                  (a, b) =>
                    new Date(a.valide_jusqu_a).getTime() - new Date(b.valide_jusqu_a).getTime(),
                )[0];
              const image = commerce.logo_url ?? commerce.photo_url;
              const content = (
                <>
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-xl bg-slate-50 object-contain"
                    />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary font-display text-xl font-black text-navy">
                      {commerce.nom.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-foreground">{commerce.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {commerce.trade}
                      {first(commerce.villes)?.nom ? ` · ${first(commerce.villes)?.nom}` : ""}
                    </p>
                    {activePromo ? (
                      <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-promo/10 px-2 py-0.5 text-xs font-semibold text-promo">
                        <Flame className="h-3 w-3 shrink-0" />
                        <span className="truncate">{activePromo.titre}</span>
                      </p>
                    ) : null}
                  </div>
                </>
              );
              return (
                <li key={commerce.id} className="surface-card flex items-center gap-3 p-3">
                  {commerce.site_actif ? (
                    <Link
                      to="/site/$slug"
                      params={{ slug: commerce.slug }}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      {content}
                    </Link>
                  ) : (
                    <Link
                      to="/commerce/$slug"
                      params={{ slug: commerce.slug }}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      {content}
                    </Link>
                  )}
                  <button
                    type="button"
                    aria-label={`Retirer ${commerce.nom} de mes favoris`}
                    disabled={toggle.isPending}
                    onClick={() =>
                      toggle.mutate(
                        { commerceId: commerce.id, isFavorite: true },
                        { onError: (error) => toast.error(error.message) },
                      )
                    }
                    className="shrink-0 rounded-full p-2 text-red-500 hover:bg-secondary disabled:opacity-60"
                  >
                    <Heart className="h-5 w-5 fill-current" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
