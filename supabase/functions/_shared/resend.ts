const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERTS_FROM_EMAIL =
  Deno.env.get("ALERTS_FROM_EMAIL") ?? "PlaceDuCoin <onboarding@resend.dev>";

// Un échec d'envoi individuel (adresse invalide, quota Resend, etc.) ne doit jamais faire échouer
// tout le lot -- on le journalise et on continue avec les autres destinataires.
export async function sendAlertEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY absente -- e-mail non envoyé à", to);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: ALERTS_FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Échec envoi Resend vers", to, res.status, await res.text());
  }
}
