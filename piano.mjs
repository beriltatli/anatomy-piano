// A 1.92 m grand piano, in millimetres, built to come apart in layers.
// Plan coordinates: u across the keyboard from bass (0) to treble (1490), v from the key fronts (0) to the tail.
// World: x = -v (the keyboard faces +x), y = 745 - u (bass at +y), z up from the floor.

export function makePiano(k, G, P) {
  const W = 1490;
  const at = (p) => k.iso(p, P);
  const w3 = (u, v, z) => [-v, W / 2 - u, z];
  const fl = ([u, v]) => [-v, W / 2 - u];
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const V = G.viewOf(P);
  const path3 = (pts, closed = false) => k.pathOf(pts.map(at), closed);
  const ext = (uvRing, z, h, opts = {}) => k.extrude(uvRing.map(fl), z, h, P, opts);
  const rectUV = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const slab = (u0, v0, u1, v1, z, h, style = {}, bevel = 0) => S(ext(rectUV(u0, v0, u1, v1), z, h, { bevel }), style);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ── Plan ─────────────────────────────────────────────────────────────────
  const Z = { floor: 0, caseBottom: 620, keybed: 660, rimTop: 990, sound: 850, plateBand: [880, 905], front: [905, 935], strut: [945, 975], pinblock: [850, 900] };
  const bez = (p0, p1, p2, p3, n) => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, s = 1 - t;
    return [s * s * s * p0[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t * t * t * p3[0], s * s * s * p0[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t * t * t * p3[1]];
  });
  const tail = Array.from({ length: 33 }, (_, i) => {
    const a = Math.PI - (i / 32) * (Math.PI + 0.1745);
    return [320 + 320 * Math.cos(a), 1600 + 320 * Math.sin(a)];
  });
  const end = tail[tail.length - 1];
  const bent = bez(end, [end[0] - 51, end[1] - 294], [1490, 900], [1490, 600], 28).slice(1);
  // The rim, as an open path from the bass cheek round the tail to the treble cheek.
  const RIM_OUT = [[0, 150], [0, 1000], [0, 1600], ...tail.slice(1), ...bent, [1490, 380], [1490, 150]];
  const offset = (pts, d) => pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const du = b[0] - a[0], dv = b[1] - a[1];
    const len = Math.hypot(du, dv) || 1;
    return [p[0] + (dv / len) * d, p[1] - (du / len) * d];
  });
  const RIM_IN = offset(RIM_OUT, 40);
  const cutAt = (pts, v0) => {
    // The part of a rim path behind v0, with its two ends placed exactly on v = v0.
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      if (p[1] >= v0) out.push(p);
      if (q && (p[1] - v0) * (q[1] - v0) < 0) {
        const t = (v0 - p[1]) / (q[1] - p[1]);
        out.push([lerp(p[0], q[0], t), v0]);
      }
    }
    return out;
  };

  // Split the rim into the walls that face the viewer and those that face away.
  function rimPieces() {
    const n = RIM_OUT.length;
    const near = [];
    for (let i = 0; i < n - 1; i++) {
      const [a, b] = [fl(RIM_OUT[i]), fl(RIM_OUT[i + 1])];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      // Outward normal. The plan keeps the interior on its right in (u, v), and the map to world is a mirror.
      const len = Math.hypot(dx, dy) || 1;
      const nx = dy / len, ny = -dx / len;
      near.push(nx * V[0] + ny * V[1] > 0);
    }
    const runs = [];
    let start = 0;
    for (let i = 1; i <= near.length; i++) {
      if (i === near.length || near[i] !== near[start]) { runs.push({ near: near[start], from: start, to: i }); start = i; }
    }
    return runs.map((r) => {
      const outer = RIM_OUT.slice(r.from, r.to + 1);
      const inner = RIM_IN.slice(r.from, r.to + 1);
      return { near: r.near, ring: [...outer, ...inner.reverse()] };
    });
  }
  const RIMS = rimPieces();

  function rim(nearSide) {
    const out = [];
    for (const piece of RIMS.filter((r) => r.near === nearSide)) {
      out.push(S(ext(piece.ring, Z.caseBottom, Z.rimTop - Z.caseBottom, { convex: false }), { tone: "hi" }));
    }
    if (nearSide) {
      // A gold-leaf line runs along the rim top, as on real cases.
      const inner = RIMS.filter((r) => r.near).map((r) => r.ring.slice(0, r.ring.length / 2).map(([u, v]) => w3(u, v, Z.rimTop - 22)));
      for (const line of inner) out.push(L(path3(line), { tone: "lo", className: "pa-goldline" }));
    }
    return out.join("");
  }

  // Cheeks (key blocks), keybed and the dark interior seen from above.
  const KEYS = { u0: 134, white: 23.5, n: 52 };
  KEYS.u1 = KEYS.u0 + KEYS.white * KEYS.n;
  function caseFront(nearSide) {
    const out = [];
    if (!nearSide) {
      out.push(slab(0, 0, W, 700, Z.caseBottom, Z.keybed - Z.caseBottom, { tone: "hi" }));
      out.push(slab(0, 0, KEYS.u0, 150, Z.keybed, 110, { tone: "hi" }, 1.2));
    } else {
      out.push(slab(KEYS.u1, 0, W, 150, Z.keybed, 110, { tone: "hi" }, 1.2));
    }
    return out.join("");
  }
  const INNER = cutAt(RIM_IN, 150);
  function interior() {
    const out = [];
    const ring = INNER.map(([u, v]) => at(w3(u, v, Z.caseBottom)));
    out.push(`<path class="iso-shade" data-shade="0" d="${k.pathOf(ring, true)}"/>`);
    // Braces under the soundboard, fanning from the belly rail to the rim.
    const BRACES = [[[300, 420], [190, 1720]], [[620, 420], [560, 1560]], [[900, 420], [930, 1180]], [[1200, 420], [1380, 760]]];
    for (const [[u0, v0], [u1, v1]] of BRACES) {
      const du = u1 - u0, dv = v1 - v0, len = Math.hypot(du, dv);
      const nu = (-dv / len) * 22, nv = (du / len) * 22;
      out.push(S(ext([[u0 - nu, v0 - nv], [u0 + nu, v0 + nv], [u1 + nu, v1 + nv], [u1 - nu, v1 - nv]], Z.caseBottom, 70), { tone: "mid", className: "pa-wood" }));
    }
    out.push(slab(45, 380, W - 45, 420, Z.caseBottom, 200, { tone: "mid", className: "pa-wood" }));
    return out.join("");
  }

  // ── Soundboard and bridges ───────────────────────────────────────────────
  const SB_V = 400;
  const SB = cutAt(RIM_IN, SB_V);

  // Strings: 88 notes; the lowest 20 are copper-wound and overstrung across the tenor.
  const NOTES = 88;
  const PIN_V = [205, 255];
  const HITCH = offset(cutAt(RIM_IN, SB_V), 62);
  const hitchHit = (o, d) => {
    let best = null;
    for (let i = 0; i < HITCH.length - 1; i++) {
      const a = HITCH[i], b = HITCH[i + 1];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const den = d[0] * ey - d[1] * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den;
      const s = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
      if (t > 50 && s >= 0 && s <= 1 && (!best || t < best)) best = t;
    }
    return best ? [o[0] + d[0] * best, o[1] + d[1] * best] : null;
  };
  const STRINGS = Array.from({ length: NOTES }, (_, i) => {
    const n = i + 1;
    const bass = n <= 20;
    const u = bass ? lerp(150, 520, i / 19) : lerp(560, 1380, (n - 21) / 67);
    const ang = bass ? lerp(0.42, 0.3, i / 19) : lerp(-0.02, 0.06, (n - 21) / 67);
    const d = [Math.sin(ang), Math.cos(ang)];
    const start = [u, 330];
    const stop = hitchHit(start, d);
    const len = Math.hypot(stop[0] - start[0], stop[1] - start[1]);
    const bridge = [start[0] + d[0] * (len - 70), start[1] + d[1] * (len - 70)];
    return { n, bass, pin: [u, PIN_V[n % 2]], start, stop, bridge, len };
  });
  const STRING_Z = { pin: 948, agraffe: 940, bridge: 902, hitch: 906, over: 14 };

  function bridgeBand(points, width) {
    const left = offset(points, -width / 2);
    const right = offset(points, width / 2);
    return [...left, ...right.reverse()];
  }
  function soundboard() {
    const out = [];
    out.push(S(ext(SB, Z.sound - 9, 9, { convex: false }), { tone: "hi", className: "pa-spruce" }));
    // Grain: thin lines clipped to the board, running along the spruce at 40 degrees.
    const grain = [];
    const dir = [Math.cos(0.7), Math.sin(0.7)];
    for (let c = -1800; c < 1800; c += 46) {
      const o = [745 + -dir[1] * c, 1100 + dir[0] * c];
      const hits = [];
      for (let i = 0; i < SB.length; i++) {
        const a = SB[i], b = SB[(i + 1) % SB.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const den = dir[0] * ey - dir[1] * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den;
        const s = ((a[0] - o[0]) * dir[1] - (a[1] - o[1]) * dir[0]) / den;
        if (s >= 0 && s < 1) hits.push(t);
      }
      hits.sort((p, q) => p - q);
      for (let j = 0; j + 1 < hits.length; j += 2) {
        const p0 = [o[0] + dir[0] * hits[j], o[1] + dir[1] * hits[j]];
        const p1 = [o[0] + dir[0] * hits[j + 1], o[1] + dir[1] * hits[j + 1]];
        grain.push(path3([w3(...p0, Z.sound), w3(...p1, Z.sound)]));
      }
    }
    out.push(L(grain.join(""), { tone: "faint" }));
    const treble = STRINGS.filter((s) => !s.bass).map((s) => s.bridge);
    const bass = STRINGS.filter((s) => s.bass).map((s) => s.bridge);
    out.push(S(ext(bridgeBand(treble, 30), Z.sound, STRING_Z.bridge - Z.sound, { convex: false }), { tone: "hi", className: "pa-wood" }));
    out.push(S(ext(bridgeBand(bass, 34), Z.sound, STRING_Z.bridge + STRING_Z.over - Z.sound, { convex: false }), { tone: "hi", className: "pa-wood" }));
    out.push(D([...treble, ...bass].map(([u, v], i) => at(w3(u, v, STRING_Z.bridge + (i >= treble.length ? STRING_Z.over : 0)))), { size: 0.35, tone: "lo" }));
    return out.join("");
  }

  function pinblock() {
    const seams = [0.25, 0.5, 0.75].map((t) => path3([w3(W - 45, lerp(150, 330, t), Z.pinblock[1]), w3(W - 45, lerp(150, 330, t), Z.pinblock[0])]));
    const out = [S(ext(rectUV(45, 150, W - 45, 330), Z.pinblock[0], Z.pinblock[1] - Z.pinblock[0], { bevel: 1 }), { tone: "hi", className: "pa-wood", inner: L(seams.join(""), { tone: "faint" }) })];
    const pins = STRINGS.map((s) => path3([w3(s.pin[0], s.pin[1], Z.pinblock[1]), w3(s.pin[0], s.pin[1], STRING_Z.pin + 8)])).join("");
    out.push(D(STRINGS.map((s) => at(w3(s.pin[0], s.pin[1], Z.pinblock[1]))), { size: 0.6, tone: "lo" }));
    out.push(L(pins, { tone: "mid" }));
    out.push(D(STRINGS.map((s) => at(w3(s.pin[0], s.pin[1], STRING_Z.pin + 8))), { size: 0.75, tone: "mid" }));
    return out.join("");
  }

  function strings() {
    const steel = [];
    const copper = [];
    for (const s of STRINGS) {
      const lift = s.bass ? STRING_Z.over : 0;
      const pts = [w3(s.pin[0], s.pin[1], STRING_Z.pin), w3(s.start[0], s.start[1], STRING_Z.agraffe + lift), w3(s.bridge[0], s.bridge[1], STRING_Z.bridge + lift), w3(s.stop[0], s.stop[1], STRING_Z.hitch + lift)];
      (s.bass ? copper : steel).push(path3(pts));
    }
    // Red stringing felt woven behind the hitch pins and in front of the agraffes.
    const felt = STRINGS.filter((s) => !s.bass).map((s) => w3(s.stop[0] - Math.sin(0.02) * 30, s.stop[1] - 30, STRING_Z.hitch + 1));
    // Each string ends in a coil at its tuning pin and a loop round its hitch pin.
    const ends = STRINGS.flatMap((s) => [at(w3(s.pin[0], s.pin[1], STRING_Z.pin)), at(w3(s.stop[0], s.stop[1], STRING_Z.hitch + (s.bass ? STRING_Z.over : 0)))]);
    return L(steel.join(""), { tone: "hi", className: "pa-steel" }) + L(path3(felt), { tone: "lo", className: "pa-felt" }) + L(copper.join(""), { tone: "hi", className: "pa-copper" }) + D(ends, { size: 0.55, tone: "mid" });
  }

  // ── Cast-iron plate ──────────────────────────────────────────────────────
  const PLATE_OUT = offset(cutAt(RIM_IN, 330), 8);
  const PLATE_IN = offset(cutAt(RIM_IN, 330), 128);
  function plateBand(nearSide) {
    // The band is cut into the half that faces the viewer and the half that doesn't, like the rim.
    const ring = [...PLATE_OUT, ...[...PLATE_IN].reverse()];
    return S(ext(ring, Z.plateBand[0], Z.plateBand[1] - Z.plateBand[0], { convex: false }), { tone: "hi", className: "pa-gold" });
  }
  const STRUTS = [[[300, 330], [330, 1740]], [[560, 330], [520, 1560]], [[840, 330], [860, 1280]], [[1130, 330], [1250, 980]]];
  function plate() {
    const out = [plateBand()];
    out.push(slab(45, 150, W - 45, 330, Z.front[0], Z.front[1] - Z.front[0], { tone: "hi", className: "pa-gold" }, 1.2));
    // Round lightening holes along the band, like the photographs.
    const holes = [];
    for (const t of [0.12, 0.24, 0.36, 0.5, 0.64, 0.78, 0.9]) {
      const i = Math.round(t * (PLATE_OUT.length - 1));
      const [u, v] = [(PLATE_OUT[i][0] + PLATE_IN[i][0]) / 2, (PLATE_OUT[i][1] + PLATE_IN[i][1]) / 2];
      const ring = Array.from({ length: 28 }, (_, j) => w3(u + 34 * Math.cos((j / 28) * Math.PI * 2), v + 34 * Math.sin((j / 28) * Math.PI * 2), Z.plateBand[1]));
      holes.push(`<path class="iso-shade" data-shade="0" d="${path3(ring, true)}"/>`);
      holes.push(L(path3(ring, true), { tone: "mid" }));
    }
    out.push(holes.join(""));
    for (const [[u0, v0], [u1, v1]] of STRUTS) {
      const du = u1 - u0, dv = v1 - v0, len = Math.hypot(du, dv);
      const nu = (-dv / len) * 26, nv = (du / len) * 26;
      out.push(S(ext([[u0 - nu, v0 - nv], [u0 + nu, v0 + nv], [u1 + nu, v1 + nv], [u1 - nu, v1 - nv]], Z.strut[0], Z.strut[1] - Z.strut[0]), { tone: "hi", className: "pa-gold" }));
      for (const [u, v] of [[u0, v0], [u1, v1]]) out.push(S(k.cylinder(...fl([u, v]), 30, Z.plateBand[1], Z.strut[0] - Z.plateBand[1], P, 28), { tone: "hi", className: "pa-gold" }));
    }
    // Hitch pins at the band and agraffe studs along the front bar.
    out.push(D(STRINGS.map((s) => at(w3(s.stop[0], s.stop[1], Z.plateBand[1]))), { size: 0.55, tone: "mid" }));
    out.push(D(STRINGS.map((s) => at(w3(s.start[0], s.start[1] - 8, Z.front[1]))), { size: 0.6, tone: "mid" }));
    // Oval openings for the tuning pins in the front bar.
    const ovals = [];
    for (let g = 0; g < 8; g++) {
      const u0 = lerp(120, 1330, g / 7);
      const ring = Array.from({ length: 24 }, (_, j) => w3(u0 + 60 * Math.cos((j / 24) * Math.PI * 2), 230 + 42 * Math.sin((j / 24) * Math.PI * 2), Z.front[1]));
      ovals.push(L(path3(ring, true), { tone: "lo" }));
    }
    out.push(ovals.join(""));
    return out.join("");
  }

  // ── Keyboard and action: one drawer ─────────────────────────────────────
  function drawer() {
    const out = [];
    out.push(slab(KEYS.u0 - 4, 20, KEYS.u1 + 4, 520, Z.keybed, 15, { tone: "mid", className: "pa-wood" }));
    out.push(slab(KEYS.u0, 150, KEYS.u1, 480, Z.keybed + 15, 22, { tone: "hi", className: "pa-wood" }));
    const lines = [];
    for (let i = 1; i < 88; i++) {
      const u = lerp(KEYS.u0, KEYS.u1, i / 88);
      lines.push(path3([w3(u, 150, Z.keybed + 37), w3(u, 480, Z.keybed + 37)]));
    }
    out.push(L(lines.join(""), { tone: "faint" }));
    out.push(D(Array.from({ length: 88 }, (_, i) => at(w3(lerp(KEYS.u0, KEYS.u1, (i + 0.5) / 88), 300, Z.keybed + 37))), { size: 0.4, tone: "lo" }));
    // White keys: one ivory row with the gaps between keys cut across its top and front.
    const kz = Z.keybed + 42;
    const gaps = [];
    for (let i = 1; i < KEYS.n; i++) {
      const u = KEYS.u0 + i * KEYS.white;
      gaps.push(path3([w3(u, 150, kz), w3(u, 0, kz), w3(u, 0, kz - 27)]));
    }
    out.push(S(ext(rectUV(KEYS.u0, 0, KEYS.u1, 150), Z.keybed + 15, 27, { bevel: 0.6 }), { tone: "hi", className: "pa-ivory", inner: L(gaps.join(""), { tone: "lo" }) }));
    const blacks = [];
    const PATTERN = [1, 1, 0, 1, 1, 1, 0];
    for (let i = KEYS.n - 2; i >= 0; i--) {
      // A0 starts the keyboard; its octave pattern begins at A (A#, then B has none).
      const note = (i + 5) % 7;
      if (!PATTERN[note]) continue;
      const u = KEYS.u0 + (i + 1) * KEYS.white;
      blacks.push(slab(u - 6.5, 50, u + 6.5, 150, Z.keybed + 42, 12, { tone: "hi", className: "pa-lacquer" }, 0.4));
    }
    out.push(blacks.join(""));
    // Action: brackets, wippen rail, hammer flange rail, 88 shanks and hammer heads.
    for (const t of [0.02, 0.27, 0.52, 0.76, 0.98]) {
      const u = lerp(KEYS.u0, KEYS.u1, t);
      out.push(slab(u - 6, 230, u + 6, 400, Z.keybed + 15, 150, { tone: "mid", className: "pa-wood" }));
    }
    out.push(slab(KEYS.u0, 240, KEYS.u1, 270, Z.keybed + 60, 14, { tone: "mid", className: "pa-wood" }));
    out.push(slab(KEYS.u0, 236, KEYS.u1, 262, 830, 18, { tone: "mid", className: "pa-wood" }));
    const shanks = [];
    for (let i = 0; i < 88; i++) {
      const u = lerp(KEYS.u0, KEYS.u1, (i + 0.5) / 88);
      shanks.push(path3([w3(u, 262, 846), w3(u, 352, 852)]));
    }
    out.push(L(shanks.join(""), { tone: "mid" }));
    const heads = [];
    for (let i = 87; i >= 0; i--) {
      const u = lerp(KEYS.u0, KEYS.u1, (i + 0.5) / 88);
      heads.push(slab(u - 5.5, 348, u + 5.5, 372, 840, 46, { tone: "hi", className: "pa-felt-head" }));
    }
    out.push(heads.join(""));
    return out.join("");
  }

  // ── Legs, lyre and pedals ────────────────────────────────────────────────
  const LEGS = [[[70, 80], 0], [[1420, 80], 1], [[330, 1740], 2]];
  function leg([u, v]) {
    const [x, y] = fl([u, v]);
    const F = G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const out = [];
    out.push(S(G.solidOf([[0, 0.1], [6, 34, 1], [14, 38, 1], [26, 30, 1], [40, 0.1]], G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), P), { tone: "hi", className: "pa-brass" }));
    const prof = [[40, 46], [70, 50, 1], [110, 46, 1], [160, 40], [480, 52], [540, 60, 1], [580, 62, 1], [620, 62]];
    out.push(S(G.solidOf(prof, F, P), { tone: "hi", className: "pa-lacquer" }));
    out.push(L(G.arcOf(F, 160, 40, P) + G.arcOf(F, 480, 52, P), { tone: "lo" }));
    return out.join("");
  }
  function lyre() {
    const out = [];
    const u0 = 745;
    out.push(slab(u0 - 110, 400, u0 + 110, 470, 40, 80, { tone: "hi", className: "pa-lacquer" }, 0.8));
    for (const du of [-70, 70]) out.push(slab(u0 + du - 14, 418, u0 + du + 14, 452, 120, Z.caseBottom - 120, { tone: "hi", className: "pa-lacquer" }));
    for (const du of [-28, 0, 28]) out.push(slab(u0 + du - 30, 330, u0 + du + 30, 400, 72, 8, { tone: "hi", className: "pa-brass" }, 0.4));
    for (const du of [-40, 40]) {
      const a = w3(u0 + du, 470, 100), b = w3(u0 + du * 2.5, 820, Z.caseBottom);
      out.push(L(path3([a, b]), { tone: "hi" }), D([at(a), at(b)], { size: 0.9, tone: "mid" }));
    }
    return out.join("");
  }

  // ── Lid and fallboard: thin plates that turn on hinges, redrawn each frame ──
  const LID = [[0, 150], [0, 1600], ...tail.slice(1), ...bent, [1490, 380], [1490, 150]];
  const rotX = (p, [cy, cz], a) => {
    const ry = p[1] - cy, rz = p[2] - cz;
    return [p[0], cy + ry * Math.cos(a) - rz * Math.sin(a), cz + ry * Math.sin(a) + rz * Math.cos(a)];
  };
  const rotY = (p, [cx, cz], a) => {
    const rx = p[0] - cx, rz = p[2] - cz;
    return [cx + rx * Math.cos(a) + rz * Math.sin(a), p[1], cz - rx * Math.sin(a) + rz * Math.cos(a)];
  };
  function thinPlate(top, bottom, style) {
    // A plate given as two matching 3D rings. Draws the visible sides, then the visible face.
    const n = top.length;
    const c = top.reduce((s, p) => G.add3(s, p), [0, 0, 0]).map((v) => v / n);
    const nTop = G.unit3(G.sub3(top[0], bottom[0]));
    const faceUp = G.dot3(nTop, V) > 0;
    const face = faceUp ? top : bottom;
    const back = faceUp ? bottom : top;
    const parts = [];
    const fill = [k.pathOf(face.map(at), true)];
    const edges = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mid = G.lerp3(top[i], top[j], 0.5);
      const along = G.sub3(top[j], top[i]);
      let nrm = G.unit3(G.cross3(along, nTop));
      if (G.dot3(nrm, G.sub3(mid, c)) < 0) nrm = G.mul3(nrm, -1);
      if (G.dot3(nrm, V) <= 0) continue;
      const quad = [face[i], face[j], back[j], back[i]].map(at);
      fill.push(k.pathOf(quad, true));
      parts.push(`<path class="iso-shade" data-shade="${Math.min(3, G.toneOf(nrm, P))}" d="${k.pathOf(quad, true)}"/>`);
      edges.push(k.pathOf([back[i], back[j]].map(at)));
    }
    const faceTone = G.toneOf(faceUp ? nTop : G.mul3(nTop, -1), P);
    const cls = style.className ? ` ${style.className}` : "";
    return `<g class="iso-solid${cls}"><path class="iso-fill" d="${fill.join("")}"/>${parts.join("")}<path class="${faceTone >= 3 ? "iso-top" : "iso-shade"}"${faceTone >= 3 ? "" : ` data-shade="${faceTone}"`} d="${fill[0]}"/><path class="iso-line iso-edge" data-tone="${style.tone || "hi"}" d="${fill[0]}${edges.join("")}"/></g>`;
  }
  const HINGE = [W / 2, Z.rimTop];
  const lidTop = LID.map(([u, v]) => w3(u, v, Z.rimTop + 22));
  const lidBottom = LID.map(([u, v]) => w3(u, v, Z.rimTop));
  const PROP_BASE = (() => {
    const i = RIM_IN.findIndex((p) => p[1] < 1000 && p[0] > 1300 && p[1] > 700);
    const p = RIM_IN[i >= 0 ? i : RIM_IN.length - 6];
    return { uv: p, world: w3(p[0], p[1], Z.rimTop) };
  })();
  function lid(angle) {
    const a = -angle;
    const top = lidTop.map((p) => rotX(p, HINGE, a));
    const bottom = lidBottom.map((p) => rotX(p, HINGE, a));
    let out = thinPlate(top, bottom, { tone: "hi", className: "pa-lacquer" });
    // Hinges on the bass side.
    for (const v of [500, 1200]) out += S(k.cylinder(...fl([-6, v]), 9, Z.rimTop - 6, 30, P, 18), { tone: "hi", className: "pa-brass" });
    return out;
  }
  function prop(angle) {
    if (angle < 0.05) return "";
    const tip = rotX(w3(PROP_BASE.uv[0] - 30, PROP_BASE.uv[1] - 40, Z.rimTop), HINGE, -angle);
    const base = PROP_BASE.world;
    const d = G.sub3(tip, base);
    return S(G.disc(0, G.len3(d), 9, G.frameAlong(base, G.unit3(d)), P), { tone: "hi", className: "pa-lacquer" });
  }
  const FB = { u0: KEYS.u0, u1: KEYS.u1, v0: 8, v1: 150, z: Z.keybed + 110 };
  function fallboard(angle) {
    const hinge = [-FB.v1, FB.z];
    const ring = [[FB.u0, FB.v0], [FB.u1, FB.v0], [FB.u1, FB.v1], [FB.u0, FB.v1]];
    const top = ring.map(([u, v]) => rotY(w3(u, v, FB.z + 10), hinge, angle));
    const bottom = ring.map(([u, v]) => rotY(w3(u, v, FB.z), hinge, angle));
    return thinPlate(top, bottom, { tone: "hi", className: "pa-lacquer" });
  }

  // Music desk: a panel that closes the front above the keys, and leans back as a desk when opened.
  function desk(t) {
    const a = -1.95 * t;
    const hinge = [-150, Z.keybed + 110];
    const ring = [[45, 150], [W - 45, 150]];
    const h = Z.rimTop - (Z.keybed + 110);
    const top = [w3(ring[0][0], 150, hinge[1]), w3(ring[1][0], 150, hinge[1]), w3(ring[1][0], 150, hinge[1] + h), w3(ring[0][0], 150, hinge[1] + h)].map((p) => rotY(p, hinge, a));
    const bottom = top.map((p) => rotY(rotY(p, hinge, -a), [-150 + 18, hinge[1]], 0)).map((p) => rotY([p[0] - 18, p[1], p[2]], hinge, a));
    return thinPlate(top, bottom, { tone: "hi", className: "pa-lacquer" });
  }

  function floorHalo() {
    const ring = LID.map(([u, v]) => w3(u, v, 0));
    return `<path class="iso-halo" d="${path3(ring, true)}"/>`;
  }

  // Bounds of each layer, for framing every step.
  const BOX = {
    piano: [[0, 0, 0], [W, 1920, Z.rimTop + 22]],
    lidOpen: [[0, 150, Z.rimTop], [W, 1920, Z.rimTop + Math.sin(1.0) * W]],
    plate: [[45, 150, Z.plateBand[0]], [W - 45, 1880, Z.strut[1]]],
    strings: [[45, 150, STRING_Z.hitch], [W - 45, 1880, STRING_Z.pin + 10]],
    soundboard: [[40, SB_V, Z.sound - 9], [W - 40, 1880, STRING_Z.bridge + STRING_Z.over]],
    pinblock: [[45, 150, Z.pinblock[0]], [W - 45, 330, STRING_Z.pin + 8]],
    drawer: [[KEYS.u0, 0, Z.keybed], [KEYS.u1, 520, 890]],
  };
  const boxPoints = ([[u0, v0, z0], [u1, v1, z1]], [dx, dz] = [0, 0]) => {
    const out = [];
    for (const u of [u0, u1]) for (const v of [v0, v1]) for (const z of [z0, z1]) { const p = w3(u, v, z); out.push([p[0] + dx, p[1], p[2] + dz]); }
    return out;
  };

  return {
    W, Z, w3, fl, rim, caseFront, interior, soundboard, pinblock, strings, plate, drawer, leg, lyre, LEGS, lid, prop, fallboard, desk, floorHalo,
    BOX, boxPoints, KEYS, STRINGS, RIM_TOP: Z.rimTop,
  };
}
