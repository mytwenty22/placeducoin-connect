import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Building2, LayoutGrid, LogOut, Heart } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { BackButton } from "@/components/BackButton";
import { InstallAppButton } from "@/components/InstallAppButton";
import { RadiusSelector } from "@/components/RadiusSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { PreferencesPanel } from "@/components/PreferencesPanel";
import { SpotLocalMark, SpotLocalWordmark } from "@/components/SpotLocalLogo";
import { supabase } from "@/lib/supabase";

const NAV = [
  { to: "/", label: "Marketplace", short: "Accueil", icon: LayoutGrid },
  { to: "/pro", label: "Espace Pro", short: "Pro", icon: Store },
  { to: "/mairie", label: "Espace Mairie", short: "Mairie", icon: Building2 },
  { to: "/compte", label: "Mon compte", short: "Compte", icon: Heart },
] as const;

export function AppHeader() {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isHome = pathname === "/";
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-gradient-navy text-primary-foreground">
      {/* Jusqu'à xl : logo complet + actions sur la 1re ligne, liens sur la 2e (en onglets à
          libellés courts sur mobile). À partir de xl : une seule ligne. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-1.5 pt-3 xl:flex-nowrap xl:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!isHome ? (
            <BackButton className="text-primary-foreground/70 hover:text-primary-foreground" />
          ) : null}
          <Link to="/" aria-label="SpotLocal, accueil" className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-promo text-promo-foreground">
              <SpotLocalMark className="h-6 w-6" />
            </span>
            {/* Corail éclairci pour « Local » : le rouge promo manque de contraste sur le bleu marine. */}
            <SpotLocalWordmark
              className="h-[1.15rem] w-auto min-w-0 max-w-full"
              localClassName="fill-[oklch(0.76_0.14_35)]"
            />
          </Link>
        </div>
        <nav className="order-last grid w-full grid-cols-4 gap-1 xl:order-none xl:flex xl:w-auto xl:shrink-0 xl:items-center">
          {NAV.map(({ to, label, short, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground data-[status=active]:bg-primary-foreground/15 data-[status=active]:text-primary-foreground sm:flex-row sm:justify-center sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-1.5 sm:text-sm"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <InstallAppButton />
          {isHome ? (
            <>
              <div className="hidden sm:block">
                <RadiusSelector />
              </div>
              <NotificationBell />
              <PreferencesPanel />
            </>
          ) : null}
          {session ? (
            <button
              type="button"
              aria-label="Se déconnecter"
              onClick={async () => {
                await supabase.auth.signOut();
                router.navigate({ to: "/" });
              }}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground sm:px-3"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Se déconnecter</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
