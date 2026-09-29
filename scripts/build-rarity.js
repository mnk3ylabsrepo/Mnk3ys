/**
 * Builds lib/<slug>-rarity.json for the Preview 2 rarity checker from on-chain metadata (Helius DAS).
 * MNK3YS ranks come from each NFT's own "Rarity Rank" attribute. Collections without one (ZMB3YS) are ranked
 * statistically: score = sum of -ln(trait frequency) across all traits, highest score = rank 1.
 * Trait % is computed across unburnt NFTs.
 *
 * Usage: node scripts/build-rarity.js <mnk3ys|zmb3ys>   (needs HELIUS_API_KEY and <SLUG>_COLLECTION_MINT in .env)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const RANK_TRAIT = /^rarity rank$/i;

(async function main() {
  const slug = (process.argv[2] || '').toLowerCase();
  const key = process.env.HELIUS_API_KEY;
  const mint = process.env[slug.toUpperCase() + '_COLLECTION_MINT'];
  if (!slug || !key || !mint) throw new Error('Usage: node scripts/build-rarity.js <slug> (needs HELIUS_API_KEY and <SLUG>_COLLECTION_MINT)');
  const out = path.join(__dirname, '..', 'lib', slug + '-rarity.json');

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
  const numberOf = (a) => {
    const m = /#(\d+)/.exec(a.content?.metadata?.name || '');
    return m ? Number(m[1]) : null;
  };
  const traitsOf = (a) => (a.content?.metadata?.attributes || []).filter((t) => !RANK_TRAIT.test(t.trait_type));

  for (const a of live) {
    const num = numberOf(a);
    if (num != null) numbers[num] = a.id;
    for (const t of a.content?.metadata?.attributes || []) {
      if (RANK_TRAIT.test(t.trait_type)) {
        if (/^\d+$/.test(String(t.value))) ranks[t.value] = a.id;
        else if (String(t.value) === '1/1') oneOfOnes.push(a.id);
      }
    }
    for (const t of traitsOf(a)) {
      const byValue = (counts[t.trait_type] = counts[t.trait_type] || {});
      byValue[t.value] = (byValue[t.value] || 0) + 1;
    }
  }

  const onChainRanks = Object.keys(ranks).length > 0;
  if (!onChainRanks) {
    const scored = live.map((a) => ({
      id: a.id,
      num: numberOf(a) ?? Infinity,
      score: traitsOf(a).reduce((s, t) => s - Math.log(counts[t.trait_type][t.value] / live.length), 0),
    }));
    scored.sort((x, y) => y.score - x.score || x.num - y.num);
    scored.forEach((s, i) => { ranks[i + 1] = s.id; });
  }

  const traitPct = {};
  for (const [type, byValue] of Object.entries(counts)) {
    traitPct[type] = {};
    for (const [value, n] of Object.entries(byValue)) traitPct[type][value] = Math.round((n / live.length) * 10000) / 100;
  }

  const nums = Object.keys(numbers).map(Number);
  const data = {
    builtAt: new Date().toISOString(),
    rankSource: onChainRanks ? 'on-chain' : 'statistical',
    supply: live.length,
    maxRank: Math.max(...Object.keys(ranks).map(Number)),
    numberRange: nums.length ? [Math.min(...nums), Math.max(...nums)] : null,
    ranks,
    numbers,
    oneOfOnes,
    traitPct,
  };
  fs.writeFileSync(out, JSON.stringify(data));
  console.log('Wrote', out, '—', data.rankSource, 'ranks;', Object.keys(ranks).length, 'ranked,', nums.length, 'numbered', JSON.stringify(data.numberRange) + ',', oneOfOnes.length, '1/1s,', live.length, 'live');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
