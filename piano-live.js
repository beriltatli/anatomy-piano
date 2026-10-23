const ROOT = document.getElementById("fig-piano");
const PP = __P__;
const VIEWS = __VIEWS__;
const STEPS = __STEPS__;
const MOVES = __MOVES__;
const LID_OPEN = __LID__;
const FALL_OPEN = __FALL__;
const KIT = { iso, pathOf, solidSvg, lineSvg, dotsSvg, extrude, cylinder, translateAlong };
const PIANO = makePiano(KIT, G, PP);
const stage = ROOT.querySelector(".pv-stage");
const svg = stage.querySelector("svg");
const rootG = svg.querySelector("[data-pv-root]");
const readout = ROOT.querySelector("[data-readout]");
const buttons = [...ROOT.querySelectorAll("[data-step]")];
const clip = svg.querySelector("[data-pv-clip]");
const el = (name) => svg.querySelector(`[data-pv="${name}"]`);
const N = {};
for (const node of rootG.children) N[node.dataset.pv] = node;
const still = matchMedia("(prefers-reduced-motion: reduce)");

let step = 0;
let shares = Object.fromEntries(Object.keys(MOVES).map((n) => [n, 0]));
let since = Object.fromEntries(Object.keys(MOVES).map((n) => [n, 0]));
let lidA = 0, fallA = 0, lidFade = 1, view = VIEWS[0].slice();
let frame = 0, last = 0, visible = false, touring = !still.matches, tourClock = 0, idle = 0;
let lastLid = -1, lastFall = -1, lastOrder = "";

const ease = (x, target, dt, tau) => (still.matches ? target : x + (target - x) * (1 - Math.exp(-dt / tau)));
const offsetOf = (name) => {
  const m = MOVES[name];
  const s = shares[name];
  const e = s * s * (3 - 2 * s);
  return [m.by[0] * e, m.by[1] * e];
};
const BOTTOM = { plate: PIANO.Z.plateBand[0], strings: 902, soundboard: PIANO.Z.sound - 9 };

function setStep(n, user = true) {
  step = Math.max(0, Math.min(STEPS.length - 1, n));
  for (const b of buttons) b.setAttribute("aria-pressed", String(+b.dataset.step === step));
  if (user) { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; tourClock = 0; run(); }, 9000); }
  run();
}

