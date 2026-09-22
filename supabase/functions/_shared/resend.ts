const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERTS_FROM_EMAIL =
  // TODO: repasser à "Bons Plans du Coin <notifications@bonplanducoin.fr>" une fois ce domaine
  // vérifié dans Resend (Resend rejette tout envoi "from" un domaine non vérifié).
  Deno.env.get("ALERTS_FROM_EMAIL") ?? "Bons Plans du Coin <onboarding@resend.dev>";

export type SendResult = { to: string; ok: boolean; status?: number; error?: string };

// Un échec d'envoi individuel (adresse invalide, quota Resend, etc.) ne doit jamais faire échouer
// tout le lot -- on le journalise et on renvoie un résultat par destinataire plutôt que de jeter.
export async function sendAlertEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY absente -- e-mail non envoyé à", to);
    return { to, ok: false, error: "RESEND_API_KEY absente" };
  }
  console.log("Envoi Resend ->", to, "from:", ALERTS_FROM_EMAIL);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: ALERTS_FROM_EMAIL, to, subject, html }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    console.error("Échec envoi Resend vers", to, res.status, bodyText);
    return { to, ok: false, status: res.status, error: bodyText };
  }
  console.log("E-mail envoyé via Resend à", to, res.status, bodyText);
  return { to, ok: true, status: res.status };
}
