import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Building2, LayoutGrid, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { BackButton } from "@/components/BackButton";
import { RadiusSelector } from "@/components/RadiusSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { PreferencesPanel } from "@/components/PreferencesPanel";
import { supabase } from "@/lib/supabase";

const NAV = [
  { to: "/", label: "Marketplace", icon: LayoutGrid },
  { to: "/pro", label: "Espace Pro", icon: Store },
  { to: "/mairie", label: "Espace Mairie", icon: Building2 },
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
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {!isHome ? (
            <BackButton className="text-primary-foreground/70 hover:text-primary-foreground" />
          ) : null}
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-promo text-promo-foreground font-display text-lg font-black">
              P
            </span>
            <span className="truncate font-display text-lg font-extrabold tracking-tight">
              PlaceDuCoin
            </span>
          </Link>
        </div>
        <nav className="flex shrink-0 items-center gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground data-[status=active]:bg-primary-foreground/15 data-[status=active]:text-primary-foreground"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          {isHome ? (
            <div className="ml-1 flex items-center gap-1.5">
              <div className="hidden sm:block">
                <RadiusSelector />
              </div>
              <NotificationBell />
              <PreferencesPanel />
            </div>
          ) : null}
          {session ? (
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.navigate({ to: "/" });
              }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Se déconnecter</span>
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
