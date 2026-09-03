import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import {
  Store,
  Zap,
  CreditCard,
  Check,
  Rocket,
  Trash2,
  Image as ImageIcon,
  X,
  CalendarDays,
  Video,
  FlaskConical,
  LogOut,
  Package,
  Upload,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmailPasswordLogin } from "@/components/EmailPasswordLogin";
import { supabase } from "@/lib/supabase";
import { addNotification } from "@/lib/notifications-store";
import { slugify } from "@/lib/slugify";
import { parseCsv } from "@/lib/csv";
import { CATEGORIES, type CategoryKey } from "@/lib/placeducoin-data";
import type { Horaire } from "@/lib/horaires";
import { THEME_OPTIONS, THEME_STYLES, type ThemeVisuel } from "@/lib/site-theme";
import { getReadableTextColor } from "@/lib/color";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "Espace Pro Commerçant — PlaceDuCoin" },
      {
        name: "description",
        content:
          "Gérez votre fiche, publiez une promo flash en 30 secondes et boostez votre visibilité locale.",
      },
      { property: "og:title", content: "Espace Pro Commerçant — PlaceDuCoin" },
      {
        property: "og:description",
        content: "Profil, promos flash et options de visibilité pour les commerçants.",
      },
    ],
  }),
  component: ProSpace,
});

type Profile = { role: "mairie" | "pro" | "admin" };
type Ville = { id: string; nom: string };
type Commerce = {
  id: string;
  slug: string;
  nom: string;
  trade: string;
  category: CategoryKey;
  ville_id: string;
  adresse: string | null;
  telephone: string | null;
  photo_url: string | null;
  logo_url: string | null;
  description: string | null;
  horaires: Horaire[];
  instagram: string | null;
  galerie_urls: string[];
  video_url: string | null;
  theme_visuel: ThemeVisuel;
  site_actif: boolean;
  boost_actif: boolean;
};
type Promo = {
  id: string;
  titre: string;
  kind: "promo" | "arrivage" | "evenement";
  description: string | null;
  photo_url: string | null;
  prix_avant: number | null;
  prix_maintenant: number | null;
  valide_jusqu_a: string;
};
type Produit = {
  id: string;
  nom: string;
  prix: number | null;
  description: string | null;
  photo_url: string | null;
};

function ProSpace() {
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
        <ProAuthGate />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ProDashboard userId={session.user.id} />
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto max-w-lg px-4 pb-24 pt-6">{children}</div>
    </div>
  );
}

const DEMO_PRO_EMAIL = "preview-test@placeducoin.fr";
const DEMO_PRO_PASSWORD = "TestPro12345!";

function ProAuthGate() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [demoLoading, setDemoLoading] = useState(false);

  return (
    <div className="space-y-3">
      {mode === "login" ? (
        <EmailPasswordLogin
          heading="Connexion Pro"
          icon={<Store className="h-5 w-5 text-navy" />}
          accentClass="focus:border-navy"
          buttonClass="bg-primary text-primary-foreground"
          showForgotPassword
        />
      ) : (
        <ProSignupForm />
      )}
      <button
        type="button"
        onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
        className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {mode === "login"
          ? "Pas encore de compte ? Créer un compte Pro"
          : "Déjà un compte ? Se connecter"}
      </button>

      {import.meta.env.DEV ? (
        <button
          type="button"
          disabled={demoLoading}
          onClick={async () => {
            setDemoLoading(true);
            const { error } = await supabase.auth.signInWithPassword({
              email: DEMO_PRO_EMAIL,
              password: DEMO_PRO_PASSWORD,
            });
            setDemoLoading(false);
            if (error) toast.error(error.message);
          }}
          className="mx-auto block w-full rounded-xl border border-dashed border-navy/40 py-2.5 text-xs font-semibold text-navy hover:bg-secondary disabled:opacity-60"
        >
          {demoLoading ? "Connexion…" : "Connexion Demo Pro (dev uniquement)"}
        </button>
      ) : null}
    </div>
  );
}

function ProSignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="surface-card mx-auto max-w-sm space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          toast.error(error.message);
          setLoading(false);
          return;
        }
        if (data.session && data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({ id: data.user.id, role: "pro" }, { onConflict: "id" });
          if (profileError) toast.error(profileError.message);
        } else {
          toast.success("Compte créé — vérifiez votre boîte mail pour confirmer votre adresse.");
        }
        setLoading(false);
      }}
    >
      <div className="flex items-center gap-2">
        <Store className="h-5 w-5 text-navy" />
        <h1 className="font-display text-lg font-extrabold text-foreground">Créer un compte Pro</h1>
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

