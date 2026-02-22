/**
 * Database helpers for users, wallets, pairs state.
 * Uses Neon PostgreSQL.
 */
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
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

// ——— Pairs game state ———
async function getPairsState(discordId) {
  const p = getPool();
  if (!p) return null;
  const res = await p.query(
    'SELECT turns_remaining, deck_json, flipped_json, matched_json, prizes_won_json FROM pairs_state WHERE discord_id = $1',
    [discordId]
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

async function savePairsState(discordId, state) {
  const p = getPool();
  if (!p) return null;
  await p.query(
    `INSERT INTO pairs_state (discord_id, turns_remaining, deck_json, flipped_json, matched_json, prizes_won_json, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, NOW())
     ON CONFLICT (discord_id) DO UPDATE SET
       turns_remaining = EXCLUDED.turns_remaining,
       deck_json = EXCLUDED.deck_json,
       flipped_json = EXCLUDED.flipped_json,
       matched_json = EXCLUDED.matched_json,
       prizes_won_json = EXCLUDED.prizes_won_json,
       updated_at = NOW()`,
    [
      discordId,
      state.turnsRemaining ?? 0,
      JSON.stringify(state.deck || []),
      JSON.stringify(state.flipped || []),
      JSON.stringify(state.matched || {}),
      JSON.stringify(state.prizesWon || []),
    ]
  );
  return state;
}

module.exports = {
  getPool,
  upsertUser,
  linkWallet,
  getWalletsByDiscord,
  getDiscordByWallet,
  getAllWalletToDiscord,
  getDiscordUsernames,
  getPairsState,
  savePairsState,
};
