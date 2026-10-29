'use strict';
// Mints preview test tokens to a wallet. The mint authority key stays in the server env.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bs58 = require('bs58');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');

const CLAIM_UI = 100000;
const hits = new Map();

function loadConfig() {
  const box = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../preview/blup3ts/config.js'), 'utf8'), box);
  return box.window.BLUP3TS_CONFIG;
}

function tooMany(key, max, windowMs) {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const h = (hits.get(key) || []).filter((t) => now - t < windowMs);
  hits.set(key, h);
  return h.length >= max;
}
function mark(key) {
  const h = hits.get(key) || [];
  h.push(Date.now());
  hits.set(key, h);
}

async function claim(wallet, env, ip) {
  const C = loadConfig();
  if (C.TEST_PLAY !== true) return { status: 403, body: { ok: false, message: 'Test token play is not on.' } };
  let owner;
  try { owner = new PublicKey(String(wallet || '').trim()); } catch (e) {
    return { status: 400, body: { ok: false, message: 'That is not a Solana address.' } };
  }
  if (!C.BLUNANA_MINT || C.BLUNANA_MINT === C.REAL_BLUNANA_MINT) {
    return { status: 503, body: { ok: false, message: 'Test token is not created yet.' } };
  }
  if (!env.HELIUS_API_KEY || !env.PAIRS_TREASURY_SECRET_KEY) {
    return { status: 503, body: { ok: false, message: 'Test token minting is not configured on this server.' } };
  }
  let authority;
  try { authority = Keypair.fromSecretKey(bs58.decode(env.PAIRS_TREASURY_SECRET_KEY)); } catch (e) {
    return { status: 503, body: { ok: false, message: 'Test token minting is not configured on this server.' } };
  }
  if (C.RESERVE_WALLET !== authority.publicKey.toBase58()) {
    return { status: 503, body: { ok: false, message: 'Test reserve does not match the mint authority.' } };
  }
  if (owner.equals(authority.publicKey)) return { status: 400, body: { ok: false, message: 'The reserve wallet cannot claim.' } };
  const ipKey = 'ip:' + (ip || 'unknown'), walletKey = 'w:' + owner.toBase58();
  if (tooMany(ipKey, 20, 60 * 60 * 1000) || tooMany(walletKey, 3, 60 * 60 * 1000)) {
    return { status: 429, body: { ok: false, message: 'That wallet already claimed recently. Try again in an hour.' } };
  }
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=' + encodeURIComponent(env.HELIUS_API_KEY), 'confirmed');
  const mint = new PublicKey(C.BLUNANA_MINT);
  const ata = await getOrCreateAssociatedTokenAccount(connection, authority, mint, owner);
  const raw = BigInt(CLAIM_UI) * (10n ** BigInt(C.BLUNANA_DECIMALS || 6));
  const signature = await mintTo(connection, authority, mint, ata.address, authority, raw);
  mark(ipKey);
  mark(walletKey);
  return { status: 200, body: { ok: true, amount: String(CLAIM_UI), symbol: C.TEST_TOKEN_SYMBOL || 'BLUTEST', mint: C.BLUNANA_MINT, signature } };
}

module.exports = { claim, CLAIM_UI };
