#!/usr/bin/env node
/**
 * Debug Blunanas: log raw Magic Eden and Helius responses so we can fix parsing.
 * Run: node scripts/debug-blunanas.js   (optional: from project root with .env)
 */
require('dotenv').config();
const axios = require('axios');

const ME_BASE = 'https://api-mainnet.magiceden.dev/v2';
const HELIUS_RPC = 'https://mainnet.helius-rpc.com';
const API_KEY = process.env.HELIUS_API_KEY;
const MINT = process.env.BLUNANANAS_COLLECTION_MINT || '9KRbzF8b4T9c3TVxpkfajgcJTxmoXaPCtJDv4Pp9wtwX';

async function main() {
  console.log('=== ME GET /collections/blunanas ===');
  try {
    const meta = await axios.get(`${ME_BASE}/collections/blunanas`, { timeout: 10000, validateStatus: () => true });
    console.log('Status:', meta.status);
    console.log(JSON.stringify(meta.data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\n=== ME GET /collections/blunanas/stats ===');
  try {
    const stats = await axios.get(`${ME_BASE}/collections/blunanas/stats`, { timeout: 8000, validateStatus: () => true });
    console.log('Status:', stats.status);
    console.log(JSON.stringify(stats.data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\n=== ME GET /collections/blunanas/holder_stats ===');
  try {
    const holderStats = await axios.get(`${ME_BASE}/collections/blunanas/holder_stats`, { timeout: 10000, validateStatus: () => true });
    console.log('Status:', holderStats.status);
    console.log(JSON.stringify(holderStats.data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  if (API_KEY) {
    console.log('\n=== Helius getAssetsByGroup(collection, ' + MINT + ') page 1 ===');
    try {
      const helius = await axios.post(
        `${HELIUS_RPC}/?api-key=${API_KEY}`,
        {
          jsonrpc: '2.0',
          id: '1',
          method: 'getAssetsByGroup',
          params: {
            groupKey: 'collection',
            groupValue: MINT,
            page: 1,
            limit: 5,
            options: { showUnverifiedCollections: true, showCollectionMetadata: true },
          },
        },
        { timeout: 15000, validateStatus: () => true }
      );
      console.log('Result keys:', helius.data?.result ? Object.keys(helius.data.result) : 'no result');
      console.log('Items length:', helius.data?.result?.items?.length ?? 0);
      if (helius.data?.result?.items?.length) {
        console.log('First item keys:', Object.keys(helius.data.result.items[0]));
        console.log('First item (truncated):', JSON.stringify(helius.data.result.items[0], null, 2).slice(0, 1500));
      } else {
        console.log(JSON.stringify(helius.data, null, 2).slice(0, 2000));
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  } else {
    console.log('\n(Set HELIUS_API_KEY in .env to test Helius)');
  }
}

main();
