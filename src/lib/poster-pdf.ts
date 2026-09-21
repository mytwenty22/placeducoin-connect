import { getSiteUrl } from "@/lib/site-url";

export type PosterCommerce = {
  nom: string;
  trade: string;
  slug: string;
  logo_url: string | null;
  site_actif: boolean;
};

// Adresse encodée dans le QR code : la fiche publique du commerce (son site sur-mesure s'il en a
// un), avec `?app=1` pour que la page propose aussitôt d'installer l'application PlaceDuCoin.
// Toujours sur l'URL de production (getSiteUrl), jamais sur l'origine courante : une affiche
// imprimée depuis localhost enverrait tous les clients vers un lien mort.
export function posterTargetUrl(commerce: Pick<PosterCommerce, "slug" | "site_actif">) {
  const path = commerce.site_actif ? "site" : "commerce";
  return `${getSiteUrl()}/${path}/${encodeURIComponent(commerce.slug)}?app=1`;
}

// Les polices PDF standard (Helvetica) ne couvrent que le Latin-1 : on ramène la typographie
// courante à de l'ASCII/Latin-1 et on retire le reste (emoji, alphabets non latins) plutôt que
// d'imprimer des caractères illisibles sur l'affiche.
function toPdfText(value: string) {
  return value
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type LoadedImage = { dataUrl: string; width: number; height: number };

// Convertit n'importe quel format d'image que le navigateur sait afficher (webp, svg, png…) en PNG,
// le seul format que jsPDF sait intégrer de façon fiable. Renvoie null si l'image est
// inaccessible ou si son hébergeur n'autorise pas la lecture cross-origin (canvas "tainted").
function loadImageAsPng(url: string): Promise<LoadedImage | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timeout = window.setTimeout(() => resolve(null), 8000);
    image.onload = () => {
      window.clearTimeout(timeout);
      try {
        const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/png"), width, height });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };
    image.src = url;
  });
}

const NAVY = "#141D3D";
const RED = "#DC3B32";
const GREY = "#5B6478";

/**
 * Génère et télécharge l'affiche vitrine A4 du commerce : nom, logo et QR code vers sa fiche.
 * `logoIncluded` vaut false quand un logo était configuré mais n'a pas pu être chargé, pour que
 * l'interface puisse prévenir le commerçant plutôt que d'imprimer une affiche sans logo en silence.
 */
export async function downloadPosterPdf(commerce: PosterCommerce) {
  // Chargés à la demande : jsPDF et qrcode pèsent lourd et ne servent qu'à ce bouton.
  const [{ jsPDF }, QRCode] = await Promise.all([import("jspdf"), import("qrcode")]);

  const qrDataUrl = await QRCode.toDataURL(posterTargetUrl(commerce), {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 1024,
    color: { dark: NAVY, light: "#FFFFFF" },
  });
  const logo = commerce.logo_url ? await loadImageAsPng(commerce.logo_url) : null;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pageW = 210;
  const center = pageW / 2;

  // ── Bandeau supérieur : marque, logo, nom du commerce ─────────────────────────────────────
  doc.setFillColor(NAVY);
  doc.rect(0, 0, pageW, 112, "F");
  doc.setFillColor(RED);
  doc.rect(0, 112, pageW, 3, "F");

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PlaceDuCoin", center, 16, { align: "center", charSpace: 0.6 });

  const logoBox = 44;
  const logoX = center - logoBox / 2;
  const logoY = 26;
  doc.setFillColor("#FFFFFF");
  doc.roundedRect(logoX, logoY, logoBox, logoBox, 6, 6, "F");
  if (logo) {
    const pad = 4;
    const inner = logoBox - pad * 2;
    const ratio = Math.min(inner / logo.width, inner / logo.height);
    const drawW = logo.width * ratio;
    const drawH = logo.height * ratio;
    doc.addImage(
      logo.dataUrl,
      "PNG",
      logoX + (logoBox - drawW) / 2,
      logoY + (logoBox - drawH) / 2,
      drawW,
      drawH,
    );
  } else {
    doc.setTextColor(NAVY);
    doc.setFontSize(40);
    doc.text(toPdfText(commerce.nom).charAt(0).toUpperCase() || "P", center, logoY + 29, {
      align: "center",
    });
  }

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const nameLines = (doc.splitTextToSize(toPdfText(commerce.nom), 170) as string[]).slice(0, 2);
  const nameY = 88;
  doc.text(nameLines, center, nameY, { align: "center", lineHeightFactor: 1.15 });
  const trade = toPdfText(commerce.trade);
  if (trade) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor("#C9CFE0");
    doc.text(trade, center, nameY + (nameLines.length > 1 ? 20 : 10), { align: "center" });
  }

  // ── Accroche ──────────────────────────────────────────────────────────────────────────────
  doc.setTextColor(NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Nos offres du moment", center, 138, { align: "center" });
  doc.text("sont sur l'appli PlaceDuCoin !", center, 148, { align: "center" });

  doc.setTextColor(GREY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Scannez le QR code pour voir la fiche du commerce", center, 158, { align: "center" });
  doc.text("et installer l'application sur votre telephone.", center, 164, { align: "center" });

  // ── QR code encadré ───────────────────────────────────────────────────────────────────────
  const qrSize = 78;
  const frame = 6;
  const qrX = center - qrSize / 2;
  const qrY = 174;
  doc.setDrawColor(RED);
  doc.setLineWidth(1.2);
  doc.setFillColor("#FFFFFF");
  doc.roundedRect(qrX - frame, qrY - frame, qrSize + frame * 2, qrSize + frame * 2, 5, 5, "FD");
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // ── Les 3 étapes ──────────────────────────────────────────────────────────────────────────
  const steps = [
    ["1", "Scannez"],
    ["2", "Ouvrez la page"],
    ["3", "Installez l'appli"],
  ] as const;
  const stepsY = 274;
  const colW = 60;
  steps.forEach(([number, label], index) => {
    const x = center + (index - 1) * colW;
    doc.setFillColor(RED);
    doc.circle(x - 14, stepsY, 4.2, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(number, x - 14, stepsY + 1.4, { align: "center" });
    doc.setTextColor(NAVY);
    doc.setFontSize(11);
    doc.text(label, x - 8, stepsY + 1.4);
  });

  doc.setTextColor(GREY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(getSiteUrl().replace(/^https?:\/\//, ""), center, 290, { align: "center" });

  doc.save(`affiche-vitrine-${commerce.slug}.pdf`);
  return { logoIncluded: !commerce.logo_url || logo !== null };
}
