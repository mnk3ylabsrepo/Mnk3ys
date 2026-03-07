/**
 * Vercel: handle /api/pairs and /api/pairs/* so sub-routes (state, create-buy-tx, etc.) reach Express.
 */
const fs = require('fs');
const path = require('path');
const app = require('../../server');

const ROOT = path.resolve(path.join(__dirname, '..', '..'));

module.exports = (req, res) => {
  const slug = req.query && req.query.slug;
  let rest = Array.isArray(slug) ? slug.filter(Boolean).join('/') : (slug ? String(slug).replace(/^\/+|\/+$/, '') : '');
  if (!rest && (req.url || req.originalUrl)) {
    const raw = (req.url || req.originalUrl || '').split('?')[0];
    const pathOnly = raw.startsWith('http') ? (() => { try { return new URL(raw).pathname; } catch (_) { return raw; } })() : raw;
    const match = (pathOnly || '').match(/^\/?api\/pairs(?:\/(.+))?$/);
    if (match) rest = (match[1] || '').replace(/\/+$/, '');
  }
  const pathname = '/api/pairs' + (rest ? '/' + rest : '');
  const q = (req.url || '').includes('?') ? '?' + (req.url || '').split('?').slice(1).join('?') : '';

  if ((pathname === '/api/pairs' || pathname === '/api/pairs/') && (req.method || 'GET').toUpperCase() === 'GET') {
    try {
      const body = fs.readFileSync(path.join(ROOT, 'pairs.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(body);
    } catch (e) {
      return res.status(404).end();
    }
  }

  req.url = pathname + q;
  return app(req, res);
};
