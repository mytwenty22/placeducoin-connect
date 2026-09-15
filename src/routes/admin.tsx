import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, LogOut, ShieldCheck, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmailPasswordLogin } from "@/components/EmailPasswordLogin";
import { supabase } from "@/lib/supabase";
import { createMairieAccount, listMairieAccounts } from "@/lib/mairie-admin";
import { listProAccounts } from "@/lib/pro-admin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administration — PlaceDuCoin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminSpace,
});

type Profile = { role: "mairie" | "pro" | "admin" };

function AdminSpace() {
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
          heading="Connexion Administration"
          icon={<ShieldCheck className="h-5 w-5 text-navy" />}
          accentClass="focus:border-navy"
          buttonClass="bg-primary text-primary-foreground"
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AdminDashboard userId={session.user.id} />
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}

function AdminDashboard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const accountsQuery = useQuery({
    queryKey: ["mairie-accounts"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Session invalide.");
      return listMairieAccounts({ data: { accessToken } });
    },
    enabled: profileQuery.data?.role === "admin",
  });

  const proAccountsQuery = useQuery({
    queryKey: ["pro-accounts"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Session invalide.");
      return listProAccounts({ data: { accessToken } });
    },
    enabled: profileQuery.data?.role === "admin",
  });

  const sendResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Email de réinitialisation envoyé au commerçant."),
    onError: (error: Error) => toast.error(error.message),
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      villeNom: string;
      departmentCode: string;
    }) => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Session invalide.");
      return createMairieAccount({ data: { accessToken, ...input } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mairie-accounts"] });
      toast.success("Compte Mairie créé");
    },
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

  if (profileQuery.data?.role !== "admin") {
    return (
      <div className="surface-card space-y-3 p-5 text-center">
        <p className="text-sm text-foreground">Ce compte n'a pas les droits Administrateur.</p>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/70"
          >
            <LogOut className="h-3.5 w-3.5" /> Déconnexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 rounded-2xl bg-gradient-navy p-5 text-primary-foreground">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-extrabold">Administration</h1>
          <p className="text-sm text-primary-foreground/70">Création des comptes Mairie</p>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/15"
        >
          <LogOut className="h-3.5 w-3.5" /> Déconnexion
        </button>
      </header>

      <CreateMairieAccountForm
        pending={createMutation.isPending}
        onCreate={(input) => createMutation.mutate(input)}
      />

      <section>
        <h2 className="font-display text-lg font-extrabold text-foreground">Comptes Mairie</h2>
        <div className="mt-4 space-y-2">
          {accountsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : null}
          {accountsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun compte Mairie pour le moment.</p>
          ) : null}
          {accountsQuery.data?.map((account) => (
            <article
              key={account.id}
              className="surface-card flex items-center justify-between p-3 text-sm"
            >
              <div>
                <p className="font-semibold text-foreground">{account.email}</p>
                <p className="text-xs text-muted-foreground">
                  {account.villeNom}
                  {account.departmentCode
                    ? ` (${account.departmentCode})`
                    : " — département manquant"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(account.createdAt).toLocaleDateString("fr-FR")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-extrabold text-foreground">Comptes Commerçants</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pour des raisons de sécurité, un admin ne peut pas définir directement le mot de passe
          d'un commerçant. Envoyez-lui un lien de réinitialisation par email à la place.
        </p>
        <div className="mt-4 space-y-2">
          {proAccountsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : null}
          {proAccountsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun compte Commerçant pour le moment.</p>
          ) : null}
          {proAccountsQuery.data?.map((account) => (
            <article
              key={account.id}
              className="surface-card flex items-center justify-between gap-3 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{account.commerceNom}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {account.email} — {account.villeNom}
                </p>
              </div>
              <button
                type="button"
                disabled={sendResetMutation.isPending}
                onClick={() => sendResetMutation.mutate(account.email)}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/70 disabled:opacity-60"
              >
                <KeyRound className="h-3.5 w-3.5" /> Réinitialiser le mot de passe
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const DEPARTMENT_CODE_PATTERN = /^(0[1-9]|[1-8][0-9]|9[0-5]|2[ab]|97[1-6])$/i;

function CreateMairieAccountForm({
  onCreate,
  pending,
}: {
  onCreate: (input: {
    email: string;
    password: string;
    villeNom: string;
    departmentCode: string;
  }) => void;
  pending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [villeNom, setVilleNom] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const isDepartmentCodeValid = DEPARTMENT_CODE_PATTERN.test(departmentCode.trim());

  return (
    <form
      className="surface-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim() || !villeNom.trim() || !isDepartmentCodeValid) return;
        onCreate({
          email,
          password,
          villeNom,
          departmentCode: departmentCode.trim().toUpperCase(),
        });
        setEmail("");
        setPassword("");
        setVilleNom("");
        setDepartmentCode("");
      }}
    >
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-navy" />
        <h2 className="font-display text-lg font-extrabold text-foreground">
          Créer un compte Mairie
        </h2>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Commune
        </span>
        <input
          value={villeNom}
          onChange={(e) => setVilleNom(e.target.value)}
          placeholder="Ex : Annecy"
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Si la commune n'existe pas encore, elle est créée automatiquement.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Département
        </span>
        <input
          value={departmentCode}
          onChange={(e) => setDepartmentCode(e.target.value)}
          placeholder="Ex : 74"
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Code département (01-95, 2A, 2B, 971-976). Sert au filtre géographique des bannières
          publicitaires — si la commune existe déjà sans département renseigné, il sera complété.
        </span>
        {departmentCode.trim() && !isDepartmentCodeValid ? (
          <span className="mt-1 block text-xs font-semibold text-destructive">
            Code département invalide.
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Email du compte Mairie
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mairie@annecy.fr"
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mot de passe initial
        </span>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Au moins 8 caractères"
          className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer le compte Mairie"}
      </button>
    </form>
  );
}
