/**
 * Pairs game: buy (verify SPL transfer + credit turns) and collect (treasury sends prize to user).
 * Uses PAIRS_TREASURY_SECRET_KEY for testing; no SOL fee during testing.
 */
const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, createAssociatedTokenAccountIdempotentInstruction, getAccount } = require('@solana/spl-token');
const bs58 = require('bs58');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

function getPairsConfig(env) {
  const costBlunana = parseInt(env.PAIRS_COST_BLUNANA || '100000', 10);
  const turnsPerBuy = parseInt(env.PAIRS_TURNS_PER_BUY || '5', 10);
  const blunanaMint = env.BLUNANA_TOKEN_MINT || env.TOKEN_MINT || 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS';
  const decimals = parseInt(env.BLUNANA_DECIMALS || '6', 10);
  let treasuryPubkey = null;
  let treasuryKeypair = null;
  if (env.PAIRS_TREASURY_SECRET_KEY) {
    try {
      const secret = bs58.decode(env.PAIRS_TREASURY_SECRET_KEY);
      treasuryKeypair = Keypair.fromSecretKey(secret);
      treasuryPubkey = treasuryKeypair.publicKey.toBase58();
    } catch (e) {
      console.warn('PAIRS_TREASURY_SECRET_KEY invalid:', e.message);
    }
  }
  if (!treasuryPubkey && env.PAIRS_TREASURY_WALLET) treasuryPubkey = env.PAIRS_TREASURY_WALLET;
  return { costBlunana, turnsPerBuy, blunanaMint, decimals, treasuryPubkey, treasuryKeypair };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify that the transaction is a valid SPL token transfer to treasury for the expected amount.
 * Tries getParsedTransaction with 'confirmed' first, then getTransaction as fallback.
 */
async function verifyBuyTransaction(connection, signature, treasuryPubkey, expectedAmountRaw, mintPubkey) {
  const sig = typeof signature === 'string' ? signature.trim() : String(signature || '').trim();
  if (!sig) return { ok: false, error: 'Invalid signature' };
  const treasury = new PublicKey(treasuryPubkey);
  const mint = new PublicKey(mintPubkey);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);
  const opts = { commitment: 'confirmed', maxSupportedTransactionVersion: 0 };
  let tx = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    tx = await connection.getParsedTransaction(sig, opts);
    if (tx) break;
    const raw = await connection.getTransaction(sig, opts);
    if (raw && raw.meta && !raw.meta.err && raw.transaction && raw.transaction.message) {
      const found = parseRawTxForTransfer(raw, treasuryAta, mint, BigInt(expectedAmountRaw));
      if (found) return { ok: true };
    }
    await sleep(attempt < 11 ? 1500 : 0);
  }
  if (!tx || !tx.meta || tx.meta.err) return { ok: false, error: 'Transaction failed or not found' };
  const instructions = tx.transaction?.message?.instructions || [];
  const inner = tx.meta?.innerInstructions || [];
  const allIxs = [...instructions, ...inner.flatMap((ii) => ii.instructions)];
  const tokenProgramStr = TOKEN_PROGRAM_ID.toBase58();
  for (const ix of allIxs) {
    const progId = ix.programId && ix.programId.toBase58 ? ix.programId.toBase58() : String(ix.programId);
    if (progId !== tokenProgramStr) continue;
    const parsed = ix.parsed;
    if (!parsed || (parsed.type !== 'transfer' && parsed.type !== 'transferChecked')) continue;
    const info = parsed.info;
    if (!info) continue;
    const dest = info.destination;
    const amount = info.amount || info.tokenAmount?.amount;
    const mintStr = info.mint;
    if (!dest || amount === undefined) continue;
    const destPubkey = typeof dest === 'string' ? new PublicKey(dest) : dest;
    if (!destPubkey.equals(treasuryAta)) continue;
    if (mintStr && new PublicKey(mintStr).toBase58() !== mint.toBase58()) continue;
    const amountNum = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
    if (amountNum >= BigInt(expectedAmountRaw)) return { ok: true };
  }
  return { ok: false, error: 'No valid transfer to treasury found' };
}

