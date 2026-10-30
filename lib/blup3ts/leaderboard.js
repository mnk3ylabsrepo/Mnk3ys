'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const db = require('../../db');

const configBox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../preview/blup3ts/config.js'), 'utf8'), configBox);
const C = configBox.window.BLUP3TS_CONFIG;
const LV = (function () {
  const t = C.LEVEL_STRENGTH, fallback = [50, 150, 350, 700, 1000, 1500, 2300, 3500, 5000], step = C.LEVEL_STEP_AFTER;
  const ok = Array.isArray(t) && t.length >= 1 && t.every(function (x, i) { return Number.isFinite(x) && x > 0 && (i === 0 || x > t[i - 1]); });
  return { t: ok ? t.slice() : fallback, step: Number.isFinite(step) && step > 0 ? step : 2000 };
})();
function strNeeded(n) {
  if (n <= 1) return 0;
  const i = n - 2;
  return i < LV.t.length ? LV.t[i] : LV.t[LV.t.length - 1] + (i - LV.t.length + 1) * LV.step;
}
function levelFor(s) {
  s = Math.max(0, +s || 0);
  let l = 1;
  while (l < 999 && strNeeded(l + 1) <= s) l++;
  return l;
}
function weekBounds(now) {
  const x = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - x.getUTCDay());
  const start = x.toISOString().slice(0, 10);
  const end = new Date(x.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  return { start: start, end: end };
}
function shortWallet(w) {
  const s = String(w || '').trim();
  return s || 'Player';
}
function clean(s, n) {
  return String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
}
function httpsImg(s) {
  if (!/^https:\/\//i.test(String(s || ''))) return '';
  try { const u = new URL(s); return u.protocol === 'https:' ? String(s).slice(0, 400) : ''; } catch (e) { return ''; }
}
function petBoardScore(p, board, period, week) {
  const str = Number(p.str) || 0;
  const jams = Number(p.jams) || 0;
  const inWeek = String(p.week_start || '').slice(0, 10) === week;
  const wStr = inWeek ? Math.max(0, Number(p.week_str) || 0) : 0;
  const wJams = inWeek ? Math.max(0, Number(p.week_jams) || 0) : 0;
  if (board === 'jam') return period === 'week' ? wJams : jams;
  if (board === 'level') {
    if (period === 'week') return Math.max(0, levelFor(str) - levelFor(Math.max(0, str - Math.min(str, wStr))));
    return str > 0 ? levelFor(str) : 0;
  }
  return period === 'week' ? wStr : str;
}
function buildEntries(rows, walletToDiscord, names, opts) {
  const board = opts.board === 'jam' || opts.board === 'level' ? opts.board : 'str';
  const period = opts.period === 'all' ? 'all' : 'week';
  const week = opts.week;
  const groups = new Map();
  (rows || []).forEach(function (p) {
    const wallet = String(p.wallet_address || '');
    if (!wallet) return;
    const discordId = walletToDiscord.get(wallet.toLowerCase()) || null;
    const key = discordId ? 'd:' + discordId : 'w:' + wallet.toLowerCase();
    let g = groups.get(key);
    if (!g) { g = { discordId: discordId, wallets: [], pets: [] }; groups.set(key, g); }
    if (g.wallets.indexOf(wallet) < 0) g.wallets.push(wallet);
    g.pets.push(p);
  });
  const entries = [];
  groups.forEach(function (g) {
    let score = 0, best = null, bestScore = -1;
    g.pets.forEach(function (p) {
      const s = petBoardScore(p, board, period, week);
      if (board === 'level') { if (s > score) score = s; }
      else score += s;
      if (s > bestScore) { bestScore = s; best = p; }
    });
    if (!(score > 0) || !best) return;
    const username = g.discordId ? clean(names.get(String(g.discordId)) || names.get(g.discordId), 32) : '';
    entries.push({
      rank: 0,
      name: username || shortWallet(g.wallets[0]),
      score: score,
      level: levelFor(best.str),
      petName: clean(best.pet_name, 32),
      collection: clean(best.collection, 16),
      petNumber: best.pet_number == null || best.pet_number === '' ? null : Number(best.pet_number),
      petImage: httpsImg(best.pet_image),
      walletCount: g.wallets.length,
      discordId: g.discordId ? String(g.discordId) : null
    });
  });
  entries.sort(function (a, b) { return b.score - a.score || String(a.name).localeCompare(String(b.name)); });
  let prev = null;
  entries.forEach(function (e, i) {
    if (e.score !== prev) { e.rank = i + 1; prev = e.score; }
    else e.rank = entries[i - 1].rank;
  });
  return entries;
}

let rowCache = { t: 0, rows: null };
async function loadRows() {
  if (rowCache.rows && Date.now() - rowCache.t < 45000) return rowCache.rows;
  const rows = await db.getBlup3tsLeaderboardRows();
  rowCache = { t: Date.now(), rows: rows };
  return rows;
}
function publicEntry(e) {
  return {
    rank: e.rank, name: e.name, score: e.score, level: e.level,
    petName: e.petName, collection: e.collection, petNumber: e.petNumber,
    petImage: e.petImage, walletCount: e.walletCount
  };
}
async function board(query, discord) {
  const boardId = query.board === 'jam' || query.board === 'level' ? query.board : 'str';
  const period = query.period === 'all' ? 'all' : 'week';
  const week = weekBounds(new Date());
  const rows = await loadRows();
  const map = await db.getAllWalletToDiscord();
  const ids = [];
  map.forEach(function (id) { if (id && ids.indexOf(id) < 0) ids.push(id); });
  const names = ids.length ? await db.getDiscordUsernames(ids) : new Map();
  const entries = buildEntries(rows, map, names, { board: boardId, period: period, week: week.start });
  const discordId = discord && discord.id ? String(discord.id) : '';
  let me = null;
  if (discordId) {
    for (let i = 0; i < entries.length; i++) if (entries[i].discordId === discordId) me = entries[i];
  }
  return {
    ok: true, board: boardId, period: period, week: week, signedIn: !!discordId,
    entries: entries.map(publicEntry),
    me: me ? publicEntry(me) : null
  };
}

let reserveCache = { t: 0, body: null };
async function reserve() {
  if (reserveCache.body && Date.now() - reserveCache.t < 30000) return reserveCache.body;
  const wallet = C.RESERVE_WALLET;
  const mint = C.REAL_BLUNANA_MINT;
  const key = process.env.HELIUS_API_KEY;
  const decimals = Number.isFinite(C.BLUNANA_DECIMALS) ? C.BLUNANA_DECIMALS : 6;
  if (!wallet || !mint || !key) return { ok: false, balance: null };
  const r = await fetch('https://mainnet.helius-rpc.com/?api-key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'getTokenAccounts', params: { owner: wallet, mint: mint, limit: 20 } })
  });
  const j = await r.json();
  let raw = 0;
  ((j && j.result && j.result.token_accounts) || []).forEach(function (a) { raw += Number(a.amount || 0); });
  const body = { ok: true, balance: raw / Math.pow(10, decimals), symbol: '$BLUNANA' };
  reserveCache = { t: Date.now(), body: body };
  return body;
}

module.exports = { board: board, reserve: reserve, buildEntries: buildEntries, levelFor: levelFor, weekBounds: weekBounds };
