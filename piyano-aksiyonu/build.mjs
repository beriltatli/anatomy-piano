import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = "/Users/beriltatli/.claude/skills/anatomy";
const k = await import(`${SKILL}/kit/iso-kit.mjs`);
const G = await import(`${SKILL}/kit/lathe.mjs`);
const { kitScript } = await import(`${SKILL}/scripts/inline-kit.mjs`);
import { makeModel } from "./model.mjs";
import { makeSim } from "./sim.mjs";
import { makeParts } from "./parts.mjs";
import { pianoFigure, PIANO_CSS } from "./fig-piano.mjs";

const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = 640;
const AZIMUTH = 72;
const ELEVATION = 22;

const M = makeModel();
const BASE = { x: -30, y: -58, w: 770, d: 92, r: 8 };
const FIT = [...k.boxCorners(BASE, -20, 0), [394, -44, 186], [706, -44, 186], [540, 9, M.stringZ + 0.5 + 22 + 6], [420, 0, 191], [0, 11.6, 40.6]];
const P0 = k.fitProjection(FIT, WIDTH, 2000, { pad: 16, azimuth: AZIMUTH, elevation: ELEVATION });
const fitYs = FIT.map((p) => k.iso(p, P0)[1]);
const HEIGHT = Math.ceil(Math.max(...fitYs) - Math.min(...fitYs) + 2 * 16 + 14);
const P = k.fitProjection(FIT, WIDTH, HEIGHT, { pad: 16, azimuth: AZIMUTH, elevation: ELEVATION });
const parts = makeParts(k, G, P, M);
const sim = makeSim(M);
const rest = sim.create();
const pose = parts.poseOf(rest, "key");

const layers = parts.LAYERS.map(([name, fn, moving]) => {
  if (name === "strings") return `<g data-layer="strings">${fn()}<g class="pa-sing" style="opacity:0">${fn().replace(/data-tone="hi"/g, 'data-tone="lit"')}</g></g>`;
  const cast = name === "plate" || name === "brackets" ? ' class="pa-cast"' : "";
  return moving ? `<g data-move="${name}">${fn(pose)}</g>` : `<g data-layer="${name}"${cast}>${fn()}</g>`;
});

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Kuyruklu piyanonun tek tuşluk aksiyon modeli, yandan izometrik görünüş: tuş, kapstan, vipen, jak, tekrar kolu, kaçış düğmesi, çekiç, yakalayıcı, susturucu ve döküm çerçeveye gerilmiş üç tel. Tuşa basınca jak çekici fırlatır, düğmeye değip kaçar, çekiç tele vurup geri seker, yakalayıcı onu tutar; tuş yarıya dönünce tekrar kolu çekici havada tutar ve jak yerine oturur.",
  body: layers,
});