function ProDashboard({ userId }: { userId: string }) {
  const [screen, setScreen] = useState<"profil" | "promo" | "catalogue" | "options">("profil");
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const attemptedProfileCreateRef = useRef(false);
  const ensureProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, role: "pro" }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
  });

  useEffect(() => {
    if (
      profileQuery.isSuccess &&
      profileQuery.data === null &&
      !attemptedProfileCreateRef.current
    ) {
      attemptedProfileCreateRef.current = true;
      ensureProfileMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.isSuccess, profileQuery.data]);

  const commerceQuery = useQuery({
    queryKey: ["commerce", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commerces")
        .select(
          "id, slug, nom, trade, category, ville_id, adresse, telephone, photo_url, logo_url, description, horaires, instagram, galerie_urls, video_url, theme_visuel, site_actif, boost_actif",
        )
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as Commerce | null;
    },
    enabled: profileQuery.data?.role === "pro",
  });

  const activateMutation = useMutation({
    mutationFn: async (field: "site_actif" | "boost_actif") => {
      if (!commerceQuery.data) throw new Error("Commerce introuvable.");
      const { error } = await supabase
        .from("commerces")
        .update({ [field]: true })
        .eq("id", commerceQuery.data.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_result, field) => {
      queryClient.invalidateQueries({ queryKey: ["commerce", userId] });
      toast.success(
        field === "site_actif"
          ? "Mode démo activé — votre site sur-mesure est en ligne"
          : "Mode démo activé — votre offre est mise en avant",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (profileQuery.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (profileQuery.isError) {
    return (
      <p className="text-sm text-foreground">
        Erreur lors du chargement du profil : {(profileQuery.error as Error).message}
      </p>
    );
  }

  if (!profileQuery.data) {
    if (ensureProfileMutation.isError) {
      return (
        <p className="text-sm text-foreground">
          Erreur lors de la création du profil Pro :{" "}
          {(ensureProfileMutation.error as Error).message}
        </p>
      );
    }
    return <p className="text-sm text-muted-foreground">Préparation de votre profil…</p>;
  }

  if (profileQuery.data.role !== "pro") {
    return <p className="text-sm text-foreground">Ce compte n'a pas les droits Pro.</p>;
  }

  if (commerceQuery.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!commerceQuery.data) {
    return <CreateCommerceForm userId={userId} onCreated={() => commerceQuery.refetch()} />;
  }

  const commerce = commerceQuery.data;

  return (
    <>
      <div className="flex items-center gap-3">
        {commerce.photo_url ? (
          <img
            src={commerce.photo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Espace commerçant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{commerce.nom}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill
          active={commerce.site_actif}
          label={commerce.site_actif ? "Site actif" : "Formule gratuite"}
        />
        <StatusPill
          active={commerce.boost_actif}
          label={commerce.boost_actif ? "En Vedette" : "Non sponsorisé"}
          tone="promo"
        />
      </div>

      {commerce.site_actif ? (
        <Link
          to="/site/$slug"
          params={{ slug: commerce.slug }}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-navy hover:underline"
        >
          Voir mon site : /site/{commerce.slug}
        </Link>
      ) : null}

      <div className="mt-6">
        {screen === "profil" ? (
          <ProfileScreen
            commerce={commerce}
            userId={userId}
            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["commerce", userId] })}
          />
        ) : null}
        {screen === "promo" ? (
          <PromoScreen userId={userId} commerceId={commerce.id} boosted={commerce.boost_actif} />
        ) : null}
        {screen === "catalogue" ? (
          <CatalogueScreen userId={userId} commerceId={commerce.id} />
        ) : null}
        {screen === "options" ? (
          <OptionsScreen
            commerce={commerce}
            pending={activateMutation.isPending}
            onActivateSite={() => activateMutation.mutate("site_actif")}
            onActivateBoost={() => activateMutation.mutate("boost_actif")}
          />
        ) : null}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {(
            [
              { key: "profil", label: "Mon Profil", icon: Store },
              { key: "promo", label: "Promo Flash", icon: Zap },
              { key: "catalogue", label: "Catalogue", icon: Package },
              { key: "options", label: "Visibilité", icon: CreditCard },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setScreen(key)}
              className={`flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                screen === key ? "text-navy" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function StatusPill({
  active,
  label,
  tone = "mairie",
}: {
  active: boolean;
  label: string;
  tone?: "mairie" | "promo";
}) {
  const on =
    tone === "promo" ? "bg-promo text-promo-foreground" : "bg-mairie text-mairie-foreground";
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${active ? on : "bg-secondary text-muted-foreground"}`}
    >
      {label}
    </span>
  );
}

async function insertCommerceWithUniqueSlug(input: {
  owner_id: string;
  ville_id: string;
  nom: string;
  trade: string;
  category: CategoryKey;
  adresse: string;
  telephone: string;
}) {
  const baseSlug = slugify(input.nom) || "commerce";
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { error } = await supabase.from("commerces").insert({ ...input, slug });
    if (!error) return;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Impossible de générer un identifiant unique pour ce commerce.");
}

function CreateCommerceForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [trade, setTrade] = useState("");
  const [category, setCategory] = useState<CategoryKey>(CATEGORIES[0]?.key ?? "bouche");
  const [villeId, setVilleId] = useState("");
  const [adresse, setAdresse] = useState("");
  const [telephone, setTelephone] = useState("");
  const [pending, setPending] = useState(false);

  const villesQuery = useQuery({
    queryKey: ["villes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("villes").select("id, nom").order("nom");
      if (error) throw error;
      return data as Ville[];
    },
  });

  return (
    <form
      className="surface-card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nom.trim() || !villeId) {
          toast.error("Nom et ville sont requis.");
          return;
        }
        setPending(true);
        try {
          await insertCommerceWithUniqueSlug({
            owner_id: userId,
            ville_id: villeId,
            nom,
            trade,
            category,
            adresse,
            telephone,
          });
          onCreated();
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="font-display text-lg font-extrabold text-foreground">
        Créer ma fiche commerce
      </h2>

      <Field
        label="Nom de l'entreprise"
        value={nom}
        onChange={setNom}
        placeholder="Boucherie Lantoine"
      />

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Catégorie principale *
        </span>
        <select
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey)}
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted-foreground">
          Détermine dans quel onglet votre fiche apparaît sur la Marketplace.
        </span>
      </label>

      <Field
        label="Métier (optionnel)"
        value={trade}
        onChange={setTrade}
        placeholder="Ex : Boucher, Coiffeur, Ludothèque"
      />

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ville
        </span>
        <select
          value={villeId}
          onChange={(e) => setVilleId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy"
        >
          <option value="">{villesQuery.isLoading ? "Chargement…" : "Choisir une ville"}</option>
          {villesQuery.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nom}
            </option>
          ))}
        </select>
      </label>

      <Field label="Adresse" value={adresse} onChange={setAdresse} placeholder="12 rue du Marché" />
      <Field
        label="Téléphone"
        value={telephone}
        onChange={setTelephone}
        placeholder="04 50 12 34 56"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer ma fiche"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy";
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}

async function uploadCommerceFile(
  userId: string,
  file: File,
  prefix: string,
  bucket: "commerce-photos" | "commerce-videos" = "commerce-photos",
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${prefix}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function ProfileScreen({
  commerce,
  userId,
  onUpdated,
}: {
  commerce: Commerce;
  userId: string;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(commerce.nom);
  const [trade, setTrade] = useState(commerce.trade);
  const [category, setCategory] = useState<CategoryKey>(commerce.category);
  const [savingCategory, setSavingCategory] = useState(false);
  const [adresse, setAdresse] = useState(commerce.adresse ?? "");
  const [telephone, setTelephone] = useState(commerce.telephone ?? "");
  const [photoUrl, setPhotoUrl] = useState(commerce.photo_url ?? "");
  const [logoUrl, setLogoUrl] = useState(commerce.logo_url ?? "");
  const [themeVisuel, setThemeVisuel] = useState<ThemeVisuel>(commerce.theme_visuel);
  const [description, setDescription] = useState(commerce.description ?? "");
  const [horaires, setHoraires] = useState<Horaire[]>(commerce.horaires);
  const [instagram, setInstagram] = useState(commerce.instagram ?? "");
  const [galerieUrls, setGalerieUrls] = useState<string[]>(commerce.galerie_urls);
  const [galerieUrlInput, setGalerieUrlInput] = useState("");
  const [videoUrl, setVideoUrl] = useState(commerce.video_url ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingGalerie, setUploadingGalerie] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleCategoryClick(key: CategoryKey) {
    if (key === category) return;
    const previous = category;
    setCategory(key);
    setSavingCategory(true);
    const { error } = await supabase
      .from("commerces")
      .update({ category: key })
      .eq("id", commerce.id);
    setSavingCategory(false);
    if (error) {
      setCategory(previous);
      toast.error(error.message);
      return;
    }
    toast.success("Catégorie mise à jour");
    onUpdated();
  }

  function updateHoraire(index: number, field: keyof Horaire, value: string) {
    setHoraires((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  }
  function addHoraire() {
    setHoraires((prev) => [...prev, { jour: "", valeur: "" }]);
  }
  function removeHoraire(index: number) {
    setHoraires((prev) => prev.filter((_, i) => i !== index));
  }

  function addGalerieUrl() {
    const trimmed = galerieUrlInput.trim();
    if (!trimmed) return;
    setGalerieUrls((prev) => [...prev, trimmed]);
    setGalerieUrlInput("");
  }
  function removeGalerieUrl(index: number) {
    setGalerieUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGalerieFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingGalerie(true);
    try {
      const urls = await Promise.all(
        files.map((file) => uploadCommerceFile(userId, file, "galerie")),
      );
      setGalerieUrls((prev) => [...prev, ...urls]);
      toast.success(`${urls.length} photo(s) ajoutée(s)`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploadingGalerie(false);
    }
  }

  async function handlePhotoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      setPhotoUrl(await uploadCommerceFile(userId, file, "photo"));
      toast.success("Photo téléversée");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleLogoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      setLogoUrl(await uploadCommerceFile(userId, file, "logo"));
      toast.success("Logo téléversé");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleVideoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error("La vidéo dépasse la limite de 100 Mo.");
      return;
    }
    setUploadingVideo(true);
    try {
      setVideoUrl(await uploadCommerceFile(userId, file, "video", "commerce-videos"));
      toast.success("Vidéo téléversée");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploadingVideo(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          router.navigate({ to: "/" });
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
      >
        <LogOut className="h-4 w-4" /> Se déconnecter
      </button>

      {commerce.site_actif ? (
        <Link
          to="/site/$slug"
          params={{ slug: commerce.slug }}
          className="block rounded-xl bg-mairie/10 px-4 py-3 text-sm font-semibold text-mairie hover:underline"
        >
          Votre site sur-mesure est en ligne : /site/{commerce.slug}
        </Link>
      ) : null}

      <form
        className="surface-card space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          const { error } = await supabase
            .from("commerces")
            .update({
              nom,
              trade,
              adresse,
              telephone,
              photo_url: photoUrl || null,
              logo_url: logoUrl || null,
              description: description || null,
              horaires: horaires.filter((h) => h.jour.trim() || h.valeur.trim()),
              instagram: instagram || null,
              galerie_urls: galerieUrls,
              video_url: videoUrl || null,
              theme_visuel: themeVisuel,
            })
            .eq("id", commerce.id);
          setPending(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success("Profil mis à jour");
          onUpdated();
        }}
      >
        <h2 className="font-display text-lg font-extrabold text-foreground">Mon profil</h2>

        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Photo du commerce
          </span>
          {photoUrl ? (
            <img src={photoUrl} alt="" className="mt-2 h-32 w-full rounded-xl object-cover" />
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
              <ImageIcon className="h-4 w-4" />
              {uploadingPhoto ? "Envoi…" : "Téléverser"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={handlePhotoFileChange}
              />
            </label>
            <span className="text-xs text-muted-foreground">ou</span>
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
              className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-navy"
            />
          </div>
        </div>

        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Galerie photos
          </span>
          {galerieUrls.length > 0 ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {galerieUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    aria-label="Retirer cette photo"
                    onClick={() => removeGalerieUrl(i)}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
              <ImageIcon className="h-4 w-4" />
              {uploadingGalerie ? "Envoi…" : "Ajouter des photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploadingGalerie}
                onChange={handleGalerieFilesChange}
              />
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={galerieUrlInput}
              onChange={(e) => setGalerieUrlInput(e.target.value)}
              placeholder="ou coller une URL de photo…"
              className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-navy"
            />
            <button
              type="button"
              onClick={addGalerieUrl}
              className="shrink-0 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              Ajouter
            </button>
          </div>
        </div>

        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vidéo de présentation
          </span>
          {videoUrl ? <video src={videoUrl} controls className="mt-2 w-full rounded-xl" /> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
              <Video className="h-4 w-4" />
              {uploadingVideo ? "Envoi…" : "Téléverser une vidéo"}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploadingVideo}
                onChange={handleVideoFileChange}
              />
            </label>
            <span className="text-xs text-muted-foreground">ou</span>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
              className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-navy"
            />
          </div>
          <span className="mt-1 block text-xs text-muted-foreground">Taille max. 100 Mo.</span>
        </div>

        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Logo
          </span>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="mt-2 h-16 w-16 rounded-full object-cover" />
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
              <ImageIcon className="h-4 w-4" />
              {uploadingLogo ? "Envoi…" : "Téléverser"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingLogo}
                onChange={handleLogoFileChange}
              />
            </label>
            <span className="text-xs text-muted-foreground">ou</span>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-navy"
            />
          </div>
        </div>

        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Style du site
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setThemeVisuel(t.key)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                  themeVisuel === t.key
                    ? "border-navy bg-navy text-primary-foreground"
                    : "border-input bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Aperçu du site
          </span>
          <div className="mt-2 overflow-hidden rounded-xl border border-border">
            <div
              className="px-4 py-6 text-center"
              style={{
                backgroundColor: THEME_STYLES[themeVisuel].bandColor,
                color: getReadableTextColor(THEME_STYLES[themeVisuel].bandColor),
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="mx-auto h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-current/10 text-sm font-black">
                  {nom.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <p className="mt-2 font-display text-sm font-extrabold">{nom || "Nom du commerce"}</p>
              <p className="text-xs opacity-80">{trade || "Métier"}</p>
            </div>
          </div>
        </div>

        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Catégorie sur le site
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={savingCategory}
                onClick={() => handleCategoryClick(c.key)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  category === c.key
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Nom de l'entreprise" value={nom} onChange={setNom} />
        <Field label="Métier" value={trade} onChange={setTrade} />
        <Field
          label="Présentation"
          value={description}
          onChange={setDescription}
          placeholder="Quelques phrases pour présenter votre commerce…"
          textarea
        />
        <Field label="Adresse" value={adresse} onChange={setAdresse} />
        <Field label="Téléphone" value={telephone} onChange={setTelephone} />
        <Field
          label="Lien du compte Instagram"
          value={instagram}
          onChange={setInstagram}
          placeholder="@moncommerce ou https://instagram.com/…"
        />

        <div className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Horaires
          </span>
          <div className="mt-2 space-y-2">
            {horaires.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={h.jour}
                  onChange={(e) => updateHoraire(i, "jour", e.target.value)}
                  placeholder="Lun – Ven"
                  className="w-28 shrink-0 rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-navy"
                />
                <input
                  value={h.valeur}
                  onChange={(e) => updateHoraire(i, "valeur", e.target.value)}
                  placeholder="9h – 19h"
                  className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-navy"
                />
                <button
                  type="button"
                  aria-label="Retirer cet horaire"
                  onClick={() => removeHoraire(i)}
                  className="shrink-0 text-muted-foreground hover:text-promo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addHoraire}
              className="text-xs font-semibold text-navy hover:underline"
            >
              + Ajouter un horaire
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-navy-soft disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}

const DURATIONS = ["2", "4", "8", "24", "48"];
const MAX_ACTIVE_PROMOS = 3;

function PromoScreen({
  userId,
  commerceId,
  boosted,
}: {
  userId: string;
  commerceId: string;
  boosted: boolean;
}) {
  const queryClient = useQueryClient();
  const [titre, setTitre] = useState("");
  const [kind, setKind] = useState<"promo" | "arrivage" | "evenement">("promo");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [prixAvant, setPrixAvant] = useState("");
  const [prixMaintenant, setPrixMaintenant] = useState("");
  const [duration, setDuration] = useState("4");
  const [eventDateTime, setEventDateTime] = useState("");
  const isEvent = kind === "evenement";

  async function handlePhotoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      setPhotoUrl(await uploadCommerceFile(userId, file, "promo"));
      toast.success("Photo téléversée");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  const promosQuery = useQuery({
    queryKey: ["promos", commerceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promos")
        .select(
          "id, titre, kind, description, photo_url, prix_avant, prix_maintenant, valide_jusqu_a",
        )
        .eq("commerce_id", commerceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Promo[];
    },
  });

  const activePromoCount = (promosQuery.data ?? []).filter(
    (p) => p.kind !== "evenement" && new Date(p.valide_jusqu_a).getTime() > Date.now(),
  ).length;
  const limitReached = !isEvent && activePromoCount >= MAX_ACTIVE_PROMOS;

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (isEvent && !eventDateTime) {
        throw new Error("Date et heure requises pour un événement.");
      }
      if (!isEvent) {
        const { count, error: countError } = await supabase
          .from("promos")
          .select("id", { count: "exact", head: true })
          .eq("commerce_id", commerceId)
          .in("kind", ["promo", "arrivage"])
          .gt("valide_jusqu_a", new Date().toISOString());
        if (countError) throw new Error(countError.message);
        if ((count ?? 0) >= MAX_ACTIVE_PROMOS) {
          throw new Error(
            `Limite de ${MAX_ACTIVE_PROMOS} promotions actives atteinte. Supprimez-en une pour en publier une nouvelle.`,
          );
        }
      }
      const valide_jusqu_a = isEvent
        ? new Date(eventDateTime).toISOString()
        : new Date(Date.now() + Number(duration) * 3600 * 1000).toISOString();
      const { error } = await supabase.from("promos").insert({
        commerce_id: commerceId,
        titre,
        kind,
        description: isEvent ? description || null : null,
        photo_url: !isEvent && photoUrl ? photoUrl : null,
        prix_avant: !isEvent && prixAvant ? Number(prixAvant) : null,
        prix_maintenant: !isEvent && prixMaintenant ? Number(prixMaintenant) : null,
        valide_jusqu_a,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promos", commerceId] });
      toast.success(
        isEvent ? "Événement publié" : `Promo publiée — visible ${duration}h sur la marketplace`,
      );
      setTitre("");
      setDescription("");
      setPhotoUrl("");
      setPrixAvant("");
      setPrixMaintenant("");
      setEventDateTime("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promos").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promos", commerceId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const expireMutation = useMutation({
    mutationFn: async (id: string) => {
      const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { error } = await supabase
        .from("promos")
        .update({ valide_jusqu_a: pastDate })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promos", commerceId] });
      toast.success("Expiration simulée — cette offre a disparu de la Marketplace.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <form
        className="surface-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!titre.trim()) return;
          publishMutation.mutate();
        }}
      >
        <h2 className="font-display text-lg font-extrabold text-foreground">
          Publier une offre ou un événement
        </h2>
        <p className="text-xs text-muted-foreground">
          {activePromoCount}/{MAX_ACTIVE_PROMOS} promotions actives
        </p>

        {limitReached ? (
          <p className="rounded-xl bg-promo/10 p-3 text-xs font-semibold text-promo">
            Limite de {MAX_ACTIVE_PROMOS} promotions actives atteinte. Supprimez-en une ci-dessous
            pour en publier une nouvelle.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(["promo", "arrivage", "evenement"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                kind === k
                  ? "border-transparent bg-navy text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {k === "promo" ? "Promo" : k === "arrivage" ? "Arrivage" : "Événement"}
            </button>
          ))}
        </div>

        <Field
          label={isEvent ? "Titre de l'événement" : "Votre offre"}
          value={titre}
          onChange={setTitre}
          placeholder={
            isEvent ? "Ex : Soirée jeux de société" : "Ex : Côte de bœuf maturée, arrivage du jour"
          }
          textarea
        />

        {isEvent ? (
          <>
            <Field
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Détails pratiques pour vos clients…"
              textarea
            />
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Date et heure
              </span>
              <input
                type="datetime-local"
                value={eventDateTime}
                onChange={(e) => setEventDateTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy"
              />
            </label>
          </>
        ) : (
          <>
            <div className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Photo de l'offre
              </span>
              {photoUrl ? (
                <img src={photoUrl} alt="" className="mt-2 h-32 w-full rounded-xl object-cover" />
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
                  <ImageIcon className="h-4 w-4" />
                  {uploadingPhoto ? "Envoi…" : "Téléverser"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={handlePhotoFileChange}
                  />
                </label>
                <span className="text-xs text-muted-foreground">ou</span>
                <input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-navy"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Prix avant (€)"
                value={prixAvant}
                onChange={setPrixAvant}
                placeholder="32"
              />
              <Field
                label="Prix réduit (€)"
                value={prixMaintenant}
                onChange={setPrixMaintenant}
                placeholder="24"
              />
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Expire dans
                </span>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy"
                >
                  {DURATIONS.map((h) => (
                    <option key={h} value={h}>
                      {h} heures
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
              {boosted
                ? "Votre offre est actuellement affichée en haut de la marketplace (badge En Vedette)."
                : "Astuce : passez par l'onglet Visibilité pour placer cette offre tout en haut de la marketplace."}
            </p>
          </>
        )}

        <button
          type="submit"
          disabled={publishMutation.isPending || limitReached}
          className="w-full rounded-xl bg-gradient-promo py-3 text-sm font-bold text-promo-foreground disabled:opacity-60"
        >
          {publishMutation.isPending
            ? "Publication…"
            : limitReached
              ? "Limite atteinte"
              : isEvent
                ? "Publier l'événement"
                : "Publier maintenant"}
        </button>
      </form>

      <section>
        <h2 className="font-display text-lg font-extrabold text-foreground">Mes publications</h2>
        <div className="mt-3 space-y-2">
          {promosQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune publication pour le moment.</p>
          ) : null}
          {promosQuery.data?.map((p) => {
            const expired = new Date(p.valide_jusqu_a).getTime() < Date.now();
            const subtitle =
              p.kind === "evenement"
                ? `${expired ? "Passé" : "À venir"} · ${new Date(p.valide_jusqu_a).toLocaleString("fr-FR")}`
                : `${p.prix_maintenant !== null ? `${p.prix_maintenant} € · ` : ""}${
                    expired
                      ? "Expirée"
                      : `Jusqu'au ${new Date(p.valide_jusqu_a).toLocaleString("fr-FR")}`
                  }`;
            return (
              <article key={p.id} className="surface-card flex items-start gap-3 p-3">
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : p.kind === "evenement" ? (
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.titre}</p>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!expired && p.kind !== "evenement" ? (
                    <button
                      type="button"
                      title="Simuler expiration 24h"
                      aria-label={`Simuler l'expiration de ${p.titre}`}
                      onClick={() => expireMutation.mutate(p.id)}
                      disabled={expireMutation.isPending}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-navy disabled:opacity-60"
                    >
                      <FlaskConical className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Retirer ${p.titre}`}
                    onClick={() => deleteMutation.mutate(p.id)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-promo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function OptionsScreen({
  commerce,
  pending,
  onActivateSite,
  onActivateBoost,
}: {
  commerce: Commerce;
  pending: boolean;
  onActivateSite: () => void;
  onActivateBoost: () => void;
}) {
  return (
    <div className="space-y-4">
      <article className="surface-card p-5">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 shrink-0 text-navy" />
          <h2 className="font-display text-lg font-extrabold text-foreground">
            Option A · 19 €/mois
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Débloquez votre site web sur-mesure et des promos illimitées.
        </p>
        {commerce.site_actif ? (
          <Link
            to="/site/$slug"
            params={{ slug: commerce.slug }}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-mairie py-3 text-sm font-bold text-mairie-foreground"
          >
            <Check className="h-4 w-4" /> Voir mon site
          </Link>
        ) : (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => toast("Paiement Stripe non configuré dans cette démo.")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              S'abonner via Stripe
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onActivateSite}
              className="w-full rounded-xl border border-input bg-card py-3 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {pending ? "Activation…" : "Activer gratuitement (mode démo)"}
            </button>
          </div>
        )}
      </article>

      <article className="surface-card border-promo/30 p-5">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 shrink-0 text-promo" />
          <h2 className="font-display text-lg font-extrabold text-foreground">
            Option B · 9 € ponctuel
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Mettez votre offre tout en haut de la marketplace pendant 48h, avec badge rouge « En
          Vedette ».
        </p>
        {commerce.boost_actif ? (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-mairie py-3 text-sm font-bold text-mairie-foreground">
            <Check className="h-4 w-4" /> Offre en vedette
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => toast("Paiement Stripe non configuré dans cette démo.")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-promo py-3 text-sm font-bold text-promo-foreground"
            >
              Payer 9 € via Stripe
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onActivateBoost}
              className="w-full rounded-xl border border-input bg-card py-3 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {pending ? "Activation…" : "Activer gratuitement (mode démo)"}
            </button>
          </div>
        )}
      </article>

      <article className="surface-card p-5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 shrink-0 text-navy" />
          <h2 className="font-display text-lg font-extrabold text-foreground">
            Simuler une alerte Vedette
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Envoie une notification de test, comme si votre commerce venait d'être détecté En Vedette
          près d'un client. Ouvrez la marketplace dans un autre onglet pour voir la cloche se mettre
          à jour en direct.
        </p>
        <button
          type="button"
          onClick={() => {
            addNotification({
              title: `Offre en vedette près de vous : ${commerce.nom}`,
              body: `${commerce.trade} — nouvelle offre sponsorisée (test)`,
              category: commerce.category,
              shop: commerce.nom,
              slug: commerce.slug,
              distanceKm: Math.round((0.3 + Math.random() * 1.7) * 10) / 10,
            });
            toast.success("Alerte de test envoyée au centre de notifications.");
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-card py-3 text-sm font-bold text-foreground hover:bg-secondary"
        >
          <FlaskConical className="h-4 w-4" /> Simuler l'envoi d'une alerte Vedette
        </button>
      </article>

      <p className="text-center text-xs text-muted-foreground">
        Mode démo — aucun paiement réel n'est effectué. L'activation gratuite, elle, est bien
        enregistrée sur votre fiche.
      </p>
    </div>
  );
}

function CatalogueScreen({ userId, commerceId }: { userId: string; commerceId: string }) {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [importing, setImporting] = useState(false);

  const produitsQuery = useQuery({
    queryKey: ["produits", commerceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produits")
        .select("id, nom, prix, description, photo_url")
        .eq("commerce_id", commerceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Produit[];
    },
  });

  async function handlePhotoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      setPhotoUrl(await uploadCommerceFile(userId, file, "produit"));
      toast.success("Photo téléversée");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("produits").insert({
        commerce_id: commerceId,
        nom,
        prix: prix ? Number(prix) : null,
        description: description || null,
        photo_url: photoUrl || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produits", commerceId] });
      toast.success("Produit ajouté au catalogue");
      setNom("");
      setPrix("");
      setDescription("");
      setPhotoUrl("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produits").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["produits", commerceId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleCsvFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error("Fichier vide ou sans données.");
      const header = rows[0]!.map((h) => h.trim().toLowerCase());
      const nomIdx = header.indexOf("nom");
      const prixIdx = header.indexOf("prix");
      const descIdx = header.indexOf("description");
      if (nomIdx === -1) {
        throw new Error("Colonne « nom » introuvable dans le fichier.");
      }
      const products = rows
        .slice(1)
        .map((r) => ({
          commerce_id: commerceId,
          nom: (r[nomIdx] ?? "").trim(),
          prix: prixIdx !== -1 && r[prixIdx]?.trim() ? Number(r[prixIdx]!.replace(",", ".")) : null,
          description: descIdx !== -1 && r[descIdx]?.trim() ? r[descIdx]!.trim() : null,
        }))
        .filter((p) => p.nom.length > 0);
      if (products.length === 0) {
        throw new Error("Aucun produit valide trouvé dans le fichier.");
      }
      const { error } = await supabase.from("produits").insert(products);
      if (error) throw new Error(error.message);
      queryClient.invalidateQueries({ queryKey: ["produits", commerceId] });
      toast.success(`${products.length} produit(s) importé(s)`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="surface-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom.trim()) return;
          addMutation.mutate();
        }}
      >
        <h2 className="font-display text-lg font-extrabold text-foreground">
          Mon Catalogue de Produits
        </h2>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-navy/40 py-3 text-sm font-semibold text-navy hover:bg-secondary">
          <Upload className="h-4 w-4" />
          {importing ? "Import en cours…" : "Importer un fichier CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={importing}
            onChange={handleCsvFileChange}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Colonnes attendues : <code>nom</code>, <code>prix</code>, <code>description</code>{" "}
          (première ligne = en-têtes).
        </p>

        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou ajouter manuellement{" "}
          <span className="h-px flex-1 bg-border" />
        </div>

        <Field label="Nom du produit" value={nom} onChange={setNom} placeholder="Côte de bœuf" />
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Prix (€)
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            placeholder="24.00"
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy"
          />
        </label>
        <Field
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Maturée 30 jours, origine locale…"
          textarea
        />

        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Photo
          </span>
          {photoUrl ? (
            <img src={photoUrl} alt="" className="mt-2 h-24 w-24 rounded-xl object-cover" />
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
              <ImageIcon className="h-4 w-4" />
              {uploadingPhoto ? "Envoi…" : "Téléverser"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={handlePhotoFileChange}
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={addMutation.isPending}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {addMutation.isPending ? "Ajout…" : "Ajouter au catalogue"}
        </button>
      </form>

      <section>
        <h2 className="font-display text-lg font-extrabold text-foreground">
          Produits du catalogue
        </h2>
        <div className="mt-3 space-y-2">
          {produitsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun produit pour le moment.</p>
          ) : null}
          {produitsQuery.data?.map((p) => (
            <article key={p.id} className="surface-card flex items-start gap-3 p-3">
              {p.photo_url ? (
                <img
                  src={p.photo_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{p.nom}</p>
                <p className="text-xs text-muted-foreground">
                  {p.prix != null ? `${p.prix.toFixed(2)} €` : "Prix non renseigné"}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Retirer ${p.nom}`}
                onClick={() => deleteMutation.mutate(p.id)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-promo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
