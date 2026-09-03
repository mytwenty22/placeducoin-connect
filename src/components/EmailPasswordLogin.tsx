import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export function EmailPasswordLogin({
  heading,
  icon,
  accentClass = "focus:border-mairie",
  buttonClass = "bg-mairie text-mairie-foreground",
  showForgotPassword = false,
}: {
  heading: string;
  icon: ReactNode;
  accentClass?: string;
  buttonClass?: string;
  showForgotPassword?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  return (
    <form
      className="surface-card mx-auto max-w-sm space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) toast.error(error.message);
      }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h1 className="font-display text-lg font-extrabold text-foreground">{heading}</h1>
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
          className={`mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none ${accentClass}`}
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mot de passe
        </span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none ${accentClass}`}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className={`w-full rounded-xl py-3 text-sm font-bold disabled:opacity-60 ${buttonClass}`}
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>
      {showForgotPassword ? (
        <button
          type="button"
          disabled={resetting}
          onClick={async () => {
            if (!email.trim()) {
              toast.error("Entrez d'abord votre email ci-dessus.");
              return;
            }
            setResetting(true);
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            setResetting(false);
            if (error) {
              toast.error(error.message);
              return;
            }
            toast.success("Si ce compte existe, un email de réinitialisation vient d'être envoyé.");
          }}
          className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {resetting ? "Envoi…" : "Mot de passe oublié ?"}
        </button>
      ) : null}
    </form>
  );
}
