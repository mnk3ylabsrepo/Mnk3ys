/**
 * Pairs game: flip cards to match prizes. 24 cards (4x6), 5 turns for 100k BLUNANA.
 * Anyone can play. Connect wallet to pay BLUNANA for turns.
 */
(function () {
  function getWalletPublicKey() {
    var providers = [window.solflare, window.solana, window.backpack, window.glow];
    for (var i = 0; i < providers.length; i++) {
      var p = providers[i];
      if (p && p.publicKey) return p.publicKey.toString();
    }
    return null;
  }
  function getWalletProvider() {
    var providers = [window.solflare, window.solana, window.backpack, window.glow];
    for (var i = 0; i < providers.length; i++) {
      var p = providers[i];
      if (p && p.publicKey && typeof p.signTransaction === 'function') return p;
    }
    return null;
  }

  function syncPairsWallet() {
    var btn = document.getElementById('btn-connect-wallet');
    var wrap = document.getElementById('pairs-wallet-connected');
    var addrEl = document.getElementById('pairs-wallet-address');
    var balanceEl = document.getElementById('pairs-balance');
    if (!btn || !wrap) return;
    var pk = getWalletPublicKey();
    if (pk) {
      btn.style.display = 'none';
      wrap.style.display = 'flex';
      wrap.hidden = false;
      if (addrEl) addrEl.textContent = pk.length > 12 ? pk.slice(0, 4) + '…' + pk.slice(-4) : pk;
      if (balanceEl) {
        balanceEl.textContent = '…';
        fetch(window.location.origin + '/api/verify?wallet=' + encodeURIComponent(pk), { credentials: 'include' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (balanceEl) balanceEl.textContent = data && data.blunanaFormatted != null ? data.blunanaFormatted : '—';
          })
          .catch(function () {
            if (balanceEl) balanceEl.textContent = '—';
          });
      }
    } else {
      btn.style.display = '';
      wrap.style.display = 'none';
      wrap.hidden = true;
      if (balanceEl) balanceEl.textContent = '—';
    }
  }

  function getConfig() {
    var c = window.MNK3YS_CONFIG && window.MNK3YS_CONFIG.pairs;
    return {
      turnsPerBuy: (c && c.turnsPerBuy) || 5,
      costBlunana: (c && c.costBlunana) || 100000,
      gridCols: (c && c.gridCols) || 4,
      gridRows: (c && c.gridRows) || 6,
    };
  }

  const CARD_TYPES = [
    { id: 'mnk3ys', label: 'Mnk3ys NFT', count: 2 },
    { id: 'zmb3ys', label: 'Zmb3ys NFT', count: 2 },
    { id: '100k', label: '100k $BLUNANA', count: 14 },
    { id: 'shuffle', label: 'SHUFFLE', count: 6 },
  ];

  function buildDeck() {
    var deck = [];
    CARD_TYPES.forEach(function (t) {
      for (var i = 0; i < t.count; i++) deck.push({ id: t.id, label: t.label });
    });
    return deck;
  }

  function shuffleDeck(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function init() {
    var reloadState = function () {};
    syncPairsWallet();
    var mo = new MutationObserver(syncPairsWallet);
    if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    getDetectedWallets().forEach(function (w) {
      if (w.provider && typeof w.provider.on === 'function') {
        w.provider.on('accountChanged', function () { syncPairsWallet(); reloadState(); });
      }
    });

    var connectBtn = document.getElementById('btn-connect-wallet');
    var walletPicker = document.getElementById('wallet-picker');
    var walletPickerList = document.getElementById('wallet-picker-list');
    var walletPickerBackdrop = document.getElementById('wallet-picker-backdrop');
    var walletPickerClose = document.getElementById('wallet-picker-close');
    function openWalletPicker() {
      if (!walletPicker || !walletPickerList) return;
      var wallets = getDetectedWallets();
      if (!wallets.length) {
        alert('No Solana wallet extension detected. Install or enable Phantom, Solflare, or another Solana wallet in this browser.');
        return;
      }
      walletPickerList.innerHTML = '';
      wallets.forEach(function (w) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wallet-picker__btn';
        btn.textContent = w.name;
        btn.addEventListener('click', function () {
          if (walletPicker) walletPicker.setAttribute('aria-hidden', 'true');
          w.provider.connect({ onlyIfTrusted: false }).then(function () { syncPairsWallet(); reloadState(); }).catch(function (err) {
            if (err && err.code !== 4001) console.warn('Wallet connect error', err);
          });
        });
        walletPickerList.appendChild(btn);
      });
      walletPicker.setAttribute('aria-hidden', 'false');
    }
    function closeWalletPicker() {
      if (walletPicker) walletPicker.setAttribute('aria-hidden', 'true');
    }
    if (connectBtn) connectBtn.addEventListener('click', openWalletPicker);
    if (walletPickerBackdrop) walletPickerBackdrop.addEventListener('click', closeWalletPicker);
    if (walletPickerClose) walletPickerClose.addEventListener('click', closeWalletPicker);

    function getDetectedWallets() {
      var list = [];
      if (window.solflare) list.push({ name: 'Solflare', provider: window.solflare });
      if (window.backpack) list.push({ name: 'Backpack', provider: window.backpack });
      if (window.glow) list.push({ name: 'Glow', provider: window.glow });
      if (window.solana && !list.some(function (x) { return x.provider === window.solana; })) {
        list.push({ name: window.solana.isPhantom ? 'Phantom' : window.solana.isSolflare ? 'Solflare' : 'Solana', provider: window.solana });
      }
      return list;
    }

    var gridEl = document.getElementById('pairs-grid');
    var turnsEl = document.getElementById('pairs-turns');
    var buyBtn = document.getElementById('pairs-buy-turns');
    var prizesCountEl = document.getElementById('pairs-prizes-count');
    var messageEl = document.getElementById('pairs-message');

    if (!gridEl) return;

    var state = {
      deck: [],
      turns: 0,
      prizes: [],
      flipped: [],
      matched: {},
      selecting: false,
      collectionImages: {},
      localCollectionImages: {},
      lastWonPrizeId: null,
      pendingPrizes: [],
    };

    var BLUNANA_LOGO_URL = 'https://ipfs.io/ipfs/QmTKRAZEcTfDeVDt8hebrCv27DctYghtdfXRMc9FRA6NU3';
    var UNDO_ICON_URL = '/assets/undo-icon.svg';

    function getCardImageUrl(cardId) {
      if (cardId === 'shuffle') return UNDO_ICON_URL;
      if (cardId === 'mnk3ys' || cardId === 'zmb3ys') {
        return state.localCollectionImages[cardId] || state.collectionImages[cardId] || null;
      }
      return BLUNANA_LOGO_URL;
    }

    function escapeHtml(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function render() {
      gridEl.innerHTML = '';
      var cfg = getConfig();
      gridEl.style.gridTemplateColumns = 'repeat(' + cfg.gridCols + ', 1fr)';
      gridEl.style.gridTemplateRows = 'repeat(' + (cfg.gridRows || 4) + ', 1.4fr)';
      var logoUrl = (window.MNK3YS_CONFIG && window.MNK3YS_CONFIG.logoUrl) || 'assets/logo.png';
      if (logoUrl && !logoUrl.startsWith('/') && !logoUrl.startsWith('http')) logoUrl = '/' + logoUrl;
      state.deck.forEach(function (card, idx) {
        var isFlipped = state.flipped.indexOf(idx) >= 0 || state.matched[idx];
        var div = document.createElement('div');
        div.className = 'pairs__card' + (isFlipped ? ' pairs__card--flipped' : '') + (state.matched[idx] ? ' pairs__card--matched' : '');
        div.setAttribute('data-index', idx);
        var frontClass = card.id === 'shuffle' ? ' pairs__card-front--shuffle' : (card.id === 'mnk3ys' || card.id === 'zmb3ys' ? '' : ' pairs__card-front--blunana');
        var displayLabel = card.id === 'shuffle' ? card.label : (card.id === 'mnk3ys' || card.id === 'zmb3ys' ? card.label : card.id);
        var imgUrl = getCardImageUrl(card.id);
        var frontMediaHtml;
        if (card.id === 'shuffle') {
          frontMediaHtml = '<svg class="pairs__card-front-img pairs__card-front-img--svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 216.318 216.318" fill="currentColor"><path d="M118.913,22.172V0L45.295,43.154l73.617,43.155V62.604c27,5.108,46.549,28.418,46.549,56.331c0,31.641-25.659,57.383-57.3,57.383s-57.341-25.742-57.341-57.383c0-8.319,1.756-16.334,5.179-23.821L19.632,78.483c-5.825,12.743-8.774,26.354-8.774,40.452c0,53.697,43.688,97.383,97.385,97.383s97.218-43.686,97.218-97.383C205.461,68.939,167.913,27.629,118.913,22.172z"/></svg>';
        } else if (imgUrl) {
          frontMediaHtml = '<img class="pairs__card-front-img" src="' + escapeHtml(imgUrl) + '" alt="" />';
        } else {
          frontMediaHtml = '<span class="pairs__card-front-img pairs__card-front-img--placeholder" aria-hidden="true"></span>';
        }
        div.innerHTML = '<div class="pairs__card-inner"><div class="pairs__card-back"><img class="pairs__card-back-logo" src="' + escapeHtml(logoUrl) + '" alt="" /></div><div class="pairs__card-front' + frontClass + '"><div class="pairs__card-front-media">' + frontMediaHtml + '</div><span class="pairs__card-front-label">' + escapeHtml(displayLabel) + '</span></div></div>';
        if (!state.matched[idx] && state.turns > 0 && !state.selecting && state.flipped.indexOf(idx) < 0) {
          div.addEventListener('click', function () { onCardClick(idx); });
        }
        gridEl.appendChild(div);
      });
    }

    function setTurns(n) {
      state.turns = n;
      if (turnsEl) turnsEl.textContent = n;
      if (buyBtn) buyBtn.disabled = !getWalletPublicKey() || n > 0;
    }

    function setPrizes() {
      if (prizesCountEl) prizesCountEl.textContent = 'Prizes';
    }

    function setMessage(msg) {
      if (messageEl) {
        messageEl.textContent = msg || '';
        messageEl.className = 'pairs__message' + (msg ? ' pairs__message--visible' : '');
        if (msg && messageEl.scrollIntoView) messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function deal() {
      state.deck = shuffleDeck(buildDeck());
      state.flipped = [];
      state.matched = {};
      gridEl.classList.remove('pairs__grid--shuffling');
      render();
    }

    function doShuffleWithAnimation() {
      gridEl.classList.add('pairs__grid--shuffling');
      state.deck = shuffleDeck(buildDeck());
      state.flipped = [];
      state.matched = {};
      render();
      setTimeout(function () {
        gridEl.classList.remove('pairs__grid--shuffling');
        saveToStorage();
      }, 600);
    }

    var STORAGE_KEY = 'pairs_state';

    function saveToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          deck: state.deck,
          flipped: state.flipped,
          matched: state.matched,
          turns: state.turns,
          prizes: state.prizes,
        }));
      } catch (e) {}
      saveToServer();
    }

    function saveToServer() {
      var w = getWalletPublicKey();
      if (!w) return;
      fetch(window.location.origin + '/api/pairs/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: w,
          deck: state.deck,
          flipped: state.flipped || [],
          matched: state.matched || {},
          turnsRemaining: state.turns != null ? state.turns : 0,
          prizesWon: state.prizes || [],
        }),
        credentials: 'include',
      }).catch(function () {});
    }

    function loadFromStorage() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.deck) && s.deck.length === 24) return s;
      } catch (e) {}
      return null;
    }

    function onCardClick(idx) {
      if (state.pendingPrizes && state.pendingPrizes.length > 0) { setMessage('Collect your prize first'); return; }
      if (state.matched[idx] || state.flipped.indexOf(idx) >= 0) return;
      if (state.flipped.length >= 2) return;

      state.flipped.push(idx);
      render();

      var card = state.deck[idx];
      if (card.id === 'shuffle') {
        state.selecting = true;
        setMessage('SHUFFLE! Turn lost. Board reshuffling…');
        setTurns(state.turns - 1);
        setTimeout(function () {
          state.flipped = [];
          state.selecting = false;
          doShuffleWithAnimation();
          setMessage('');
        }, 1200);
        return;
      }

      if (state.flipped.length === 2) {
        state.selecting = true;
        var a = state.flipped[0];
        var b = state.flipped[1];
        var cardA = state.deck[a];
        var cardB = state.deck[b];

        if (cardB.id === 'shuffle') {
          setMessage('SHUFFLE! Turn lost. Board reshuffling…');
          setTurns(state.turns - 1);
          setTimeout(function () {
            state.flipped = [];
            state.selecting = false;
            doShuffleWithAnimation();
            setMessage('');
          }, 1200);
          return;
        }

        if (cardA.id === cardB.id) {
          state.matched[a] = true;
          state.matched[b] = true;
          state.prizes.push(cardA.label);
          state.lastWonPrizeId = cardA.id;
          setPrizes();
          state.flipped = [];
          state.selecting = false;
          setTurns(state.turns - 1);
          render();
          saveToStorage();
          showCongratsModal(cardA.label, cardA.id);
        } else {
          setTurns(state.turns - 1);
          setTimeout(function () {
            state.flipped = [];
            state.selecting = false;
            render();
            saveToStorage();
          }, 1200);
        }
      }
    }

    var prizesModal = document.getElementById('pairs-prizes-modal');
    var prizesBackdrop = document.getElementById('pairs-prizes-backdrop');
    var prizesClose = document.getElementById('pairs-prizes-close');
    var prizesListEl = document.getElementById('pairs-prizes-list');
    var prizesBtn = document.getElementById('pairs-btn-prizes');

    function openPrizesModal() {
      if (!prizesModal || !prizesListEl) return;
      prizesListEl.innerHTML = '<div class="pairs-prizes-modal__loading">Loading prizes…</div>';
      prizesModal.setAttribute('aria-hidden', 'false');

      fetch(window.location.origin + '/api/collections', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.collections && Array.isArray(data.collections)) {
            data.collections.forEach(function (c) {
              var img = c.animationUrl || c.image;
              if (c.symbol && img) state.collectionImages[c.symbol] = img;
            });
          }
          renderPrizesList(state.collectionImages);
        })
        .catch(function () { renderPrizesList({}); });
    }

    function renderPrizesList(collectionImages) {
      if (!prizesListEl) return;
      prizesListEl.innerHTML = '';
      var types = CARD_TYPES.filter(function (t) { return t.id !== 'shuffle'; });
      types.forEach(function (t) {
        var div = document.createElement('div');
        div.className = 'pairs-prizes-modal__item';
        var imgSrc = getCardImageUrl(t.id);
        var thumbHtml = imgSrc
          ? '<img class="pairs-prizes-modal__thumb" src="' + escapeHtml(imgSrc) + '" alt="" />'
          : '<span class="pairs-prizes-modal__thumb pairs-prizes-modal__thumb--placeholder" aria-hidden="true"></span>';
        div.innerHTML = thumbHtml + '<span>' + escapeHtml(t.label) + '</span>';
        prizesListEl.appendChild(div);
      });
    }

    function closePrizesModal() {
      if (prizesModal) prizesModal.setAttribute('aria-hidden', 'true');
    }

    if (prizesBtn) prizesBtn.addEventListener('click', openPrizesModal);
    if (prizesBackdrop) prizesBackdrop.addEventListener('click', closePrizesModal);
    if (prizesClose) prizesClose.addEventListener('click', closePrizesModal);

    var buyModal = document.getElementById('pairs-buy-modal');
    var buyModalBackdrop = document.getElementById('pairs-buy-modal-backdrop');
    var buyModalClose = document.getElementById('pairs-buy-modal-close');
    var congratsModal = document.getElementById('pairs-congrats-modal');
    var congratsModalBackdrop = document.getElementById('pairs-congrats-modal-backdrop');
    var congratsPrizeEl = document.getElementById('pairs-congrats-prize');
    var congratsCollectBtn = document.getElementById('pairs-congrats-collect');
    var congratsWalletHint = document.getElementById('pairs-congrats-wallet-hint');

    function showBuyModal() {
      if (buyModal) buyModal.setAttribute('aria-hidden', 'false');
    }
    function closeBuyModal() {
      if (buyModal) buyModal.setAttribute('aria-hidden', 'true');
    }
    function showCongratsModal(prizeLabel) {
      if (congratsPrizeEl) congratsPrizeEl.textContent = 'You won ' + prizeLabel;
      if (congratsWalletHint) congratsWalletHint.hidden = !!getWalletPublicKey();
      if (congratsModal) congratsModal.setAttribute('aria-hidden', 'false');
    }
    function closeCongratsModal() {
      if (congratsModal) congratsModal.setAttribute('aria-hidden', 'true');
    }

    var sentModal = document.getElementById('pairs-sent-modal');
    var sentModalBackdrop = document.getElementById('pairs-sent-modal-backdrop');
    var sentModalClose = document.getElementById('pairs-sent-modal-close');
    var sentTxLink = document.getElementById('pairs-sent-tx-link');
    function showSentModal(txSignature) {
      if (sentTxLink && txSignature) {
        sentTxLink.href = 'https://solscan.io/tx/' + encodeURIComponent(txSignature);
        sentTxLink.target = '_blank';
        sentTxLink.rel = 'noopener noreferrer';
      }
      if (sentModal) sentModal.setAttribute('aria-hidden', 'false');
    }
    function closeSentModal() {
      if (sentModal) sentModal.setAttribute('aria-hidden', 'true');
    }

    if (buyModalBackdrop) buyModalBackdrop.addEventListener('click', closeBuyModal);
    if (buyModalClose) buyModalClose.addEventListener('click', closeBuyModal);
    if (congratsModalBackdrop) congratsModalBackdrop.addEventListener('click', closeCongratsModal);
    if (sentModalBackdrop) sentModalBackdrop.addEventListener('click', closeSentModal);
    if (sentModalClose) sentModalClose.addEventListener('click', closeSentModal);
    function doCollect(prizeIdToSend, onSuccess) {
      if (!getWalletPublicKey()) { setMessage('Connect a wallet to collect'); return; }
      if (!prizeIdToSend) { setMessage('No prize to collect'); return; }
      var walletToSend = getWalletPublicKey();
      setMessage('Sending…');
      if (congratsCollectBtn) congratsCollectBtn.disabled = true;
      fetch(window.location.origin + '/api/pairs/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeId: prizeIdToSend, wallet: walletToSend }),
        credentials: 'include'
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }).catch(function () { return { ok: false, data: { error: 'Invalid response' } }; }); })
        .then(function (res) {
          if (congratsCollectBtn) congratsCollectBtn.disabled = false;
          setMessage('');
          if (res.ok && res.data && res.data.txSignature) {
            closeCongratsModal();
            showSentModal(res.data.txSignature);
            state.pendingPrizes = [];
            state.lastWonPrizeId = null;
            if (typeof onSuccess === 'function') onSuccess();
          } else {
            setMessage(res.data && res.data.error ? res.data.error : 'Collect failed');
          }
        })
        .catch(function (err) {
          if (congratsCollectBtn) congratsCollectBtn.disabled = false;
          setMessage('Collect failed');
          console.error('Pairs collect error:', err);
        });
    }
    if (congratsCollectBtn) congratsCollectBtn.addEventListener('click', function () {
      if (!getWalletPublicKey()) {
        setMessage('Connect a wallet to collect');
        return;
      }
      if (!state.lastWonPrizeId) {
        setMessage('No prize to collect');
        closeCongratsModal();
        return;
      }
      doCollect(state.lastWonPrizeId, function () {});
    });

    buyBtn.addEventListener('click', function () {
      if (state.pendingPrizes && state.pendingPrizes.length > 0) { setMessage('Collect your prize first'); return; }
      if (state.turns > 0) return;
      var walletPk = getWalletPublicKey();
      if (!walletPk) { setMessage('Connect a wallet first'); return; }
      var provider = getWalletProvider();
      if (!provider) { setMessage('Connect a wallet that can sign (e.g. Phantom, Solflare)'); return; }
      buyBtn.disabled = true;
      setMessage('Preparing…');
      var origin = window.location.origin;
      fetch(origin + '/api/pairs/create-buy-tx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: walletPk }), credentials: 'include' })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (!res.ok || !res.data.transaction) throw new Error(res.data && res.data.error ? res.data.error : 'Create tx failed');
          var b64 = res.data.transaction;
          var buf = new Uint8Array(atob(b64).split('').map(function (c) { return c.charCodeAt(0); }));
          var Tx = window.solanaWeb3 && window.solanaWeb3.Transaction;
          if (!Tx) throw new Error('Solana web3 not loaded. Refresh the page.');
          var tx = Tx.from(buf);
          if (typeof provider.signAndSendTransaction === 'function') {
            setMessage('Confirm in wallet…');
            return provider.signAndSendTransaction(tx).then(function (result) {
              var sig = result && (result.signature || result.transactionSignature || (typeof result === 'string' ? result : null));
              if (!sig) throw new Error('No signature from wallet');
              if (typeof sig !== 'string' && sig.toString) sig = sig.toString();
              return fetch(origin + '/api/pairs/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signature: sig, wallet: walletPk }), credentials: 'include' });
            });
          }
          return provider.signTransaction(tx).then(function (signedTx) {
            setMessage('Submitting…');
            var serialized = signedTx.serialize();
            var binary = '';
            for (var i = 0; i < serialized.length; i++) binary += String.fromCharCode(serialized[i]);
            var b64 = btoa(binary);
            return fetch(origin + '/api/pairs/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedTransaction: b64, wallet: walletPk }), credentials: 'include' });
          });
        })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          buyBtn.disabled = false;
          setMessage('');
          if (!res.ok) throw new Error(res.data && res.data.error ? res.data.error : 'Buy failed');
          var newTurns = res.data.turnsRemaining != null ? res.data.turnsRemaining : state.turns + (getConfig().turnsPerBuy || 5);
          setTurns(newTurns);
          if (state.deck.length === 0) deal();
          else render();
          saveToStorage();
          showBuyModal();
        })
        .catch(function (err) {
          buyBtn.disabled = false;
          setMessage(err.message || 'Buy failed');
          console.error('Pairs buy error:', err);
        });
    });

    function load() {
      var w = getWalletPublicKey();
      if (!w) {
        state.pendingPrizes = [];
        state.lastWonPrizeId = null;
        setTurns(0);
        deal();
        render();
        return;
      }
      fetch(window.location.origin + '/api/pairs/state?wallet=' + encodeURIComponent(w), { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : { state: null, pendingPrizes: [] }; })
        .then(function (data) {
          state.pendingPrizes = Array.isArray(data && data.pendingPrizes) ? data.pendingPrizes : [];
          var s = data && data.state && Array.isArray(data.state.deck) && data.state.deck.length === 24 ? data.state : loadFromStorage();
          if (s && Array.isArray(s.deck) && s.deck.length === 24) {
            state.deck = s.deck;
            state.turns = s.turnsRemaining != null ? s.turnsRemaining : (s.turns != null ? s.turns : 0);
            state.flipped = Array.isArray(s.flipped) ? s.flipped : [];
            state.matched = s.matched && typeof s.matched === 'object' ? s.matched : {};
            state.prizes = Array.isArray(s.prizesWon) ? s.prizesWon : (Array.isArray(s.prizes) ? s.prizes : []);
            setTurns(state.turns);
            setPrizes();
          } else {
            setTurns(0);
            deal();
            saveToStorage();
          }
          if (state.pendingPrizes.length > 0) {
            var first = state.pendingPrizes[0];
            state.lastWonPrizeId = first && first.prizeId ? first.prizeId : null;
            showCongratsModal('an uncollected prize.', state.lastWonPrizeId);
          }
          render();
        })
        .catch(function () {
          state.pendingPrizes = [];
          var s = loadFromStorage();
          if (s && Array.isArray(s.deck) && s.deck.length === 24) {
            state.deck = s.deck;
            state.turns = s.turns || 0;
            state.flipped = Array.isArray(s.flipped) ? s.flipped : [];
            state.matched = s.matched && typeof s.matched === 'object' ? s.matched : {};
            state.prizes = Array.isArray(s.prizes) ? s.prizes : [];
            setTurns(state.turns);
            setPrizes();
          } else {
            setTurns(0);
            deal();
            saveToStorage();
          }
          render();
        });
    }

    setTurns(0);
    load();
    reloadState = load;

    function onCollectionImagesReady() {
      render();
      if (prizesModal && prizesModal.getAttribute('aria-hidden') === 'false') {
        renderPrizesList();
      }
    }

    fetch(window.location.origin + '/assets/collections/manifest.json', { cache: 'default' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (manifest) {
        if (manifest && typeof manifest === 'object') {
          Object.keys(manifest).forEach(function (slug) {
            var filename = manifest[slug];
            if (filename) state.localCollectionImages[slug] = '/assets/collections/' + filename;
          });
          onCollectionImagesReady();
        }
      })
      .catch(function () {});

    fetch(window.location.origin + '/api/collections', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.collections && Array.isArray(data.collections)) {
          data.collections.forEach(function (c) {
            var img = c.animationUrl || c.image;
            if (c.symbol && img) state.collectionImages[c.symbol] = img;
          });
          onCollectionImagesReady();
        }
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
