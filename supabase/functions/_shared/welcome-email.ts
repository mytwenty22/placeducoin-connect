// E-mail de bienvenue d'un compte Pro ou Association, envoyé une fois par verify-identity.

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BTN =
  "display:inline-block;background:#0F172A;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px";
const STEP_NUM =
  "display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:13px;background:#E11D48;color:#ffffff;font-weight:700;margin-right:8px";

export function welcomeEmail(opts: {
  siteUrl: string;
  name: string | null;
  isAssociation: boolean;
}): { subject: string; html: string } {
  const { siteUrl, isAssociation } = opts;
  const name = opts.name ? escapeHtml(opts.name) : null;
  const flash = isAssociation ? "votre premier événement" : "votre première offre flash";
  const space = isAssociation ? "Espace association" : "Espace commerçant";

  const subject = isAssociation
    ? "Bienvenue sur SpotLocal : publiez votre premier événement"
    : "Bienvenue sur SpotLocal : publiez votre première offre en 2 minutes";

  const html = `
<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0F172A;line-height:1.5">
  <h1 style="font-size:22px;margin:0 0 8px">Bienvenue sur SpotLocal${name ? `, ${name}` : ""} !</h1>
  <p style="margin:0 0 16px">Votre compte est prêt. Voici comment être visible des habitants de votre quartier dès aujourd'hui.</p>

  <h2 style="font-size:16px;margin:24px 0 8px"><span style="${STEP_NUM}">1</span>Personnalisez votre fiche</h2>
  <p style="margin:0 0 8px">Dans votre ${space}, onglet <strong>Mon Profil</strong> :</p>
  <ul style="margin:0 0 8px;padding-left:20px">
    <li>ajoutez une photo ou votre logo, et une courte description ;</li>
    <li>renseignez vos horaires, votre téléphone et votre adresse ;</li>
    <li>placez votre boutique sur la carte (position GPS) : c'est elle qui permet à vos clients de valider leurs coupons sur place.</li>
  </ul>
  <p style="margin:0 0 8px">Envie d'aller plus loin ? Le <strong>Site Pro</strong> (onglet <strong>Visibilité</strong>) vous donne un vrai site vitrine : galerie photos, vidéo, couleurs à votre image et adresse spotlocal.fr/site/…</p>

  <h2 style="font-size:16px;margin:24px 0 8px"><span style="${STEP_NUM}">2</span>Publiez ${flash}</h2>
  <ol style="margin:0 0 8px;padding-left:20px">
    <li>Ouvrez l'onglet <strong>${isAssociation ? "Événement Flash" : "Promo Flash"}</strong> ;</li>
    <li>${
      isAssociation
        ? "donnez un titre, la date et l'heure, et une photo si vous en avez une"
        : "choisissez le type (promo, arrivage ou événement), un titre accrocheur et, si besoin, le prix avant/après"
    } ;</li>
    <li>appuyez sur <strong>${isAssociation ? "Publier l'événement" : "Publier maintenant"}</strong> : ${
      isAssociation ? "votre événement apparaît" : "votre offre apparaît"
    } aussitôt sur SpotLocal, et les habitants abonnés à votre commune sont prévenus.</li>
  </ol>

  <p style="margin:24px 0"><a href="${siteUrl}/pro" style="${BTN}">Ouvrir mon ${space}</a></p>

  <p style="margin:0 0 4px;font-size:14px">Astuce : imprimez votre affiche vitrine (bouton « Imprimer mon affiche vitrine » de votre espace) pour que vos clients vous retrouvent en scannant le QR code.</p>
  <p style="margin:16px 0 0;font-size:13px;color:#64748B">L'équipe SpotLocal</p>
</div>`;

  return { subject, html };
}
