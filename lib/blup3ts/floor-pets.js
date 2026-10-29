// NEXT BATCH (mock): 'floor' starter pets, server-side only.
// Source: Magic Eden public listings (default) or an Orbis endpoint later (FLOOR_SOURCE=orbis + ORBIS_LISTINGS_URL).
// Answers { live, source, mnk3ys:[{mint,name,image}], zmb3ys:[...] }: the ~10 lowest listings per collection, mint + name + image only.
// Nothing else from a listing ever leaves this function. Cached in memory for 10 minutes. Pets with any trait the
// family-friendly filter (filter.js) flags are skipped. Pictures come through Magic Eden's image CDN at 512px
// (img-cdn.magiceden.dev, in the page's img-src), only for source hosts on the list below.
const fs = require('fs'), path = require('path'), vm = require('vm');
const TTL = 10 * 60 * 1000, N = 10, COLS = { mnk3ys: 'mnk3ys', zmb3ys: 'zmb3ys' };
const IMG_OK = /^https:\/\/(na-assets\.pinit\.io|gateway\.pinit\.io|gateway\.irys\.xyz|firebasestorage\.googleapis\.com)\//;
let cache = null;
const small = u => `https://img-cdn.magiceden.dev/rs:fill:512:512:0:0/q:75/plain/${u}`;
let blocked = null;
function filter() {
  if (blocked) return blocked;
  for (const p of [path.join(__dirname, '../../preview/blup3ts/filter.js'), path.join(__dirname, '../../filter.js'), path.join(process.cwd(), 'filter.js'), path.join(__dirname, 'filter.js')]) {
    try { const box = { window: {}, TextEncoder }; vm.runInNewContext(fs.readFileSync(p, 'utf8'), box); if (box.window.BLUP3TS_FILTER) return (blocked = box.window.BLUP3TS_FILTER.blocked); } catch (e) {}
  }
  return null; // no filter = no live pets (fallback stays family friendly)
}
async function getJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } }); return r.ok ? await r.json() : null; }
  catch (e) { return null; } finally { clearTimeout(t); }
}
function clean(rows, sortKey, bad) {
  const seen = new Set(), out = [];
  const list = rows.filter(x => x && x.mint && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x.mint));
  if (sortKey) list.sort((a, b) => a[sortKey] - b[sortKey]);
  for (const x of list) {
    if (seen.has(x.mint)) continue; seen.add(x.mint);
    if (!x.image || !IMG_OK.test(x.image) || /[\s"'<>]/.test(x.image)) continue;
    if ((x.attributes || []).some(a => a && bad(a.trait_type, a.value))) continue;
    out.push({ mint: x.mint, name: String(x.name || '').replace(/[^\w #.-]/g, '').slice(0, 40), image: x.image });
    if (out.length >= N) break;
  }
  return out;
}
async function magiceden(slug) {
  const j = await getJSON(`https://api-mainnet.magiceden.dev/v2/collections/${slug}/listings?offset=0&limit=20`);
  if (!Array.isArray(j)) return null;
  return j.map(x => ({ mint: x.tokenMint || (x.token && x.token.mintAddress), name: x.token && x.token.name, image: (x.token && x.token.image) || (x.extra && x.extra.img),
    attributes: x.token && x.token.attributes, k: +x.price }));
}
async function orbis(slug) {
  const base = process.env.ORBIS_LISTINGS_URL; if (!base) return null;
  const j = await getJSON(base.replace('{collection}', slug)); const rows = Array.isArray(j) ? j : (j && (j.listings || j.items)) || null;
  const k = process.env.ORBIS_SORT_KEY;
  return rows && rows.map(x => ({ mint: x.mint || x.mintAddress, name: x.name, image: x.image || x.img, attributes: x.attributes, k: k ? +x[k] : 0 }));
}
async function build() {
  const bad = filter(); if (!bad) return { live: false };
  const src = process.env.FLOOR_SOURCE === 'orbis' ? orbis : magiceden;
  const [m, z] = await Promise.all([src(COLS.mnk3ys), src(COLS.zmb3ys)]);
  const mm = m && clean(m, 'k', bad), zz = z && clean(z, 'k', bad);
  if (!(mm && mm.length && zz && zz.length)) return { live: false };
  const prox = p => ({ ...p, image: small(p.image) });
  return { live: true, source: process.env.FLOOR_SOURCE === 'orbis' ? 'orbis' : 'magiceden', mnk3ys: mm.map(prox), zmb3ys: zz.map(prox) };
}
exports.handler = async () => {
  const H = { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' };
  if (!cache || Date.now() - cache.at > TTL) { const r = await build(); cache = { at: Date.now(), body: JSON.stringify(r), live: r.live }; if (!r.live) cache.at -= TTL - 60000; } // retry a failed fetch after 1 min
  return { statusCode: 200, headers: H, body: cache.body };
};
