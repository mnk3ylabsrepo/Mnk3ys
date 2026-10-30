/**
 * Database helpers for users, wallets, pairs state.
 * Uses Neon PostgreSQL.
 */
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    let url = process.env.DATABASE_URL;
    if (!url) return null;
    // Avoid pg SSL warning: prefer verify-full (or leave as-is if already set)
    if (url.includes('sslmode=require') || url.includes('sslmode=prefer') || url.includes('sslmode=verify-ca')) {
      url = url.replace(/sslmode=(require|prefer|verify-ca)/i, 'sslmode=verify-full');
    }
    pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });
  }
  return pool;
}

async function upsertUser(discordId, discordUsername, discordAvatar) {
  const p = getPool();
  if (!p) return null;
  await p.query(
    `INSERT INTO users (discord_id, discord_username, discord_avatar, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (discord_id) DO UPDATE SET
       discord_username = EXCLUDED.discord_username,
       discord_avatar = EXCLUDED.discord_avatar,
       updated_at = NOW()`,
    [discordId, discordUsername || '', discordAvatar || null]
  );
  return { discordId, discordUsername, discordAvatar };
}

async function linkWallet(discordId, discordUsername, walletAddress) {
  const p = getPool();
  if (!p) return null;
  await upsertUser(discordId, discordUsername, null);
  await p.query(
    `INSERT INTO wallets (wallet_address, discord_id)
     VALUES ($1, $2)
     ON CONFLICT (wallet_address) DO UPDATE SET discord_id = EXCLUDED.discord_id`,
    [walletAddress.toLowerCase(), discordId]
  );
  return { discordId, walletAddress };
}

async function getWalletsByDiscord(discordId) {
  const p = getPool();
  if (!p) return [];
  const res = await p.query(
    'SELECT wallet_address FROM wallets WHERE discord_id = $1',
    [discordId]
  );
  return (res.rows || []).map((r) => r.wallet_address);
}

async function unlinkWallet(discordId, walletAddress) {
  const p = getPool();
  if (!p) return 0;
  const res = await p.query(
    'DELETE FROM wallets WHERE wallet_address = $1 AND discord_id = $2',
    [walletAddress.toLowerCase(), discordId]
  );
  return res.rowCount || 0;
}

async function getDiscordByWallet(walletAddress) {
  const p = getPool();
  if (!p) return null;
  const res = await p.query(
    'SELECT discord_id FROM wallets WHERE wallet_address = $1',
    [walletAddress.toLowerCase()]
  );
  return res.rows?.[0]?.discord_id || null;
}

async function getAllWalletToDiscord() {
  const p = getPool();
  if (!p) return new Map();
  const res = await p.query('SELECT wallet_address, discord_id FROM wallets');
  const m = new Map();
  (res.rows || []).forEach((r) => m.set(r.wallet_address.toLowerCase(), r.discord_id));
  return m;
}

async function getDiscordUsernames(discordIds) {
  if (!discordIds || discordIds.length === 0) return new Map();
  const p = getPool();
  if (!p) return new Map();
  const placeholders = discordIds.map((_, i) => '$' + (i + 1)).join(',');
  const res = await p.query(
    `SELECT discord_id, discord_username FROM users WHERE discord_id IN (${placeholders})`,
    discordIds
  );
  const m = new Map();
  (res.rows || []).forEach((r) => m.set(r.discord_id, r.discord_username));
  return m;
}

// ——— Pairs game state (keyed by wallet_address) ———
function normWallet(w) {
  return w && typeof w === 'string' ? w.trim().toLowerCase() : '';
}

async function getPairsState(wallet) {
  const p = getPool();
  if (!p) return null;
  const w = normWallet(wallet);
  if (!w) return null;
  const res = await p.query(
    'SELECT turns_remaining, deck_json, flipped_json, matched_json, prizes_won_json FROM pairs_state WHERE wallet_address = $1',
    [w]
  );
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    turnsRemaining: row.turns_remaining || 0,
    deck: row.deck_json || [],
    flipped: row.flipped_json || [],
    matched: row.matched_json || {},
    prizesWon: row.prizes_won_json || [],
  };
}

