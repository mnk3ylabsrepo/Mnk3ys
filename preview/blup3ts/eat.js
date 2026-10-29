// BLUP3TS Sandbox: eating animation + 8-bit munch sounds. Fully offline.
// Art is drawn here as SVG (blue BLUNANA bananas). The pet's own picture is never edited:
// everything moves with CSS transforms / opacity on separate layers.
(function () {
  'use strict';
  // SVG namespace, taken from a parsed <svg> so no address string is needed in this file
  var NS = (function () { var d = document.createElement('div'); d.innerHTML = '<svg></svg>'; return d.firstChild.namespaceURI; })();
  var uid = 0;
  function svgEl(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

  // ---------- art ----------
  function defs(svg, id) {
    var d = svgEl('defs', {}, svg);
    var g = svgEl('linearGradient', { id: 'bf' + id, x1: '0', y1: '0', x2: '0', y2: '1' }, d);
    svgEl('stop', { offset: '0', 'stop-color': '#B9F3FF' }, g); svgEl('stop', { offset: '.45', 'stop-color': '#48D8FC' }, g); svgEl('stop', { offset: '1', 'stop-color': '#1E6FD9' }, g);
    var p = svgEl('linearGradient', { id: 'bp' + id, x1: '0', y1: '0', x2: '1', y2: '1' }, d);
    svgEl('stop', { offset: '0', 'stop-color': '#2E8BEA' }, p); svgEl('stop', { offset: '1', 'stop-color': '#0E3F86' }, p);
    var c = svgEl('linearGradient', { id: 'bd' + id, x1: '0', y1: '0', x2: '0', y2: '1' }, d);
    svgEl('stop', { offset: '0', 'stop-color': '#EAF9FF', 'stop-opacity': '.95' }, c); svgEl('stop', { offset: '1', 'stop-color': '#7FD8F5', 'stop-opacity': '.85' }, c);
    var m = svgEl('mask', { id: 'bm' + id, maskUnits: 'userSpaceOnUse', x: '-20', y: '-20', width: '140', height: '140' }, d);
    svgEl('rect', { x: '-20', y: '-20', width: '140', height: '140', fill: '#fff' }, m);
    return m;
  }
  // one blue banana; t = transform
  function banana(parent, id, t) {
    var g = svgEl('g', { transform: t || '' }, parent);
    svgEl('path', { d: 'M10 34 C16 66 46 84 78 74 C86 71 91 66 93 60 C80 66 60 68 44 60 C30 53 20 42 18 30 Z', fill: 'url(#bf' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2.4', 'stroke-linejoin': 'round' }, g);
    svgEl('path', { d: 'M20 40 C30 56 50 66 74 66', fill: 'none', stroke: '#E8FCFF', 'stroke-width': '3', 'stroke-linecap': 'round', opacity: '.75' }, g);
    svgEl('path', { d: 'M8 33 L18 29 L19 35 Z', fill: '#0B2E5C' }, g);
    svgEl('rect', { x: '89', y: '54', width: '9', height: '6', rx: '2', fill: '#0B2E5C', transform: 'rotate(-30 93 57)' }, g);
    return g;
  }
  var ART = {
    nibble: { bites: [[22, 44], [46, 64]], build: function (svg, id, food, left) {
      // half a blue BLUNANA banana, cut end showing
      svgEl('path', { d: 'M10 34 C14 56 30 72 54 77 L57 61 C40 57 26 47 18 30 Z', fill: 'url(#bf' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2.4', 'stroke-linejoin': 'round' }, food);
      svgEl('path', { d: 'M20 40 C28 54 40 64 52 68', fill: 'none', stroke: '#E8FCFF', 'stroke-width': '3', 'stroke-linecap': 'round', opacity: '.75' }, food);
      svgEl('ellipse', { cx: '56', cy: '69', rx: '5', ry: '8.5', fill: '#E8FCFF', stroke: '#0B3E7A', 'stroke-width': '2', transform: 'rotate(12 56 69)' }, food);
      svgEl('path', { d: 'M8 33 L18 29 L19 35 Z', fill: '#0B2E5C' }, food);
      // what's left: the little stem cap
      svgEl('path', { d: 'M6 32 L18 27 L20 36 L9 38 Z', fill: 'url(#bp' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2' }, left);
    } },
    snack: { bites: [[16, 38], [40, 60], [66, 68]], build: function (svg, id, food, left) {
      banana(food, id);
      // peel: three flaps that stay after the last bite
      svgEl('path', { d: 'M88 58 C78 70 70 80 64 92 L70 92 C76 82 84 72 92 64 Z', fill: 'url(#bp' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2' }, left);
      svgEl('path', { d: 'M90 60 C92 74 92 84 88 96 L94 95 C97 84 97 72 94 60 Z', fill: 'url(#bp' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2' }, left);
      svgEl('path', { d: 'M92 58 C100 66 104 74 106 86 L100 86 C98 76 96 68 90 62 Z', fill: 'url(#bp' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2' }, left);
      svgEl('rect', { x: '86', y: '50', width: '10', height: '9', rx: '2', fill: '#0B2E5C' }, left);
    } },
    meal: { bites: [[18, 20], [14, 52], [36, 40], [50, 66], [68, 50]], build: function (svg, id, food, left) {
      banana(food, id, 'rotate(-38 90 38) translate(-2 -10)');
      banana(food, id, 'rotate(-10 90 38) translate(0 0)');
      banana(food, id, 'rotate(18 90 38) translate(4 8)');
      svgEl('path', { d: 'M80 36 C86 30 92 24 96 14', fill: 'none', stroke: '#0B2E5C', 'stroke-width': '7', 'stroke-linecap': 'round' }, left);
      [['M86 40 C76 54 70 66 62 80 L68 82 C76 68 82 56 90 44 Z'], ['M88 42 C90 58 90 70 86 86 L92 86 C95 72 95 58 92 42 Z'], ['M90 40 C98 50 102 60 104 74 L98 74 C96 62 94 52 88 44 Z']].forEach(function (pp) {
        svgEl('path', { d: pp[0], fill: 'url(#bp' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2' }, left);
      });
    } },
    feast: { bites: [[12, 56], [28, 40], [44, 30], [58, 42], [74, 34], [88, 54]], build: function (svg, id, food, left) {
      // banana halves along the dish
      svgEl('path', { d: 'M4 60 C20 50 50 50 74 56 C60 64 24 68 4 66 Z', fill: 'url(#bf' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2' }, food);
      svgEl('path', { d: 'M26 58 C46 50 78 50 96 60 C80 68 44 68 26 64 Z', fill: 'url(#bf' + id + ')', stroke: '#0B3E7A', 'stroke-width': '2' }, food);
      // three scoops: blue BLUNANA, vanilla, berry
      [[28, 44, '#48D8FC', '#1E6FD9'], [50, 38, '#F4F8FF', '#9FB4D6'], [72, 44, '#FF9EC1', '#D2557F']].forEach(function (s) {
        svgEl('circle', { cx: s[0], cy: s[1], r: '15', fill: s[2], stroke: s[3], 'stroke-width': '2.2' }, food);
        svgEl('circle', { cx: s[0] - 5, cy: s[1] - 6, r: '4', fill: '#fff', opacity: '.6' }, food);
      });
      // whipped cream + cherry + sprinkles
      svgEl('path', { d: 'M38 24 C40 14 46 10 50 6 C54 10 60 14 62 24 C56 28 44 28 38 24 Z', fill: '#FFFFFF', stroke: '#B8C9E4', 'stroke-width': '2' }, food);
      svgEl('circle', { cx: '50', cy: '6', r: '5', fill: '#FF4F7B', stroke: '#B0244B', 'stroke-width': '1.6' }, food);
      svgEl('path', { d: 'M50 1 C52 -4 56 -6 60 -6', fill: 'none', stroke: '#2B7A3D', 'stroke-width': '1.8' }, food);
      [[22, 38, '#F2C94C'], [34, 34, '#fff'], [46, 32, '#48D8FC'], [56, 34, '#F2C94C'], [68, 38, '#fff'], [78, 40, '#48D8FC']].forEach(function (s, i) {
        svgEl('rect', { x: s[0], y: s[1], width: '5', height: '2', rx: '1', fill: s[2], transform: 'rotate(' + (i * 40) + ' ' + s[0] + ' ' + s[1] + ')' }, food);
      });
      // the glass boat dish (left over at the end)
      svgEl('path', { d: 'M0 62 C10 86 90 86 100 62 Z', fill: 'url(#bd' + id + ')', stroke: '#3FA6D8', 'stroke-width': '2.4' }, left);
      svgEl('rect', { x: '40', y: '82', width: '20', height: '8', rx: '3', fill: '#7FD8F5', stroke: '#3FA6D8', 'stroke-width': '2' }, left);
      svgEl('path', { d: 'M10 68 C24 78 50 80 64 78', fill: 'none', stroke: '#fff', 'stroke-width': '2.4', opacity: '.6', 'stroke-linecap': 'round' }, left);
    } }
  };
  // order matters so the dish sits under the food, the peel over nothing
  function makeItem(tier, size) {
    var id = ++uid, svg = svgEl('svg', { viewBox: '-8 -10 116 116', width: size, height: size, 'aria-hidden': 'true' });
    var mask = defs(svg, id), a = ART[tier];
    var left = svgEl('g', { 'class': 'eat-left' }), food = svgEl('g', { mask: 'url(#bm' + id + ')' });
    if (tier === 'feast') { svg.appendChild(left); svg.appendChild(food); } else { svg.appendChild(food); svg.appendChild(left); left.setAttribute('opacity', '0'); }
    a.build(svg, id, food, left);
    return { svg: svg, food: food, left: left, bite: function (i) {
      var b = a.bites[Math.min(i, a.bites.length - 1)], r = tier === 'feast' ? 15 : 13;
      [[0, 0, r], [-r * .8, r * .5, r * .75], [r * .8, -r * .4, r * .75], [r * .2, r * .9, r * .6]].forEach(function (c) {
        svgEl('circle', { cx: b[0] + c[0], cy: b[1] + c[1], r: c[2], fill: '#000' }, mask);
      });
      return b;
    } };
  }
  function icon(tier) { return makeItem(tier, 52).svg; } // small version for the Feed menu

  // ---------- 8-bit WebAudio ----------
  var ctx = null, enabled = false, noiseBuf = null;
  var master = null, vol = 1; // M13: one master volume (0..1) for all game sound effects + instruments
  function out() { if (!master) { master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); } return master; }
  function setVolume(v) { vol = Math.max(0, Math.min(1, +v || 0)); if (master && ctx) { try { master.gain.setValueAtTime(vol, ctx.currentTime); } catch (e) { master.gain.value = vol; } } }
  var Ctx = window.AudioContext || window.webkitAudioContext;
  function unlockAudio() { // call inside a tap
    if (!Ctx) return;
    try { if (!ctx) ctx = new Ctx(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; }
    if (ctx && !noiseBuf) { noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .08), ctx.sampleRate); var ch = noiseBuf.getChannelData(0); for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  }
  function tone(type, f0, f1, t0, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out()); o.start(t0); o.stop(t0 + dur + .02);
  }
  function ready() { return enabled && ctx && ctx.state !== 'closed'; }
  function munch(i) {
    if (!ready()) return; var t = ctx.currentTime + .005;
    tone('square', 420 - (i % 3) * 40, 110, t, .085, .10);
    var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = .8;
    g.gain.setValueAtTime(.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .07); n.connect(f); f.connect(g); g.connect(out()); n.start(t); n.stop(t + .08);
  }
  function whoosh() { if (ready()) tone('triangle', 300, 900, ctx.currentTime + .005, .25, .05); }
  function jingle(big) {
    if (!ready()) return; var t = ctx.currentTime + .02, notes = big ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
    notes.forEach(function (f, i) { tone('square', f, 0, t + i * .085, i === notes.length - 1 ? .32 : .1, .07); });
    tone('triangle', 262, 0, t, .2, .1); tone('triangle', 392, 0, t + notes.length * .085 - .085, .34, .1);
  }
  function haptic(p) { try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(p); } catch (e) {} }

  // ---------- particles ----------
  function fly(layer, cls, x, y, frames, dur, delay) {
    var e = document.createElement('div'); e.className = cls; layer.appendChild(e);
    var a = e.animate(frames.map(function (f) { return { transform: 'translate(' + (x + f[0]) + 'px,' + (y + f[1]) + 'px) rotate(' + (f[2] || 0) + 'deg) scale(' + (f[3] == null ? 1 : f[3]) + ')', opacity: f[4] == null ? 1 : f[4] }; }), { duration: dur, delay: delay || 0, easing: 'linear', fill: 'both' });
    a.onfinish = function () { e.remove(); };
    return e;
  }
  function crumbs(layer, x, y, n, big) {
    for (var i = 0; i < n; i++) {
      var vx = (Math.random() - .3) * (big ? 150 : 110), vy = -60 - Math.random() * 90, rot = (Math.random() - .5) * 720, fr = [];
      for (var k = 0; k <= 6; k++) { var t = k / 6; fr.push([vx * t, vy * t + 260 * t * t, rot * t, 1 - .4 * t, k < 5 ? 1 : 0]); }
      fly(layer, 'crumb c' + (i % 4), x, y, fr, 600 + Math.random() * 250);
    }
  }
  function sparkles(layer, x, y, n) {
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, d = 70 + Math.random() * 30;
      fly(layer, 'spark', x, y, [[0, 0, 0, .2, 1], [Math.cos(a) * d * .7, Math.sin(a) * d * .7, 90, 1.1, 1], [Math.cos(a) * d, Math.sin(a) * d, 180, .3, 0]], 750, i * 18); }
  }
  function confetti(layer, W) {
    for (var i = 0; i < 34; i++) { var x = Math.random() * W, sway = (Math.random() - .5) * 80, rot = (Math.random() - .5) * 900;
      fly(layer, 'confetti k' + (i % 5), x, -20, [[0, 0, 0, 1, 1], [sway * .5, 220, rot * .5, 1, 1], [sway, 470, rot, 1, 0]], 1300 + Math.random() * 600, Math.random() * 250); }
  }
  function pop(layer, text, x, y, cls, delay) {
    var e = document.createElement('div'); e.className = 'eatpop ' + (cls || ''); e.textContent = text; layer.appendChild(e);
    var a = e.animate([{ transform: 'translate(' + x + 'px,' + y + 'px) translate(-50%,0) scale(.4)', opacity: 0 }, { transform: 'translate(' + x + 'px,' + (y - 26) + 'px) translate(-50%,0) scale(1.15)', opacity: 1, offset: .25 },
      { transform: 'translate(' + x + 'px,' + (y - 46) + 'px) translate(-50%,0) scale(1)', opacity: 1, offset: .75 }, { transform: 'translate(' + x + 'px,' + (y - 70) + 'px) translate(-50%,0) scale(.9)', opacity: 0 }], { duration: 1300, delay: delay || 0, easing: 'ease-out', fill: 'both' });
    a.onfinish = function () { e.remove(); };
  }

  // ---------- the sequence ----------
  var PLAN = { nibble: { bites: 2, gap: 380, fly: 560, size: 96, crumbs: 6 }, snack: { bites: 3, gap: 400, fly: 700, size: 112, crumbs: 8 }, meal: { bites: 5, gap: 300, fly: 680, size: 132, crumbs: 10 }, feast: { bites: 6, gap: 290, fly: 780, size: 150, crumbs: 13 } };
  var current = null;
  // o: { tier, layer, petChomp, petWrap, shakeEl, mouth:{x,y} (layer px), onBite(i,n), onDone(), reduced }
  function run(o) {
    cancel();
    var P = PLAN[o.tier], layer = o.layer, M = o.mouth, token = { dead: false, timers: [] }, t0 = performance.now();
    current = token;
    var size = Math.round(P.size * (o.scale > 0 && o.scale < 3 ? o.scale : 1)), item = makeItem(o.tier, size), box = document.createElement('div'), inner = document.createElement('div');
    box.className = 'eatitem'; inner.className = 'eatinner'; inner.appendChild(item.svg); box.appendChild(inner); layer.appendChild(box);
    // the bite point of the item sits on the mouth
    var b0 = ART[o.tier].bites[0], s = size / 116, ox = M.x - (b0[0] + 8) * s, oy = M.y - (b0[1] + 10) * s;
    // keep the whole item inside the screen (big pets / big foods): nudge it in, never let it hang off an edge
    var lw = layer.clientWidth || 396, lh = layer.clientHeight || 484;
    ox = Math.max(4, Math.min(ox, lw - size - 4)); oy = Math.max(4, Math.min(oy, lh - size - 4));
    box.style.left = ox + 'px'; box.style.top = oy + 'px';
    var steps = [];
    function at(ms, fn) { steps.push([ms, fn]); }
    function biteAt(i) {
      var bp = item.bite(i), bx = ox + (bp[0] + 8) * s, by = oy + (bp[1] + 10) * s, last = i === P.bites - 1;
      munch(i); haptic(18);
      if (!o.reduced) {
        o.petChomp.animate([{ transform: 'scale(1,1)' }, { transform: 'translateY(5px) scale(1.07,.9)', offset: .35 }, { transform: 'translateY(-3px) scale(.96,1.06)', offset: .7 }, { transform: 'scale(1,1)' }], { duration: Math.min(260, P.gap - 20), easing: 'ease-out' });
        // the item gets pulled into the mouth a little more each bite
        var pull = (i + 1) / P.bites;
        inner.animate([{ transform: 'translate(' + (-10 * pull) + 'px,' + (3 * pull) + 'px) rotate(' + (-6) + 'deg)' }, { transform: 'translate(' + (-4 - 14 * pull) + 'px,' + (5 * pull) + 'px) rotate(4deg)' }, { transform: 'translate(' + (-10 * pull) + 'px,' + (3 * pull) + 'px) rotate(0deg)' }], { duration: 220, fill: 'forwards', easing: 'ease-out' });
        crumbs(layer, (bx + M.x) / 2, (by + M.y) / 2, P.crumbs, o.tier === 'feast');
      }
      if (o.onBite) o.onBite(i, P.bites);
      if (last) {
        item.food.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
        item.left.setAttribute('opacity', '1');
        if (!o.reduced) { var dx = o.tier === 'feast' ? 0 : 40; inner.animate([{ transform: 'translate(-10px,3px) rotate(0)', opacity: 1 }, { transform: 'translate(' + (dx * .5) + 'px,40px) rotate(' + (o.tier === 'feast' ? 8 : 70) + 'deg)', opacity: 1, offset: .5 }, { transform: 'translate(' + dx + 'px,170px) rotate(' + (o.tier === 'feast' ? 20 : 160) + 'deg)', opacity: 0 }], { duration: 700, delay: 140, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' }); }
        else inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, delay: 120, fill: 'forwards' });
      }
    }
    if (o.reduced) {
      box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: 'both' });
      at(300, function () { for (var i = 0; i < P.bites - 1; i++) item.bite(i); biteAt(P.bites - 1); });
      at(650, finish);
      at(950, done);
    } else {
      // fly in on an arc
      // fly in from above the middle of the screen, so it never crosses the screen's edge on the way
      var sx = Math.max(-150, Math.min(150, Math.round((lw - size) / 2 - ox))), sy = -Math.max(80, Math.min(190, oy / 0.9));
      box.animate([{ transform: 'translate(' + sx + 'px,' + sy + 'px) rotate(60deg) scale(.35)', opacity: 0 }, { transform: 'translate(' + sx * .55 + 'px,' + sy * .9 + 'px) rotate(20deg) scale(.75)', opacity: 1, offset: .35 },
        { transform: 'translate(' + sx * .15 + 'px,' + sy * .35 + 'px) rotate(-8deg) scale(1.05)', offset: .75 }, { transform: 'translate(0,0) rotate(0) scale(1)' }], { duration: P.fly, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' });
      whoosh();
      // open wide: a little stretch just before the first bite
      at(P.fly - 160, function () { o.petChomp.animate([{ transform: 'scale(1,1)' }, { transform: 'translateY(-4px) scale(.97,1.06)' }, { transform: 'scale(1,1)' }], { duration: 180 }); });
      for (var i = 0; i < P.bites; i++) (function (k) { at(P.fly + k * P.gap, function () { biteAt(k); }); })(i);
      var end = P.fly + (P.bites - 1) * P.gap + 220;
      at(end, finish);
      at(end + (o.tier === 'feast' ? 1050 : o.tier === 'meal' ? 850 : o.tier === 'nibble' ? 640 : 800), done);
    }
    function finish() {
      jingle(o.tier === 'feast'); haptic(o.tier === 'feast' ? [30, 40, 30, 40, 60] : [25, 30, 25]);
      var cx = o.center.x, cy = o.center.y;
      var ring = document.createElement('div'); ring.className = 'eatring'; ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; layer.appendChild(ring);
      ring.animate([{ transform: 'translate(-50%,-50%) scale(.55)', opacity: .95 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], { duration: o.reduced ? 400 : 800, easing: 'ease-out', fill: 'both' }).onfinish = function () { ring.remove(); };
      pop(layer, 'Yum!', cx, cy - 104, 'big');
      pop(layer, '+' + o.full + ' Hunger', cx, cy + 4, '', 120);
      if (o.reduced) return;
      o.petWrap.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-26px) scale(1.04,.98)', offset: .35 }, { transform: 'translateY(0) scale(1.06,.92)', offset: .6 }, { transform: 'translateY(-8px) scale(1)', offset: .8 }, { transform: 'translateY(0) scale(1)' }], { duration: 650, easing: 'ease-out', composite: 'add' });
      sparkles(layer, cx, cy, o.tier === 'nibble' ? 7 : o.tier === 'snack' ? 10 : 14);
      if (o.tier === 'feast') {
        confetti(layer, layer.clientWidth || 396);
        if (o.shakeEl) o.shakeEl.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-7px,3px) rotate(-.6deg)' }, { transform: 'translate(6px,-4px) rotate(.6deg)' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 420, easing: 'ease-out' });
      }
    }
    function done() { box.remove(); current = null; if (o.onDone) o.onDone(); }
    steps.sort(function (a, b) { return a[0] - b[0]; });
    (function tick() {
      if (token.dead) return;
      var el = performance.now() - t0;
      while (steps.length && steps[0][0] <= el) steps.shift()[1]();
      if (steps.length) requestAnimationFrame(tick);
    })();
    token.box = box;
    return token;
  }
  function cancel() { if (current) { current.dead = true; if (current.box) current.box.remove(); current = null; } }

  // 8-bit placeholder note per instrument, played on each Jam tap
  var lastInst = null, instN = 0;
  function inst(kind) {
    lastInst = kind || null; if (!ready() || !kind) return; var t = ctx.currentTime + .005, k = instN++ % 4;
    var sc = [0, 3, 5, 7], up = function (f) { return f * Math.pow(2, sc[k] / 12); };
    if (kind === 'bass') { tone('triangle', up(82), 0, t, .22, .2); tone('square', up(82), 0, t, .06, .05); }
    else if (kind === 'guitar') { tone('square', up(196), up(194), t, .2, .07); tone('square', up(294), 0, t + .01, .16, .04); }
    else if (kind === 'drumsticks') { var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = k % 2 ? 5000 : 1500; g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .06); n.connect(f); f.connect(g); g.connect(out()); n.start(t); n.stop(t + .08); if (!(k % 2)) tone('triangle', 140, 50, t, .1, .2); }
    else if (kind === 'mic') { tone('sine', up(440), up(452), t, .24, .12); tone('sine', up(880), 0, t, .1, .03); }
    else if (kind === 'keytar') { tone('sawtooth', up(523), 0, t, .14, .05); tone('square', up(659), 0, t + .07, .12, .04); }
  }
  window.BLUP3TS_EAT = { inst: inst, lastInst: function () { return lastInst; }, run: run, cancel: cancel, icon: icon, plan: PLAN, unlockAudio: unlockAudio, setVolume: setVolume, volume: function () { return { set: vol, node: master ? master.gain.value : null }; }, setEnabled: function (on) { enabled = !!on; }, audioState: function () { return ctx ? ctx.state : 'none'; } };
})();
