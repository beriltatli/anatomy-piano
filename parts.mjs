// Every part of the action model, in painter's order. Static parts are built once by the
// build script; moving parts are rebuilt each frame in the page from the same functions.

export function makeParts(k, G, P, M) {
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const FXZ = { o: [0, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] };
  const bar = (poly, y0, y1, style = {}) => S(G.prismOf(FXZ, poly, y0, y1, P), style);
  const box = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const xyz = ([x, z], y) => [x, y, z];
  const path = (points, closed = false) => k.pathOf(points.map(at), closed);
  const discY = ([x, z], r, y0, y1, style = {}) => S(G.disc(y0, y1, r, G.frameAlong([x, 0, z], [0, 1, 0]), P), style);
  const rod = (p0, p1, r, style = {}) => {
    const d = G.sub3(p1, p0);
    const len = G.len3(d);
    return S(G.disc(0, len, r, G.frameAlong(p0, G.unit3(d)), P), style);
  };
  const pin = ([x, z], y, r = 1.1) => S(G.disc(y, y + 0.5, r, G.frameAlong([x, 0, z], [0, 1, 0]), P), { tone: "lo", crease: "none" });
  const faceLine = (points, y, style) => L(path(points.map((p) => xyz(p, y))), style);
  const rotAll = (poly, f) => poly.map(f);
  const zig = (a, b, turns, width, y) => {
    const pts = [];
    const n = turns * 2;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * width;
      pts.push([a[0] + dx * t + nx * off, a[1] + dz * t + nz * off]);
    }
    return faceLine(pts, y, { tone: "mid" });
  };

  const area = (pts) => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  function clipConvex(subject, clip) {
    const c = area(clip) < 0 ? [...clip].reverse() : clip;
    let out = area(subject) < 0 ? [...subject].reverse() : subject;
    for (let i = 0; i < c.length && out.length; i++) {
      const a = c[i];
      const b = c[(i + 1) % c.length];
      const inside = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
      const cross = (p, q) => {
        const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
        const t = d1 / (d1 - d2);
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      };
      const input = out;
      out = [];
      for (let j = 0; j < input.length; j++) {
        const p = input[j];
        const q = input[(j + 1) % input.length];
        if (inside(q)) { if (!inside(p)) out.push(cross(p, q)); out.push(q); }
        else if (inside(p)) out.push(cross(p, q));
      }
    }
    return out;
  }

  // ── Fixed geometry ───────────────────────────────────────────────────────
  const BASE = { x: -30, y: -58, w: 770, d: 92, r: 8 };
  const RAIL_Y = [-24, 14];
  const PLATE_Y = [-44, -38];
  const SZ = M.stringZ;
  const STRINGS = [-3.6, 0, 3.6];
  const shankBottomAt = (x) => {
    const t = (x - M.H[0]) / Math.cos(M.REST);
    return M.onHammer([t, 0], M.REST)[1] - 3.2;
  };
  const REST_RAIL = { x0: 414, x1: 436 };
  const restTop = shankBottomAt((REST_RAIL.x0 + REST_RAIL.x1) / 2) - 2;
  const WIRE_Y = 7.5;
  const HEAD = { x0: 526, x1: 554, felt: SZ + M.STRING_R, block: SZ + M.STRING_R + 6, top: SZ + M.STRING_R + 22 };
  const GUIDE = { x0: 526, x1: 556, z0: 150, z1: 158 };
  const WIRE_BLOCK_TOP = 77;
  const BUTTON_X = M.TOE[0];

  function base() {
    const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -20, 20, P)}"/>`];
    const feet = k.corners(BASE, 24).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
    for (const [x, y] of feet) {
      out.push(S(k.cylinder(x, y, 9, -20, 2, P, 32), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 7, -18, 6, P, 32), { tone: "mid" }));
    }
    out.push(S(k.slabOf(BASE, -12, 12, P, 8, 1.6), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
    const screws = k.corners(BASE, 11);
    out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 18)).join(""), { tone: "lo" }));
    out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
    const strip = { x: 60, y: 24, w: 380, d: 6, r: 1 };
    out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 10, 5, strip.y + 0.8, 0.6, [1.8, 3.6], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    const label = { x: 600, y: 17, w: 96, d: 12, r: 1.4 };
    out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
    out.push(k.faceTextSvg(k.topMatrix([label.x + 6, label.y + 8.2], 0.8, P, "x"), "C6 · 1046,5 Hz · 1:1", { size: 4.4, tone: "lo" }));
    out.push(D([at([label.x + 3, label.y + 6, 0.8]), at([label.x + label.w - 3, label.y + 6, 0.8])], { size: 0.45 }));
    return out.join("");
  }

  // The cast-iron plate segment behind the strings, with its lightening holes.
  const PLATE_POLY = [[372, 0], [726, 0], [726, 170], [706, 186], [394, 186], [372, 168]];
  const HOLES = [[432, 74, 25], [514, 98, 31], [604, 86, 28], [682, 72, 21], [523, 160, 8.5], [571, 160, 8.5]];
  function plate() {
    const out = [bar(PLATE_POLY, PLATE_Y[0], PLATE_Y[1], { tone: "mid" })];
    const y = PLATE_Y[1];
    for (const [cx, cz, r] of HOLES) {
      const ring = Array.from({ length: 72 }, (_, i) => [cx + r * Math.cos((i / 72) * Math.PI * 2), cz + r * Math.sin((i / 72) * Math.PI * 2)]);
      const back = ring.map((p) => at(xyz(p, PLATE_Y[0])));
      const front = ring.map((p) => at(xyz(p, y)));
      // The bore wall fills the opening; where the back opening lines up with it you see through.
      const through = clipConvex(front, back);
      out.push(`<path class="iso-shade" data-shade="1" d="${k.pathOf(front, true)}"/>`);
      out.push(`<path class="pa-hole" d="${k.pathOf(through, true)}"/>`);
      out.push(L(k.pathOf(through, true), { tone: "faint" }));
      out.push(L(k.pathOf(front, true), { tone: "mid" }));
      if (r > 15) {
        const n = Math.round(r / 3.4);
        out.push(D(Array.from({ length: n }, (_, i) => at(xyz([cx + (r + 5) * Math.cos((i / n) * Math.PI * 2 + 0.3), cz + (r + 5) * Math.sin((i / n) * Math.PI * 2 + 0.3)], y))), { size: 0.42, tone: "lo" }));
      }
    }
    out.push(bar([[394, 180], [704, 180], [704, 186], [394, 186]], PLATE_Y[0], -30, { tone: "mid" }));
    out.push(D([400, 460, 520, 580, 640, 698].map((x) => at([x, -33, 186])), { size: 0.45 }));
    out.push(bar(box(372, 0, 726, 5), PLATE_Y[1], -32, { tone: "lo" }));
    out.push(D([384, 450, 530, 610, 690, 716].map((x) => at([x, -34, 5])), { size: 0.45 }));
    return out.join("");
  }

  const bolts = (pts, y) => D(pts.map((p) => at(xyz(p, y))), { size: 0.45, tone: "lo" });
  function brackets() {
    const y = [-30, -24];
    const out = [];
    out.push(bar(box(262, 0, 452, 7), y[0], y[1], { tone: "mid" }));
    out.push(bar([[280, 7], [318, 7], [314, 58], [284, 58]], y[0], y[1], { tone: "mid" }));
    out.push(bar([[328, 7], [376, 7], [394, 142], [334, 142]], y[0], y[1], { tone: "mid" }));
    out.push(L(path([[350, -24, 30], [366, -24, 30], [374, -24, 96], [352, -24, 96]].map(([x, yy, z]) => [x, yy, z]), true), { tone: "faint" }));
    out.push(bar([[404, 7], [440, 7], [437, 104], [410, 104]], y[0], y[1], { tone: "mid" }));
    out.push(bolts([[270, 3.5], [444, 3.5], [299, 12], [352, 12], [422, 12]], y[1]));
    out.push(bar(box(570, 0, 662, 7), y[0], y[1], { tone: "mid" }));
    out.push(bar([[596, 7], [634, 7], [632, 104], [598, 104]], y[0], y[1], { tone: "mid" }));
    out.push(bolts([[576, 3.5], [656, 3.5], [615, 12]], y[1]));
    return out.join("");
  }

  function keyFrame() {
    const out = [];
    const rail = (x0, x1, h) => bar(box(x0, 0, x1, h), -30, 18, { tone: "mid" });
    out.push(rail(14, 36, 4));
    out.push(S(k.cylinder(25, 0, 5.4, 4, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(25, 0, 1.5, 6, 9, P, 14), { tone: "hi", crease: "none" }));
    out.push(rail(230, 260, 14));
    out.push(S(k.cylinder(245, 0, 6.5, 14, 2, P, 28), { tone: "lo" }));
    out.push(rail(468, 500, 14));
    out.push(bar(box(468, 14, 500, 16), -30, 18, { tone: "lo" }));
    out.push(D([[25, 16], [245, 16], [484, 16]].map(([x]) => at([x, 15, x < 30 ? 4 : 14])), { size: 0.45 }));
    return out.join("");
  }

  // ── Moving parts ─────────────────────────────────────────────────────────
  const keyFn = (pose) => (p) => M.rot(p, M.KEY.balance, pose.alpha);
  function key(pose) {
    const f = keyFn(pose);
    const lit = pose.lit === "key";
    const out = [];
    out.push(bar(rotAll(box(0, 16, 50, 38), f), -11, 11, { tone: "hi" }));
    out.push(bar(rotAll(box(-1.6, 23, 0, 40.6), f), -11.6, 11.6, { tone: "hi", lit }));
    out.push(bar(rotAll(box(-1.6, 38, 50, 40.6), f), -11.6, 11.6, { tone: "hi", lit }));
    out.push(bar(rotAll(box(50, 16, 545, 38), f), -6, 6, { tone: "hi" }));
    out.push(bar(rotAll(box(50, 38, 150, 40.6), f), -6, 6, { tone: "hi", lit }));
    for (const x of [78, 106]) out.push(discY(f([x, 27]), 6.2, 5.9, 6.25, { tone: "mid" }));
    const mortise = [[241, -2], [249, -2], [249, 2], [241, 2]].map(([x, y]) => { const [rx, rz] = f([x, 38]); return [rx, y, rz]; });
    out.push(L(path(mortise, true), { tone: "lo" }));
    const capBase = f([M.CAPSTAN.x, M.KEY.top]);
    const axis = [-Math.sin(pose.alpha), 0, Math.cos(pose.alpha)];
    const CF = G.frameAlong([capBase[0], 0, capBase[1]], axis);
    out.push(S(G.solidOf([[0, 5.6], [1.4, 5.6], [1.4, 4.2], [7.6, 4.2], [8.6, 3.6, 1], [9.4, 2.4, 1], [10, 0, 1]], CF, P), { tone: "hi" }));
    out.push(L(G.arcOf(CF, 4.6, 4.2, P), { tone: "faint" }));
    return out.join("");
  }

  function backcheck(pose) {
    const f = keyFn(pose);
    const lit = pose.lit === "check";
    const F = M.CHECK_FACE;
    const dir = M.faceDir;
    const away = [dir[1], -dir[0]];
    const p = (s, t) => [F[0] + dir[0] * s + away[0] * t, F[1] + dir[1] * s + away[1] * t];
    const [s0, s1] = [M.CHECK_SPAN[0] - 1.5, M.CHECK_SPAN[1] + 2];
    const out = [];
    const wireTop = p(s0, 5.2);
    const wireBottom = [wireTop[0] - 2.5, M.KEY.top];
    out.push(rod(xyz(f(wireBottom), 0), xyz(f(wireTop), 0), 1.05, { tone: "hi" }));
    out.push(bar(rotAll([p(s0, 2.4), p(s1, 2.4), p(s1, 9.5), p(s0, 9.5)], f), -4.6, 4.6, { tone: "hi", lit }));
    out.push(bar(rotAll([p(s0 + 0.6, 0), p(s1 - 0.6, 0), p(s1, 2.4), p(s0, 2.4)], f), -4.6, 4.6, { tone: "hi", lit }));
    out.push(S(k.cylinder(f(wireBottom)[0], 0, 2.2, f(wireBottom)[1], 1.2, P, 16), { tone: "mid" }));
    return out.join("");
  }

  const wipFn = (pose) => (p) => M.onWippen(p, pose.psi);
  function wippen(pose) {
    const f = wipFn(pose);
    const out = [];
    out.push(bar(rotAll(box(331, 48, 343, 50.6), f), -4, 4, { tone: "mid" }));
    out.push(bar(rotAll(box(330, 50.6, 344, 58.4), f), -4.4, 4.4, { tone: "hi" }));
    out.push(bar(rotAll([[293, 57.6], [394, 59.6], [397, 64], [394, 70], [293, 68]], f), -5, 5, { tone: "hi" }));
    out.push(pin(M.W, 5));
    out.push(bar(rotAll([[340, 68.5], [350, 68.8], [349, 96], [341, 96]], f), -5, -1, { tone: "hi" }));
    out.push(bar(rotAll([[318, 67.8], [330, 68], [330, 84], [318, 84]], f), -5, -1, { tone: "hi" }));
    out.push(bar(rotAll(box(318, 84, 330, 86), f), -5, -1, { tone: "mid" }));
    out.push(pin(f([386, 65]), 5, 0.9));
    return out.join("");
  }

  const leverFn = (pose) => (p) => M.leverPoint(p, pose.psi, pose.mu);
  function lever(pose) {
    const f = leverFn(pose);
    const w = wipFn(pose);
    const lit = pose.lit === "lever";
    const out = [];
    out.push(rod(xyz(f([326, 86.4]), -3), xyz(f([326, 94]), -3), 1.2, { tone: "mid" }));
    out.push(bar(rotAll([[322, 94], [394, 94], [397, 97], [394, 100], [322, 100]], f), -6, -1, { tone: "hi", lit }));
    const top = f([326, 100]);
    out.push(S(G.disc(0, 1.3, 2.2, G.frameAlong(xyz(top, -3.5), [-Math.sin(pose.psi + pose.mu), 0, Math.cos(pose.psi + pose.mu)]), P), { tone: "mid" }));
    out.push(pin(f(M.Q), -1));
    // Repetition spring: coiled on the flange post, one arm on the wippen, one under the lever.
    const coil = w([345, 88]);
    const ring = Array.from({ length: 25 }, (_, i) => [coil[0] + 2.3 * Math.cos((i / 24) * Math.PI * 2), coil[1] + 2.3 * Math.sin((i / 24) * Math.PI * 2)]);
    out.push(faceLine(ring, -0.7, { tone: "mid" }));
    out.push(faceLine([[coil[0] + 2.3, coil[1]], f([371, 94])], -0.7, { tone: "mid" }));
    out.push(faceLine([[coil[0] - 1.6, coil[1] - 1.6], w([340.4, 74])], -0.7, { tone: "mid" }));
    return out.join("");
  }

  const jackFn = (pose) => (p) => M.jackPoint(p, pose.psi, pose.tau);
  function jack(pose) {
    const f = jackFn(pose);
    const w = wipFn(pose);
    const lit = pose.lit === "jack";
    const out = [];
    out.push(zig(w([362, 69.5]), f([362, 76.2]), 3, 1.3, 1.5));
    out.push(D([at(xyz(w([362, 69.5]), 1.5)), at(xyz(f([362, 76.2]), 1.5))], { size: 0.55, tone: "mid" }));
    out.push(bar(rotAll([[350, 76.4], [352.4, 79.6], [377, 78.2], [377.5, 71.6], [372, 70.6]], f), -1, 4, { tone: "hi", lit }));
    out.push(bar(rotAll([[374, 69.6], [381, 69.6], [387, 99.6], [381, 99.6]], f), -1, 4, { tone: "hi", lit }));
    out.push(pin(f(M.J), 4, 1));
    return out.join("");
  }

  function letoff() {
    const out = [];
    const y = 1.5;
    out.push(rod([BUTTON_X, y, M.BUTTON + 3], [BUTTON_X, y, 122], 1.1, { tone: "mid" }));
    out.push(S(k.cylinder(BUTTON_X, y, 4.2, M.BUTTON, 1.3, P, 24), { tone: "mid" }));
    out.push(S(k.cylinder(BUTTON_X, y, 4.2, M.BUTTON + 1.3, 2.2, P, 24), { tone: "hi" }));
    out.push(S(k.cylinder(BUTTON_X, y, 2.6, 117.5, 2.2, P, 6), { tone: "mid" }));
    return out.join("");
  }

  function restRail() {
    return bar(box(REST_RAIL.x0, restTop - 8, REST_RAIL.x1, restTop - 2), -24, 14, { tone: "mid" }) + bar(box(REST_RAIL.x0, restTop - 2, REST_RAIL.x1, restTop), -24, 14, { tone: "lo" });
  }

  const hamFn = (pose) => (p) => M.onHammer(p, pose.theta);
  function hammer(pose) {
    const f = hamFn(pose);
    const lit = pose.lit === "hammer";
    const out = [];
    const o = f([0, 0]);
    const SF = G.frameAlong(xyz(o, 0), [Math.cos(pose.theta), 0, Math.sin(pose.theta)]);
    out.push(S(G.solidOf([[4, 3.3], [119, 2.9]], SF, P), { tone: "hi" }));
    const kc = f(M.KNUCKLE.at);
    const KF = G.frameAlong(xyz(kc, 0), [0, 1, 0]);
    out.push(S(G.disc(-4, 4, M.KNUCKLE.r, KF, P), { tone: "hi" }));
    out.push(L(G.circleOf(KF, 4, M.KNUCKLE.r - 1.3, P, 28), { tone: "faint" }));
    out.push(bar(rotAll(M.TAIL, f), -4.8, 4.8, { tone: "hi" }));
    out.push(bar(rotAll([[118, -3.2], [138, -3.2], [139, 14], [117, 14]], f), -4.8, 4.8, { tone: "hi" }));
    const felt = [[115, 14], [141, 14], [140.2, 22], [138.2, 29], [135.4, 34.4], [131.8, 38.4], [128, 40], [124.2, 38.4], [120.6, 34.4], [117.8, 29], [115.8, 22]];
    const under = [[118.4, 14], [117.9, 22], [119.4, 27.6], [122, 32], [125, 34.6], [128, 35.4], [131, 34.6], [134, 32], [136.6, 27.6], [138.1, 22], [137.6, 14]];
    out.push(S(G.prismOf(FXZ, felt.map(f), -5.6, 5.6, P), { tone: "hi", lit, inner: faceLine(under.map(f), 5.6, { tone: "faint" }) }));
    out.push(D([at(xyz(f([128, 7]), 4.8))], { size: 0.5, tone: "lo" }));
    return out.join("");
  }

  function flange() {
    const out = [];
    out.push(rod([M.LEVER_AT_DROP[0], -3.5, M.DROP_TIP], [M.LEVER_AT_DROP[0], -3.5, 111], 1.15, { tone: "mid" }));
    out.push(bar(box(358, 110.5, 373, 128), -4.2, 4.2, { tone: "mid" }));
    out.push(pin(M.H, 4.2, 1.2));
    out.push(D([at([365.5, 4.2, 124])], { size: 0.5 }));
    return out.join("");
  }

  function flangeRail() {
    const out = [];
    out.push(bar(box(334, 122, 354, 136), -24, 14, { tone: "mid" }));
    out.push(bar(box(354, 128, 394, 142), -24, 14, { tone: "mid" }));
    out.push(D([[340, 129], [348, 129]].map(([x, z]) => at([x, 14, z])), { size: 0.45 }));
    out.push(D([[362, 139], [386, 139]].map(([x, z]) => at([x, 14, z])), { size: 0.45 }));
    return out.join("");
  }

  const underFn = (pose) => (p) => M.rot(p, M.U, pose.nu);
  function damperRails() {
    const out = [];
    out.push(bar(box(598, 46, 632, 57), -24, 14, { tone: "mid" }));
    out.push(bar(box(605, 57, 619, 70.5), -3, 3, { tone: "mid" }));
    return out.join("");
  }
  function underlever(pose) {
    const f = underFn(pose);
    const lit = pose.lit === "damper";
    const out = [];
    out.push(bar(rotAll(box(527, M.FELT_BOTTOM, 541, M.FELT_BOTTOM + 2), f), -4, 4, { tone: "mid" }));
    out.push(bar(rotAll(box(527, M.FELT_BOTTOM + 2, 541, 62), f), -4.4, 4.4, { tone: "hi", lit }));
    out.push(bar(rotAll([[524, 62], [616, 62], [619, 66], [616, 70], [524, 70]], f), -5, 5, { tone: "hi", lit }));
    out.push(pin(M.U, 5));
    out.push(bar(rotAll(box(533, 70, 547, WIRE_BLOCK_TOP), f), 3, 11.5, { tone: "hi" }));
    out.push(D([at(xyz(f([540, 73.5]), 11.5))], { size: 0.5, tone: "lo" }));
    return out.join("");
  }
  function stopRail() {
    return bar(box(566, 86, 600, 94), -24, 14, { tone: "mid" }) + bar(box(566, 84, 600, 86), -24, 14, { tone: "lo" });
  }
  function wireLower(pose) {
    const z0 = WIRE_BLOCK_TOP + pose.lift;
    return rod([M.WIRE_X, WIRE_Y, z0], [M.WIRE_X, WIRE_Y, GUIDE.z0], 1.0, { tone: "hi" });
  }
  function guide() {
    const out = [gusset(GUIDE.x0 + 4, GUIDE.z0, 12, 3), gusset(GUIDE.x1 - 4, GUIDE.z0, 12, 3), bar(box(GUIDE.x0, GUIDE.z0, GUIDE.x1, GUIDE.z1), PLATE_Y[1], 14, { tone: "mid" })];
    out.push(L(k.ring(M.WIRE_X, WIRE_Y, 2.4, GUIDE.z1, P, 24), { tone: "lo" }));
    out.push(D([at([GUIDE.x0 + 5, 14, 154]), at([GUIDE.x1 - 5, 14, 154])], { size: 0.45 }));
    return out.join("");
  }
  function damperHead(pose) {
    const lit = pose.lit === "damper";
    const dz = pose.lift;
    const out = [];
    out.push(rod([M.WIRE_X, WIRE_Y, GUIDE.z1], [M.WIRE_X, WIRE_Y, HEAD.block + dz], 1.0, { tone: "hi" }));
    out.push(bar([[HEAD.x0 + 2, HEAD.felt + dz], [HEAD.x1 - 2, HEAD.felt + dz], [HEAD.x1 - 1, HEAD.block + dz], [HEAD.x0 + 1, HEAD.block + dz]], -6, 6, { tone: "mid" }));
    out.push(bar(box(HEAD.x0, HEAD.block + dz, HEAD.x1, HEAD.top + dz), -9, 9, { tone: "hi", lit }));
    out.push(D([at([M.WIRE_X, 9, HEAD.block + 6 + dz])], { size: 0.5, tone: "lo" }));
    return out.join("");
  }

  // Strings: tuning pins and pin block in front, agraffe, speaking length, bridge, hitch pins.
  const PINS = [[408, -3.6], [420, 0], [432, 3.6]];
  const FYZ = (x) => ({ o: [x, 0, 0], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] });
  const gusset = (x, zTop, reach, t = 4) => S(G.prismOf(FYZ(x), [[PLATE_Y[1], zTop], [PLATE_Y[1] + reach, zTop], [PLATE_Y[1], zTop - reach]], -t / 2, t / 2, P), { tone: "mid" });
  function stringFrame() {
    const out = [];
    for (const x of [402, 444]) out.push(gusset(x, 152, 16));
    for (const x of [636, 696]) out.push(gusset(x, 150, 14));
    out.push(gusset(713, 166, 12));
    out.push(bar(box(394, 152, 452, 170), PLATE_Y[1], 12, { tone: "mid" }));
    out.push(L(path([[394, 12, 161], [452, 12, 161]]), { tone: "faint" }));
    out.push(bar(box(394, 170, 470, 172.5), PLATE_Y[1], 12, { tone: "lo" }));
    for (const [x, y] of PINS) {
      out.push(S(k.cylinder(x, y, 3.4, 172.5, 18, P, 24), { tone: "hi" }));
      out.push(L([SZ - 0.8, SZ + 0.6, SZ + 2].map((z) => k.sideArc(x, y, 3.6, z, P, 18)).join(""), { tone: "mid" }));
      out.push(L(k.lineOnTop([x - 2.2, y], [x + 2.2, y], 190.5, P), { tone: "lo" }));
    }
    out.push(bar(box(M.AGRAFFE - 3, 172.5, M.AGRAFFE + 3, SZ + 4), -6.5, 6.5, { tone: "hi" }));
    out.push(D(STRINGS.map((y) => at([M.AGRAFFE + 3, y, SZ])), { size: 0.55, tone: "lo" }));
    out.push(bar(box(628, 150, 704, 156), PLATE_Y[1], 12, { tone: "mid" }));
    out.push(L(path([[628, 12, 153], [704, 12, 153]]), { tone: "faint" }));
    out.push(bar([[M.BRIDGE - 7, 156], [M.BRIDGE + 7, 156], [M.BRIDGE + 4, SZ - M.STRING_R], [M.BRIDGE - 4, SZ - M.STRING_R]], -10, 10, { tone: "hi" }));
    out.push(D(STRINGS.flatMap((y) => [at([M.BRIDGE - 2, y + 1.2, SZ - 0.5]), at([M.BRIDGE + 2, y - 1.2, SZ - 0.5])]), { size: 0.45, tone: "lo" }));
    out.push(bar(box(700, 166, 726, 172), PLATE_Y[1], 10, { tone: "mid" }));
    for (const y of STRINGS) out.push(S(k.cylinder(714, y, 1.3, 172, 6, P, 12), { tone: "hi" }));
    out.push(bar(box(684, 172, 698, SZ - 0.6), -7, 7, { tone: "lo" }));
    return out.join("");
  }
  function strings() {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const y = STRINGS[i];
      const [px] = PINS[i];
      const d = path([[px + 3.4, y, SZ], [M.AGRAFFE - 3, y, SZ]]) + path([[M.AGRAFFE + 3, y, SZ], [M.BRIDGE - 2, y, SZ]]) + path([[M.BRIDGE + 2, y, SZ], [714 - 1.3, y, 175.5]]);
      out.push(L(d, { tone: "hi", className: "pa-string" }));
    }
    return out.join("");
  }

  function gauge() {
    const G0 = { x: 2, y: 14, w: 9, d: 6, r: 0.8 };
    const out = [S(k.slabOf(G0, 0, 46, P, 3, 0.4), { tone: "mid" })];
    const y = G0.y + G0.d;
    const ticks = { minor: "", major: "" };
    for (let i = 0; i <= 10; i++) {
      const z = 40.6 - i;
      const len = i % 5 === 0 ? 4.4 : 2.4;
      ticks[i % 5 === 0 ? "major" : "minor"] += path([[G0.x, y, z], [G0.x + len, y, z]]);
    }
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(L(path([[G0.x, y, 40.6], [G0.x + 4.4, y, 40.6]]), { tone: "hi" }));
    return out.join("");
  }

  const LAYERS = [
    ["base", base], ["plate", plate], ["brackets", brackets], ["keyframe", keyFrame],
    ["key", key, true], ["wippenRail", () => bar(box(286, 44, 312, 54), -24, 14, { tone: "mid" }) + bar(box(292, 54, 308, 66), -3, 3, { tone: "mid" }) + D([at([299, 14, 49])], { size: 0.45 })],
    ["damperRails", damperRails], ["underlever", underlever, true], ["stopRail", stopRail],
    ["wippen", wippen, true], ["lever", lever, true], ["jack", jack, true], ["letoff", letoff], ["restRail", restRail],
    ["hammer", hammer, true], ["backcheck", backcheck, true], ["flange", flange], ["flangeRail", flangeRail],
    ["wireLower", wireLower, true], ["guide", guide], ["stringFrame", stringFrame], ["strings", strings], ["damperHead", damperHead, true], ["gauge", gauge],
  ];

  const poseOf = (s, lit) => ({ alpha: M.keyAngle(s.d), psi: M.wippenAngle(s.d), tau: s.tau, mu: s.mu, theta: s.theta, nu: s.nu, lift: s.lift, lit });

  return { LAYERS, poseOf, BASE, PLATE_POLY, HEAD };
}
