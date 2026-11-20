// BLUP3TS Jam instruments (Nov 10 preview). Made by Azgog (@azgog).
// Every instrument is played by small physical / analog-style models written here, rendered once into
// sample buffers and played on the Jam beat grid (120 BPM, E minor pentatonic, the same as audio/jam_loop.mp3).
//   bass, guitar : plucked-string model (Karplus-Strong with pick position, string loss, fine tuning)
//   drumsticks   : drum kit (kick with pitch drop and beater click, snare tones + wires, metallic hats, toms)
//   mic          : singing blips (glottal source + vocal-tract formants, consonant onsets, vibrato)
//   keytar       : analog lead (two detuned saws, resonant filter sweep, delayed vibrato)
//   keys         : electric piano (FM tine + bark)
//   horn         : trumpet (harmonic brass model that brightens as it gets louder, lip scoop, breath)
//   shaker       : shaker (random bead collisions through gourd resonances)
//   pad          : warm synth pad (seven-voice detuned saws, slow filter swell)
// Taps start a one-beat phrase on the next 16th note. Pet stats shape the phrase:
//   level adds layers, mood picks the minor (E) or major (G) side of the key, low hunger lays back and plays half-time,
//   strength adds punch, and pet rarity (Common > Legendary) gives richer riffs.
// Recordings: config.js JAM_RECORDINGS lets real recordings replace the synth per instrument and rarity
// (see audio/jam/README.txt). Everything plays through the same equaliser pass (EQ table below) so it sits even.
// Works in the browser (window.BLUP3TS_JAM) and in node (module.exports) for offline test renders.
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function rng(salt) { var s = salt >>> 0 || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- filters ----------
  function biq(type, f, Q, sr, db) { // RBJ cookbook
    var A = Math.pow(10, (db || 0) / 40), w = TAU * Math.min(f, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q), b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; } // peak
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function filt(x, k) { var z1 = 0, z2 = 0; for (var i = 0; i < x.length; i++) { var v = x[i], y = k[0] * v + z1; z1 = k[1] * v - k[3] * y + z2; z2 = k[2] * v - k[4] * y; x[i] = y; } return x; }
  function svf() { // time-varying state-variable filter (topology-preserving), gives lp, bp, hp
    var ic1 = 0, ic2 = 0, g = 0, k = 1, a1 = 0, a2 = 0, a3 = 0, o = { lp: 0, bp: 0, hp: 0 };
    o.set = function (fc, Q, sr) { g = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr); k = 1 / Q; a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; };
    o.run = function (x) { var v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; o.lp = v2; o.bp = v1; o.hp = x - k * v1 - v2; return v2; };
    return o;
  }
  function polyblep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
  function sat(x, d) { return Math.tanh(x * d) / Math.tanh(d); }
  function buf(sec, sr) { return new Float32Array(Math.max(1, Math.ceil(sec * sr))); }

  // ---------- plucked string (extended Karplus-Strong) ----------
  // o: dur (s, note held), rel (s, damped after), bright 0..1, pick 0..0.5 (pluck point), t60 (s), vel, salt
  function pluck(f, o, sr) {
    var R = rng(o.salt || 1), P = sr / f, S = 0.5 - 0.35 * o.bright, L = Math.floor(P - S - 0.1), d = P - S - L, C = (1 - d) / (1 + d);
    var out = buf(o.dur + o.rel + 0.02, sr), line = new Float32Array(L), idx = 0, zPrev = 0, apx = 0, apy = 0;
    var rhoOn = Math.pow(10, -3 / (f * o.t60)), rhoOff = Math.pow(10, -3 / (f * Math.max(0.02, o.rel * 0.5))), on = Math.floor(o.dur * sr);
    // excitation: the string's shape when the finger/pick lets go (a triangle peaking at the pluck point) plus a little
    // noise for the pick scrape, softened by the finger/pick brightness
    var exc = new Float32Array(L), a = 0.02 + 0.6 * (1 - o.bright), nz = o.noise == null ? 0.12 : o.noise, y = 0, mean = 0, pk = Math.max(1, Math.round(o.pick * L)), e2 = new Float32Array(L);
    for (var i = 0; i < L; i++) exc[i] = (i < pk ? i / pk : (L - i) / (L - pk)) + nz * (R() * 2 - 1);
    for (i = 0; i < L; i++) { y = (1 - a) * exc[i] + a * y; e2[i] = y; }
    for (i = 0; i < L; i++) mean += e2[i]; mean /= L; for (i = 0; i < L; i++) e2[i] = (e2[i] - mean) * o.vel;
    for (var n = 0; n < out.length; n++) {
      var rho = n < on ? rhoOn : rhoOff, z = line[idx], lp = rho * ((1 - S) * z + S * zPrev); zPrev = z;
      var ap = C * lp + apx - C * apy; apx = lp; apy = ap;
      var v = (n < L ? e2[n] : 0) + ap; line[idx] = v; idx = (idx + 1) % L; out[n] = v;
    }
    if (o.pickup) { var pu = Math.max(1, Math.round(o.pickup * P)), mix = o.pickupMix == null ? 1 : o.pickupMix, src = out.slice(); for (n = 0; n < out.length; n++) out[n] = (1 - mix) * src[n] + mix * (src[n] - (n >= pu ? src[n - pu] : 0)); } // electric pickup position
    if (o.atk) { var an = Math.floor(o.atk * sr); for (n = 0; n < an && n < out.length; n++) out[n] *= 0.5 - 0.5 * Math.cos(Math.PI * n / an); } // finger / pick contact time
    var fadeN = Math.min(out.length, Math.floor(0.01 * sr)); for (i = 0; i < fadeN; i++) out[out.length - 1 - i] *= i / fadeN;
    return out;
  }

  // ---------- voices ----------
  var V = {};
  V.bass = function (e, sr) { // electric bass, finger style, bridge + neck pickups, small amp
    var f = mtof(e.m), x = pluck(f, { dur: e.dur, rel: 0.06, bright: clamp(0.7 + 0.2 * e.punch + (e.bright - 0.5) * 0.2, 0, 1), pick: 0.12, t60: 2.6, noise: 0.25, atk: 0.008 - 0.004 * e.punch, pickup: 0.14, pickupMix: 0.7, vel: e.vel, salt: e.salt }, sr);
    filt(x, biq('lp', 2200 + 1200 * e.punch, 0.7, sr)); filt(x, biq('peak', 100, 1.0, sr, 3)); filt(x, biq('peak', 800, 1.2, sr, 2));
    for (var i = 0; i < x.length; i++) x[i] = sat(x[i] * 1.2, 0.8 + 0.8 * e.punch);
    return x;
  };
  V.gtr = function (e, sr) { // electric guitar strum (or muted chuck), light crunch amp + cabinet
    var notes = e.m, up = e.up, len = e.dur + 0.5, x = buf(len + 0.1, sr), gap = up ? 0.006 : 0.009, ord = notes.slice(); if (up) ord.reverse();
    ord.forEach(function (m, j) {
      var s = pluck(mtof(m), { dur: e.mute ? 0.035 : e.dur, rel: e.mute ? 0.03 : 0.12, bright: 0.75 + 0.15 * e.bright, pick: 0.13, t60: 3.2, noise: 0.3, pickup: 0.12, atk: 0.003, vel: e.vel * (up ? 0.7 : 1) * (1 - j * 0.05), salt: e.salt + j * 31 }, sr);
      var o = Math.floor(j * gap * sr); for (var i = 0; i < s.length && o + i < x.length; i++) x[o + i] += s[i];
    });
    for (var i = 0; i < x.length; i++) x[i] = sat(x[i] * 0.9, 2.0);
    filt(x, biq('hp', 90, 0.7, sr)); filt(x, biq('peak', 2200, 0.9, sr, 4)); filt(x, biq('lp', 5200, 0.8, sr)); filt(x, biq('lp', 7000, 0.6, sr));
    return x;
  };
  V.kick = function (e, sr) {
    var x = buf(0.45, sr), R = rng(e.salt), ph = 0;
    for (var i = 0; i < x.length; i++) { var t = i / sr, f = 48 + 120 * Math.exp(-t / 0.032) + 40 * Math.exp(-t / 0.006); ph += TAU * f / sr; x[i] = Math.sin(ph) * Math.exp(-t / 0.26) * Math.min(1, t / 0.0015); }
    var c = buf(0.012, sr); for (i = 0; i < c.length; i++) c[i] = (R() * 2 - 1) * Math.exp(-i / sr / 0.0016); filt(c, biq('hp', 1500, 0.7, sr)); filt(c, biq('lp', 7000, 0.7, sr));
    for (i = 0; i < c.length; i++) x[i] += c[i] * (0.25 + 0.4 * e.punch);
    for (i = 0; i < x.length; i++) x[i] = sat(x[i] * e.vel * 1.3, 1.4);
    return x;
  };
  V.snare = function (e, sr) {
    var x = buf(0.32, sr), R = rng(e.salt), p1 = 0, p2 = 0, nz = buf(0.32, sr);
    for (var i = 0; i < nz.length; i++) nz[i] = R() * 2 - 1;
    filt(nz, biq('hp', 1200, 0.7, sr)); filt(nz, biq('peak', 5000, 1.2, sr, 3)); filt(nz, biq('lp', 9500, 0.7, sr));
    for (i = 0; i < x.length; i++) { var t = i / sr; p1 += TAU * (185 + 40 * Math.exp(-t / 0.01)) / sr; p2 += TAU * 332 / sr;
      x[i] = (0.55 * Math.sin(p1) * Math.exp(-t / 0.055) + 0.3 * Math.sin(p2) * Math.exp(-t / 0.04)) * (0.7 + 0.5 * e.punch) + 0.75 * nz[i] * Math.exp(-t / 0.11) * Math.min(1, t / 0.0008); }
    for (i = 0; i < x.length; i++) x[i] = sat(x[i] * e.vel, 1.2);
    return x;
  };
  V.hat = function (e, sr) { // closed / open hi-hat: six detuned square partials + noise, high band only
    var dec = e.open ? 0.22 : 0.032, x = buf(dec * 4 + 0.02, sr), R = rng(e.salt), F = [205.3, 304.4, 369.6, 522.7, 540, 800], ph = [0, 0, 0, 0, 0, 0];
    for (var i = 0; i < x.length; i++) { var s = 0; for (var j = 0; j < 6; j++) { ph[j] += F[j] * 1.7 / sr; s += (ph[j] % 1) < 0.5 ? 1 : -1; } x[i] = s / 6 * 0.6 + (R() * 2 - 1) * 0.5; }
    filt(x, biq('bp', 8200, 0.9, sr)); filt(x, biq('hp', 5500, 0.7, sr));
    for (i = 0; i < x.length; i++) x[i] *= Math.exp(-i / sr / dec) * Math.min(1, i / sr / 0.0006) * e.vel * 1.4;
    return x;
  };
  V.tom = function (e, sr) {
    var x = buf(0.4, sr), ph = 0, f0 = mtof(e.m), R = rng(e.salt);
    for (var i = 0; i < x.length; i++) { var t = i / sr; ph += TAU * f0 * (1 + 0.35 * Math.exp(-t / 0.03)) / sr; x[i] = (Math.sin(ph) + 0.08 * (R() * 2 - 1) * Math.exp(-t / 0.02)) * Math.exp(-t / 0.2) * e.vel; }
    return x;
  };
  var VOW = { u: [380, 1000, 2700], a: [850, 1220, 2810], o: [520, 920, 2700], i: [330, 2500, 3200], e: [560, 2000, 2900] };
  V.voice = function (e, sr) { // singing blip: consonant (b / d) into a vowel
    var f0 = mtof(e.m), len = e.dur + 0.09, x = buf(len, sr), R = rng(e.salt), syl = e.syl || 'du', con = syl[0], vw = VOW[syl[1]] || VOW.u;
    var ph = 0, nH = Math.floor(5200 / f0), jit = 0;
    var rs = [svf(), svf(), svf(), svf()], bw = [90, 110, 160, 250];
    for (var i = 0; i < x.length; i++) {
      var t = i / sr, vib = t > 0.14 ? 0.35 * Math.min(1, (t - 0.14) / 0.12) * Math.sin(TAU * 5.6 * t) : 0, scoop = -0.5 * Math.exp(-t / 0.035);
      if (!(i & 63)) jit = (R() - 0.5) * 0.04;
      var f = f0 * Math.pow(2, (vib + scoop + jit) / 12); ph += f / sr; ph -= Math.floor(ph);
      var s = 0; for (var k = 1; k <= nH; k++) s += Math.sin(TAU * k * ph) / Math.pow(k, 1.05);
      var en = (t < 0.025 ? t / 0.025 : 1) * (t > e.dur ? Math.exp(-(t - e.dur) / 0.03) : 1);
      s = s * en * 0.35 + (R() * 2 - 1) * 0.03 * en;
      if (!(i & 15)) { var tr = Math.min(1, t / (con === 'b' ? 0.03 : 0.04));
        for (var q = 0; q < 4; q++) { var F = q < 3 ? vw[q] : 3800; if (con === 'd' && q === 1) F = 1750 + (F - 1750) * tr; else if (con === 'b' && q < 3) F *= 0.65 + 0.35 * tr; rs[q].set(F, F / bw[q], sr); } }
      var y = s; for (q = 0; q < 4; q++) y = rs[q].run(y); // cascade formant resonators (all-pole, like a vocal tract)
      if (t < 0.006) y += (R() * 2 - 1) * 0.12 * (1 - t / 0.006); // consonant release burst
      x[i] = y * e.vel;
    }
    filt(x, biq('hp', 120, 0.7, sr)); filt(x, biq('peak', 3000, 1.0, sr, 2));
    return x;
  };
  V.lead = function (e, sr) { // keytar: two detuned saws + sub square, resonant low-pass sweep
    var f0 = mtof(e.m), x = buf(e.dur + 0.12, sr), fl = svf(), p = [Math.random(), Math.random(), 0], R = rng(e.salt); p[0] = R(); p[1] = R();
    for (var i = 0; i < x.length; i++) {
      var t = i / sr, vib = t > 0.18 ? 0.15 * Math.sin(TAU * 5.8 * t) : 0, f = f0 * Math.pow(2, vib / 12), s = 0;
      for (var j = 0; j < 2; j++) { var fj = f * Math.pow(2, (j ? 7 : -7) / 1200), dt = fj / sr; p[j] += dt; if (p[j] >= 1) p[j] -= 1; s += 2 * p[j] - 1 - polyblep(p[j], dt); }
      var dt2 = f / 2 / sr; p[2] += dt2; if (p[2] >= 1) p[2] -= 1; var sq = (p[2] < 0.5 ? 1 : -1) + polyblep(p[2], dt2) - polyblep((p[2] + 0.5) % 1, dt2);
      s = s * 0.5 + sq * 0.18;
      if (!(i & 15)) fl.set(Math.min(f0 * 2 + 1500 + (1800 + 3000 * e.bright + 1500 * e.punch) * Math.exp(-t / 0.16), 16000), 2.2, sr);
      var a = t < 0.004 ? t / 0.004 : 0.75 + 0.25 * Math.exp(-(t - 0.004) / 0.15); if (t > e.dur) a *= Math.exp(-(t - e.dur) / 0.035);
      x[i] = fl.run(s) * a * e.vel * 0.55;
    }
    return x;
  };
  V.ep = function (e, sr) { // electric piano: FM tine (1:1 body, 14:1 ding), slight bark, damper on release
    var x = buf(e.dur + 0.35, sr), notes = e.m;
    notes.forEach(function (m, j) {
      var f = mtof(m), T = 1.6 * Math.pow(261 / f, 0.45), v = e.vel * (j === notes.length - 1 ? 1 : 0.8), ph = 0, o = Math.floor(j * 0.004 * sr);
      for (var i = 0; i + o < x.length; i++) {
        var t = i / sr, I = (0.6 + 1.0 * v + 0.3 * e.bright) * Math.exp(-t / 0.5) + 0.18, w = TAU * f * t;
        var body = Math.sin(w + I * Math.sin(w)), ding = 0.45 * v * Math.exp(-t / 0.05) * Math.sin(w + 1.2 * Math.sin(14 * w));
        var a = Math.exp(-t / T) * Math.min(1, t / 0.007); if (t > e.dur) a *= Math.exp(-(t - e.dur) / 0.08);
        var y = (body + ding) * a * v * 0.3; x[i + o] += y + 0.12 * y * y;
      }
    });
    filt(x, biq('hp', 60, 0.7, sr)); filt(x, biq('lp', 6500, 0.7, sr));
    return x;
  };
  V.brass = function (e, sr) { // trumpet: harmonics brighten with loudness, lip scoop on attack, breath
    var f0 = mtof(e.m), x = buf(e.dur + 0.12, sr), R = rng(e.salt), ph = 0, nH = Math.floor(9000 / f0), br = buf(0.08, sr), amp = new Float32Array(nH + 1);
    for (var i = 0; i < br.length; i++) br[i] = R() * 2 - 1; filt(br, biq('bp', 1500, 1.0, sr));
    var atk = 0.035 - 0.012 * e.punch, fall = e.fall ? 1 : 0;
    for (i = 0; i < x.length; i++) {
      var t = i / sr, A = t < atk ? Math.pow(t / atk, 1.5) * 1.06 : 0.92 + 0.14 * Math.exp(-(t - atk) / 0.05);
      if (t > e.dur) A *= Math.exp(-(t - e.dur) / 0.04);
      var cents = -40 * Math.exp(-t / 0.03) + (t > 0.22 ? 12 * Math.sin(TAU * 5.3 * t) : 0) - (fall && t > e.dur * 0.5 ? 300 * Math.pow((t - e.dur * 0.5) / (e.dur * 0.5 + 0.1), 2) : 0);
      ph += f0 * Math.pow(2, cents / 1200) / sr; ph -= Math.floor(ph);
      var slope = 1.75 - 1.5 * A * e.vel - 0.25 * e.bright, s = 0;
      if (!(i & 7)) { for (var k = 1; k <= nH; k++) { var fk = f0 * k; amp[k] = Math.pow(k, -slope) * (1 + 1.4 * Math.exp(-Math.pow((fk - 1300) / 800, 2))); } }
      for (k = 1; k <= nH; k++) s += amp[k] * Math.sin(TAU * k * ph);
      x[i] = s * A * e.vel * 0.32 + (i < br.length ? br[i] * 0.05 * (1 - i / br.length) : 0);
    }
    filt(x, biq('hp', 150, 0.7, sr));
    return x;
  };
  V.shake = function (e, sr) { // shaker (Cook's stochastic bead model): energy -> random collisions -> gourd resonances
    var x = buf(0.16, sr), R = rng(e.salt), lvl = 0, r1 = svf(), r2 = svf(), atk = 0.012 + 0.006 * (1 - e.punch);
    r1.set(4200 + 600 * e.bright, 2.2, sr); r2.set(7600, 3, sr);
    for (var i = 0; i < x.length; i++) {
      var t = i / sr, E = (t < atk ? t / atk : Math.exp(-(t - atk) / 0.032)) * e.vel;
      if (R() < E * 0.25) lvl += E * (0.4 + R() * 0.6); lvl *= 0.994;
      var s = lvl * (R() * 2 - 1); r1.run(s); r2.run(s); x[i] = (r1.bp * 0.9 + r2.bp * 0.7) * 0.03;
    }
    filt(x, biq('hp', 2500, 0.7, sr));
    return x;
  };
  V.pad = function (e, sr) { // warm pad: 7 detuned saws per note, slow attack and filter swell
    var x = buf(e.dur + 0.8, sr), R = rng(e.salt), DET = [0, -9, 9, -17, 17, -4, 5];
    e.m.forEach(function (m, j) {
      var f0 = mtof(m), fl = svf(), ps = DET.map(function () { return R(); }), v = e.vel * (j ? 0.75 : 0.9);
      for (var i = 0; i < x.length; i++) {
        var t = i / sr, s = 0;
        for (var k = 0; k < DET.length; k++) { var dt = f0 * Math.pow(2, DET[k] / 1200) / sr; ps[k] += dt; if (ps[k] >= 1) ps[k] -= 1; s += 2 * ps[k] - 1 - polyblep(ps[k], dt); }
        if (!(i & 31)) fl.set(500 + (900 + 900 * e.bright) * Math.min(1, t / 0.45), 0.9, sr);
        var a = Math.min(1, t / 0.28); a = a * a * (3 - 2 * a); if (t > e.dur) a *= Math.exp(-(t - e.dur) / 0.28);
        x[i] += fl.run(s / DET.length) * a * v * 0.7;
      }
    });
    return x;
  };

  V.didg = function (e, sr) { // didgeridoo: lip-buzz source through the tube's uneven resonances, a moving mouth formant, breath
    var toot = e.syl === 't', pat = toot ? 0 : +(String(e.syl || 'p0').slice(1)) || 0, sx = e.sx || 0.125, f0 = mtof(e.m), x = buf(e.dur + 0.1, sr), R = rng(e.salt);
    var TL = 2048, tab = new Float32Array(TL + 1), RES = toot ? [1] : [1, 2.6, 4.3, 6.1, 7.9], nH = Math.max(1, Math.min(60, Math.floor((toot ? 3000 : 2600) / f0)));
    for (var k = 1; k <= nH; k++) { var w = 0.2; for (var q = 0; q < RES.length; q++) w += 1.6 * Math.exp(-Math.pow((k - RES[q]) / 0.45, 2)); var a = w * Math.pow(k, toot ? -1.4 : -0.85); for (var i = 0; i <= TL; i++) tab[i] += a * Math.sin(TAU * k * i / TL); }
    var mx = 0; for (i = 0; i <= TL; i++) mx = Math.max(mx, Math.abs(tab[i])); for (i = 0; i <= TL; i++) tab[i] /= mx;
    var fm = svf(), ph = R(), nz = 0, atk = toot ? 0.015 : 0.045;
    for (i = 0; i < x.length; i++) {
      var t = i / sr, m;
      if (pat === 0) m = 0.5 + 0.5 * Math.sin(TAU * 1.6 * t - 1.5); // slow "wow"
      else { var per = pat === 1 ? 2 * sx : sx, u = (t % per) / per; m = Math.exp(-u / 0.35) * (pat === 3 && Math.floor(t / per) % 4 === 0 ? 1 : 0.8); } // tongue/throat pulses on 8ths or 16ths
      ph += f0 * (1 + 0.004 * Math.sin(TAU * 4.7 * t)) / sr; ph -= Math.floor(ph);
      var fi = ph * TL, i0 = fi | 0, src = tab[i0] + (tab[i0 + 1] - tab[i0]) * (fi - i0);
      if (!(i & 15)) fm.set(toot ? 1500 : 420 + 1250 * m, toot ? 4 : 2.6, sr);
      nz = 0.9 * nz + 0.1 * (R() * 2 - 1);
      var a2 = (t < atk ? t / atk : 1) * (t > e.dur ? Math.exp(-(t - e.dur) / 0.05) : 1) * (1 - 0.18 * m * (pat ? 1 : 0));
      fm.run(src); x[i] = (0.5 * src + 1.3 * fm.bp + 0.25 * nz * (0.5 + m)) * a2 * e.vel * 0.5;
    }
    filt(x, biq('hp', 35, 0.7, sr)); filt(x, biq('lp', 4000, 0.7, sr));
    return x;
  };
  V.sticks = function (e, sr) { // wooden clapsticks: two short wood modes + click
    var x = buf(0.08, sr), R = rng(e.salt), p1 = 0, p2 = 0;
    for (var i = 0; i < x.length; i++) { var t = i / sr; p1 += TAU * 2150 / sr; p2 += TAU * 3420 / sr; x[i] = (0.7 * Math.sin(p1) * Math.exp(-t / 0.022) + 0.4 * Math.sin(p2) * Math.exp(-t / 0.012) + (t < 0.002 ? (R() * 2 - 1) * 0.6 : 0)) * e.vel; }
    return x;
  };
  V.rim = function (e, sr) { // rim click (reggae one drop)
    var x = buf(0.07, sr), R = rng(e.salt), p1 = 0;
    for (var i = 0; i < x.length; i++) { var t = i / sr; p1 += TAU * 1700 / sr; x[i] = (0.8 * Math.sin(p1) * Math.exp(-t / 0.012) + (R() * 2 - 1) * 0.5 * Math.exp(-t / 0.006)) * e.vel; }
    filt(x, biq('hp', 600, 0.7, sr)); return x;
  };
  V.brush = function (e, sr) { // brush on a snare: soft swish
    var x = buf(0.25, sr), R = rng(e.salt);
    for (var i = 0; i < x.length; i++) { var t = i / sr; x[i] = (R() * 2 - 1) * (t < 0.03 ? t / 0.03 : Math.exp(-(t - 0.03) / 0.07)) * e.vel * 0.5; }
    filt(x, biq('bp', 3500, 0.6, sr)); return x;
  };
  V.clap = function (e, sr) { // hand clap: three quick bursts + room tail
    var x = buf(0.25, sr), R = rng(e.salt);
    for (var i = 0; i < x.length; i++) { var t = i / sr, en = 0; [0, 0.011, 0.022].forEach(function (o) { if (t >= o) en = Math.max(en, Math.exp(-(t - o) / 0.006)); }); en = Math.max(en, 0.4 * Math.exp(-(t - 0.03) / 0.06) * (t > 0.03 ? 1 : 0)); x[i] = (R() * 2 - 1) * en * e.vel; }
    filt(x, biq('bp', 1300, 0.8, sr)); return x;
  };
  V.bell = function (e, sr) { // glockenspiel / bells: bright FM, long ring
    var x = buf(e.dur + 0.9, sr), f = mtof(e.m);
    for (var i = 0; i < x.length; i++) { var t = i / sr, w = TAU * f * t; x[i] = Math.sin(w + 1.6 * Math.exp(-t / 0.15) * Math.sin(3.5 * w)) * Math.exp(-t / 0.5) * Math.min(1, t / 0.002) * e.vel * 0.3; }
    return x;
  };
  V.jingle = function (e, sr) { // sleigh bells: many tiny metal bells shaken
    var x = V.shake(e, sr), R = rng(e.salt + 9), ph = [0, 0, 0, 0], F = [5200, 6100, 7300, 8800];
    for (var i = 0; i < x.length; i++) { var t = i / sr, s = 0; for (var j = 0; j < 4; j++) { ph[j] += F[j] / sr; s += Math.sin(TAU * ph[j]); } x[i] = x[i] * 0.5 + s * 0.06 * Math.exp(-t / 0.08) * e.vel * (0.6 + 0.4 * R()); }
    return x;
  };
  V.crackle = function (e, sr) { // record crackle bed for lofi (one bar)
    var x = buf(e.dur, sr), R = rng(e.salt);
    for (var i = 0; i < x.length; i++) x[i] = (R() < 0.0009 ? (R() * 2 - 1) : 0) * 0.5 + (R() * 2 - 1) * 0.006;
    filt(x, biq('bp', 2500, 0.5, sr)); return x;
  };
  V.agtr = function (e, sr) { // nylon / acoustic guitar note: soft finger pluck, wooden body, no amp
    var x = pluck(mtof(e.m), { dur: e.dur, rel: 0.2, bright: 0.45, pick: 0.18, t60: 2.4, noise: 0.15, atk: 0.004, vel: e.vel, salt: e.salt }, sr);
    filt(x, biq('peak', 220, 1.2, sr, 4)); filt(x, biq('peak', 2800, 1.5, sr, 2)); filt(x, biq('lp', 6000, 0.7, sr)); return x;
  };

  // ---------- instruments, unlock order, equaliser ----------
  // EQ: gain (linear) per instrument, measured so tapping every beat sits at -21 LUFS, 1.5 dB under the beat loop as it plays in game (-19.6),
  // plus a high-pass (Hz). Calibrated offline (preview tools: jam_render.js + jam_calibrate.py). Recordings use the same gain after loudness matching.
  var EQ = { bass: { gain: 0.1885, hp: 30 }, guitar: { gain: 0.1462, hp: 40 }, drumsticks: { gain: 0.2153, hp: 30 }, mic: { gain: 0.0713, hp: 40 }, keytar: { gain: 0.3015, hp: 40 },
    keys: { gain: 0.3038, hp: 40 }, horn: { gain: 0.1063, hp: 40 }, shaker: { gain: 0.3701, hp: 40 }, pad: { gain: 0.2213, hp: 40 }, didg: { gain: 0.2156, hp: 30 } };
  var ORDER = ['bass', 'guitar', 'drumsticks', 'mic', 'keytar', 'keys', 'shaker', 'horn', 'pad', 'didg'];
  var RAR = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

  // ---------- harmony of the beat loop (one chord root per beat, 16 beats) ----------
  var ROOTS = ['E', 'G', 'D', 'G', 'E', 'G', 'G', 'E', 'E', 'G', 'D', 'G', 'E', 'G', 'G', 'E'];
  var PENT = [4, 7, 9, 11, 2]; // E minor pentatonic = G major pentatonic: every note fits the loop
  var BASSR = { E: 40, G: 43, D: 38, A: 45 };
  var CH = { // [minor side, major side] voicings, pentatonic notes only
    gtr: { E: [[52, 59, 62, 67], [55, 59, 64, 67]], G: [[55, 59, 62, 67], [55, 62, 67, 69]], D: [[50, 57, 62, 64], [57, 62, 64, 69]], A: [[57, 62, 64, 69], [57, 64, 67, 69]] },
    ep: { E: [[52, 55, 59, 62], [55, 59, 64, 67]], G: [[55, 59, 62, 64], [55, 59, 62, 69]], D: [[50, 57, 62, 64], [57, 62, 64, 69]], A: [[55, 57, 62, 64], [57, 62, 64, 67]] },
    pad: { E: [[40, 52, 59, 62, 67], [43, 55, 59, 64, 71]], G: [[43, 55, 59, 62, 67], [43, 55, 62, 67, 69]], D: [[38, 50, 57, 62, 64], [38, 50, 57, 64, 69]], A: [[45, 57, 62, 64, 67], [45, 57, 64, 67, 69]] }
  };
  var TONES = { E: [4, 7, 11, 2], G: [7, 11, 2, 4], D: [2, 9, 4, 7], A: [9, 2, 4, 7] }; // chord tones for melodies (pitch classes)

  // ---------- beats: tempo, key, chord roots per beat, groove. Every instrument follows the picked beat. ----------
  // tr = semitones from E (the key change), roots use the E-minor-pentatonic chord names above, swing = late 16ths (0..0.3)
  // gain: measured offline so each beat plays at -19.6 LUFS in game, the same as the 8-bit loop (jam_calibrate_beats.py).
  var R4 = function (a, b, c, d) { var o = []; [a, b, c, d].forEach(function (x) { o.push(x, x, x, x); }); return o; };
  var BEATS = {
    chip8: { id: 'chip8', name: '8-bit Original', emoji: '🕹️', bpm: 120, tr: 0, swing: 0, roots: ['E', 'G', 'D', 'G', 'E', 'G', 'G', 'E', 'E', 'G', 'D', 'G', 'E', 'G', 'G', 'E'], style: 'file', file: 'audio/jam_loop.mp3' },
    lofi: { id: 'lofi', name: 'Lofi Chill Hop', emoji: '🎧', bpm: 84, tr: -2, swing: 0.18, roots: R4('E', 'A', 'G', 'D'), style: 'lofi', gain: 1 },
    funk: { id: 'funk', name: 'Funky Groove', emoji: '🕺', bpm: 104, tr: 0, swing: 0, roots: ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'A', 'A', 'A', 'A', 'E', 'E', 'G', 'D'], style: 'funk', gain: 1 },
    island: { id: 'island', name: 'Island Breeze', emoji: '🏝️', bpm: 80, tr: 5, swing: 0.1, roots: R4('E', 'A', 'E', 'D'), style: 'island', gain: 1 },
    rock: { id: 'rock', name: 'Rock Out', emoji: '🤘', bpm: 120, tr: 0, swing: 0, roots: R4('E', 'G', 'D', 'A'), style: 'rock', gain: 1 },
    acoustic: { id: 'acoustic', name: 'Mellow Acoustic', emoji: '🪕', bpm: 92, tr: 0, swing: 0.08, roots: R4('G', 'D', 'E', 'A'), style: 'acoustic', gain: 1 },
    community: { id: 'community', name: 'Community Groove', emoji: '🤝', bpm: 100, tr: 3, swing: 0.05, roots: R4('E', 'G', 'A', 'D'), style: 'funk', flavour: 'claps', community: true, gain: 1 }
  };
  // Seasonal beats: one per month (beat of the month), built on the base grooves with their own key, tempo and a little extra
  [[1, 'snowday', 'Snow Day Lofi', '❄️', 'lofi', 80, -2, 'bells'], [2, 'heartbeat', 'Heartbeat Funk', '💖', 'funk', 100, 0, 'claps'], [3, 'springrain', 'Spring Rain Acoustic', '🌧️', 'acoustic', 88, 0, 'bells'],
   [4, 'garden', 'Garden Island', '🌷', 'island', 82, 3, ''], [5, 'bloom', 'Bloom Lofi', '🌸', 'lofi', 86, 1, 'bells'], [6, 'sunny', 'Sunny Island', '☀️', 'island', 84, 5, 'claps'],
   [7, 'fireworks', 'Firework Rock', '🎆', 'rock', 126, 0, 'crash'], [8, 'beach', 'Beach Funk', '🏖️', 'funk', 106, 2, 'claps'], [9, 'schoolbell', 'School Bell Rock', '🔔', 'rock', 118, -2, 'bells'],
   [10, 'spooky', 'Spooky Funk', '🎃', 'funk', 98, -1, 'bells'], [11, 'harvest', 'Harvest Acoustic', '🍂', 'acoustic', 90, 2, 'shaker'], [12, 'jingle', 'Jingle Lofi', '🎄', 'lofi', 84, -2, 'jingle']]
    .forEach(function (q) { var b = BEATS[q[4]]; BEATS[q[1]] = { id: q[1], name: q[2], emoji: q[3], bpm: q[5], tr: q[6], swing: b.swing, roots: b.roots, style: q[4], flavour: q[7], month: q[0], gain: 1 }; });
  var BEAT_GAIN = {'acoustic': 0.4214, 'beach': 0.2233, 'bloom': 0.3506, 'community': 0.2277, 'fireworks': 0.1761, 'funk': 0.2304, 'garden': 0.3929, 'harvest': 0.4286, 'heartbeat': 0.2364, 'island': 0.4021, 'jingle': 0.3539, 'lofi': 0.355, 'rock': 0.1735, 'schoolbell': 0.1784, 'snowday': 0.3528, 'spooky': 0.233, 'springrain': 0.415, 'sunny': 0.3953}; // filled by calibration below
  var BASE_BEATS = ['chip8', 'lofi', 'funk', 'island', 'rock', 'acoustic'];
  function seasonalFor(month) { for (var k in BEATS) if (BEATS[k].month === month) return BEATS[k]; return null; }

  // one loop of a beat, as events in 16th notes from the loop start
  function inKey(m) { var p = ((m % 12) + 12) % 12; return p === 4 || p === 7 || p === 9 || p === 11 || p === 2; } // E minor pentatonic (before the key change)
  function upKey(m) { while (!inKey(m)) m++; return m; }
  function snap(m) { return inKey(m) ? m : inKey(m - 1) ? m - 1 : inKey(m + 1) ? m + 1 : m - 2; } // a groove note that falls outside the key moves to the nearest key note
  function beatScore(D) {
    var ev = [], N = D.roots.length, bars = N / 4, E = function (t, o) { o.t = t; if (o.m != null) o.m = Array.isArray(o.m) ? o.m.map(snap) : snap(o.m); ev.push(o); };
    var P = function (str, f) { for (var i = 0; i < str.length; i++) if (str[i] !== '.') f(i, str[i]); }; // pattern string, one char per 16th
    for (var bar = 0; bar < bars; bar++) {
      var B = bar * 16, root = function (i) { return D.roots[bar * 4 + (i >> 2)]; }, br = function (i) { return BASSR[root(i)]; };
      if (D.style === 'lofi') {
        P('x......x..x.....', function (i) { E(B + i, { v: 'kick', vel: 0.85 }); });
        P('....x.......x...', function (i) { E(B + i, { v: 'snare', vel: 0.5 }); });
        P('x.x.x.x.x.x.x.x.', function (i) { E(B + i, { v: 'hat', vel: i % 4 ? 0.35 : 0.55 }); });
        E(B, { v: 'ep', m: CH.ep[root(0)][0], vel: 0.55, len: 13 }); E(B + 11, { v: 'ep', m: CH.ep[root(8)][1], vel: 0.35, len: 4 });
        E(B, { v: 'bass', m: br(0), vel: 0.8, len: 6 }); E(B + 7, { v: 'bass', m: br(4) + 7 - (root(4) === 'D' ? 12 : 0), vel: 0.6, len: 3 }); E(B + 10, { v: 'bass', m: br(8), vel: 0.7, len: 5 });
        E(B, { v: 'crackle', vel: 1, len: 16 });
      } else if (D.style === 'funk') {
        P('x..x...x..x.....', function (i) { E(B + i, { v: 'kick', vel: 0.9 }); });
        P('....x.x..x..x.x.', function (i) { E(B + i, { v: 'snare', vel: i % 4 ? 0.22 : 0.8 }); });
        P('xxxxxxxxxxxxxxxx', function (i) { E(B + i, { v: 'hat', vel: i % 2 ? 0.3 : 0.5 }); });
        P('xxx.xxx.xxx.xxx.', function (i) { E(B + i, { v: 'gtr', m: CH.gtr[root(i)][1].slice(1), mute: true, up: i % 2 === 1, vel: 0.35, len: 0.3 }); });
        P('..x.......x.....', function (i) { E(B + i, { v: 'gtr', m: CH.gtr[root(i)][1].slice(1), vel: 0.6, len: 1 }); });
        [[0, 0], [3, 0], [6, 12], [7, 10], [10, 0], [12, 7], [14, 12]].forEach(function (q) { E(B + q[0], { v: 'bass', m: br(q[0]) + q[1], vel: q[1] === 12 ? 0.9 : 0.8, len: 1.4 }); });
      } else if (D.style === 'island') {
        P('........x.......', function (i) { E(B + i, { v: 'kick', vel: 0.9 }); E(B + i, { v: 'rim', vel: 0.7 }); });
        P('x.x.x.x.x.x.x.x.', function (i) { E(B + i, { v: 'hat', vel: 0.32 }); });
        P('..x...x...x...x.', function (i) { E(B + i, { v: 'ep', m: CH.ep[root(i)][1], vel: 0.6, len: 0.9 }); });
        [[2, 0, 2], [6, 7, 2], [8, 0, 3], [12, 12, 1.5], [14, 10, 1.5]].forEach(function (q) { var m = br(q[0]) + q[1]; if (q[1] === 7 && root(q[0]) === 'D') m -= 12; E(B + q[0], { v: 'bass', m: m, vel: 0.85, len: q[2] }); });
      } else if (D.style === 'rock') {
        P('x.....x.x.x.....', function (i) { E(B + i, { v: 'kick', vel: 0.95 }); });
        P('....x.......x...', function (i) { E(B + i, { v: 'snare', vel: 0.9 }); });
        P('x.x.x.x.x.x.x.x.', function (i) { E(B + i, { v: 'hat', vel: 0.45, open: i === 14 }); });
        if (bar % 2 === 0) E(B, { v: 'hat', open: true, vel: 0.9 });
        P('x.x.x.x.x.x.x.x.', function (i) { var r0 = br(i) + 12; E(B + i, { v: 'gtr', m: [r0, r0 + 7, r0 + 12], vel: i % 4 ? 0.6 : 0.85, len: 1.6 }); });
        P('x.x.x.x.x.x.x.x.', function (i) { E(B + i, { v: 'bass', m: br(i), vel: 0.75, len: 1.7 }); });
      } else if (D.style === 'acoustic') {
        P('x.......x.......', function (i) { E(B + i, { v: 'kick', vel: 0.55 }); });
        P('....x.......x...', function (i) { E(B + i, { v: 'brush', vel: 0.8 }); });
        P('x.x.x.x.x.x.x.x.', function (i) { E(B + i, { v: 'shake', vel: i % 4 ? 0.45 : 0.6 }); });
        P('x.x.x.x.x.x.x.x.', function (i) { var ch = CH.gtr[root(i)][1], ord = [0, 2, 1, 3, 2, 1, 3, 2]; E(B + i, { v: 'agtr', m: ch[ord[(i >> 1) % 8]], vel: 0.7, len: 3 }); });
        E(B, { v: 'bass', m: br(0), vel: 0.7, len: 6 }); E(B + 8, { v: 'bass', m: br(8) + 7 - (root(8) === 'D' || root(8) === 'A' ? 12 : 0), vel: 0.6, len: 6 });
      }
      if (D.flavour === 'bells') P('x.....x...x.....', function (i) { var tn = TONES[root(i)]; E(B + i, { v: 'bell', m: 76 + ((tn[(i + bar) % 4] - 4 + 12) % 12), vel: 0.5, len: 2 }); });
      if (D.flavour === 'jingle') P('x.xxx.xxx.xxx.xx', function (i) { E(B + i, { v: 'jingle', vel: i % 4 ? 0.5 : 0.8 }); });
      if (D.flavour === 'claps') P('....x.......x...', function (i) { E(B + i, { v: 'clap', vel: 0.7 }); });
      if (D.flavour === 'shaker') P('.x.x.x.x.x.x.x.x', function (i) { E(B + i, { v: 'shake', vel: 0.4 }); });
      if (D.flavour === 'crash' && bar % 2 === 1) E(B + 12, { v: 'hat', open: true, vel: 1 });
    }
    return ev;
  }
  // render one seamless loop of a beat (the tail of the last notes wraps round to the start)
  function beatJob(D, sr, opt) { // a beat render in steps: step() does one note, finish() returns the loop
    opt = opt || {}; var sx = 60 / D.bpm / 4, L = Math.round(D.roots.length * 4 * sx * sr), x = new Float32Array(L), c = { sixteenth: sx, major: false, punch: 0.5 }, ev = beatScore(D), k = 0;
    return {
      left: function () { return ev.length - k; },
      step: function () {
        var e = ev[k++]; if (!e) return false;
        if (e.m != null) e.m = Array.isArray(e.m) ? e.m.map(function (m) { return m + D.tr; }) : e.m + D.tr;
        var sw = D.swing && e.t % 2 ? D.swing : 0, o = Math.round((e.t + sw) * sx * sr), b = voice(e, c, sr);
        for (var i = 0; i < b.length; i++) x[(o + i) % L] += b[i]; // the tail wraps round, so the loop is seamless
        return k < ev.length;
      },
      finish: function () {
        filt(x, biq('hp', 30, 0.7, sr)); if (D.style === 'lofi') filt(x, biq('lp', 5000, 0.7, sr));
        if (!opt.raw) { var g = BEAT_GAIN[D.id] || 1; for (var i = 0; i < L; i++) { var v = x[i] * g, a = Math.abs(v); x[i] = a > 0.4 ? Math.sign(v) * (0.4 + 0.16 * Math.tanh((a - 0.4) / 0.16)) : v; } } // peak control at -5 dBFS
        return x;
      }
    };
  }
  function renderBeat(D, sr, opt) { var j = beatJob(D, sr, opt); while (j.step()); return j.finish(); }

  function pool(root, lo, hi) { var t = TONES[root], o = []; for (var m = lo; m <= hi; m++) if (t.indexOf(((m % 12) + 12) % 12) >= 0) o.push(m); return o; }
  function pentStep(m, k) { var d = k > 0 ? 1 : -1, n = Math.abs(k); while (n) { m += d; if (PENT.indexOf(((m % 12) + 12) % 12) >= 0) n--; } return m; }

  // one beat of music for an instrument. c: beat (0..15), rar 0..3, major bool, punch 0..1, layer 0..2, drag bool
  function beatEvents(inst, b, c) {
    var D = c.def || BEATS.chip8, RT = D.roots, N = RT.length; b = ((b % N) + N) % N;
    var r = c.rar, root = RT[b], nxt = RT[(b + 1) % N], end = b % 4 === 3, mj = c.major ? 1 : 0, ev = [], E = function (o) { ev.push(o); return o; };
    var lo = mj ? 64 : 59, hi = mj ? 79 : 74, pl = pool(root, lo, hi), mi = function (i) { return pl[((i % pl.length) + pl.length) % pl.length]; }, cont = (b * 3) % 4;
    if (inst === 'bass') {
      var R0 = BASSR[root] + (mj && root === 'E' ? 0 : 0), nx = BASSR[nxt];
      E({ s: 0, v: 'bass', m: R0, vel: 1, len: r ? 2 : 3.6 });
      if (r >= 1) E({ s: 2, v: 'bass', m: r >= 2 && b % 2 ? R0 + 12 : R0 + 7 - (root === 'D' ? 12 : 0), vel: 0.85, len: 1.6 });
      if (r >= 2) E({ s: 3, v: 'bass', m: pentStep(nx, -1), vel: 0.7, len: 0.9 });
      if (r >= 3) { E({ s: 1, v: 'bass', m: R0, vel: 0.4, len: 0.4 }); if (end) { ev.length = 1; [0, 1, 2, 3].forEach(function (k) { if (k) E({ s: k, v: 'bass', m: pentStep(R0, k), vel: 0.8, len: 0.9 }); }); } }
    } else if (inst === 'guitar') {
      var ch = CH.gtr[root][mj];
      E({ s: 0, v: 'gtr', m: ch, vel: 1, len: r ? 1.8 : 3.5 });
      if (r >= 1) E({ s: 2, v: 'gtr', m: ch.slice(1), up: true, vel: 0.8, len: 1.6 });
      if (r >= 2) E({ s: 1, v: 'gtr', m: ch, mute: true, vel: 0.5, len: 0.3 });
      if (r >= 2) E({ s: 3, v: 'gtr', m: ch.slice(1), up: true, vel: 0.65, len: 0.9 });
      if (r >= 3 && end) { ev.length = 1; [1, 2, 3].forEach(function (k) { E({ s: k, v: 'gtr', m: [mi(cont + k)], vel: 0.9, len: 0.9 }); }); }
    } else if (inst === 'drumsticks') {
      E({ s: 0, v: b % 2 ? 'snare' : 'kick', vel: 1 });
      E({ s: 2, v: 'hat', vel: 0.8 });
      if (r >= 1) { E({ s: 0, v: 'hat', vel: 0.6 }); if (b % 4 === 2) E({ s: 3, v: 'kick', vel: 0.75 }); }
      if (r >= 2) { E({ s: 1, v: 'hat', vel: 0.45 }); E({ s: 3, v: 'hat', vel: 0.5 }); if (b % 2) E({ s: 3, v: 'snare', vel: 0.28 }); }
      if (r >= 3) { if (b % 4 === 1) E({ s: 2, v: 'hat', open: true, vel: 0.7 }); if (end && b === N - 1) { ev = ev.filter(function (x) { return x.s === 0; }); [[1, 50], [2, 45], [3, 41]].forEach(function (q) { E({ s: q[0], v: 'tom', m: q[1], vel: 0.85 }); }); } }
    } else if (inst === 'mic') {
      var sy = ['du', 'ba', 'da', 'du', 'bo', 'di'];
      E({ s: 0, v: 'voice', m: mi(cont), syl: sy[b % 6], vel: 1, len: r ? 1.6 : 3 });
      if (r >= 1) E({ s: 2, v: 'voice', m: mi(cont + 1), syl: 'ba', vel: 0.85, len: r >= 2 ? 0.8 : 1.6 });
      if (r >= 2) E({ s: 3, v: 'voice', m: mi(cont + 2), syl: 'da', vel: 0.8, len: 0.8 });
      if (r >= 3 && end) { ev.length = 1; [1, 2, 3].forEach(function (k) { E({ s: k, v: 'voice', m: mi(cont + 3 - k), syl: k % 2 ? 'di' : 'da', vel: 0.85, len: 0.8 }); }); }
    } else if (inst === 'keytar') {
      E({ s: 0, v: 'lead', m: mi(cont + 1), vel: 1, len: r ? 1.7 : 3 });
      if (r >= 1) E({ s: 2, v: 'lead', m: mi(cont + 2), vel: 0.9, len: r >= 2 ? 0.8 : 1.7 });
      if (r >= 2) E({ s: 3, v: 'lead', m: mi(cont + 3), vel: 0.85, len: 0.8 });
      if (r >= 3) { E({ s: 1, v: 'lead', m: mi(cont + 1) + 12, vel: 0.6, len: 0.7 }); if (end) [0, 1, 2, 3].forEach(function (k) { ev[k] && (ev[k].m = mi(cont + k * 2) + (k > 1 ? 12 : 0)); }); }
    } else if (inst === 'keys') {
      var ce = CH.ep[root][mj];
      E({ s: 0, v: 'ep', m: ce, vel: 1, len: r ? 1.5 : 3.6 });
      if (r >= 1) E({ s: 2, v: 'ep', m: ce, vel: 0.75, len: 1.2 });
      if (r >= 2) E({ s: 3, v: 'ep', m: CH.ep[nxt][mj], vel: 0.7, len: 1 });
      if (r >= 3) E({ s: 1, v: 'ep', m: [upKey(ce[ce.length - 1] + (mj ? 4 : 2))], vel: 0.5, len: 0.8 }); // little grace note on top, always in key
    } else if (inst === 'horn') {
      E({ s: 2, v: 'brass', m: mi(cont + 1), vel: 1, len: r ? 1 : 1.6 });
      if (r >= 1) E({ s: 0, v: 'brass', m: mi(cont), vel: 0.8, len: 0.9 });
      if (r >= 2) E({ s: 3, v: 'brass', m: mi(cont + 2), vel: 0.85, len: 0.9 });
      if (r >= 3 && end) { ev = ev.filter(function (x) { return x.s < 2; }); E({ s: 2, v: 'brass', m: mi(cont + 3), vel: 1, len: 2, fall: true }); }
    } else if (inst === 'shaker') {
      var acc = [1, 0.5, 0.8, 0.55];
      [0, 2].forEach(function (k) { E({ s: k, v: 'shake', vel: acc[k] }); });
      if (r >= 1) [1, 3].forEach(function (k) { E({ s: k, v: 'shake', vel: acc[k] }); });
      if (r >= 2) ev.forEach(function (x) { if (x.s === 2) x.vel = 1; });
      if (r >= 3 && end) [10 / 3, 11 / 3].forEach(function (k) { E({ s: k, v: 'shake', vel: 0.6 }); });
    } else if (inst === 'pad') {
      var cp = CH.pad[root][mj].slice(r >= 1 ? 0 : 1);
      if (r >= 2) cp = cp.concat([cp[cp.length - 2] + 12]); // octave shimmer on a chord tone
      E({ s: 0, v: 'pad', m: cp, vel: 1, len: 7 });
      if (r >= 3) E({ s: 2, v: 'ep', m: [cp[cp.length - 1] + 12], vel: 0.35, len: 1 });
    }
    else if (inst === 'didg') { // drone on the beat's root, folded into the didgeridoo's low range (C2..B2 after the key change)
      var dr = BASSR[root]; while (dr + D.tr > 47) dr -= 12; while (dr + D.tr < 36) dr += 12;
      E({ s: 0, v: 'didg', m: dr, syl: 'p' + r, vel: 1, len: 4.4 });
      if (r >= 2) E({ s: 3, v: 'didg', m: dr + 19, syl: 't', vel: 0.55, len: 0.9 }); // overblown toot (a 12th up, still in key)
      if (r >= 3 && end) E({ s: 2, v: 'didg', m: dr + 19, syl: 't', vel: 0.7, len: 0.9 });
    }
    // level layers: 4+ adds a soft groove under it, 7+ adds a harmony voice on top
    if (c.layer >= 1) {
      if (inst === 'bass' || inst === 'didg') E({ s: 0, v: 'kick', vel: 0.55, layer: 1 });
      else if (inst === 'drumsticks' || inst === 'shaker') E({ s: 0, v: 'bass', m: BASSR[root], vel: 0.55, len: 1.8, layer: 1 });
      else E({ s: 0, v: 'bass', m: BASSR[root], vel: 0.5, len: 1.8, layer: 1 });
    }
    if (c.layer >= 2) {
      var main = ev.filter(function (x) { return !x.layer; });
      if (inst === 'bass') E({ s: 2, v: 'bass', m: BASSR[root] + 12, vel: 0.45, len: 0.8, layer: 2 });
      else if (inst === 'didg') { E({ s: 0, v: 'sticks', vel: 0.6, layer: 2 }); E({ s: 2, v: 'sticks', vel: 0.5, layer: 2 }); } // clapsticks
      else if (inst === 'drumsticks') E({ s: 2, v: 'shake', vel: 0.6, layer: 2 });
      else if (inst === 'shaker') E({ s: 2, v: 'hat', vel: 0.4, layer: 2 });
      else main.forEach(function (x) { if (typeof x.m === 'number' && !x.layer) E({ s: x.s, v: x.v, m: pentStep(x.m, 2), syl: x.syl, vel: x.vel * 0.5, len: x.len, layer: 2 }); else if (Array.isArray(x.m) && x.s === 0) E({ s: 0, v: x.v, m: [x.m[x.m.length - 1] + 12], vel: 0.35, len: x.len, layer: 2 }); });
    }
    if (c.drag) { // hungry: half-time, softer, a little behind the beat (set in render)
      var anc = inst === 'horn' ? 2 : 0, keep = ev.filter(function (x) { return x.s === anc || (x.s === 2 - anc && b % 2 === 0); }); // horns keep their off-beat stab
      if (!keep.some(function (x) { return !x.layer; })) { var first = ev.filter(function (x) { return !x.layer; })[0]; if (first) keep.push(first); }
      ev = keep.map(function (x) { x.vel *= inst === 'horn' ? 1 : 0.85; return x; }); // brass goes darker when soft, so it keeps its level
    }
    return ev;
  }

  // the one-beat window that a tap starting on 16th `slot` of beat `beat` plays (rest of this beat + start of the next)
  function phrase(inst, c) {
    // long notes (pads, held chords) that started earlier in the beat come in right away on the tap instead of waiting
    var a = beatEvents(inst, c.beat, c).filter(function (x) { return x.s >= c.slot || (x.len || 0) >= 4; }).map(function (x) { x.s = Math.max(0, x.s - c.slot); return x; });
    var held = a.some(function (x) { return (x.len || 0) >= 4; });
    var b = c.slot ? beatEvents(inst, c.beat + 1, c).filter(function (x) { return x.s < c.slot && !(held && (x.len || 0) >= 4); }).map(function (x) { x.s += 4 - c.slot; return x; }) : [];
    return a.concat(b);
  }

  // pet stats -> phrase controls
  function controls(st) {
    st = st || {}; var lv = st.level || 1, str = Math.max(0, st.str || 0);
    return { def: BEATS[st.beatId] || BEATS.chip8, rar: RAR[st.rarity] || 0, major: (st.joy == null ? 60 : st.joy) >= 50, punch: clamp(Math.log(1 + str) / Math.log(1 + 5000), 0, 1), layer: lv >= 7 ? 2 : lv >= 4 ? 1 : 0, drag: (st.full == null ? 100 : st.full) < 30 };
  }

  // render a list of events to one mono buffer (with EQ). sixteenth = seconds per 16th note
  var vcache = {}, vcount = 0;
  function voice(e, c, sr) {
    var key = [e.v, e.m, e.syl, e.up, e.mute, e.open, e.fall, e.lo, Math.round(e.vel * 20), Math.round((e.len || 0) * 10), c.major, Math.round(c.punch * 4), Math.round(c.sixteenth * 1000), sr].join('|');
    if (vcache[key]) return vcache[key];
    if (vcount > 400) { vcache = {}; vcount = 0; }
    var p = { m: e.m, syl: e.syl, up: e.up, mute: e.mute, open: e.open, fall: e.fall, lo: e.lo, sx: c.sixteenth, vel: e.vel, dur: (e.len || 1) * c.sixteenth, punch: Math.round(c.punch * 4) / 4, bright: c.major ? 0.65 : 0.45, salt: hashStr(key) };
    vcount++; return (vcache[key] = V[e.v](p, sr));
  }
  function render(inst, c, sr, opt) {
    opt = opt || {}; var D = c.def || BEATS.chip8, ev = phrase(inst, c), sx = c.sixteenth, lay = c.drag ? 0.022 : 0, parts = [], end = 0;
    ev.forEach(function (e) {
      if (D.tr && e.m != null) e.m = Array.isArray(e.m) ? e.m.map(function (m) { return m + D.tr; }) : e.m + D.tr; // the beat's key
      var ab = e.s + c.slot, sw = D.swing && Math.abs(ab - Math.round(ab)) < 1e-6 && Math.round(ab) % 2 ? D.swing : 0; // swung 16ths
      var b = voice(e, c, sr), o = Math.round(((e.s + sw) * sx + lay) * sr); parts.push([o, b]); end = Math.max(end, o + b.length); });
    var x = new Float32Array(Math.max(1, end)), g = (opt.raw ? 1 : EQ[inst].gain) * Math.pow(10, (1.5 * c.punch) / 20);
    parts.forEach(function (p) { for (var i = 0; i < p[1].length; i++) x[p[0] + i] += p[1][i]; });
    if (!opt.raw) { filt(x, biq('hp', EQ[inst].hp, 0.7, sr)); for (var i = 0; i < x.length; i++) { var v = x[i] * g, a = Math.abs(v); x[i] = a > 0.36 ? Math.sign(v) * (0.36 + 0.14 * Math.tanh((a - 0.36) / 0.14)) : v; } } // soft peak control: never above 0.5 (-6 dBFS), so loop + instrument stay clean
    return x;
  }

  var api = { BEATS: BEATS, BASE_BEATS: BASE_BEATS, seasonalFor: seasonalFor, beatScore: beatScore, renderBeat: renderBeat, beatJob: beatJob, BEAT_GAIN: BEAT_GAIN, ORDER: ORDER, EQ: EQ, ROOTS: ROOTS, beatEvents: beatEvents, phrase: phrase, controls: controls, render: render, voices: V, mtof: mtof, pluck: pluck };

  // ---------- browser player ----------
  if (typeof window !== 'undefined') {
    var CFG = window.BLUP3TS_CONFIG || {}, REC = CFG.JAM_RECORDINGS || {}, FOLDER = typeof REC.folder === 'string' ? REC.folder : 'audio/jam/', recBuf = {}, recLoading = {};
    var bus = null, pcache = {}, pn = 0;
    function getBus(ctx, out) { // equaliser pass for every instrument sound: high-pass + gentle peak control
      if (bus && bus.ctx === ctx) return bus.input;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30; hp.Q.value = 0.7;
      var cp = ctx.createDynamicsCompressor(); cp.threshold.value = -6; cp.knee.value = 6; cp.ratio.value = 4; cp.attack.value = 0.003; cp.release.value = 0.12;
      hp.connect(cp); cp.connect(out); bus = { ctx: ctx, input: hp }; return hp;
    }
    function recName(inst, rar) { var m = REC[inst]; if (!m || typeof m !== 'object') return null; return m[rar] || m.all || null; }
    function loadRec(ctx, inst, rar) { // a drop-in recording, loudness-matched to the synth level on decode
      var n = recName(inst, rar); if (!n || recBuf[n] || recLoading[n] || !window.fetch) return;
      recLoading[n] = true;
      fetch(FOLDER + n).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (a) { return new Promise(function (res, rej) { ctx.decodeAudioData(a, res, rej); }); })
        .then(function (b) { var d = b.getChannelData(0), w = Math.floor(b.sampleRate * 0.1), best = 0, acc = 0; for (var i = 0; i < d.length; i++) { acc += d[i] * d[i]; if (i >= w) acc -= d[i - w] * d[i - w]; if (acc > best) best = acc; } var rms = Math.sqrt(best / w) || 1; recBuf[n] = { b: b, g: Math.min(8, 0.13 / rms) }; })
        .catch(function () { recBuf[n] = null; });
    }
    function phraseBuf(ctx, inst, c) {
      var sr = ctx.sampleRate, key = [inst, c.def.id, c.beat, c.slot, c.rar, c.major, c.layer, c.drag, Math.round(c.punch * 4), sr].join('|'), b = pcache[key];
      if (!b) { var x = render(inst, c, sr); b = ctx.createBuffer(1, x.length, sr); (b.copyToChannel ? b.copyToChannel(x, 0) : b.getChannelData(0).set(x)); if (++pn > 300) { pcache = {}; pn = 0; } pcache[key] = b; }
      return b;
    }
    // at Jam start: load a drop-in recording if listed, and pre-render the 16 on-beat phrases a few ms at a time
    // so even the first taps on a slow phone play right on the grid
    api.prepare = function (ctx, inst, st, periodMs) {
      var c = controls(st); loadRec(ctx, inst, Object.keys(RAR)[c.rar]); if (!EQ[inst]) return;
      c.sixteenth = (periodMs || 500) / 4000; c.slot = 0; var b = 0, N = c.def.roots.length;
      (function next() { if (b >= N) return; c.beat = b++; try { phraseBuf(ctx, inst, c); } catch (e) { return; } setTimeout(next, 15); })();
    };
    // play one tap: info = { beat, slot, delayMs, level, joy, full, str, rarity }
    api.play = function (ctx, out, inst, info) {
      if (!ctx || !EQ[inst]) return false;
      var c = controls(info), t0 = ctx.currentTime, when = t0 + Math.max(0, (info.delayMs || 0) / 1000) + 0.005, dest = getBus(ctx, out);
      c.beat = info.beat || 0; c.slot = info.slot || 0; c.sixteenth = (info.periodMs || 500) / 4000;
      var rn = c.def.id === 'chip8' ? recName(inst, Object.keys(RAR)[c.rar]) : null, rec = rn && recBuf[rn];
      if (rn && rec === undefined) loadRec(ctx, inst, Object.keys(RAR)[c.rar]);
      try {
        var src = ctx.createBufferSource(), g = ctx.createGain(), hum = 1 + (Math.random() - 0.5) * 0.08;
        if (rec) { src.buffer = rec.b; g.gain.value = rec.g * hum * (c.drag ? 0.85 : 1); }
        else {
          src.buffer = phraseBuf(ctx, inst, c); g.gain.value = hum;
        }
        src.connect(g); g.connect(dest); src.start(Math.max(when, ctx.currentTime)); return true;
      } catch (e) { return false; }
    };

    // ---------- beat player: synth beats loop gaplessly in WebAudio (works in iOS Safari, which has no gaps here either) ----------
    var bcache = {}, bjobs = {}, now = null;
    function bkey(ctx, id) { return id + '|' + ctx.sampleRate; }
    api.beatReady = function (ctx, id) { return !!(ctx && bcache[bkey(ctx, id)]); };
    // render a beat a few ms at a time (no frame drops), then cb(buffer)
    api.loadBeat = function (ctx, id, cb) {
      var D = BEATS[id]; if (!ctx || !D || D.style === 'file') { if (cb) cb(null); return; }
      var k = bkey(ctx, id); if (bcache[k]) { if (cb) cb(bcache[k]); return; }
      if (bjobs[k]) { if (cb) bjobs[k].cbs.push(cb); return; }
      var job = beatJob(D, ctx.sampleRate), w = bjobs[k] = { cbs: cb ? [cb] : [] };
      (function slice() {
        var t = Date.now(); while (job.step()) if (Date.now() - t > 8) return setTimeout(slice, 0);
        var x = job.finish(), b = ctx.createBuffer(1, x.length, ctx.sampleRate); (b.copyToChannel ? b.copyToChannel(x, 0) : b.getChannelData(0).set(x));
        bcache[k] = b; delete bjobs[k]; w.cbs.forEach(function (f) { try { f(b); } catch (e) {} });
      })();
    };
    api.startBeat = function (ctx, out, id, delay) {
      api.stopBeat(); var b = bcache[bkey(ctx, id)]; if (!b) return null;
      var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; s.loop = true; s.connect(g); g.connect(out);
      var t0 = ctx.currentTime + (delay || 0.06); s.start(t0); now = { s: s, g: g, t0: t0, len: b.duration, id: id, ctx: ctx };
      return { t0: t0, length: b.duration };
    };
    api.stopBeat = function (fade) {
      if (!now) return; var n = now; now = null;
      try { var t = n.ctx.currentTime; n.g.gain.setValueAtTime(n.g.gain.value, t); n.g.gain.linearRampToValueAtTime(0, t + (fade || 0.08)); n.s.stop(t + (fade || 0.08) + 0.02); } catch (e) { try { n.s.stop(); } catch (e2) {} }
    };
    // seconds into the loop that the player hears right now (output latency taken off), or -1 before it starts
    // output latency: Chrome and Firefox report it; Safari leaves outputLatency out, so use baseLatency plus a typical
    // iPhone speaker buffer (about 20 ms). Bluetooth headphones add more; the jam timing windows are wide enough for kids.
    function lat(c) { return typeof c.outputLatency === 'number' && c.outputLatency > 0 ? c.outputLatency : (c.baseLatency || 0.005) + 0.02; }
    api.beatTime = function () { // seconds into the loop that the player hears right now, -1 before it starts
      if (!now) return -1; var t = now.ctx.currentTime - now.t0 - lat(now.ctx);
      return t < 0 ? -1 : t % now.len;
    };
    // seconds of the beat that have gone out to the speaker so far (a little negative at the very start), null when stopped.
    // This is the scheduling clock: an instrument note set for beat k at t0 + k lines up sample-exact with the beat buffer.
    api.beatElapsed = function () { if (!now) return null; return now.ctx.currentTime - now.t0; };
    api.outputLatency = function (c) { c = c || (now && now.ctx); return c ? lat(c) : 0; }; // what the ear hears later than that clock
    api.beatPlaying = function () { return now ? now.id : null; };
    window.BLUP3TS_JAM = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(this);
