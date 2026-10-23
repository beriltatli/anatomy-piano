
const PROJ = __P__;
const KIT = { iso, pathOf, solidSvg, lineSvg, dotsSvg, cylinder, slabOf, ring, sideArc, lineOnTop, corners, depthOf, haloOf, planOutline, insetPlan, topTicks, topMatrix, faceTextSvg };
const MODEL = makeModel();
const SIM = makeSim(MODEL);
const PARTS = makeParts(KIT, G, PROJ, MODEL);
const SLOW = 25;
const SLOW_FAST = 220;
let slow = SLOW;
const H = 1e-4;

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const status = stage.querySelector(".pa-sr");
const sing = svg.querySelector(".pa-sing");
const movers = PARTS.LAYERS.filter(([, , moving]) => moving).map(([name, fn]) => ({ name, fn, el: svg.querySelector(`[data-move="${name}"]`), last: "" }));
const still = matchMedia("(prefers-reduced-motion: reduce)");
const dynButtons = [...document.querySelectorAll("[data-dyn]")];
const soundButton = document.querySelector("[data-sound]");
const zoomButton = document.querySelector("[data-zoom]");
const FULL = __FULL__, ZOOM = __ZOOM__;
let zoomed = false, zoomAt = 0, zoomFrame = 0, zoomFrom = FULL;
const viewNow = () => svg.getAttribute("viewBox").split(/[ ,]+/).map(Number);
function setZoom(on, instant = false) {
  zoomed = on;
  zoomButton.setAttribute("aria-pressed", on ? "true" : "false");
  zoomButton.textContent = on ? "tüm model" : "yakın plan";
  const to = on ? ZOOM : FULL;
  if (instant || still.matches) { svg.setAttribute("viewBox", to.join(" ")); return; }
  zoomFrom = viewNow();
  zoomAt = performance.now();
  cancelAnimationFrame(zoomFrame);
  const step = (now) => {
    const t = Math.min(1, (now - zoomAt) / 700);
    const e = 1 - Math.pow(1 - t, 3);
    svg.setAttribute("viewBox", zoomFrom.map((v, i) => (v + (to[i] - v) * e).toFixed(2)).join(" "));
    if (t < 1) zoomFrame = requestAnimationFrame(step);
  };
  zoomFrame = requestAnimationFrame(step);
}
zoomButton.addEventListener("click", () => setZoom(!zoomed));
setZoom(true, true);

let s = SIM.create();
let dyn = "mf";
let frame = 0, last = 0, visible = false;
let touring = !still.matches, tourClock = 0, tourStep = 0, idleTimer = 0, held = false, userStrike = false;
let pressAt = 0, lit = "key", litSince = 0, finishStroke = false;

// The idle tour, in physical seconds: strike, half release, repeat from there, full release.
const TOUR = [[0, 10, "mf"], [0.1, 5.4], [0.17, 10, "mf"], [0.27, 0], [0.62, null]];

const fmt = (v, n = 1) => v.toFixed(n).replace(".", ",");
const LIT = { rest: "key", press: "key", letoff: "jack", flight: "hammer", strike: "hammer", rebound: "hammer", fall: "hammer", check: "check", lever: "lever", drop: "lever", repeat: "jack", hold: "hammer", rise: "damper", damp: "damper" };
function textOf(st) {
  const ms = Math.max(0, (st.t - pressAt) * 1000);
  const gap = MODEL.stringZ - MODEL.STRING_R - MODEL.crown(st.theta)[1];
  switch (st.phase) {
    case "rest": return "dinlenme · tuşa basın";
    case "press": return `tuş iniyor · ${fmt(st.d)} mm · çekiç tele ${fmt(gap)} mm`;
    case "letoff": return `jak kaçış düğmesinde · tele ${fmt(gap)} mm`;
    case "flight": return `kaçış · çekiç serbest uçuşta · ${fmt(ms)} ms`;
    case "strike": return `tele vuruş · ${fmt(st.strikeSpeed, 2)} m/s · ${fmt(ms)} ms`;
    case "rebound": return `geri sekme · tele ${fmt(gap)} mm`;
    case "fall": return `çok yavaş: çekiç tele ulaşmadı · geri düşüyor`;
    case "check": return `yakalayıcı tuttu · tele ${fmt(gap)} mm`;
    case "lever": return `tekrar kolu çekici kaldırıyor · tele ${fmt(gap)} mm`;
    case "repeat": return `jak yerine oturdu · tekrara hazır · tuş ${fmt(st.d)} mm`;
    case "drop": return `çekiç tekrar kolunda · tele ${fmt(gap)} mm`;
    case "hold": return `tuş basılı · ${fmt(st.d)} mm`;
    case "rise": return st.lift > 0.2 ? `tuş dönüyor · susturucu ${fmt(st.lift)} mm yukarıda` : `tuş dönüyor · ${fmt(st.d)} mm`;
    case "damp": return "susturucu tele indi · ses kesiliyor";
    default: return "";
  }
}

