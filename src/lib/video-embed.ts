export type DemoVideo = { title: string; url: string };

/**
 * Vidéos de démonstration (format vertical 9:16). Coller un lien YouTube ou Vimeo (lien de
 * partage ou de la barre d'adresse). La vidéo commerçant passe dans le guide rapide de l'espace
 * Pro, la vidéo client sur /compte et sur la fiche ouverte via le QR code de l'affiche vitrine.
 */
export const PRO_DEMO_VIDEO: DemoVideo = {
  title: "Espace Pro : utilisation",
  url: "https://www.youtube.com/shorts/5xYUUT17UNw",
};
export const CLIENT_DEMO_VIDEO: DemoVideo = {
  title: "Première connexion client",
  url: "https://www.youtube.com/shorts/cLIAJbTK_DU",
};

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

/** Vidéos intégrables de la liste (liens non reconnus écartés). */
export function embeddableVideos(videos: DemoVideo[]) {
  return videos.flatMap(({ title, url }) => {
    const embedUrl = toVideoEmbedUrl(url);
    return embedUrl ? [{ title, embedUrl }] : [];
  });
}