function render() {
  for (const name of Object.keys(MOVES)) {
    const [dx, dz] = offsetOf(name);
    N[name].setAttribute("transform", translateAlong(PP, [dx, 0, dz]));
  }
  if (Math.abs(lidA - lastLid) > 1e-4) {
    N.lid.innerHTML = lidA > 0.002 || lidFade > 0 ? PIANO.lid(lidA) : "";
    N.prop.innerHTML = PIANO.prop(lidA);
    lastLid = lidA;
  }
  N.lid.style.opacity = lidFade.toFixed(3);
  N.prop.style.opacity = lidFade.toFixed(3);
  if (Math.abs(fallA - lastFall) > 1e-4) { N.fallboard.innerHTML = PIANO.fallboard(fallA); N.desk.innerHTML = PIANO.desk(fallA / FALL_OPEN); lastFall = fallA; }
  N.desk.style.opacity = lidFade.toFixed(3);

  // The part of the drawer that has left the case is drawn again over the case front.
  const [ddx] = offsetOf("drawer");
  if (ddx > 1) {
    const x0 = Math.max(0, -520 + ddx), x1 = ddx;
    const pts = [];
    for (const x of [x0, x1]) for (const y of [PIANO.W / 2 - PIANO.KEYS.u0, PIANO.W / 2 - PIANO.KEYS.u1]) for (const z of [PIANO.Z.keybed - 2, 892]) pts.push(iso([x, y, z], PP));
    clip.setAttribute("d", pathOf(hull(pts), true));
  } else clip.setAttribute("d", "M-9999 -9999h1v1z");

  // Painter's order: anything lifted clear of the rim is drawn after the near walls, lowest first.
  const inside = [], high = [];
  for (const name of ["soundboard", "strings", "plate"]) {
    const bottom = BOTTOM[name] + offsetOf(name)[1];
    (bottom > PIANO.RIM_TOP + 1 ? high : inside).push([bottom, name]);
  }
  inside.sort((a, b) => a[0] - b[0]);
  high.sort((a, b) => a[0] - b[0]);
  const lidBack = lidA > 0.01;
  const order = [
    "leg2", "leg0", "lyre", "leg1", ...(lidBack ? ["lid"] : []), "rimFar", "caseFar", "interior",
    "pinblock", ...inside.map((p) => p[1]), "drawer", "rimNear", "caseNear", "fallboard", "desk", "drawerOut",
    ...high.map((p) => p[1]), "prop", ...(lidBack ? [] : ["lid"]),
  ];
  const sig = order.join(",");
  if (sig !== lastOrder) { for (const name of order) rootG.appendChild(N[name]); lastOrder = sig; }

  svg.setAttribute("viewBox", view.map((v) => v.toFixed(1)).join(" "));
  const apart = Object.keys(MOVES).some((n) => step >= MOVES[n].step && shares[n] < 0.98);
  const together = Object.keys(MOVES).some((n) => step < MOVES[n].step && shares[n] > 0.02);
  const state = apart ? "ayrılıyor…" : together ? "toplanıyor…" : STEPS[step].note;
  const text = `${String(step).padStart(2, "0")} · ${STEPS[step].name} · ${state}`;
  if (readout.textContent !== text) readout.textContent = text;
}

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    tourClock += dt;
    if (tourClock > 2.8) { tourClock = 0; setStep(step >= STEPS.length - 1 ? 0 : step + 1, false); }
  }
  for (const name of Object.keys(MOVES)) {
    const m = MOVES[name];
    const want = step >= m.step ? 1 : 0;
    since[name] = want === 1 && shares[name] < 1 ? since[name] + dt : 0;
    if (want === 1 && since[name] < m.delay && !still.matches) continue;
    shares[name] = ease(shares[name], want, dt, 0.32);
    if (Math.abs(shares[name] - want) < 1e-3) shares[name] = want;
  }
  lidA = ease(lidA, step >= 1 ? LID_OPEN : 0, dt, 0.35);
  fallA = ease(fallA, step >= 1 ? FALL_OPEN : 0, dt, 0.3);
  lidFade = ease(lidFade, step >= 2 ? 0 : 1, dt, 0.12);
  if (Math.abs(lidA - (step >= 1 ? LID_OPEN : 0)) < 1e-3) lidA = step >= 1 ? LID_OPEN : 0;
  if (Math.abs(fallA - (step >= 1 ? FALL_OPEN : 0)) < 1e-3) fallA = step >= 1 ? FALL_OPEN : 0;
  if (lidFade < 0.002) lidFade = 0;
  if (lidFade > 0.998) lidFade = 1;
  const target = VIEWS[step];
  view = view.map((v, i) => ease(v, target[i], dt, 0.4));
  render();
  const settled = !touring && view.every((v, i) => Math.abs(v - target[i]) < 0.05) && Object.keys(MOVES).every((n) => shares[n] === (step >= MOVES[n].step ? 1 : 0)) && (lidA === 0 || lidA === LID_OPEN) && (fallA === 0 || fallA === FALL_OPEN) && (lidFade === 0 || lidFade === 1);
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

buttons.forEach((b) => b.addEventListener("click", () => setStep(+b.dataset.step)));
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { e.preventDefault(); setStep(step + 1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); setStep(step - 1); }
  if (e.key === "Home") setStep(0);
  if (e.key === "End") setStep(STEPS.length - 1);
});
stage.addEventListener("pointerdown", () => { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; run(); }, 9000); });
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
render();
