/** Preview subdomain helpers (Vercel branch deploy — does not affect production main). */

function isPreviewSite() {
  const v = process.env.PREVIEW_SITE;
  return v === '1' || v === 'true';
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i === -1) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

/** Optional gate: set PREVIEW_ACCESS_TOKEN on the preview branch only. Returns false if response sent. */
function enforcePreviewAccess(req, res) {
  const secret = (process.env.PREVIEW_ACCESS_TOKEN || '').trim();
  if (!secret || !isPreviewSite()) return true;

  let qToken = null;
  try {
    const url = new URL(req.url || '/', 'https://localhost');
    qToken = url.searchParams.get('access');
  } catch (_) {}

  if (qToken === secret) {
    res.setHeader(
      'Set-Cookie',
      'preview_access=' + encodeURIComponent(secret) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000'
    );
    return true;
  }

  const cookies = parseCookies(req.headers && req.headers.cookie);
  if (cookies.preview_access === secret) return true;

  res.status(404).setHeader('Content-Type', 'text/plain').send('Not found');
  return false;
}

module.exports = { isPreviewSite, enforcePreviewAccess };
