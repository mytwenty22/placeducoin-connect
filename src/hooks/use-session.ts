import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// `ready` distingue "pas encore de réponse de Supabase" de "visiteur déconnecté", pour ne pas
// afficher un écran de connexion le temps que la session locale soit relue.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, ready };
}
