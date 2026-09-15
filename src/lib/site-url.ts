// Auth email links (password reset, invites) must always point at the public production
// URL, never at whatever origin the request happens to come from -- otherwise testing from
// localhost sends commerçants a link to their own machine instead of the live site. The
// fallback is the prod domain itself (not window.location.origin), so a missing env var
// fails safe to a working link instead of silently reintroducing the localhost bug.
const PROD_SITE_URL = "https://placeducoin-connect.vercel.app";

export function getSiteUrl() {
  return import.meta.env["VITE_SITE_URL"] ?? PROD_SITE_URL;
}
