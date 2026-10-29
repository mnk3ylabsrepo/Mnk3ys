// BLUP3TS launch config (mnk3ylabs.com). One codebase, config driven. Edit here, then re-run the checks.
// Public values only. Never put a private key, seed phrase or API secret in this file: it is public.
// The RPC / Helius key lives ONLY in the Netlify env (HELIUS_API_KEY or RPC_URL) and is used by
// netlify/functions/nft-check.js, so it never reaches the browser.
// Money numbers (costs, caps, guard, scales, partner shares and fees) are owned by Grok Bot COS. Do not
// change them here without COS sign-off.
window.BLUP3TS_CONFIG = (function deepFreeze(o) { Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); }); return Object.freeze(o); })({
  // NFT ownership check endpoint (read-only). null = no server yet: the app shows 'NFT check coming soon' and
  // players use the starter pets. Static hosting (mnk3ylabs.com/play/) ships null. The Netlify staging deploy sets it
  // to its own function (netlify/functions/nft-check.js) at deploy time. If you point it at another server, add that
  // server to connect-src in the CSP (index.html meta, _headers, .htaccess). NEVER put an API key in this URL.
  NFT_CHECK_ENDPOINT: '/api/blup3ts-nfts',
  // NEXT BATCH: pet row flags. LP Dollz code and data stay in place; true brings them back.
  LPDOLLZ_ENABLED: false,
  LEGENDARY_STARTER_ENABLED: false, // MNK3Y #4182 (rank 16) starter, kept for later
  // Starter pets with no wallet: one random 'floor' MNK3Y + one random 'floor' ZMB3Y. The list comes from
  // netlify/functions/floor-pets.js (server-side, cached, sends only mint + name). Static hosting or no answer = bundled common pets.
  FLOOR_STARTERS: true,
  FLOOR_ENDPOINT: '/api/blup3ts-floor',
  // Same-origin proxy. The Helius key stays on the server. Absolute, because the Solana client rejects a relative URL.
  RPC_URL: (typeof location === 'undefined' ? 'https://www.mnk3ylabs.com' : location.origin) + '/api/blup3ts-rpc',
  // Preview live play uses this test token, never the real $BLUNANA mint below, once TEST_PLAY is on.
  TEST_PLAY: true,
  TEST_TOKEN_SYMBOL: 'BLUTEST',
  TEST_TOKEN_NAME: 'BLUP3TS Test',

  // 'mainnet-readonly' = look up pets only. Real feeding needs BOTH a reserve wallet below AND this
  // set to exactly 'mainnet-live'.
  NETWORK: 'mainnet-live',

  // Preview test reserve. Live feeds of BLUTEST are sent here. Not the real $BLUNANA reserve.
  RESERVE_WALLET: '5eZ3Qt1jKCGdXkCES791W68T87bGG62j9ZHcmBaMUtTP',

  // $BLUNANA (pinned). Classic SPL token, 6 decimals. REAL_BLUNANA_MINT stays the community token.
  // BLUNANA_MINT is what a live feed sends. While TEST_PLAY is on, that is the preview test token, not $BLUNANA.
  REAL_BLUNANA_MINT: 'C9vfeaCLhJy7sykgKnfzi6RikawQNoGtRKwsaupKavmV',
  BLUNANA_MINT: '2arvp34u8Fzcq6UBRqq5dmWuMncwJ9pggMKUwZbRoGPv',
  BLUNANA_DECIMALS: 6,

  // Playable NFT collections. standard: 'core' (Metaplex Core: membership = update authority Collection(addr))
  // or 'token-metadata' (classic NFT: metadata collection must be set AND verified).
  // verified: true only when checked on-chain; anything UNCONFIRMED stays null and is skipped.
  //  - MNK3YS / ZMB3YS: Core CollectionV1 accounts, sample mints from Magic Eden listings resolve to them
  //    (Shared/Core/CollectionGate.swift, re-read on mainnet Oct 22 2026).
  //  - LP Dollz: 4 Magic Eden 'lp_doll' listings (LP Doll #3946, #2983, #1324, #1200) all carry a VERIFIED
  //    Token Metadata collection GiAuA3e7...; that collection NFT is named 'LP Dollz'. Checked Oct 22 2026.
  CORE_PROGRAM: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
  COLLECTIONS: [
    { id: 'mnk3ys', name: 'MNK3YS', one: 'MNK3Y', standard: 'core', address: 'HJfPjNV3AeDGRRyJfmYrQhsQaTkoct4novtBj4Nq4atU', verified: true, supply: 5000, partner: null, enabled: true },
    { id: 'zmb3ys', name: 'ZMB3YS', one: 'ZMB3Y', standard: 'core', address: 'GtR8jyrwDvhmCi1oLG1dtErFU2xb8YpbM8Xtot8yagbq', verified: true, supply: 5555, partner: null, enabled: true },
    { id: 'ldz', name: 'LP Dollz', one: 'LP Doll', standard: 'token-metadata', address: 'GiAuA3e7E3onswrPnMqgtErTX4oQeQuoF9Cy1Sg2fJ8b', verified: true, supply: 4443, partner: 'ldz', enabled: true,
      marketplace: 'https://www.orbisonsol.io/marketplace/lp-dollz' }
  ],

  // Partner communities. Money fields (poolShare, joinFee, reserveMatch) are COS numbers; real payments are OFF.
  // joinFee is a CAD-equivalent amount. tokenMint / pool are public on-chain addresses.
  //  - LDZ token mint E5ZV... read from the Raydium CPMM pool account 5agA... (token_1 next to $BLUNANA),
  //    DexScreener lists it as symbol LDZ. Checked Oct 22 2026.
  //  - GOTM mint AAqZ6C... (Meteora pool 4wDb..., token_a) and Empire mint Empird... (Meteora DAMM v2 HQJb...)
  //    read the same way. Their NFT collections are not set (null) because they are disabled.
  PARTNERS: [
    { id: 'ldz', name: 'LP Dollz', collection: 'GiAuA3e7E3onswrPnMqgtErTX4oQeQuoF9Cy1Sg2fJ8b', tokenMint: 'E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK', tokenSymbol: 'LDZ', tokenDecimals: 9,
      pool: '5agAmsULnt4eeiKNjxQgAJyGYNbzkwoTaFWCFvtt5vN5', poolDex: 'Raydium CPMM', poolPair: 'BLUNANA/LDZ', supply: 4443,
      poolShare: 0.20, reserveMatch: true, joinFee: 0, tier: 'founding', enabled: true, note: 'Founding partner. Pool share matched by the reserve.' },
    { id: 'gotm', name: 'GOTM', collection: null, tokenMint: 'AAqZ6CECabwnYLm3FDqPrVQotXLPGQ3BJSfecYmXeJU5', tokenSymbol: 'GOTM', tokenDecimals: 9,
      pool: '4wDbtd1R9jzxpNR5o7S4RPdJpUeP4Wd21jxYPtwskLsb', poolDex: 'Meteora', poolPair: 'BLUNANA/GOTM', supply: null,
      poolShare: 0.10, reserveMatch: false, joinFee: 250, tier: 'standard', enabled: false, note: 'must reseed shared pool' },
    { id: 'empire', name: 'Empire', collection: null, tokenMint: 'EmpirdtfUMfBQXEjnNmTngeimjfizfuSBD3TN9zqzydj', tokenSymbol: 'Empire', tokenDecimals: 5,
      pool: 'HQJbeVTrRaXNYZYsd1yWnqudoXz1ULeMPPdTALUi37V3', poolDex: 'Meteora DAMM v2', poolPair: 'BLUNANA/Empire', supply: null,
      poolShare: 0.10, reserveMatch: false, joinFee: 250, tier: 'standard', enabled: false, note: 'must reseed shared pool' }
  ],

  // Where NFT pictures and metadata may come from (https only). Also written into the CSP by the build.
  IMAGE_HOSTS: ['firebasestorage.googleapis.com', 'na-assets.pinit.io', 'gateway.pinit.io', 'gateway.irys.xyz', '*.datasprite-cdn.com', 'arweave.net', '*.arweave.net', 'ipfs.io', 'nftstorage.link', '*.ipfs.nftstorage.link', 'cdn.helius-rpc.com'],
  METADATA_HOSTS: ['firebasestorage.googleapis.com', 'gateway.pinit.io', 'gateway.irys.xyz', '*.datasprite-cdn.com', 'arweave.net', '*.arweave.net', 'ipfs.io', 'nftstorage.link'],

  // $BLUNANA per feed. Same numbers in Pretend and Wallet mode. The transfer builder has these pinned too
  // and refuses to build if this table and its own copy disagree.
  FEED_COSTS: { nibble: 100, snack: 250, meal: 1000, feast: 2500 },

  // One knob for every $BLUNANA amount (feeds now, Store costs later): each amount x COST_SCALE, rounded to whole
  // tokens, at least 1. Must be a positive finite number, otherwise 1 is used.
  COST_SCALE: 1,

  // Extra knob for REAL Wallet-mode amounts only (real feeds, Store later), on top of COST_SCALE.
  // Pretend mode ignores it. Same rules: positive finite number, else 1; whole tokens, at least 1.
  LIVE_COST_SCALE: 1,

  // Level curve: total strength needed to reach Level 2, 3, ... 10. After Level 10, each level needs +2,000 more.
  // Strength only comes from feeding. Saved pets just recompute their level from strength.
  LEVEL_STRENGTH: [50, 150, 350, 700, 1000, 1500, 2300, 3500, 5000],
  LEVEL_STEP_AFTER: 2000,

  // Instruments unlock by level (free, never sold). Pets already past a level get it right away.
  INSTRUMENT_LEVELS: { bass: 2, guitar: 3, drumsticks: 4, mic: 5, keytar: 6 },

  // Jam length. From LONG_JAM_LEVEL the player may pick a Long Jam (optional): about 1.5x mood and 1.5x hunger
  // cost, needs 1.5x the usual food to start. Jam never adds strength.
  JAM_SECONDS: 8,
  LONG_JAM_SECONDS: 16,
  LONG_JAM_LEVEL: 6,
  // Jam beat play: taps on the pet picture are judged against the beat of the jam track.
  // BPM/OFFSET_MS describe audio/jam_loop.mp3 (120 BPM, 16 beats). Windows are +/- ms from the beat.
  // LATENCY_MS: taps are judged this much earlier when the music plays (phone audio delay);
  // VISUAL_LATENCY_MS when sound is off (screen delay). Mood: Perfect/Good add points, Miss none;
  // the points are capped at TAP_BONUS_MAX (same cap as before), so a jam never gives more mood than before.
  JAM_BEAT: { BPM: 120, OFFSET_MS: 10, PERFECT_MS: 80, GOOD_MS: 160, LATENCY_MS: 70, VISUAL_LATENCY_MS: 30, PERFECT_PTS: 2, GOOD_PTS: 1, TAP_BONUS_MAX: 12 },

  // Game boost from burning one cNFT of a pinned collection. OFF until both are set (see README_WEB.md).
  BURN_BOOST_ENABLED: false,
  BLUNANA_CNFT_COLLECTION: null,

  // Wallet connect master switch (read-only: public address + NFT check only). false = Pretend mode only.
  WALLET_CONNECT_ENABLED: true,
  // M10 go-live: the NFT check gives back ONLY these collections (LP Dollz left out for now; the LP Doll starter pet stays).
  NFT_CHECK_COLLECTIONS: ['mnk3ys', 'zmb3ys'],
  // Wallets offered (Wallet Standard). Read-only connect, public address only.
  WALLETS: ['Phantom', 'Solflare', 'Backpack'],
  // Optional 'sign a message' proof. OFF for launch: P1 never asks the wallet to sign anything.
  SIGN_IN_ENABLED: false,

  // Preview only: on so Wallet mode can feed with the BLUTEST test token. This does not spend real $BLUNANA.
  REAL_PAYMENTS_ENABLED: true,
  // Daily limits per wallet: total $BLUNANA (and $BLUNANA-equivalent) across feeds + Store, and feeds per day.
  DAILY_CAP: 25000,
  DAILY_FEEDS_MAX: 10,
  // Partner-token feeds count toward DAILY_CAP at their $BLUNANA-equivalent amount, read from that partner's pool at feed time.
  PARTNER_FEEDS_COUNT_AT_POOL_VALUE: true,
  // Cost guard: pause real costs if the cheapest path to Level 10 costs more than this many CAD.
  PRICE_GUARD: { enabled: true, maxLevel10Cad: 10, level: 10 },

  // ===== Rarity (P2 prep). Tiers by percent of each collection's size (number of NFTs), best first. =====
  // While RARITY_PERKS_ENABLED is false, perks change nothing. Feed costs are the same for everyone.
  RARITY_PERKS_ENABLED: false,
  // Hunger: how much food (%) every pet loses per hour. Rarer pets can get hungry a bit slower (hungerDecayReduction
  // below, clamped to 0..0.25), only when RARITY_PERKS_ENABLED is true. With the flag off it is exactly this for every pet.
  BASE_HUNGER_DECAY_PER_HOUR: 4,
  RARITY_TIERS: [
    { id: 'legendary', name: 'Legendary', topPct: 1, strBonus: 0.15, storeDiscount: 0.15, hungerDecayReduction: 0.15 },
    { id: 'rare', name: 'Rare', topPct: 5, strBonus: 0.10, storeDiscount: 0.10, hungerDecayReduction: 0.10 },
    { id: 'uncommon', name: 'Uncommon', topPct: 20, strBonus: 0.05, storeDiscount: 0.05, hungerDecayReduction: 0.05 },
    { id: 'common', name: 'Common', topPct: 100, strBonus: 0, storeDiscount: 0, hungerDecayReduction: 0 }
  ],

  // 'Show original traits' (18+, off by default). Web only, own connected NFTs only, never starter pets.
  ORIGINAL_TRAITS_SETTING: true,

  // ===== Watch cases (cosmetic only, free, never sold). ONE map: add an entry here to onboard a new project. =====
  // A project case unlocks for that collection once ANY of the player's pets from it reaches CASE_UNLOCK_LEVEL.
  // Before that the pet wears the default case. Pets whose collection has no case (e.g. LP Dollz) use the default.
  // Fields: name, collection (null = default), caseBg / bandBg (CSS gradients), rim + accent + glow (colours),
  // crown (CSS gradient), logo (local image or null), motif (a style in style.css + index.html: null | 'drip' | 'slime').
  CASE_UNLOCK_LEVEL: 3,
  DEFAULT_WATCH_CASE: 'default',
  WATCH_CASES: {
    default: { name: 'BLUP3TS Classic', collection: null,
      caseBg: 'linear-gradient(145deg,#4a4f5c,#15171d 55%,#2c3038)', bandBg: 'linear-gradient(#1a1f2a,#0c0f16)',
      rim: '#5c6170', accent: '#48D8FC', glow: 'rgba(0,0,0,0)', crown: 'repeating-linear-gradient(#80838d 0 3px,#3a3d46 3px 6px)', logo: null, motif: null },
    mnk3ys: { name: 'MNK3YLabs Drip', collection: 'MNK3YS',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#3d8fe0 0,rgba(61,143,224,0) 45%),linear-gradient(150deg,#1d5aa8,#0b2249 48%,#06142e 70%,#15407e)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(72,216,252,.10) 0 2px,transparent 2px 12px),linear-gradient(#0d2a55,#061533)',
      rim: '#48D8FC', accent: '#F2C94C', glow: 'rgba(72,216,252,.45)', crown: 'repeating-linear-gradient(#ffe08a 0 3px,#b8860b 3px 6px)',
      logo: 'assets/mnk3ylabs_logo.png', motif: 'drip' },
    zmb3ys: { name: 'ZMB3YS Toxic', collection: 'ZMB3YS',
      caseBg: 'radial-gradient(40% 30% at 18% 22%,rgba(124,255,58,.16) 0,transparent 70%),radial-gradient(35% 25% at 82% 78%,rgba(124,255,58,.12) 0,transparent 70%),linear-gradient(150deg,#2b3a22,#11180d 50%,#0a0f08 70%,#25331b)',
      bandBg: 'repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 3px,transparent 3px 9px),linear-gradient(#1f2b17,#0d140a)',
      rim: '#7CFF3A', accent: '#B6FF5C', glow: 'rgba(124,255,58,.40)', crown: 'repeating-linear-gradient(#b6ff5c 0 3px,#2f6b12 3px 6px)',
      logo: 'assets/zmb3ys.png', motif: 'slime' }
  },

  // How long to wait for the RPC before showing a friendly error.
  RPC_TIMEOUT_MS: 15000,

  // Sign-in message lifetime.
  SIGN_IN_MINUTES: 10,
  MAX_PETS: 60
});
