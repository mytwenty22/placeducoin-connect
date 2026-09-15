// Auth email links (password reset, invites) must always point at the public production
// URL, never at whatever origin the request happens to come from -- otherwise testing from
// localhost sends commerçants a link to their own machine instead of the live site.
export function getSiteUrl() {
  return import.meta.env["VITE_SITE_URL"] ?? window.location.origin;
}
