import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type DbNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

// Notifications persistées côté serveur (voir supabase/migrations/20260922150000_notifications_table.sql)
// -- réservées aux clients connectés, alimentées par les Edge Functions d'alertes pour les commerces
// mis en favori. Complète src/lib/notifications-store.ts, qui reste purement local/anonyme.
export function useDbNotifications() {
  const [session, setSession] = useState<Session | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, read, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.created_at,
      })) satisfies DbNotification[];
    },
    enabled: !!userId,
  });

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return { notifications: query.data ?? [], markRead, markAllRead };
}
