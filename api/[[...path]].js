/**
 * Vercel: all requests hit this handler. Serve static from project root, /api/* to Express.
 */
const fs = require('fs');
const path = require('path');
const app = require('../server');
const { sendPreviewHtml, sendPreview2Html } = require('../lib/preview-site');

const ROOT = path.resolve(path.join(__dirname, '..'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

function sendFile(res, filePath, ext) {
  try {
    const body = ['.html', '.css', '.js', '.json', '.webmanifest', '.svg'].includes(ext)
      ? fs.readFileSync(filePath, 'utf8')
      : fs.readFileSync(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    return res.status(200).send(body);
  } catch (e) {
    return res.status(404).end();
  }
}

module.exports = (req, res) => {
  const pathSegments = req.query && req.query.path;
  let raw;
  if (pathSegments != null) {
    const rest = Array.isArray(pathSegments) ? pathSegments.filter(Boolean).join('/') : String(pathSegments).replace(/^\/+|\/+$/, '');
    raw = rest ? '/api/' + rest : '/api';
  } else {
    raw = (req.url || req.path || '').split('?')[0];
    if (raw.startsWith('http')) {
      try {
        raw = new URL(raw).pathname;
      } catch (_) {}
    }
    if (!raw.startsWith('/')) raw = '/' + raw;
    if (!raw.startsWith('/api')) {
      if (/^\/(discord|verify|collections|holders|prices|blunana-ohlc|wallets|wallets-unlink|pairs|blup3ts-nfts|blup3ts-floor|blup3ts-rpc|blup3ts-claim|blup3ts-pets|blup3ts-leaderboard|blup3ts-reserve|blup3ts-feeds)(\/|$|\?)/.test(raw)) {
        raw = '/api' + raw;
      }
    }
  }
  if (!raw.startsWith('/api') && /^\/(discord|verify|collections|holders|prices|blunana-ohlc|wallets|wallets-unlink|pairs|blup3ts-nfts|blup3ts-floor|blup3ts-rpc|blup3ts-claim|blup3ts-pets|blup3ts-leaderboard|blup3ts-reserve|blup3ts-feeds)(\/|$|\?)/.test(raw)) {
    raw = '/api' + raw;
  }
  const q = (req.url || '').includes('?') ? '?' + (req.url || '').split('?').slice(1).join('?') : '';

  if (raw === '/api/pairs' || raw === '/api/pairs/') {
    try {
      const body = fs.readFileSync(path.join(ROOT, 'pairs.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(body);
    } catch (e) {
      return res.status(404).end();
    }
  }

  const isApiRoute = /^\/api\/(discord|verify|collections|holders|prices|blunana-ohlc|wallets|wallets-unlink|pairs|blup3ts-nfts|blup3ts-floor|blup3ts-rpc|blup3ts-claim|blup3ts-pets|blup3ts-leaderboard|blup3ts-reserve|blup3ts-feeds)(\/|$|\?)/.test(raw);
  if (isApiRoute) {
    req.url = raw + q;
    return app(req, res);
  }

  let u = raw;
  if (u.startsWith('/api/')) u = u.slice(4) || '/';
  else if (u === '/api') u = '/';
  if (u === '/Mnk3ys' || u === '/Mnk3ys/') u = '/';
  else if (u.startsWith('/Mnk3ys/')) u = u.slice(8) || '/';
  u = (u || '/').trim().replace(/\/+/g, '/').replace(/\/$/, '') || '/';

  if (u === '/favicon.ico') return res.status(204).end();
  if (u === '/favicon.svg') {
    try {
      const body = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      return res.status(200).send(body);
    } catch (e) {
      return res.status(404).end();
    }
  }

  if (u === '/pairs' || u === '/pairs/') {
    const pairsPath = path.join(ROOT, 'pairs.html');
    try {
      const body = fs.readFileSync(pairsPath, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(body);
    } catch (e) {
      return res.status(404).end();
    }
  }

  if (u === '/preview' || u === '/preview/') {
    if (sendPreviewHtml(res, ROOT)) return;
    return res.status(404).end();
  }

  if (u === '/preview2' || u === '/preview2/') {
    res.statusCode = 308;
    res.setHeader('Location', '/');
    return res.end();
  }

  if (u === '/preview/blup3ts' || u === '/preview/blup3ts/') {
    res.statusCode = 308;
    res.setHeader('Location', '/blup3ts/');
    return res.end();
  }
  if (u === '/preview/blupa1rs' || u === '/preview/blupa1rs/') {
    res.statusCode = 308;
    res.setHeader('Location', '/blupa1rs/');
    return res.end();
  }

  const isRoot = u === '' || u === '/' || u === '/index.html';

  function sendGame(publicPrefix, diskDir) {
    if (u === publicPrefix) {
      return sendFile(res, path.join(ROOT, diskDir, 'index.html'), '.html');
    }
    if (u.startsWith(publicPrefix + '/')) {
      const gameRel = u.slice(publicPrefix.length).replace(/^\/+/, '') || 'index.html';
      const gamePath = path.join(ROOT, diskDir, gameRel);
      const gameResolved = path.resolve(gamePath);
      if (!gameResolved.startsWith(path.resolve(ROOT, diskDir))) return res.status(404).end();
      if (!fs.existsSync(gameResolved)) return res.status(404).end();
      return sendFile(res, gameResolved, path.extname(gameResolved) || '.html');
    }
    return null;
  }

  const blup3ts = sendGame('/blup3ts', 'preview/blup3ts');
  if (blup3ts) return blup3ts;
  const blupa1rs = sendGame('/blupa1rs', 'preview/blupa1rs');
  if (blupa1rs) return blupa1rs;

  if (isRoot) {
    if (sendPreview2Html(res, ROOT)) return;
    return res.status(404).end();
  }

  const rel = (u || '').replace(/^\/+/, '') || 'index.html';
  const filePath = path.join(ROOT, rel);
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(ROOT))) return res.status(404).end();
  const ext = path.extname(u);
  if (u.startsWith('/css/') || u.startsWith('/js/') || u.startsWith('/assets/') || u.startsWith('/legacy/') || u.startsWith('/preview/')) {
    try {
      const body = ['.css', '.js', '.json', '.html'].includes(ext)
        ? fs.readFileSync(resolvedPath, 'utf8')
        : fs.readFileSync(resolvedPath);
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      return res.status(200).send(body);
    } catch (e) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(404).send('Not Found');
    }
  }

  req.url = raw + q;
  return app(req, res);
};