function parseRawTxForTransfer(rawTx, treasuryAta, mint, expectedAmountRaw) {
  const message = rawTx.transaction.message;
  const accountKeys = message.accountKeys || [];
  const getKey = (i) => {
    const k = accountKeys[i];
    return k ? (typeof k === 'string' ? new PublicKey(k) : k.pubkey ? new PublicKey(k.pubkey) : null) : null;
  };
  const instructions = message.instructions || [];
  const inner = (rawTx.meta && rawTx.meta.innerInstructions) ? rawTx.meta.innerInstructions : [];
  const allIxs = [...instructions, ...inner.flatMap((ii) => ii.instructions || [])];
  const tokenProgramId = TOKEN_PROGRAM_ID.toBase58();
  for (const ix of allIxs) {
    const programId = getKey(ix.programIdIndex);
    if (!programId || programId.toBase58() !== tokenProgramId) continue;
    const data = ix.data;
    if (!data || typeof data !== 'string') continue;
    const buf = Buffer.from(data, 'base64');
    if (buf.length < 1) continue;
    const instructionType = buf[0];
    if (instructionType !== 3 && instructionType !== 12) continue;
    const destIndex = ix.accounts && ix.accounts[1] != null ? ix.accounts[1] : 1;
    const destKey = getKey(destIndex);
    if (!destKey || !destKey.equals(treasuryAta)) continue;
    let amount = BigInt(0);
    if (buf.length >= 9) amount = buf.readBigUInt64LE(1);
    if (amount >= expectedAmountRaw) return true;
  }
  return false;
}

/**
 * Build and send collect: SPL token prize (BLUNANA) from treasury to user.
 */
async function sendTokenPrize(connection, treasuryKeypair, userWalletPubkey, amountRaw, mintPubkey) {
  const mint = new PublicKey(mintPubkey);
  const sourceAta = await getAssociatedTokenAddress(mint, treasuryKeypair.publicKey);
  const destAta = await getAssociatedTokenAddress(mint, userWalletPubkey);
  const sourceAccount = await getAccount(connection, sourceAta).catch(() => null);
  if (!sourceAccount || sourceAccount.amount < amountRaw) {
    throw new Error('Treasury has insufficient balance to send this prize. Need ' + amountRaw.toString() + ' raw, have ' + (sourceAccount ? sourceAccount.amount.toString() : '0') + '.');
  }
  console.log('[pairs] Collect: sending to', userWalletPubkey.toBase58(), 'amountRaw', amountRaw.toString(), 'destAta', destAta.toBase58());
  const tx = new Transaction();
  tx.add(createAssociatedTokenAccountIdempotentInstruction(
    treasuryKeypair.publicKey,
    destAta,
    userWalletPubkey,
    mint
  ));
  tx.add(createTransferInstruction(sourceAta, destAta, treasuryKeypair.publicKey, amountRaw));
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = treasuryKeypair.publicKey;
  tx.sign(treasuryKeypair);
  const wire = tx.serialize();
  const sig = await connection.sendRawTransaction(wire, { skipPreflight: true, preflightCommitment: 'confirmed' });
  console.log('[pairs] Collect: tx sent', sig);
  const confirmResult = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  if (confirmResult && confirmResult.value && confirmResult.value.err) {
    throw new Error('Transaction failed on-chain: ' + JSON.stringify(confirmResult.value.err));
  }
  const opts = { commitment: 'confirmed', maxSupportedTransactionVersion: 0 };
  let txResult = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    txResult = await connection.getTransaction(sig, opts);
    if (txResult) break;
    await sleep(attempt < 7 ? 800 : 0);
  }
  if (!txResult) {
    throw new Error('Transaction could not be verified (getTransaction returned null). Signature: ' + sig);
  }
  if (txResult.meta && txResult.meta.err) {
    throw new Error('Transaction failed on-chain: ' + JSON.stringify(txResult.meta.err));
  }
  console.log('[pairs] Collect: verified ok', sig);
  return sig;
}

/**
 * Parse prizeId to amount (raw) for token prizes, or null for NFT.
 */
