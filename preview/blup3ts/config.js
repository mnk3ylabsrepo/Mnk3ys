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

  // BLUTEST only. This wallet is the test-token mint authority. BLUTEST feeds are sent here.
  RESERVE_WALLET: '5eZ3Qt1jKCGdXkCES791W68T87bGG62j9ZHcmBaMUtTP',
  // Real $BLUNANA community wallet. The top ticker reads its balance. BLUNANA play feeds are sent here.
  BLUNANA_RESERVE_WALLET: 'B3HziYmuE9Wx42FULYZLTBRNg5WNBj6UH32Vb5kfacBN',

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
  // Adopt chooser (Azgog, Nov 3): tapping Adopt shows Orbis + Magic Eden; each opens that pet's own page in a new tab
  // (per pet: {mint}), else the collection page (COLLECTIONS[].adopt). Nothing is ever bought in the game.
  ADOPT_ITEM_URLS: { orbis: 'https://www.orbisonsol.io/marketplace/item/{mint}', me: 'https://magiceden.io/item-details/{mint}' },
  CORE_PROGRAM: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
  COLLECTIONS: [
    { id: 'mnk3ys', name: 'MNK3YS', one: 'MNK3Y', standard: 'core', address: 'HJfPjNV3AeDGRRyJfmYrQhsQaTkoct4novtBj4Nq4atU', verified: true, supply: 5000, partner: null, enabled: true,
      adopt: { orbis: 'https://www.orbisonsol.io/marketplace/mnk3ys', me: 'https://magiceden.io/marketplace/mnk3ys' } },
    { id: 'zmb3ys', name: 'ZMB3YS', one: 'ZMB3Y', standard: 'core', address: 'GtR8jyrwDvhmCi1oLG1dtErFU2xb8YpbM8Xtot8yagbq', verified: true, supply: 5555, partner: null, enabled: true,
      adopt: { orbis: 'https://www.orbisonsol.io/marketplace/zmb3ys', me: 'https://magiceden.io/marketplace/zmb3ys' } },
    { id: 'ldz', name: 'LP Dollz', one: 'LP Doll', standard: 'token-metadata', address: 'GiAuA3e7E3onswrPnMqgtErTX4oQeQuoF9Cy1Sg2fJ8b', verified: true, supply: 4443, partner: 'ldz', enabled: true,
      marketplace: 'https://www.orbisonsol.io/marketplace/lp-dollz' },
    // Caporegime Del $Empire (Nov 2 2026): Core CollectionV1 BzJea2jN..., name + 500/500 read on mainnet Nov 2 2026;
    // Magic Eden listing mints (Capo # 182, # 298, # 353) resolve to it. Magic Eden is also used for data lookups.
    { id: 'capo', name: 'Caporegime Del $Empire', one: 'Capo', standard: 'core', address: 'BzJea2jNqDByBjg99ZaopGYKngK5DnnvuYM1NtkhXmw4', verified: true, supply: 500, partner: null, enabled: true,
      marketplace: 'https://www.orbisonsol.io/marketplace/caporegime-del-empire',
      adopt: { orbis: 'https://www.orbisonsol.io/marketplace/caporegime-del-empire', me: 'https://magiceden.io/marketplace/caporegime_del_empire' } }
  ],

  // Partner communities. Money fields (poolShare, joinFee, reserveMatch) are COS numbers. Real feeds are ON (REAL_PAYMENTS_ENABLED below); partner join fees are not charged in the app.
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
  IMAGE_HOSTS: ['firebasestorage.googleapis.com', 'na-assets.pinit.io', 'we-assets.pinit.io', 'gateway.pinit.io', 'gateway.irys.xyz', '*.datasprite-cdn.com', 'arweave.net', '*.arweave.net', 'ipfs.io', 'nftstorage.link', '*.ipfs.nftstorage.link', 'cdn.helius-rpc.com'],
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
  NFT_CHECK_COLLECTIONS: ['mnk3ys', 'zmb3ys', 'capo'],
  // Wallets offered (Wallet Standard). Read-only connect, public address only.
  WALLETS: ['Phantom', 'Solflare', 'Backpack'],
  // Optional 'sign a message' proof. OFF for launch: P1 never asks the wallet to sign anything.
  SIGN_IN_ENABLED: false,

  // ON: Wallet mode feeds for real. The BLUTEST/BLUNANA switch picks the token: BLUTEST goes to RESERVE_WALLET,
  // real $BLUNANA goes to BLUNANA_RESERVE_WALLET.
  REAL_PAYMENTS_ENABLED: true,
  // PREVIEW MOCK (Nov 2 2026): SOL fee per feed. UI line only, NO SOL transfer is wired. Stays false until the real-mode checklist is done and Azgog says build it.
  SOL_FEE_ENABLED: false,
  SOL_FEE_USD_PER_FEED: 0.05,
  // Azgog, Nov 3: the feed SOL fee is for Snack, Meal and Feast only. Nibble never has a SOL fee (every pet, $BLUNANA and $EMPIRE).
  SOL_FEE_TIERS: ['snack', 'meal', 'feast'],
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
  // CAPO_WALLET_ENABLED (Azgog, Nov 3): false = Caporegime Del $Empire is Pretend-only. In Wallet mode the Capo row is locked
  // ('Coming soon'): no Capo NFT check, no Capo floor / starter pets, no $EMPIRE feeds, no Capo Store buys. Old saves fall back to the default pet.
  CAPO_WALLET_ENABLED: false,
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
      logo: 'assets/zmb3ys.png', motif: 'slime' },
    // Caporegime Del $Empire: basic Capo Drip + 4 faces from standout traits. ALL 5 are Capo pets only (app.js capoOnly) (Magic Eden / collection metadata, Nov 2 2026). Same drip
    // style as MNK3YLabs Drip, only the colours change (style.css 'CAPO FACES'). Free once a Capo reaches Level 3.
    capo: { name: 'Capo Drip', collection: 'Caporegime Del $Empire', // basic Capo face (Azgog, Nov 3), like MNK3YLabs Drip / ZMB3YS Toxic
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#ff6b6b 0,rgba(255,107,107,0) 45%),linear-gradient(150deg,#d9302c,#7a1412 48%,#1a1a1f 72%,#b82522)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(255,255,255,.08) 0 2px,transparent 2px 12px),linear-gradient(#232329,#0e0e12)',
      rim: '#ffffff', accent: '#ff4d4d', glow: 'rgba(255,77,77,.40)', crown: 'repeating-linear-gradient(#ffffff 0 3px,#1a1a1f 3px 6px)',
      logo: 'capo/capo_logo.png', motif: 'drip' },
    capo_galaxy: { name: 'Galaxy Glow', collection: 'Caporegime Del $Empire',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#b98cff 0,rgba(185,140,255,0) 45%),linear-gradient(150deg,#5b2bb5,#24104f 48%,#120830 70%,#4a22a0)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(255,255,255,.10) 0 2px,transparent 2px 12px),linear-gradient(#2a1260,#120830)',
      rim: '#9fe8ff', accent: '#ff7ad9', glow: 'rgba(159,232,255,.50)', crown: 'repeating-linear-gradient(#e3d1ff 0 3px,#6a3bd1 3px 6px)',
      logo: 'capo/capo_logo.png', motif: 'drip' },
    capo_golden: { name: 'Golden Robe', collection: 'Caporegime Del $Empire',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#fff1a8 0,rgba(255,241,168,0) 45%),linear-gradient(150deg,#f2c230,#b78512 48%,#6e4c08 70%,#e0ad22)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(255,255,255,.14) 0 2px,transparent 2px 12px),linear-gradient(#8a5f0c,#4a3205)',
      rim: '#ffe27a', accent: '#ffffff', glow: 'rgba(255,214,90,.50)', crown: 'repeating-linear-gradient(#fff1a8 0 3px,#b78512 3px 6px)',
      logo: 'capo/capo_logo.png', motif: 'drip' },
    capo_radiation: { name: 'Radiation Zone', collection: 'Caporegime Del $Empire',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#d8ff6a 0,rgba(216,255,106,0) 45%),linear-gradient(150deg,#7fbf1f,#3a6410 48%,#1c3308 70%,#6aa818)',
      bandBg: 'repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 3px,transparent 3px 9px),linear-gradient(#2d4a0d,#132205)',
      rim: '#e6ff3a', accent: '#1b1b1b', glow: 'rgba(214,255,58,.50)', crown: 'repeating-linear-gradient(#e6ff3a 0 3px,#1b1b1b 3px 6px)',
      logo: 'capo/capo_logo.png', motif: 'drip' },
    capo_night: { name: 'Empire Night', collection: 'Caporegime Del $Empire', store: true, // STORE face ($EMPIRE)
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#3a4a8a 0,rgba(58,74,138,0) 45%),linear-gradient(150deg,#1b2350,#0b0f2a 48%,#05071a 72%,#151d46)',
      bandBg: 'repeating-linear-gradient(90deg,rgba(255,214,90,.14) 0 2px,transparent 2px 10px),linear-gradient(#12183a,#070a1e)',
      rim: '#ffd65a', accent: '#9fe8ff', glow: 'rgba(255,214,90,.40)', crown: 'repeating-linear-gradient(#ffd65a 0 3px,#1b2350 3px 6px)',
      logo: 'capo/capo_logo.png', motif: 'drip' },
    capo_velvet: { name: 'Velvet Rose', collection: 'Caporegime Del $Empire', store: true, // STORE face ($EMPIRE)
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#ff8fb8 0,rgba(255,143,184,0) 45%),linear-gradient(150deg,#a3245a,#5a0f30 48%,#2e0618 72%,#8a1d4c)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(255,255,255,.08) 0 2px,transparent 2px 12px),linear-gradient(#4a0c28,#22040f)',
      rim: '#ffc2d8', accent: '#ffffff', glow: 'rgba(255,143,184,.45)', crown: 'repeating-linear-gradient(#ffc2d8 0 3px,#8a1d4c 3px 6px)',
      logo: 'capo/capo_logo.png', motif: 'drip' },
    capo_demonic: { name: 'Spooky Ember', collection: 'Caporegime Del $Empire', // Skins: Demonic, spooky-cute (Azgog, Nov 3)
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#ff9a7a 0,rgba(255,154,122,0) 45%),linear-gradient(150deg,#c8321e,#6e1410 48%,#3a0a0a 70%,#a82818)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(255,170,60,.12) 0 2px,transparent 2px 12px),linear-gradient(#5a1010,#2a0606)',
      rim: '#ff8a3d', accent: '#ffd23f', glow: 'rgba(255,110,50,.50)', crown: 'repeating-linear-gradient(#ffd23f 0 3px,#a82818 3px 6px)',
      logo: 'capo/capo_logo.png', motif: 'drip' }
  },

  // ===== Extra watch faces (faces.js WATCH faces f_*), PREVIEW =====
  // FACE_UNLOCKS_ENABLED false = no prices anywhere and the paid faces show 'Coming soon' (Christmas still follows its date).
  // FACE_PRICES: whole $BLUNANA, one-time per wallet (Pretend mode: pretend $BLUNANA). Real amounts also use COST_SCALE x LIVE_COST_SCALE.
  // FACE_FREE_FROM: free for everyone from this moment (UTC). Dec 1 2026 00:00 America/Halifax = 2026-12-01T04:00:00Z.
  // FACE_UNLOCK_ENDPOINT: empty = no server record yet. The dev adds /api/blup3ts-faces (see API_FACES.md).
  FACE_UNLOCKS_ENABLED: true,
  FACE_PRICES: { f_blunanaville: 100000, f_neon: 75000, f_haunted: 50000, f_pirate: 50000, f_glacier: 35000 }, // FINAL (Azgog via COS, Nov 3)
  FACE_FREE_FROM: { f_christmas: '2026-12-01T04:00:00Z' },
  FACE_UNLOCK_ENDPOINT: '',
  // Face SOL fee (PREVIEW, Azgog Nov 2 2026 1:37/1:38 AM AT): the same small SOL fee as feeds, 0.05 USD worth of SOL per face unlock.
  // Real $BLUNANA unlocks only (no SOL fee on BLUTEST). Its own switch.
  // ON HOLD (build Nov 2 2026): OFF until the dev's quote endpoint exists. While it is OFF, real $BLUNANA face unlocks are
  // paused too (never charged without the fee Azgog approved). BLUTEST unlocks work. Turn ON together with FACE_SOL_FEE_QUOTE_ENDPOINT.
  // The dev's server turns USD into lamports from the live SOL price and answers FACE_SOL_FEE_QUOTE_ENDPOINT (see API_FACES.md).
  // FAIL CLOSED: empty endpoint or no price = the paid unlock is blocked ('Price unavailable, try again shortly'), no tx is sent.
  // SOL_FEE_RECIPIENT: the community wallet (Azgog, Nov 2 2026 2:31 AM AT), also planned for the feed SOL fee. MIN/MAX: client sanity range in lamports.
  // Nov 3 (Azgog via COS): paid $BLUNANA face unlocks KEEP the 5-cent SOL fee. The no-SOL-fee rule covers only the new Store items.
  // Real $BLUNANA paid face unlocks stay paused until PAID_FACE_REAL_UNLOCKS_ENABLED is true (after the dev's SOL quote endpoint exists).
  PAID_FACE_REAL_UNLOCKS_ENABLED: false,
  FACE_SOL_FEE_ENABLED: false,
  SOL_FEE_USD_PER_FACE: 0.05,
  FACE_SOL_FEE_QUOTE_ENDPOINT: '',
  SOL_FEE_RECIPIENT: 'B3HziYmuE9Wx42FULYZLTBRNg5WNBj6UH32Vb5kfacBN',
  SOL_FEE_MIN_LAMPORTS: 1000,
  SOL_FEE_MAX_LAMPORTS: 5000000,

  // ===== FREE UNLOCK SOL FEE (Azgog, Nov 3): faces/items that are free today (MNK3YLabs Drip, ZMB3YS Toxic, the 5 Capo
  // faces, Christmas Morning from Dec 1, any free Store item) cost a ONE-TIME 0.10 USD worth of SOL per wallet to unlock,
  // in Wallet mode. BLUP3TS Classic stays fully free. Live SOL price from the dev's server (FREE_UNLOCK_FEE_QUOTE_ENDPOINT,
  // lamports only, never worked out in the browser); no quote = no unlock ('Price unavailable, try again shortly').
  // Paid to SOL_FEE_RECIPIENT. OFF until the server price check exists. Pretend mode: nothing is paid, faces work as before.
  FREE_UNLOCK_SOL_FEE_ENABLED: false,
  FREE_UNLOCK_SOL_FEE_USD: 0.10,
  FREE_UNLOCK_FEE_QUOTE_ENDPOINT: '',

  // ===== $EMPIRE FEEDS (Azgog via COS, Nov 3): Capo pets can also be fed with $EMPIRE. Same community wallet as $BLUNANA.
  // Meal sizes match the $BLUNANA feed value from a LIVE quote (EMPIRE_QUOTE_ENDPOINT on the dev's server, nothing
  // hardcoded here). No quote = no feed. Decimals read on-chain Nov 3 2026 (public RPC): 5. OFF by default.
  EMPIRE_FEEDS_ENABLED: false,
  EMPIRE: { mint: 'EmpirdtfUMfBQXEjnNmTngeimjfizfuSBD3TN9zqzydj', symbol: '$EMPIRE', decimals: 5, recipient: 'B3HziYmuE9Wx42FULYZLTBRNg5WNBj6UH32Vb5kfacBN', collection: 'Caporegime Del $Empire' },
  EMPIRE_QUOTE_ENDPOINT: '/api/blup3ts-empire-quote',

  // ===== STORE (Azgog via COS, Nov 3): one-time buys per connected wallet, like face unlocks. Capo items are Capo only,
  // MNK3YS / ZMB3YS items are for that collection's pets. Real buys stay OFF (STORE_REAL_BUYS_ENABLED) until the server
  // record + checks exist (HANDOFF.md). Store items have NO SOL fee. Items with price 0 use the free unlock SOL fee above.
  // FINAL prices (Azgog via COS, Nov 3): Capo faces 10,000 $EMPIRE each, Capo charms 5,000 $EMPIRE each, MNK3YS / ZMB3YS charms 50,000 $BLUNANA each.
  STORE_ENABLED: true,
  STORE_REAL_BUYS_ENABLED: false,
  STORE_ITEMS: [
    { id: 'capo_night', kind: 'face', name: 'Empire Night', collection: 'Caporegime Del $Empire', token: 'empire', price: 10000, art: 'store/capo_night.png' }, // FINAL
    { id: 'capo_velvet', kind: 'face', name: 'Velvet Rose', collection: 'Caporegime Del $Empire', token: 'empire', price: 10000, art: 'store/capo_velvet.png' }, // FINAL
    { id: 'charm_fedora', kind: 'item', name: 'Fedora', collection: 'Caporegime Del $Empire', token: 'empire', price: 5000, art: 'store/charm_fedora.png' }, // FINAL
    { id: 'charm_rose', kind: 'item', name: 'Rose', collection: 'Caporegime Del $Empire', token: 'empire', price: 5000, art: 'store/charm_rose.png' }, // FINAL
    { id: 'charm_banana', kind: 'item', name: 'Blunana Buddy', collection: 'MNK3YS', token: 'blunana', price: 50000, art: 'store/charm_banana.png' }, // FINAL
    { id: 'charm_bone', kind: 'item', name: 'Glow Bone', collection: 'ZMB3YS', token: 'blunana', price: 50000, art: 'store/charm_bone.png' } // FINAL
  ],

  // How long to wait for the RPC before showing a friendly error.
  RPC_TIMEOUT_MS: 15000,

  // Sign-in message lifetime.
  SIGN_IN_MINUTES: 10,
  MAX_PETS: 60,

  // Ranks screen. Scores come from saved pet progress on the server.
  // LB REWARDS (PREVIEW, Nov 2 2026). LB_REWARDS_ENABLED false = no reward card, no Monthly tab, no winner face anywhere.
  // First Monthly #1: November 2026, picked at the end of November Atlantic time (2026-12-01T04:00:00Z), then every month.
  // LB_AUTH_ENDPOINT: wallet proof (signMessage). Empty = off. The dev adds /api/blup3ts-auth (/nonce, /verify, /session). See API_LB_SECURITY.md.
  // LB_REWARDS_ENDPOINT: empty = no winner list yet, so the winner face stays locked for everyone. The dev adds /api/blup3ts-rewards.
  LB_REWARDS_ENABLED: false,
  // RANKS SECURITY (build Nov 2 2026, Azgog): LB_SECURE_ENABLED true = the Ranks sheet asks a connected wallet to prove it is theirs
  // (signMessage with a server nonce, never a transaction), and real feeds are sent to FEED_RECEIPT_ENDPOINT with their tx signature.
  // The server counts a feed only for a proved wallet and only after the tx is FINALIZED on chain and matches (see docs/API_LB_SECURITY.md).
  // Needs the dev's /api/blup3ts-auth (nonce, verify, session) and the new /api/blup3ts-feeds checks. Set false to go back to the old flow.
  LB_SECURE_ENABLED: false,
  FEED_RECEIPT_ENDPOINT: '/api/blup3ts-feeds',
  LB_REWARDS_FIRST_MONTH: '2026-11',
  LB_AUTH_ENDPOINT: '/api/blup3ts-auth',
  LB_REWARDS_ENDPOINT: '',
  LEADERBOARD_ENABLED: true,
  LEADERBOARD_ENDPOINT: '/api/blup3ts-leaderboard',
  LEADERBOARD_DISCORD_LOGIN_URL: '/api/discord/auth?next=/preview/blup3ts/'
});
