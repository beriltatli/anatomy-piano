// Figure 1: the whole grand piano, closed, then opened and taken apart layer by layer.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makePiano } from "./piano.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const STEPS = [
  { name: "Dış görünüş", note: "kapak ve klavye kapağı kapalı · 1,92 m kuyruklu" },
  { name: "Kapaklar açık", note: "kapak 58° açık · klavye kapağı katlandı" },
  { name: "Döküm çerçeve", note: "dökme demir · yaklaşık 20 ton tel gerilimini taşır" },
  { name: "Teller", note: "88 nota · pesteki 20 nota bakır sargılı ve çapraz" },
  { name: "Ses tablosu ve köprüler", note: "9 mm ladin · köprü titreşimi tablaya verir" },
  { name: "Klavye ve aksiyon", note: "88 tuş · 88 çekiç · tek parça çekmece gibi çıkar" },
];

// Each moving layer: the step it leaves at, and how far it travels (world x, world z).
export const MOVES = {
  plate: { step: 2, by: [-260, 1500], delay: 0.25 },
  strings: { step: 3, by: [-130, 1000], delay: 0 },
  soundboard: { step: 4, by: [0, 520], delay: 0 },
  drawer: { step: 5, by: [640, 0], delay: 0 },
};
export const LID_OPEN = 1.01;
export const FALL_OPEN = -1.72;

export function pianoFigure(k, G) {
  const WIDTH = 640;
  const HEIGHT = 540;
  const AZ = -35;
  const EL = 25;
  const unit = { origin: [0, 0], scale: 1, azimuth: AZ, elevation: EL };
  const probe = makePiano(k, G, unit);
  const stepPoints = (step) => {
    const pts = [...probe.boxPoints(probe.BOX.piano)];
    if (step === 1) pts.push(...probe.boxPoints(probe.BOX.lidOpen));
    for (const [name, m] of Object.entries(MOVES)) {
      const box = probe.BOX[name];
      pts.push(...probe.boxPoints(box, step >= m.step ? m.by : [0, 0]));
    }
    return pts;
  };
  const all = [];
  for (let s = 0; s < STEPS.length; s++) all.push(...stepPoints(s));
  const P = k.fitProjection(all, WIDTH, HEIGHT, { pad: 20, azimuth: AZ, elevation: EL });
  const piano = makePiano(k, G, P);

  // A view box per step, so the camera frames what is on show.
  const aspect = WIDTH / HEIGHT;
  const VIEWS = STEPS.map((_, s) => {
    const pts = stepPoints(s).map((p) => k.iso(p, P));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys) + 24;
    const w = Math.max(x1 - x0, (y1 - y0) * aspect) * 1.08;
    const h = w / aspect;
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h].map((v) => +v.toFixed(1));
  });

  const g = (name, html, extra = "") => `<g data-pv="${name}"${extra}>${html}</g>`;
  const legs = piano.LEGS.map(([uv, i]) => g(`leg${i}`, piano.leg(uv)));
  const body = [
    `<defs><clipPath id="pv-out"><path data-pv-clip d="M-9999 -9999h1v1z"/></clipPath></defs>`,
    g("halo", piano.floorHalo()),
    `<g data-pv-root>`,
    ...legs,
    g("lyre", piano.lyre()),
    g("lid", ""),
    g("rimFar", piano.rim(false), ' class="pa-lacquer"'),
    g("caseFar", piano.caseFront(false), ' class="pa-lacquer"'),
    g("interior", piano.interior(), ' class="pa-lacquer"'),
    g("soundboard", piano.soundboard()),
    g("pinblock", piano.pinblock()),
    g("strings", piano.strings()),
    g("plate", piano.plate()),
    `<g data-pv="drawer" id="pv-drawer">${piano.drawer()}</g>`,
    g("rimNear", piano.rim(true), ' class="pa-lacquer"'),
    g("caseNear", piano.caseFront(true), ' class="pa-lacquer"'),
    g("fallboard", piano.fallboard(0)),
    g("desk", piano.desk(0)),
    `<g data-pv="drawerOut" clip-path="url(#pv-out)"><use href="#pv-drawer"/></g>`,
    g("prop", ""),
    `</g>`,
  ];
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "Bir kuyruklu piyano: önce kapalı, sonra kapağı açılmış ve katmanlarına ayrılmış. Döküm çerçeve en üste kalkar, altında teller, sonra ses tablosu ile köprüler ve pim bloğu; klavye ve aksiyon çekmece gibi öne çıkar. Kasa, ayaklar ve pedal lirı yerinde kalır.",
    body,
  });

  const buttons = STEPS.map((s, i) => `<button type="button" data-step="${i}" aria-pressed="${i === 0}"><span>${String(i).padStart(2, "0")}</span>${s.name}</button>`).join("");
  const html = `<section id="fig-piano">${k.plateHtml({
    fig: "Şekil 1",
    title: "Kuyruklu piyano · katman katman",
    hint: "← → ya da düğmeler",
    readout: `00 · ${STEPS[0].name} · ${STEPS[0].note}`,
    keys: [
      { mark: "raised", label: "Kasa (rim), ayaklar ve pedal lirı yerinde kalır; katmanlar yukarı kalkar, klavye öne çıkar" },
      { mark: "edge", label: "Bakır sargılı pes telleri tenor tellerinin üstünden çapraz geçer" },
    ],
    caption: "1,92 m'lik bir kuyruklu piyano, milimetre ölçüsüyle. En üstte dökme demir çerçeve var: yaklaşık 230 telin toplam 20 tona yaklaşan çekme kuvvetini taşır, ahşap kasa bu yükü tek başına taşıyamaz. Teller öndeki akort pimlerinden (pim bloğuna çakılı) agraflara, oradan köprünün üstünden arkadaki bağlama pimlerine gider. Köprü, telin titreşimini 9 mm'lik ladin ses tablosuna aktarır; asıl sesi yayan bu tabladır. Pesin 20 notası bakır sargılıdır ve uzunluk kazanmak için tenor tellerinin üstünden çapraz gerilir. Klavye ve aksiyon kasaya vidalı değildir: tek parça halinde çekmece gibi öne çekilip çıkarılır. Tek bir tuşun mekanizması Şekil 2'de.",
    body: `<div class="iso-stage pv-stage" tabindex="0" role="group" aria-label="Kuyruklu piyano katmanları. Sağ ve sol ok tuşları ya da alttaki düğmeler katmanları sırayla açar.">${svg}</div><div class="pa-controls pv-steps" role="group" aria-label="Katmanlar">${buttons}<a class="pv-link" href="#fig-action">Tek tuş → Şekil 2</a></div>`,
  })}</section>`;

  const live = readFileSync(join(HERE, "piano-live.js"), "utf8")
    .replace("__P__", JSON.stringify(P))
    .replace("__VIEWS__", JSON.stringify(VIEWS))
    .replace("__STEPS__", JSON.stringify(STEPS))
    .replace("__MOVES__", JSON.stringify(MOVES))
    .replace("__LID__", String(LID_OPEN))
    .replace("__FALL__", String(FALL_OPEN));
  const script = readFileSync(join(HERE, "piano.mjs"), "utf8").replace(/^export /gm, "") + `\n{\n${live}\n}\n`;
  return { html, script, VIEWS };
}

