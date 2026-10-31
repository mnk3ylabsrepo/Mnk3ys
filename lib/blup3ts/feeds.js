'use strict';
// A confirmed wallet feed becomes one row other open pages can poll.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const db = require('../../db');
const nft = require('./nft-check');

const configBox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../preview/blup3ts/config.js'), 'utf8'), configBox);
const C = configBox.window.BLUP3TS_CONFIG;

const TIERS = { nibble: 'Nibble', snack: 'Snack', meal: 'Meal', feast: 'Feast' };
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PET = /^own-[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function amountFor(tier) {
  const base = C.FEED_COSTS && C.FEED_COSTS[tier];
  if (!Number.isFinite(base) || base < 1) return 0;
  const scale = Number.isFinite(C.COST_SCALE) && C.COST_SCALE > 0 ? C.COST_SCALE : 1;
  const live = Number.isFinite(C.LIVE_COST_SCALE) && C.LIVE_COST_SCALE > 0 ? C.LIVE_COST_SCALE : 1;
  return Math.max(1, Math.round(base * scale * live));
}
function shortWallet(w) {
  const s = String(w || '');
  return s.length > 12 ? s.slice(0, 4) + '…' + s.slice(-4) : s || 'Player';
}
function petLabel(row) {
  const name = clean(row.pet_name, 32);
  if (name) return name;
  const coll = clean(row.collection, 16);
  const num = row.pet_number == null ? null : Number(row.pet_number);
  if (coll && Number.isFinite(num)) return coll + ' #' + num;
  return 'a pet';
}
async function whoFor(wallets) {
  const map = await db.getAllWalletToDiscord();
  const ids = [];
  wallets.forEach(function (w) {
    const id = map.get(String(w).toLowerCase());
    if (id && ids.indexOf(id) < 0) ids.push(id);
  });
  const names = ids.length ? await db.getDiscordUsernames(ids) : new Map();
  return function (wallet) {
    const id = map.get(String(wallet).toLowerCase());
    const name = id ? clean(names.get(id), 32) : '';
    return name || shortWallet(wallet);
  };
}
function shape(row, who) {
  const token = row.token === 'blunana' ? '$BLUNANA' : 'BLUTEST';
  return {
    id: Number(row.id),
    who: who(row.wallet_address),
    pet: petLabel(row),
    tier: TIERS[row.tier] || 'Feed',
    amount: Number(row.amount) || 0,
    token: token
  };
}

async function record(body, env) {
  const wallet = String((body && body.wallet) || '').trim();
  const petId = String((body && body.petId) || '').trim();
  const tier = String((body && body.tier) || '').trim();
  const token = body && body.token === 'blunana' ? 'blunana' : (body && body.token === 'test' ? 'test' : '');
  if (!WALLET.test(wallet) || !PET.test(petId) || !TIERS[tier] || !token) {
    return { status: 400, body: { ok: false } };
  }
  const amount = amountFor(tier);
  if (!amount) return { status: 400, body: { ok: false } };
  let owned = null;
  try {
    const looked = await nft.lookup(wallet, env, global.fetch);
    owned = looked && Array.isArray(looked.pets) ? looked.pets.map(function (p) { return 'own-' + p.id; }) : null;
  } catch (e) {
    owned = null;
  }
  if (!owned || owned.indexOf(petId) < 0) return { status: 403, body: { ok: false } };
  const rawNum = body.number;
  const number = rawNum == null || rawNum === '' || !Number.isFinite(Number(rawNum)) ? null : Math.max(0, Math.round(Number(rawNum)));
  const saved = await db.addBlup3tsFeed({
    wallet: wallet,
    petId: petId,
    name: clean(body.name, 32) || null,
    collection: clean(body.collection, 16) || null,
    number: number,
    tier: tier,
    amount: amount,
    token: token
  });
  if (!saved) return { status: 503, body: { ok: false } };
  if (saved.limited) return { status: 429, body: { ok: false } };
  return { status: 200, body: { ok: true, id: saved.id } };
}

async function recent(after) {
  const listed = await db.listBlup3tsFeeds(after);
  const rows = listed.rows || [];
  const who = rows.length ? await whoFor(rows.map(function (r) { return r.wallet_address; })) : function () { return 'Player'; };
  return {
    ok: true,
    latest: listed.latest || 0,
    feeds: rows.map(function (r) { return shape(r, who); })
  };
}

module.exports = { record: record, recent: recent, amountFor: amountFor };