let audio = null, soundOn = false, voice = null;
function ensureAudio() {
  if (audio) return audio;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  return audio;
}
function strikeSound(speed) {
  if (!soundOn || !userStrike) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  const level = Math.min(0.32, 0.05 + speed * 0.06);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(level * 0.35, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + 6);
  gain.connect(ctx.destination);
  const f0 = 1046.5;
  const oscs = [1, 2, 3, 4, 5].map((n) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f0 * n * Math.sqrt(1 + 0.0004 * n * n);
    g.gain.value = (n === 1 ? 1 : 0.5 / n) * Math.min(1, 0.4 + speed / 4);
    o.connect(g).connect(gain);
    o.start(now);
    o.stop(now + 6.2);
    return o;
  });
  if (voice) voice.gain.gain.cancelScheduledValues(now), voice.gain.gain.setTargetAtTime(0.0001, now, 0.01);
  voice = { gain, oscs };
}
function damp() {
  if (!voice || !audio) return;
  const now = audio.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setTargetAtTime(0.0001, now, 0.03);
  voice = null;
}

function render() {
  const phase = s.phase;
  const want = LIT[phase] || "hammer";
  if (want !== lit && s.t - litSince > 0.002) { lit = want; litSince = s.t; }
  const pose = PARTS.poseOf(s, lit);
  for (const m of movers) {
    const html = m.fn(pose);
    if (html !== m.last) { m.el.innerHTML = html; m.last = html; }
  }
  sing.style.opacity = Math.min(1, s.sound * 1.6).toFixed(3);
  const text = textOf(s) + (slow > 100 ? ` · ${Math.round(slow / 10) * 10}× yavaş` : "");
  if (readout.textContent !== text) readout.textContent = text;
}

let lastPhase = "rest", lastLift = 0;
function advance(hPhys) {
  const n = Math.max(1, Math.ceil(hPhys / H));
  const h = hPhys / n;
  for (let i = 0; i < n; i++) {
    if (finishStroke && s.d >= MODEL.SPEC.dip - 0.02) { finishStroke = false; if (!held) s.target = 0; }
    const strikes = s.struck;
    SIM.step(s, h);
    if (s.struck > strikes) strikeSound(s.strikeSpeed);
    if (lastLift > 0.25 && s.lift <= 0.25) damp();
    lastLift = s.lift;
  }
  if (s.phase !== lastPhase) {
    lastPhase = s.phase;
    if (["strike", "check", "repeat", "damp"].includes(s.phase)) status.textContent = textOf(s);
  }
  if (s.events.length > 40) s.events.splice(0, s.events.length - 20);
}

function tourTick(hPhys) {
  tourClock += hPhys;
  while (tourStep < TOUR.length && tourClock >= TOUR[tourStep][0]) {
    const [, target, d] = TOUR[tourStep];
    if (target === null) { tourClock = 0; tourStep = 0; continue; }
    if (target > s.d) pressAt = s.t;
    s.target = target;
    if (d) s.speed = SIM.SPEEDS[d];
    tourStep++;
  }
}

function settled() {
  return !touring && !held && !finishStroke && s.d === s.target && s.phase === "rest" && s.sound === 0;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const near = s.phase === "flight" || s.phase === "strike" || (s.phase === "letoff" && MODEL.jackShift(s.tau) > MODEL.ESCAPE * 0.82);
  const wantSlow = near && !still.matches ? SLOW_FAST : SLOW;
  slow += (wantSlow - slow) * (1 - Math.exp(-dt / (wantSlow > slow ? 0.05 : 0.25)));
  const hPhys = dt / slow;
  if (touring) tourTick(hPhys);
  advance(hPhys);
  render();
  const done = settled();
  if (done && !touring && !idleTimer && !still.matches) {
    // Resume the tour a while after the key has come to rest.
    idleTimer = setTimeout(() => { idleTimer = 0; touring = true; tourClock = 0; tourStep = 0; userStrike = false; run(); }, 5000);
  }
  frame = visible && !done ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

function press(down) {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = 0;
  held = down;
  if (down) {
    finishStroke = false;
    userStrike = true;
    if (soundOn) ensureAudio()?.resume?.();
    pressAt = s.t;
    s.speed = SIM.SPEEDS[dyn];
    s.target = MODEL.SPEC.dip;
  } else {
    // A quick tap still plays a whole keystroke: the finger lets go once the key reaches the keybed.
    if (s.target > 0 && s.d < MODEL.SPEC.dip - 0.05) finishStroke = true;
    else s.target = 0;
  }
  stage.setAttribute("aria-pressed", down ? "true" : "false");
  if (still.matches) { advance(down ? 0.12 : 0.6); render(); }
  run();
}

function setDyn(name) {
  dyn = name;
  for (const b of dynButtons) b.setAttribute("aria-pressed", b.dataset.dyn === name ? "true" : "false");
}
dynButtons.forEach((b) => b.addEventListener("click", () => setDyn(b.dataset.dyn)));
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
  soundButton.textContent = soundOn ? "ses açık" : "ses kapalı";
  if (soundOn) ensureAudio()?.resume?.();
});

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointerdown", (e) => { if (e.button > 0) return; stage.setPointerCapture?.(e.pointerId); press(true); });
stage.addEventListener("pointerup", () => press(false));
stage.addEventListener("pointercancel", () => press(false));
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) press(true); }
  if (e.key === "1") setDyn("p");
  if (e.key === "2") setDyn("mf");
  if (e.key === "3") setDyn("f");
});
stage.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") press(false); });
render();
