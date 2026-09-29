/**
 * Builds lib/mnk3ys-rarity.json for the Preview 2 rarity checker from on-chain metadata (Helius DAS).
 * Ranks come from each NFT's own "Rarity Rank" attribute; trait % is computed across unburnt NFTs.
 *
 * Usage: node scripts/build-mnk3ys-rarity.js   (needs HELIUS_API_KEY and MNK3YS_COLLECTION_MINT in .env)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUT = path.join(__dirname, '..', 'lib', 'mnk3ys-rarity.json');
const RANK_TRAIT = /^rarity rank$/i;

(async function main() {
  const key = process.env.HELIUS_API_KEY;
  const mint = process.env.MNK3YS_COLLECTION_MINT;
  if (!key || !mint) throw new Error('HELIUS_API_KEY and MNK3YS_COLLECTION_MINT are required');

  const assets = [];
  for (let page = 1; page <= 10; page++) {
    const r = await axios.post(
      'https://mainnet.helius-rpc.com/?api-key=' + key,
      { jsonrpc: '2.0', id: '1', method: 'getAssetsByGroup', params: { groupKey: 'collection', groupValue: mint, page, limit: 1000 } },
      { timeout: 60000 }
    );
    const items = r.data?.result?.items || [];
    assets.push(...items);
    if (items.length < 1000) break;
  }

  const live = assets.filter((a) => !a.burnt);
  const ranks = {};
  const numbers = {};
  const oneOfOnes = [];
  const counts = {};
  for (const a of live) {
    const num = /#(\d+)/.exec(a.content?.metadata?.name || '');
    if (num) numbers[num[1]] = a.id;
    for (const t of a.content?.metadata?.attributes || []) {
      if (RANK_TRAIT.test(t.trait_type)) {
        if (/^\d+$/.test(String(t.value))) ranks[t.value] = a.id;
        else if (String(t.value) === '1/1') oneOfOnes.push(a.id);
        continue;
      }
      const byValue = (counts[t.trait_type] = counts[t.trait_type] || {});
      byValue[t.value] = (byValue[t.value] || 0) + 1;
    }
  }
  const traitPct = {};
  for (const [type, byValue] of Object.entries(counts)) {
    traitPct[type] = {};
    for (const [value, n] of Object.entries(byValue)) traitPct[type][value] = Math.round((n / live.length) * 10000) / 100;
  }

  const out = { builtAt: new Date().toISOString(), supply: live.length, ranks, numbers, oneOfOnes, traitPct };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('Wrote', OUT, '—', Object.keys(ranks).length, 'ranked,', Object.keys(numbers).length, 'numbered,', oneOfOnes.length, '1/1s,', live.length, 'live');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