function parsePrizeId(prizeId) {
  const s = String(prizeId || '').trim().toLowerCase();
  const tokenMatch = s.match(/(\d+)k/);
  if (tokenMatch) return parseInt(tokenMatch[1], 10) * 1000; // e.g. 100k or "100k $BLUNANA" -> 100000
  return null;
}

/**
 * Fetch treasury's NFT mint addresses that belong to the given collection (Helius DAS getAssetsByOwner).
 * Returns array of mint addresses (asset.id). Excludes compressed NFTs that need different transfer flow.
 */
async function getTreasuryNftsByCollection(rpcUrlWithKey, treasuryPubkey, collectionMint) {
  const collection = String(collectionMint).trim();
  if (!collection || !treasuryPubkey) return [];
  const body = {
    jsonrpc: '2.0',
    id: 'pairs-nft-1',
    method: 'getAssetsByOwner',
    params: {
      ownerAddress: treasuryPubkey,
      limit: 100,
      page: 1,
      options: { showFungible: false, showNativeBalance: false }
    }
  };
  const res = await fetch(rpcUrlWithKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => null);
  const items = data?.result?.items || [];
  const mints = [];
  for (const asset of items) {
    if (asset.compression?.compressed) continue;
    const grouping = asset.grouping || [];
    const inCollection = grouping.some(
      (g) => g.group_key === 'collection' && String(g.group_value).toLowerCase() === collection.toLowerCase()
    );
    if (inCollection && asset.id) mints.push(asset.id);
  }
  return mints;
}

