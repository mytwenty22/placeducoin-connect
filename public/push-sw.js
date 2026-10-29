// Chargé dans le service worker généré par vite-plugin-pwa (workbox.importScripts, voir
// vite.config.ts). Affiche les notifications push envoyées par les Edge Functions d'alertes
// (supabase/functions/_shared/web-push.ts) et ouvre la page liée au clic.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "SpotLocal";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  // Fenêtre SpotLocal déjà ouverte (application installée sur le téléphone) : elle est ramenée au
  // premier plan sur la page de l'offre, au lieu d'ouvrir un nouvel onglet du navigateur.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const exact = windows.find((client) => client.url === url);
      if (exact) return exact.focus();
      const existing = windows.find((client) => "navigate" in client);
      if (existing) {
        try {
          const navigated = await existing.navigate(url);
          if (navigated) return navigated.focus();
        } catch {
          // Fenêtre non contrôlée par ce service worker : on ouvre une nouvelle fenêtre.
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
