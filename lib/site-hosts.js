/**
 * Host helpers for main site + game subdomains (same Vercel project).
 * blupets.* → BLUP3TS, blupairs.* → BLUPA1RS
 */

function requestHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function gameDirForHost(host) {
  if (!host) return null;
  if (host === 'blupets.mnk3ylabs.com' || host.startsWith('blupets.')) {
    return 'preview/blup3ts';
  }
  if (host === 'blupairs.mnk3ylabs.com' || host.startsWith('blupairs.')) {
    return 'preview/blupa1rs';
  }
  return null;
}

function isGameHost(host) {
  return !!gameDirForHost(host);
}

function isMainSiteHost(host) {
  return /^(www\.mnk3ylabs\.com|mnk3ylabs\.com|mnk3ys\.vercel\.app|localhost|127\.0\.0\.1)$/.test(host || '');
}

/** Discord OAuth callback allowed hosts (must also be registered in Discord portal). */
const OAUTH_HOST_RE =
  /^(www\.mnk3ylabs\.com|mnk3ylabs\.com|blupets\.mnk3ylabs\.com|blupairs\.mnk3ylabs\.com|mnk3ys\.vercel\.app)$/;

module.exports = {
  requestHost,
  gameDirForHost,
  isGameHost,
  isMainSiteHost,
  OAUTH_HOST_RE,
};
