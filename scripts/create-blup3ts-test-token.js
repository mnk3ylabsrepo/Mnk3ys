'use strict';
// Creates the BLUP3TS preview test token on Solana mainnet and points the preview config at it.
// Uses PAIRS_TREASURY_SECRET_KEY as the mint authority and feed reserve. Does not print the key.
// Refuses to touch the real $BLUNANA mint. Safe to run again: a second run keeps the saved mint.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { createMint, getMint } = require('@solana/spl-token');

const REAL = 'C9vfeaCLhJy7sykgKnfzi6RikawQNoGtRKwsaupKavmV';
const root = path.join(__dirname, '..');
const configPath = path.join(root, 'preview/blup3ts/config.js');
const recordPath = path.join(root, 'preview/blup3ts/test-token.json');

function patch(src, from, to) {
  if (src.includes(to)) return src;
  if (!src.includes(from)) throw new Error('config marker missing: ' + from.slice(0, 80));
  return src.replace(from, to);
}

async function main() {
  if (!process.env.HELIUS_API_KEY || !process.env.PAIRS_TREASURY_SECRET_KEY) {
    throw new Error('Need HELIUS_API_KEY and PAIRS_TREASURY_SECRET_KEY in .env');
  }
  const authority = Keypair.fromSecretKey(bs58.decode(process.env.PAIRS_TREASURY_SECRET_KEY));
  const reserve = authority.publicKey.toBase58();
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=' + encodeURIComponent(process.env.HELIUS_API_KEY), 'confirmed');

  let mint;
  if (fs.existsSync(recordPath)) {
    const saved = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    if (!saved.mint || saved.mint === REAL) throw new Error('saved test token record is not usable');
    mint = saved.mint;
    const info = await getMint(connection, new PublicKey(mint));
    if (info.decimals !== 6) throw new Error('saved mint is not 6 decimals');
    if (!info.mintAuthority || !info.mintAuthority.equals(authority.publicKey)) throw new Error('saved mint authority is not the test reserve');
    console.log('Keeping existing test mint');
  } else {
    const lamports = await connection.getBalance(authority.publicKey);
    if (lamports < 2_000_000) throw new Error('Test reserve ' + reserve + ' needs at least 0.002 SOL to create the mint. It has ' + (lamports / 1e9));
    const created = await createMint(connection, authority, authority.publicKey, null, 6);
    mint = created.toBase58();
    if (mint === REAL) throw new Error('refusing to use the real BLUNANA mint');
    fs.writeFileSync(recordPath, JSON.stringify({
      symbol: 'BLUTEST',
      name: 'BLUP3TS Test',
      decimals: 6,
      mint,
      reserve,
      network: 'mainnet-beta',
      createdAt: new Date().toISOString()
    }, null, 2) + '\n');
    console.log('Created test mint');
  }

  let src = fs.readFileSync(configPath, 'utf8');
  src = patch(src, 'TEST_PLAY: false,', 'TEST_PLAY: true,');
  src = patch(src, "NETWORK: 'mainnet-readonly',", "NETWORK: 'mainnet-live',");
  src = patch(src, 'RESERVE_WALLET: null,', "RESERVE_WALLET: '" + reserve + "',");
  src = patch(src, "\n  BLUNANA_MINT: '" + REAL + "',", "\n  BLUNANA_MINT: '" + mint + "',");
  src = patch(src, 'REAL_PAYMENTS_ENABLED: false,', 'REAL_PAYMENTS_ENABLED: true,');
  if (src.includes(REAL) && src.indexOf("BLUNANA_MINT: '" + mint + "'") < 0) throw new Error('mint was not switched');
  if ((src.match(new RegExp(REAL, 'g')) || []).length !== 1) throw new Error('real mint should remain only as REAL_BLUNANA_MINT');
  fs.writeFileSync(configPath, src);
  console.log(JSON.stringify({ symbol: 'BLUTEST', mint, reserve, payments: true }));
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