function registerPairsRoutes(app, opts) {
  const express = opts.express || require('express');
  const {
    db,
    HELIUS_API_KEY,
    HELIUS_RPC,
    getPairsState,
    savePairsState,
  } = opts;
  const config = getPairsConfig(opts.env || process.env);
  if (!config.treasuryPubkey) console.warn('Pairs: PAIRS_TREASURY_SECRET_KEY or PAIRS_TREASURY_WALLET not set. Buy/collect will fail.');

  const connection = HELIUS_API_KEY ? new Connection(HELIUS_RPC + '/?api-key=' + HELIUS_API_KEY) : null;

  app.get('/api/pairs/config', function (req, res) {
    res.json({
      treasuryWallet: config.treasuryPubkey || null,
      costBlunana: config.costBlunana,
      turnsPerBuy: config.turnsPerBuy,
      blunanaMint: config.blunanaMint,
      decimals: config.decimals,
      solFeeLamports: parseInt(process.env.PAIRS_SOL_FEE_LAMPORTS || '0', 10),
    });
  });

  app.post('/api/pairs/create-buy-tx', express.json(), async function (req, res) {
    const { wallet } = req.body || {};
    if (!wallet || !connection || !config.treasuryPubkey) {
      return res.status(400).json({ error: 'wallet required and pairs treasury must be configured' });
    }
    try {
      const userPubkey = new PublicKey(wallet);
      const mint = new PublicKey(config.blunanaMint);
      const treasuryPubkey = new PublicKey(config.treasuryPubkey);
      const userAta = await getAssociatedTokenAddress(mint, userPubkey);
      const treasuryAta = await getAssociatedTokenAddress(mint, treasuryPubkey);
      const amountRaw = BigInt(config.costBlunana * Math.pow(10, config.decimals));
      const tx = new Transaction();
      const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
      if (!treasuryAtaInfo) {
        tx.add(createAssociatedTokenAccountInstruction(userPubkey, treasuryAta, treasuryPubkey, mint));
      }
      tx.add(createTransferInstruction(userAta, treasuryAta, userPubkey, amountRaw));
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = userPubkey;
      const serialized = tx.serialize({ requireAllSignatures: false });
      res.json({ transaction: serialized.toString('base64') });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed to create transaction' });
    }
  });

  app.post('/api/pairs/buy', express.json(), async function (req, res) {
    const wallet = (req.body && req.body.wallet && String(req.body.wallet).trim()) || '';
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const { signature, signedTransaction } = req.body || {};
    if (!signature && !signedTransaction) return res.status(400).json({ error: 'signature or signedTransaction required' });
    if (!config.treasuryPubkey || !connection) return res.status(503).json({ error: 'Pairs treasury not configured' });
    if (!db || !db.getPairsStateByWallet || !db.savePairsStateByWallet) return res.status(503).json({ error: 'Database not configured' });
    let sig = typeof signature === 'string' ? signature.trim() : (signature && (signature.signature || signature.transactionSignature || signature.toString)) ? String(signature.signature || signature.transactionSignature || signature.toString()).trim() : null;
    if (signedTransaction) {
      try {
        const txBuf = Buffer.from(signedTransaction, 'base64');
        const tx = Transaction.from(txBuf);
        sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
      } catch (e) {
        return res.status(400).json({ error: 'Invalid or failed transaction: ' + (e.message || 'unknown') });
      }
    }
    if (!sig || typeof sig !== 'string') return res.status(400).json({ error: 'Invalid signature' });
    console.log('[pairs] Verifying buy tx:', sig.slice(0, 16) + '...');
    const expectedAmountRaw = config.costBlunana * Math.pow(10, config.decimals);
    const verification = await verifyBuyTransaction(
      connection,
      sig,
      config.treasuryPubkey,
      expectedAmountRaw,
      config.blunanaMint
    );
    if (!verification.ok) return res.status(400).json({ error: verification.error || 'Invalid payment' });
    try {
      let state = await db.getPairsStateByWallet(wallet);
      if (!state) state = { turnsRemaining: 0, deck: [], flipped: [], matched: {}, prizesWon: [] };
      state.turnsRemaining = (state.turnsRemaining || 0) + config.turnsPerBuy;
      await db.savePairsStateByWallet(wallet, state);
      if (db.recordPairsBuyByWallet) {
        await db.recordPairsBuyByWallet(wallet, config.turnsPerBuy, sig);
      }
      res.json({ ok: true, turnsRemaining: state.turnsRemaining, signature: sig });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pairs/collect', express.json(), async function (req, res) {
    const { prizeId, wallet } = req.body || {};
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    if (!config.treasuryKeypair || !connection) return res.status(503).json({ error: 'Pairs treasury not configured' });
    if (!db || !db.getPairsStateByWallet || !db.savePairsStateByWallet) return res.status(503).json({ error: 'Database not configured' });
    let userWallet;
    try {
      userWallet = new PublicKey(wallet);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const walletStr = String(wallet).trim().toLowerCase();
    let claimed = null;
    if (db.claimPendingPairsPrizeByWallet && db.claimFirstPendingPairsPrizeByWallet) {
      claimed = prizeId ? await db.claimPendingPairsPrizeByWallet(walletStr, prizeId) : null;
      if (!claimed) claimed = await db.claimFirstPendingPairsPrizeByWallet(walletStr);
    }
    if (!claimed && (db.claimPendingPairsPrizeByWallet || db.claimFirstPendingPairsPrizeByWallet)) {
      return res.status(400).json({ error: 'No pending prize to collect. It may already have been sent.' });
    }
    const actualPrizeId = (claimed && claimed.prizeId) || prizeId || '';
    if (!actualPrizeId) return res.status(400).json({ error: 'prizeId and wallet required' });
    const amountHuman = parsePrizeId(actualPrizeId);
    if (amountHuman != null) {
      const amountRaw = BigInt(amountHuman * Math.pow(10, config.decimals));
      try {
        const txSig = await sendTokenPrize(
          connection,
          config.treasuryKeypair,
          userWallet,
          amountRaw,
          config.blunanaMint
        );
        if (db.markPairsPrizeSentWallet && claimed) await db.markPairsPrizeSentWallet(claimed, txSig);
        let state = await db.getPairsStateByWallet(walletStr);
        if (state && Array.isArray(state.prizesWon)) {
          const idx = state.prizesWon.indexOf(actualPrizeId);
          if (idx !== -1) {
            state.prizesWon = state.prizesWon.slice(0, idx).concat(state.prizesWon.slice(idx + 1));
            await db.savePairsStateByWallet(walletStr, state);
          }
        }
        res.json({ ok: true, txSignature: txSig });
      } catch (e) {
        if (db.markPairsPrizeFailedWallet && claimed) await db.markPairsPrizeFailedWallet(claimed, e && e.message);
        const errMsg = (e && e.message) || (e && typeof e.toString === 'function' && e.toString()) || String(e) || 'Transfer failed';
        console.error('[pairs] Collect token prize failed:', errMsg, e);
        res.status(500).json({ error: errMsg });
      }
      return;
    }
    if (actualPrizeId.toLowerCase() === 'mnk3ys' || actualPrizeId.toLowerCase() === 'zmb3ys') {
      const collectionKey = actualPrizeId.toLowerCase() === 'mnk3ys' ? 'MNK3YS_COLLECTION_MINT' : 'ZMB3YS_COLLECTION_MINT';
      const collectionMint = process.env[collectionKey];
      if (!collectionMint) return res.status(503).json({ error: 'NFT collection not configured for ' + actualPrizeId + ' (set ' + collectionKey + ' in .env)' });
      const rpcUrlWithKey = HELIUS_API_KEY && HELIUS_RPC ? HELIUS_RPC + '/?api-key=' + HELIUS_API_KEY : null;
      if (!rpcUrlWithKey) return res.status(503).json({ error: 'Helius RPC not configured' });
      const treasuryAddress = config.treasuryKeypair.publicKey.toBase58();
      const mints = await getTreasuryNftsByCollection(rpcUrlWithKey, treasuryAddress, collectionMint);
      if (!mints.length) return res.status(503).json({ error: 'No NFTs from the ' + actualPrizeId + ' collection in the treasury. Top up the treasury to award this prize.' });
      const nftMint = mints[Math.floor(Math.random() * mints.length)];
      try {
        const mint = new PublicKey(nftMint);
        const sourceAta = await getAssociatedTokenAddress(mint, config.treasuryKeypair.publicKey);
        const destAta = await getAssociatedTokenAddress(mint, userWallet);
        const tx = new Transaction();
        tx.add(createAssociatedTokenAccountIdempotentInstruction(
          config.treasuryKeypair.publicKey,
          destAta,
          userWallet,
          mint
        ));
        tx.add(createTransferInstruction(sourceAta, destAta, config.treasuryKeypair.publicKey, 1));
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = config.treasuryKeypair.publicKey;
        tx.sign(config.treasuryKeypair);
        const wire = tx.serialize();
        const txSig = await connection.sendRawTransaction(wire, { skipPreflight: false, preflightCommitment: 'confirmed' });
        const confirmResult = await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');
        if (confirmResult && confirmResult.value && confirmResult.value.err) {
          throw new Error('Transaction failed on-chain: ' + JSON.stringify(confirmResult.value.err));
        }
        const txResult = await connection.getTransaction(txSig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
        if (txResult && txResult.meta && txResult.meta.err) {
          throw new Error('Transaction failed on-chain: ' + JSON.stringify(txResult.meta.err));
        }
        if (db.markPairsPrizeSentWallet && claimed) await db.markPairsPrizeSentWallet(claimed, txSig);
        let state = await db.getPairsStateByWallet(walletStr);
        if (state && Array.isArray(state.prizesWon)) {
          const idx = state.prizesWon.indexOf(actualPrizeId);
          if (idx !== -1) {
            state.prizesWon = state.prizesWon.slice(0, idx).concat(state.prizesWon.slice(idx + 1));
            await db.savePairsStateByWallet(walletStr, state);
          }
        }
        res.json({ ok: true, txSignature: txSig });
      } catch (e) {
        if (db.markPairsPrizeFailedWallet && claimed) await db.markPairsPrizeFailedWallet(claimed, e && e.message);
        const errMsg = (e && e.message) || (e && typeof e.toString === 'function' && e.toString()) || String(e) || 'NFT transfer failed';
        console.error('[pairs] Collect NFT prize failed:', errMsg, e);
        res.status(500).json({ error: errMsg });
      }
      return;
    }
    if (claimed && db.markPairsPrizeFailedWallet) await db.markPairsPrizeFailedWallet(claimed, 'Unknown prize: ' + actualPrizeId);
    res.status(400).json({ error: 'Unknown prize: ' + actualPrizeId });
  });
}

module.exports = { registerPairsRoutes, getPairsConfig, verifyBuyTransaction, sendTokenPrize, parsePrizeId };
