// Auth email links (password reset, invites) must always point at the public production
// URL, never at whatever origin the request happens to come from -- otherwise testing from
// localhost sends commerçants a link to their own machine instead of the live site. The
// fallback is the prod domain itself (not window.location.origin), so a missing env var
// fails safe to a working link instead of silently reintroducing the localhost bug.
const PROD_SITE_URL = "https://placeducoin-connect.vercel.app";

// VITE_SITE_URL has repeatedly been set on Vercel as a pasted Markdown link
// (e.g. "[https://placeducoin-connect.vercel.app](https://placeducoin-connect.vercel.app)")
// instead of a bare URL. Unwrap that shape and strip any stray brackets/parens
// so a misconfigured env var can never leak Markdown syntax into an email link.
function sanitizeSiteUrl(raw: string): string {
  const markdownLink = raw.match(/\[([^\]]+)\]\(([^)]+)\)/);
  const url = markdownLink?.[2] ?? raw;
  return url
    .replace(/[[\]()]/g, "")
    .trim()
    .replace(/\/+$/, "");
}

export function getSiteUrl() {
  const raw = import.meta.env["VITE_SITE_URL"];
  return raw ? sanitizeSiteUrl(raw) : PROD_SITE_URL;
}
