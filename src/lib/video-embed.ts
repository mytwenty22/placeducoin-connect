/**
 * Vidéos tutoriel (format vertical 9:16) affichées côte à côte dans le guide rapide de l'espace
 * Pro. Coller ici des liens YouTube ou Vimeo (lien de partage ou de la barre d'adresse) ; liste
 * vide = emplacement "bientôt disponible".
 */
export const PRO_TUTORIAL_VIDEOS: { title: string; url: string }[] = [
  { title: "SpotLocal Démo 1", url: "https://www.youtube.com/shorts/5xYUUT17UNw" },
  { title: "SpotLocal Démo 2", url: "https://www.youtube.com/shorts/cLIAJbTK_DU" },
];

/** Lien YouTube / Vimeo -> URL d'intégration (iframe), ou null si le lien n'est pas reconnu. */
export function toVideoEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, "");

  let youtubeId: string | null = null;
  if (host === "youtu.be") youtubeId = parsed.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    youtubeId =
      parsed.searchParams.get("v") ??
      parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ??
      null;
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parsed.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/)?.[1];
    if (id) return `https://player.vimeo.com/video/${id}?dnt=1`;
  }
  return null;
}