export const PIANO_CSS = `
.pv-steps{gap:6px}
@media (max-width:560px){#fig-piano .iso-plate-corner[data-corner="readout"]{white-space:normal;text-align:right;max-width:62%}}
.pv-steps button{display:inline-flex;gap:6px;align-items:center}
.pv-steps button span{font-family:var(--anatomy-mono);font-size:10px;color:var(--anatomy-muted)}
.pv-link{margin-left:auto;font-size:12px;color:var(--anatomy-text);text-decoration:none;border-bottom:1px solid var(--anatomy-faint, #ccc);padding:2px 0}
.pv-link:hover{color:var(--anatomy-strong)}
.pv-stage{cursor:default}
.iso .pa-lacquer{--anatomy-paper:#0d0d0e;--anatomy-face:#141416;--anatomy-top:#1b1b1e;--anatomy-shade-0:#060607;--anatomy-shade-1:#09090a;--anatomy-shade-2:#0d0d0f;--anatomy-shade-3:#121214;--anatomy-lit-top:#202024;--anatomy-lit-shade:#121214;--anatomy-hi:#8c8c92;--anatomy-mid:#55555a;--anatomy-lo:#3c3c40;--anatomy-faint:#26262a}
.iso[data-theme="light"] .pa-lacquer{--anatomy-paper:#1e1e21;--anatomy-face:#2a2a2e;--anatomy-top:#38383d;--anatomy-shade-0:#141416;--anatomy-shade-1:#19191c;--anatomy-shade-2:#202023;--anatomy-shade-3:#29292d;--anatomy-lit-top:#444449;--anatomy-lit-shade:#2a2a2e;--anatomy-hi:#050506;--anatomy-mid:#5c5c62;--anatomy-lo:#4a4a50;--anatomy-faint:#3a3a3f}
.iso .pa-gold{--anatomy-paper:#3a3020;--anatomy-face:#453a27;--anatomy-top:#4f432d;--anatomy-shade-0:#262015;--anatomy-shade-1:#2c2518;--anatomy-shade-2:#332a1c;--anatomy-shade-3:#3b3120;--anatomy-hi:#e0c88f;--anatomy-mid:#8f7c54;--anatomy-lo:#62553a;--anatomy-faint:#4a402c}
.iso[data-theme="light"] .pa-gold{--anatomy-paper:#e3cf98;--anatomy-face:#ead8a6;--anatomy-top:#efdfb2;--anatomy-shade-0:#c4ab6c;--anatomy-shade-1:#cdb579;--anatomy-shade-2:#d6c086;--anatomy-shade-3:#ddc891;--anatomy-hi:#5a4718;--anatomy-mid:#93783c;--anatomy-lo:#b39857;--anatomy-faint:#cfb877}
.iso .pa-spruce{--anatomy-paper:#2c2619;--anatomy-face:#342d1e;--anatomy-top:#3a3221;--anatomy-shade-0:#1f1a11;--anatomy-shade-1:#241e14;--anatomy-shade-2:#282217;--anatomy-shade-3:#2d261a;--anatomy-hi:#dccb9f;--anatomy-mid:#8a7b58;--anatomy-lo:#5a4f39;--anatomy-faint:#3f372a}
.iso[data-theme="light"] .pa-spruce{--anatomy-paper:#f1e3c2;--anatomy-face:#f5e9cd;--anatomy-top:#f7edd5;--anatomy-shade-0:#ddc89b;--anatomy-shade-1:#e3cfa6;--anatomy-shade-2:#e8d6b0;--anatomy-shade-3:#eddcba;--anatomy-hi:#5e4c2a;--anatomy-mid:#a48f62;--anatomy-lo:#c7b287;--anatomy-faint:#e2d1ab}
.iso .pa-wood{--anatomy-paper:#2a241b;--anatomy-face:#312a20;--anatomy-top:#372f23;--anatomy-shade-0:#1d1912;--anatomy-shade-1:#221d15;--anatomy-shade-2:#262118;--anatomy-shade-3:#2b251c;--anatomy-hi:#d6c3a0;--anatomy-mid:#857558;--anatomy-lo:#574c39;--anatomy-faint:#3e3628}
.iso[data-theme="light"] .pa-wood{--anatomy-paper:#e9dcc4;--anatomy-face:#efe4d0;--anatomy-top:#f3eadb;--anatomy-shade-0:#d2c1a1;--anatomy-shade-1:#d9c9ac;--anatomy-shade-2:#dfd0b6;--anatomy-shade-3:#e4d7c0;--anatomy-hi:#4e3f26;--anatomy-mid:#988462;--anatomy-lo:#bba98a;--anatomy-faint:#d6c7ab}
.iso .pa-ivory{--anatomy-paper:#d9d6cc;--anatomy-face:#e3e0d7;--anatomy-top:#ebe8df;--anatomy-shade-0:#aeaba1;--anatomy-shade-1:#b9b6ac;--anatomy-shade-2:#c4c1b7;--anatomy-shade-3:#cfccc2;--anatomy-hi:#2e2d2a;--anatomy-mid:#77746d;--anatomy-lo:#99968f;--anatomy-faint:#b8b5ad}
.iso[data-theme="light"] .pa-ivory{--anatomy-paper:#fbfaf6;--anatomy-face:#ffffff;--anatomy-top:#ffffff;--anatomy-shade-0:#dedbd2;--anatomy-shade-1:#e6e3db;--anatomy-shade-2:#eeebe4;--anatomy-shade-3:#f5f3ed;--anatomy-hi:#2a2a2c;--anatomy-mid:#8d8a84;--anatomy-lo:#b6b3ac;--anatomy-faint:#d6d3cc}
.iso .pa-brass{--anatomy-paper:#4a3a17;--anatomy-top:#6b5522;--anatomy-shade-0:#3a2d11;--anatomy-shade-1:#453614;--anatomy-shade-2:#544219;--anatomy-shade-3:#624d1e;--anatomy-hi:#e8cf86}
.iso[data-theme="light"] .pa-brass{--anatomy-paper:#d9b65c;--anatomy-top:#ecd38a;--anatomy-shade-0:#b08c35;--anatomy-shade-1:#bf9b43;--anatomy-shade-2:#cba84f;--anatomy-shade-3:#d6b65e;--anatomy-hi:#5b4410}
.iso .pa-felt-head{--anatomy-paper:#cfcabc;--anatomy-top:#ddd9cd;--anatomy-shade-0:#a7a397;--anatomy-shade-1:#b3afa3;--anatomy-shade-2:#bfbbaf;--anatomy-shade-3:#c9c5b9;--anatomy-hi:#3a3833}
.iso[data-theme="light"] .pa-felt-head{--anatomy-paper:#f3f0e8;--anatomy-top:#fbf9f3;--anatomy-shade-0:#d7d3c7;--anatomy-shade-1:#dfdbd0;--anatomy-shade-2:#e7e3d9;--anatomy-shade-3:#eeebe2;--anatomy-hi:#3a3833}
.iso .pa-copper{stroke:#d4925e}
.iso[data-theme="light"] .pa-copper{stroke:#a8642f}
.iso .pa-steel{stroke:#b9bcc2}
.iso[data-theme="light"] .pa-steel{stroke:#5f6268}
.iso .pa-felt{stroke:#c65a4e;stroke-width:2.2}
.iso[data-theme="light"] .pa-felt{stroke:#b3463b;stroke-width:2.2}
.iso .pa-goldline{stroke:#9c8550}
.iso[data-theme="light"] .pa-goldline{stroke:#b89a55}
[data-pv="lid"],[data-pv="prop"],[data-pv="desk"]{transition:opacity .45s var(--anatomy-ease)}
`;
