/**
 * Host helpers for Discord OAuth callback domain selection.
 */

function requestHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

/** Discord OAuth callback allowed hosts (must also be registered in Discord portal). */
const OAUTH_HOST_RE =
  /^(www\.mnk3ylabs\.com|mnk3ylabs\.com|mnk3ys\.vercel\.app)$/;

module.exports = {
  requestHost,
  OAUTH_HOST_RE,
};
