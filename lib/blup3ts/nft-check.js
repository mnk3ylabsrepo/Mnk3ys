// BLUP3TS NFT ownership check (read-only). Netlify Function.
// GET /.netlify/functions/nft-check?owner=<public address>
// Looks up the wallet's NFTs with DAS getAssetsByOwner and keeps only assets in a VERIFIED collection from
// config.js COLLECTIONS that are also listed in NFT_CHECK_COLLECTIONS (M10 go-live: MNK3YS + ZMB3YS only). Metaplex Core assets are double-checked on-chain.
// The RPC key comes from the Netlify env only (RPC_URL, or HELIUS_API_KEY) and never reaches the browser.
// No key yet -> { ok:false, code:'not-configured' } and the app shows 'NFT check coming soon'.
// Nothing here can sign or send anything: it only reads public data.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const configBox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../preview/blup3ts/config.js'), 'utf8'), configBox);
const C = configBox.window.BLUP3TS_CONFIG;

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const KEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function b58decode(s) {
  let n = 0n; for (const ch of s) { const i = B58.indexOf(ch); if (i < 0) throw new Error('bad b58'); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const ch of s) { if (ch === '1') out.unshift(0); else break; }
  return Uint8Array.from(out);
}
function b58encode(bytes) {
  let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = '1' + s; else break; }
  return s;
}
function isKey(s) { if (typeof s !== 'string' || !KEY_RE.test(s)) return false; try { return b58decode(s).length === 32; } catch (e) { return false; } }
function txt(v, max) { return String(v == null ? '' : v).slice(0, 400).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 40); }
function hostOk(h, list) { h = h.toLowerCase(); return list.some((p) => { p = p.toLowerCase(); return p.indexOf('*.') === 0 ? (h.length > p.length - 1 && h.slice(-(p.length - 1)) === p.slice(1)) : h === p; }); }
function safeImg(u) { try { const x = new URL(String(u)); return x.protocol === 'https:' && !x.username && !x.password && hostOk(x.hostname, C.IMAGE_HOSTS || []) ? x.href : null; } catch (e) { return null; } }

function rpcUrl(env) {
  const u = env.RPC_URL && String(env.RPC_URL).trim();
  if (u && /^https:\/\//.test(u)) return u;
  const k = env.HELIUS_API_KEY && String(env.HELIUS_API_KEY).trim();
  if (k && /^[A-Za-z0-9-]{8,80}$/.test(k)) return 'https://mainnet.helius-rpc.com/?api-key=' + encodeURIComponent(k);
  return null;
}
async function rpc(url, method, params, fetchImpl, ms) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 10000);
  try {
    const r = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'blup3ts', method, params }), signal: ctl.signal });
    if (!r.ok) { const e = new Error('rpc http ' + r.status); e.http = r.status; throw e; }
    const j = await r.json();
    if (!j || typeof j !== 'object') throw new Error('bad rpc reply');
    if (j.error) { const e = new Error('rpc error'); e.rpc = j.error.code; throw e; }
    return j.result;
  } catch (e) { if (e && e.name === 'AbortError') { const x = new Error('timeout'); x.timeout = true; throw x; } throw e; }
  finally { clearTimeout(t); }
}

// ---------- abuse protection (M10) ----------
const MAX_PAGES = 2;               // at most 2 x 1000 assets per wallet look-up
const CACHE_MS = 60 * 1000;        // same wallet within a minute -> cached answer, no new RPC calls
const CACHE_MAX = 500;
const RATE_WINDOW_MS = 60 * 1000, RATE_MAX = 20;  // per client IP, per warm function instance (best effort)
// Browsers may call this only from these sites. Requests without an Origin (same-site GET, curl) are allowed.
const ORIGINS = ['https://majestic-moxie-3c09c8.netlify.app', 'https://mnk3ylabs.com', 'https://www.mnk3ylabs.com', 'https://mnk3ys.vercel.app'];
const ORIGIN_RE = /^https:\/\/[a-z0-9-]+--majestic-moxie-3c09c8\.netlify\.app$/; // deploy previews of the sandbox
function originOk(o) {
  if (!o || ORIGINS.includes(o) || ORIGIN_RE.test(o)) return true;
  try { const u = new URL(o); return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'); } catch (e) { return false; }
}
const cache = new Map(), hits = new Map();
function cacheGet(k) { const v = cache.get(k); if (!v) return null; if (Date.now() - v.t > CACHE_MS) { cache.delete(k); return null; } return v.r; }
function cachePut(k, r) { if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); cache.set(k, { t: Date.now(), r }); }
function limited(ip) {
  const now = Date.now(); if (hits.size > 5000) hits.clear();
  const h = (hits.get(ip) || []).filter((x) => now - x < RATE_WINDOW_MS); h.push(now); hits.set(ip, h);
  return h.length > RATE_MAX;
}