const latheSource = readFileSync(join(SKILL, "kit", "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const latheScript = `const G = (() => {${latheSource}\nreturn { viewOf, scaleOf, frameAlong, frameOf, pointOf, disc, solidOf, prismOf, circleOf, arcOf, dot3, add3, sub3, mul3, unit3, cross3, len3, lerp3, toneOf, lightOf };})();\n`;
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");
const zoomPts = [[282, 14, 54], [282, 14, 16], [300, -24, 140], [394, -38, 186], [420, -4, 191], [540, 9, 208], [622, 5, 58], [600, 14, 46], [500, 11, 16]].map((p) => k.iso(p, P));
const zx = zoomPts.map((p) => p[0]);
const zy = zoomPts.map((p) => p[1]);
let ZOOM = [Math.min(...zx), Math.min(...zy), Math.max(...zx) - Math.min(...zx), Math.max(...zy) - Math.min(...zy)];
{
  const aspect = WIDTH / HEIGHT;
  const [x, y, w, h] = ZOOM;
  const W2 = Math.max(w, h * aspect) * 1.04;
  const H2 = W2 / aspect;
  ZOOM = [x + w / 2 - W2 / 2, y + h / 2 - H2 / 2, W2, H2].map((v) => +v.toFixed(1));
}
const live = readFileSync(join(HERE, "live.js"), "utf8").replace(/document\.querySelector\(/g, "ROOT.querySelector(").replace(/document\.querySelectorAll\(/g, "ROOT.querySelectorAll(").replace("__P__", JSON.stringify(P)).replace("__ZOOM__", JSON.stringify(ZOOM)).replace("__FULL__", JSON.stringify([0, 0, WIDTH, HEIGHT]));

const CSS = `
.pa-hole{fill:var(--anatomy-card)}
.iso .pa-cast{--anatomy-paper:#1a1917;--anatomy-face:#201f1c;--anatomy-top:#23221f;--anatomy-shade-0:#121110;--anatomy-shade-1:#151413;--anatomy-shade-2:#181715;--anatomy-shade-3:#1c1b18;--anatomy-mid:#6f6a61;--anatomy-lo:#47433d;--anatomy-faint:#302e2a}
.iso[data-theme="light"] .pa-cast{--anatomy-paper:#ebe8e1;--anatomy-face:#f0ede7;--anatomy-top:#f3f0ea;--anatomy-shade-0:#d5d1c8;--anatomy-shade-1:#dcd8d0;--anatomy-shade-2:#e2ded7;--anatomy-shade-3:#e7e4dd;--anatomy-mid:#8d887e;--anatomy-lo:#b3aea4;--anatomy-faint:#cdc8bf}
.iso-stage{overflow:hidden;border-radius:2px}
.iso-stage .iso-svg{overflow:hidden}
.pa-sing .iso-line{stroke-width:1.3}
.iso-stage{cursor:pointer;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px;border-radius:4px}
.pa-controls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0 0;font:12px/1 ui-sans-serif,system-ui,sans-serif;color:var(--anatomy-muted)}
.pa-controls button{font:inherit;color:var(--anatomy-text);background:transparent;border:1px solid var(--anatomy-faint, #ccc);border-radius:999px;padding:5px 11px;cursor:pointer}
.pa-controls button[aria-pressed="true"]{color:var(--anatomy-strong);border-color:var(--anatomy-mid)}
.pa-controls .pa-sep{flex:1}
`;

const keys = [
  { mark: "lit", label: "Parlayan parça: o an işi yapan (tuş → jak → çekiç → yakalayıcı → tekrar kolu → susturucu)" },
  { mark: "raised", label: "Aksiyon: tuş, kapstan, vipen, jak, tekrar kolu, çekiç, susturucu" },
  { mark: "flat", label: "Sabit: tuş çerçevesi, raylar, braketler, döküm çerçeve, teller" },
];
const r1 = (v) => v.toFixed(1).replace(".", ",");
const caption = `Şekil 1'deki klavyeden tek bir tuş: tek tuşluk kuyruklu piyano aksiyon modeli, C6 (1046,5 Hz), gerçek ölçüde milimetre ile ve 25 kat yavaş çekimle. Tuşun önü ${M.SPEC.dip} mm iner. Tuş denge pimi üzerinde döner, kapstan vipeni, vipen de jakı kaldırır; çekiç başı tuştan yaklaşık ${r1(M.ratio)} kat fazla yol alır. Tuş ${r1(M.dButton)} mm inince jakın ayağı kaçış düğmesine değer. ${r1(M.dLetoff)} mm'de jak çekiç topuzunun altından kayar ve çekiç tele ${M.SPEC.letoff} mm kala serbest kalır. Bu andan sonra sesi yalnızca çekicin hızı belirler: tele vurur, geri seker ve yakalayıcı onu telin ${M.SPEC.check} mm altında tutar. Tuş yarıya kadar dönünce tekrar kolu yayıyla çekici telin yaklaşık ${M.SPEC.letoff + M.SPEC.drop} mm altında havada tutar, jak topuzun altına geri oturur ve tuşu tamamen bırakmadan ikinci vuruş yapılabilir: çift kaçış budur. Susturucu tuş ${M.SPEC.damperAt} mm inince kalkar, tuş bırakılınca keçesiyle tele oturup sesi keser. Çekiç teli titreşen uzunluğun 1/8'inde vurur (${M.SPEC.speaking} mm'lik telde agraftan ${r1(M.SPEC.speaking / 8)} mm).`;

const controls = `<div class="pa-controls" role="group" aria-label="Vuruş gücü"><span>Vuruş:</span><button type="button" data-dyn="p" aria-pressed="false">p</button><button type="button" data-dyn="mf" aria-pressed="true">mf</button><button type="button" data-dyn="f" aria-pressed="false">f</button><span class="pa-sep"></span><button type="button" data-zoom aria-pressed="false">yakın plan</button><button type="button" data-sound aria-pressed="false">ses kapalı</button></div>`;

const piano = pianoFigure(k, G);
const body = `<style>${CSS}${PIANO_CSS}</style>` + piano.html + `<div style="height:48px"></div><section id="fig-action">` + k.plateHtml({
  fig: "Şekil 2",
  title: "Tek tuşun aksiyonu",
  hint: "Basılı tut · 1 2 3 vuruş gücü",
  readout: "dinlenme · tuşa basın",
  keys,
  caption,
  body: `<div class="iso-stage" tabindex="0" role="button" aria-pressed="false" aria-label="Piyano tuşu: figüre basılı tutun ya da boşluk tuşunu basılı tutun. 1, 2, 3 tuşları vuruş gücünü p, mf, f yapar.">${svg}<span class="pa-sr" role="status" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></span></div>${controls}`,
}) + `</section>`;

const themeScript = `try{const q=matchMedia("(prefers-color-scheme: dark)");if(q.matches&&!document.body.dataset.fixed)document.body.dataset.theme="dark";}catch(e){}\n`;
const page = k.pageHtml({
  title: "Kuyruklu piyano",
  theme,
  width: 760,
  body,
  script: themeScript + kitScript() + latheScript + strip("model.mjs") + strip("sim.mjs") + strip("parts.mjs") + `{\nconst ROOT = document.getElementById("fig-action");\n${live}\n}\n` + piano.script,
});
const name = process.argv.includes("--dark") ? "piyano-aksiyonu-koyu.html" : "piyano-aksiyonu.html";
writeFileSync(join(HERE, name), process.argv.includes("--dark") ? page.replace('<body class="iso" data-theme="dark">', '<body class="iso" data-theme="dark" data-fixed="1">') : page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, "scale", P.scale.toFixed(3));