async function savePairsState(wallet, state) {
  const p = getPool();
  if (!p) return null;
  const w = normWallet(wallet);
  if (!w) return null;
  await p.query(
    `INSERT INTO pairs_state (wallet_address, turns_remaining, deck_json, flipped_json, matched_json, prizes_won_json, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, NOW())
     ON CONFLICT (wallet_address) DO UPDATE SET
       turns_remaining = EXCLUDED.turns_remaining,
       deck_json = EXCLUDED.deck_json,
       flipped_json = EXCLUDED.flipped_json,
       matched_json = EXCLUDED.matched_json,
       prizes_won_json = EXCLUDED.prizes_won_json,
       updated_at = NOW()`,
    [
      w,
      state.turnsRemaining ?? 0,
      JSON.stringify(state.deck || []),
      JSON.stringify(state.flipped || []),
      JSON.stringify(state.matched || {}),
      JSON.stringify(state.prizesWon || []),
    ]
  );
  return state;
}

async function recordPairsBuy(wallet, turnsBought, txSignature) {
  const p = getPool();
  if (!p) return null;
  const w = normWallet(wallet);
  if (!w) return null;
  await p.query(
    `INSERT INTO pairs_buys (wallet_address, turns_bought, tx_signature) VALUES ($1, $2, $3)`,
    [w, turnsBought, txSignature || null]
  );
  return { wallet: w, turnsBought, txSignature };
}

async function insertPairsPrize(wallet, prizeId) {
  const p = getPool();
  if (!p) return null;
  const w = normWallet(wallet);
  if (!w) return null;
  const res = await p.query(
    `INSERT INTO pairs_prizes (wallet_address, prize_id, status) VALUES ($1, $2, 'pending') RETURNING id`,
    [w, String(prizeId).trim()]
  );
  return res.rows?.[0]?.id ?? null;
}

async function getPendingPairsPrizes(wallet) {
  const p = getPool();
  if (!p) return [];
  const w = normWallet(wallet);
  if (!w) return [];
  const res = await p.query(
    `SELECT id, prize_id, created_at FROM pairs_prizes
     WHERE wallet_address = $1 AND status = 'pending'
     ORDER BY created_at ASC`,
    [w]
  );
  return (res.rows || []).map((r) => ({ id: r.id, prizeId: r.prize_id, createdAt: r.created_at }));
}

async function countPendingByPrizeId(wallet) {
  const p = getPool();
  if (!p) return {};
  const w = normWallet(wallet);
  if (!w) return {};
  const res = await p.query(
    `SELECT prize_id, COUNT(*)::int AS cnt FROM pairs_prizes
     WHERE wallet_address = $1 AND status = 'pending'
     GROUP BY prize_id`,
    [w]
  );
  const out = {};
  (res.rows || []).forEach((r) => { out[r.prize_id] = r.cnt; });
  return out;
}

async function claimPendingPairsPrize(wallet, prizeId) {
  const p = getPool();
  if (!p) return null;
  const w = normWallet(wallet);
  if (!w) return null;
  const res = await p.query(
    `UPDATE pairs_prizes SET status = 'claimed', updated_at = NOW()
     WHERE id = (
       SELECT id FROM pairs_prizes
       WHERE wallet_address = $1 AND prize_id = $2 AND status = 'pending'
       ORDER BY created_at ASC LIMIT 1
     )
     RETURNING id, prize_id AS "prizeId"`,
    [w, String(prizeId).trim()]
  );
  const row = res.rows?.[0];
  return row ? { id: row.id, prizeId: row.prizeId } : null;
}

async function claimFirstPendingPairsPrize(wallet) {
  const p = getPool();
  if (!p) return null;
  const w = normWallet(wallet);
  if (!w) return null;
  const res = await p.query(
    `UPDATE pairs_prizes SET status = 'claimed', updated_at = NOW()
     WHERE id = (
       SELECT id FROM pairs_prizes
       WHERE wallet_address = $1 AND status = 'pending'
       ORDER BY created_at ASC LIMIT 1
     )
     RETURNING id, prize_id AS "prizeId"`,
    [w]
  );
  const row = res.rows?.[0];
  return row ? { id: row.id, prizeId: row.prizeId } : null;
}

async function markPairsPrizeSent(prizeRowId, txSignature) {
  const p = getPool();
  if (!p) return;
  const id = typeof prizeRowId === 'object' && prizeRowId != null && prizeRowId.id != null ? prizeRowId.id : prizeRowId;
  await p.query(
    `UPDATE pairs_prizes SET status = 'sent', tx_signature = $2, updated_at = NOW() WHERE id = $1`,
    [id, txSignature || null]
  );
}

