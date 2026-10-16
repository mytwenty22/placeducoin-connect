// Fuseau fixé : les pages sont rendues côté serveur (UTC) puis hydratées dans le navigateur, les
// deux doivent afficher la même date. "Le 31 oct. · 18h00" (l'heure est omise si elle vaut minuit).
export function formatEventDate(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
  const time = date
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    .replace(":", "h");
  return time === "00h00" ? `Le ${day}` : `Le ${day} · ${time}`;
}

/** "Aujourd'hui", "Demain", "Dans 15 jours". */
export function eventUrgencyLabel(iso: string) {
  const daysLeft = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000));
  if (daysLeft <= 0) return "Aujourd'hui";
  if (daysLeft === 1) return "Demain";
  return `Dans ${daysLeft} jours`;
}
