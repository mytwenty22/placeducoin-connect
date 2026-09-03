import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Nouveau mot de passe — PlaceDuCoin" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto max-w-sm px-4 py-10">
        {done ? (
          <div className="surface-card space-y-3 p-5 text-center">
            <p className="text-sm text-foreground">Mot de passe mis à jour.</p>
            <Link to="/pro" className="text-sm font-semibold text-navy hover:underline">
              Retour à l'espace Pro
            </Link>
          </div>
        ) : (
          <form
            className="surface-card space-y-4 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (password.length < 8) {
                toast.error("Le mot de passe doit faire au moins 8 caractères.");
                return;
              }
              if (password !== confirm) {
                toast.error("Les deux mots de passe ne correspondent pas.");
                return;
              }
              setLoading(true);
              const { error } = await supabase.auth.updateUser({ password });
              setLoading(false);
              if (error) {
                toast.error(error.message);
                return;
              }
              toast.success("Mot de passe mis à jour.");
              setDone(true);
            }}
          >
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-navy" />
              <h1 className="font-display text-lg font-extrabold text-foreground">
                Nouveau mot de passe
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Ce lien vient de votre email de réinitialisation. Choisissez un nouveau mot de passe
              pour votre compte.
            </p>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nouveau mot de passe
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
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confirmer le mot de passe
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