async function markPairsPrizeFailed(prizeRowId, errorMessage) {
  const p = getPool();
  if (!p) return;
  const id = typeof prizeRowId === 'object' && prizeRowId != null && prizeRowId.id != null ? prizeRowId.id : prizeRowId;
  await p.query(
    `UPDATE pairs_prizes SET status = 'pending', error_message = $2, updated_at = NOW() WHERE id = $1 AND status = 'claimed'`,
    [id, (errorMessage || '').slice(0, 500)]
  );
}

// BLUP3TS NFT progress. Stats belong to the wallet that currently holds the pet.
// blup3ts_pet_holder records that wallet. A different holder, or a sale (holder cleared), resets the pet to zero.
let blup3tsReady = null;
function ensureBlup3tsPets() {
  const p = getPool();
  if (!p) return Promise.resolve(false);
  if (!blup3tsReady) {
    blup3tsReady = p.query(
      `CREATE TABLE IF NOT EXISTS blup3ts_pets (
        wallet_address TEXT NOT NULL,
        pet_id TEXT NOT NULL,
        hunger REAL NOT NULL,
        joy REAL NOT NULL,
        str INTEGER NOT NULL,
        eaten INTEGER NOT NULL,
        jams INTEGER NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (wallet_address, pet_id)
      )`
    ).then(function () {
      return p.query(
        `CREATE TABLE IF NOT EXISTS blup3ts_pet_holder (
          pet_id TEXT PRIMARY KEY,
          wallet_address TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      );
    }).catch(function (e) { blup3tsReady = null; throw e; });
  }
  return blup3tsReady.then(function () { return true; });
}
function clampPet(n, max) {
  n = Number(n);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}
const BLUP3TS_PET_ID = /^own-[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function zeroPet(id, wallet) {
  return { id: id, full: 0, joy: 0, str: 0, eaten: 0, jams: 0, reset: true, holder: wallet };
}
function petStats(r) {
  return { full: r.hunger, joy: r.joy, str: r.str, eaten: r.eaten, jams: r.jams };
}
async function writePet(client, wallet, id, stats) {
  await client.query(
    `INSERT INTO blup3ts_pets (wallet_address, pet_id, hunger, joy, str, eaten, jams, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (wallet_address, pet_id) DO UPDATE SET
       hunger = EXCLUDED.hunger, joy = EXCLUDED.joy, str = EXCLUDED.str,
       eaten = EXCLUDED.eaten, jams = EXCLUDED.jams, updated_at = NOW()`,
    [wallet, id, clampPet(stats.full, 100), clampPet(stats.joy, 100), Math.round(clampPet(stats.str, 1000000)), Math.round(clampPet(stats.eaten, 1000000)), Math.round(clampPet(stats.jams, 1000000))]
  );
}
async function claimHolder(client, id, wallet) {
  await client.query(
    `INSERT INTO blup3ts_pet_holder (pet_id, wallet_address, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (pet_id) DO UPDATE SET wallet_address = EXCLUDED.wallet_address, updated_at = NOW()`,
    [id, wallet]
  );
}
// ownedIds is the verified mint list (own-<mint>) for this wallet, or null when ownership could not be checked.
// A new holder, or a holder row cleared by a sale, gets zeros. The same holder keeps what they already saved.
async function settleHeldPet(client, wallet, id, incoming) {
  const h = await client.query('SELECT wallet_address FROM blup3ts_pet_holder WHERE pet_id = $1', [id]);
  const known = h.rows.length > 0;
  const holder = known ? h.rows[0].wallet_address : null;
  if (known && holder !== wallet) {
    await client.query('DELETE FROM blup3ts_pets WHERE pet_id = $1', [id]);
    await writePet(client, wallet, id, { full: 0, joy: 0, str: 0, eaten: 0, jams: 0 });
    await claimHolder(client, id, wallet);
    return zeroPet(id, wallet);
  }
  const cur = await client.query(
    'SELECT hunger, joy, str, eaten, jams FROM blup3ts_pets WHERE wallet_address = $1 AND pet_id = $2',
    [wallet, id]
  );
  let stats = incoming;
  if (!stats) {
    if (!cur.rows[0]) return null;
    stats = petStats(cur.rows[0]);
  }
  await writePet(client, wallet, id, stats);
  if (!known) await claimHolder(client, id, wallet);
  return { id: id, full: clampPet(stats.full, 100), joy: clampPet(stats.joy, 100), str: Math.round(clampPet(stats.str, 1000000)), eaten: Math.round(clampPet(stats.eaten, 1000000)), jams: Math.round(clampPet(stats.jams, 1000000)), reset: false, holder: wallet };
}
async function releaseSoldPets(client, wallet, ownedIds) {
  const mine = await client.query('SELECT pet_id FROM blup3ts_pets WHERE wallet_address = $1', [wallet]);
  for (let i = 0; i < mine.rows.length; i++) {
    const id = mine.rows[i].pet_id;
    if (ownedIds.indexOf(id) >= 0) continue;
    const h = await client.query('SELECT wallet_address FROM blup3ts_pet_holder WHERE pet_id = $1', [id]);
    if (h.rows[0] && h.rows[0].wallet_address === wallet) {
      await client.query('UPDATE blup3ts_pet_holder SET wallet_address = NULL, updated_at = NOW() WHERE pet_id = $1', [id]);
    }
    await client.query('DELETE FROM blup3ts_pets WHERE wallet_address = $1 AND pet_id = $2', [wallet, id]);
  }
}
async function getBlup3tsPets(wallet) {
  const p = getPool();
  if (!p || !wallet) return [];
  await ensureBlup3tsPets();
  const res = await p.query(
    'SELECT pet_id, hunger, joy, str, eaten, jams FROM blup3ts_pets WHERE wallet_address = $1',
    [wallet]
  );
  return (res.rows || []).map(function (r) {
    return { id: r.pet_id, full: r.hunger, joy: r.joy, str: r.str, eaten: r.eaten, jams: r.jams };
  });
}
async function withPets(wallet, run) {
  const p = getPool();
  if (!p || !wallet) return null;
  await ensureBlup3tsPets();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const out = await run(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (err) {}
    throw e;
  } finally {
    client.release();
  }
}
function ownedList(ids) {
  return (Array.isArray(ids) ? ids : []).filter(function (id) { return BLUP3TS_PET_ID.test(id); }).slice(0, 60);
}
// Read progress for a wallet whose NFTs were just checked. Pets that changed hands come back at zero.
async function syncBlup3tsPets(wallet, ownedIds) {
  const owned = ownedList(ownedIds);
  const out = await withPets(wallet, async function (client) {
    await releaseSoldPets(client, wallet, owned);
    const pets = [];
    for (let i = 0; i < owned.length; i++) {
      const row = await settleHeldPet(client, wallet, owned[i], null);
      if (row) pets.push(row);
    }
    return pets;
  });
  return out || [];
}
async function saveBlup3tsPets(wallet, pets, ownedIds) {
  const rows = (Array.isArray(pets) ? pets : []).filter(function (q) { return q && BLUP3TS_PET_ID.test(q.id); }).slice(0, 60);
  if (!rows.length) return { saved: 0, pets: [] };
  if (!Array.isArray(ownedIds)) {
    const p = getPool();
    if (!p || !wallet) return { saved: 0, pets: [] };
    await ensureBlup3tsPets();
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < rows.length; i++) await writePet(client, wallet, rows[i].id, rows[i]);
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (err) {}
      throw e;
    } finally {
      client.release();
    }
    return { saved: rows.length, pets: [] };
  }
  const owned = ownedList(ownedIds);
  const out = await withPets(wallet, async function (client) {
    await releaseSoldPets(client, wallet, owned);
    const changed = [];
    let saved = 0;
    for (let i = 0; i < rows.length; i++) {
      if (owned.indexOf(rows[i].id) < 0) continue;
      const row = await settleHeldPet(client, wallet, rows[i].id, rows[i]);
      saved++;
      if (row && row.reset) changed.push(row);
    }
    return { saved: saved, pets: changed };
  });
  return out || { saved: 0, pets: [] };
}

module.exports = {
  getPool,
  upsertUser,
  linkWallet,
  unlinkWallet,
  getWalletsByDiscord,
  getDiscordByWallet,
  getAllWalletToDiscord,
  getDiscordUsernames,
  getPairsState,
  savePairsState,
  recordPairsBuy,
  insertPairsPrize,
  getPendingPairsPrizes,
  countPendingByPrizeId,
  claimPendingPairsPrize,
  claimFirstPendingPairsPrize,
  markPairsPrizeSent,
  markPairsPrizeFailed,
  getBlup3tsPets,
  saveBlup3tsPets,
  syncBlup3tsPets,
};