const TM_IFACES = ['V1_NFT', 'ProgrammableNFT', 'LEGACY_NFT'];
const CHECK_IDS = Array.isArray(C.NFT_CHECK_COLLECTIONS) ? C.NFT_CHECK_COLLECTIONS : null;
function collections() { return (C.COLLECTIONS || []).filter((c) => c.enabled !== false && c.verified === true && isKey(c.address) && (!CHECK_IDS || CHECK_IDS.includes(c.id))); }
// The one collection group of a DAS asset, only if verified (DAS marks unverified ones verified:false).
function collOf(a) {
  const g = ((a && a.grouping) || []).filter((x) => x && x.group_key === 'collection');
  if (g.length !== 1 || g[0].verified === false) return null;
  return collections().find((c) => c.address === g[0].group_value) || null;
}
function candidate(a, owner) {
  const c = collOf(a); if (!c || !a || !isKey(a.id) || a.burnt) return null;
  if (!a.ownership || a.ownership.owner !== owner) return null;
  if (c.standard === 'core') return a.interface === 'MplCoreAsset' ? c : null;
  if (c.standard === 'token-metadata') return TM_IFACES.includes(a.interface) && !(a.compression && a.compression.compressed) ? c : null;
  return null;
}
function trim(a, c) {
  const cont = a.content || {}, md = cont.metadata || {}, links = cont.links || {}, files = Array.isArray(cont.files) ? cont.files : [];
  const img = safeImg(links.image) || (files[0] && (safeImg(files[0].cdn_uri) || safeImg(files[0].uri))) || null;
  const attrs = (Array.isArray(md.attributes) ? md.attributes : []).slice(0, 30).filter((x) => x && typeof x === 'object').map((x) => ({ trait_type: txt(x.trait_type, 24), value: txt(x.value, 40) })).filter((x) => x.trait_type && x.value);
  return { id: a.id, collection: c.id, name: txt(md.name, 32), image: img, attributes: attrs };
}
// Metaplex Core on-chain double check: account owned by the Core program, key AssetV1, owner = wallet,
// update authority = Collection(<pinned address>).
async function verifyCore(url, ids, owner, fetchImpl) {
  const ok = {}, ownerB = b58decode(owner);
  for (let i = 0; i < ids.length; i += 100) {
    const ch = ids.slice(i, i + 100);
    const res = await rpc(url, 'getMultipleAccounts', [ch, { encoding: 'base64', commitment: 'confirmed' }], fetchImpl);
    const vals = (res && res.value) || [];
    ch.forEach((id, k) => {
      const v = vals[k]; if (!v || v.owner !== C.CORE_PROGRAM || !Array.isArray(v.data)) return;
      let d; try { d = Buffer.from(v.data[0], 'base64'); } catch (e) { return; }
      if (d.length < 66 || d[0] !== 1 || d[33] !== 2) return;
      for (let j = 0; j < 32; j++) if (d[1 + j] !== ownerB[j]) return;
      ok[id] = b58encode(d.subarray(34, 66));
    });
  }
  return ok;
}
async function check(owner, env, fetchImpl) {
  const url = rpcUrl(env || {});
  if (!url) return { status: 200, body: { ok: false, code: 'not-configured', message: 'NFT check coming soon' } };
  if (!isKey(owner)) return { status: 400, body: { ok: false, code: 'bad-owner', message: 'That is not a Solana address.' } };
  let all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await rpc(url, 'getAssetsByOwner', { ownerAddress: owner, page, limit: 1000 }, fetchImpl);
    const items = r && Array.isArray(r.items) ? r.items : []; all = all.concat(items);
    if (items.length < 1000) break;
  }
  const cand = []; all.forEach((a) => { const c = candidate(a, owner); if (c) cand.push([a, c]); });
  const coreIds = cand.filter(([, c]) => c.standard === 'core').map(([a]) => a.id);
  const coreOk = coreIds.length ? await verifyCore(url, coreIds, owner, fetchImpl) : {};
  const pets = cand.filter(([a, c]) => c.standard !== 'core' || coreOk[a.id] === c.address).map(([a, c]) => trim(a, c)).slice(0, C.MAX_PETS || 60);
  const counts = {}; collections().forEach((c) => { counts[c.id] = pets.filter((p) => p.collection === c.id).length; });
  return { status: 200, body: { ok: true, owner, pets, counts, found: cand.length, skipped: cand.length - pets.length } };
}
function json(status, body, origin) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', vary: 'Origin' };
  if (origin && originOk(origin)) { headers['access-control-allow-origin'] = origin; headers['access-control-allow-methods'] = 'GET, POST, OPTIONS'; headers['access-control-allow-headers'] = 'accept, content-type'; headers['access-control-max-age'] = '600'; }
  return { statusCode: status, headers, body: status === 204 ? '' : JSON.stringify(body) };
}
function hdr(event, k) { const h = (event && event.headers) || {}; return h[k] || h[k.toLowerCase()] || ''; }
// Same cached ownership read the NFT check uses. Null when the chain look-up did not succeed.
async function lookup(owner, env, fetchImpl) {
  if (!isKey(owner)) return null;
  const hit = cacheGet(owner);
  if (hit && hit.body && hit.body.ok) return hit.body;
  const r = await check(owner, env, fetchImpl);
  if (r.status === 200 && r.body && r.body.ok) { cachePut(owner, r); return r.body; }
  return null;
}
exports.lookup = lookup;
exports.handler = async function (event) {
  const origin = String(hdr(event, 'origin') || '');
  try {
    if (!originOk(origin)) return json(403, { ok: false, code: 'origin', message: 'Not allowed from this site.' });
    if (event.httpMethod === 'OPTIONS') return json(204, null, origin);
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return json(405, { ok: false, code: 'method', message: 'Read only.' }, origin);
    const q = event.queryStringParameters || {};
    if (q.rpc) return json(403, { ok: false, code: 'off', message: 'Real payments are off.' }, origin); // the RPC proxy for payments stays closed until P2/P3
    let owner = q.owner;
    if (event.httpMethod === 'POST' && !owner) {
      const raw = String(event.body || '').slice(0, 512);
      try { owner = JSON.parse(event.isBase64Encoded ? Buffer.from(raw, 'base64').toString() : raw).owner; } catch (e) { owner = ''; }
    }
    owner = String(owner || '').trim();
    if (!rpcUrl(process.env)) return json(200, { ok: false, code: 'not-configured', message: 'NFT check coming soon' }, origin);
    if (!isKey(owner)) return json(400, { ok: false, code: 'bad-owner', message: 'That is not a Solana address.' }, origin);
    const ip = String(hdr(event, 'x-nf-client-connection-ip') || hdr(event, 'x-forwarded-for') || 'unknown').split(',')[0].trim();
    const hit = cacheGet(owner); if (hit) return json(hit.status, hit.body, origin);
    if (limited(ip)) return json(429, { ok: false, code: 'busy', message: 'Too many look-ups. Try again in a minute.' }, origin);
    const r = await check(owner, process.env, globalThis.fetch);
    if (r.status === 200 && r.body.ok) cachePut(owner, r);
    return json(r.status, r.body, origin);
  } catch (e) {
    const code = e && e.timeout ? 'timeout' : e && e.http === 429 ? 'busy' : e && e.rpc === -32601 ? 'no-das' : 'rpc';
    return json(502, { ok: false, code, message: 'Could not check NFTs right now.' }, origin);
  }
};
exports._core = { check, candidate, collOf, trim, rpcUrl, isKey, b58encode, b58decode, safeImg, originOk, collections };
