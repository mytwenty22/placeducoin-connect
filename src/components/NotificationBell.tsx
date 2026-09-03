import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNotifications, markAllRead, markRead } from "@/lib/notifications-store";

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Alertes des offres en vedette près de vous.</SheetDescription>
        </SheetHeader>

        {notifications.length > 0 ? (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="self-start text-xs font-semibold text-navy hover:underline"
          >
            Tout marquer comme lu
          </button>
        ) : null}

        <div className="-mx-6 mt-2 flex-1 divide-y divide-border overflow-y-auto px-6">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune notification pour le moment.
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className="flex w-full items-start gap-2 py-3 text-left"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-promo"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{n.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground/70">
                    {relativeTime(n.createdAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
