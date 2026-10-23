# Grand Piano, Layer by Layer

An interactive isometric drawing of a grand piano. It starts closed, then the lid opens and the instrument comes apart one layer at a time. A second drawing shows the action of a single key in slow motion. Everything is in one HTML file, so you don't need a server, a library or an internet connection to open it.

The labels and captions on the page are in Turkish.

<p align="center">
  <img src="gorseller/katmanlar.gif" alt="The piano starts closed and comes apart into its layers" width="640">
</p>

## Contents

- [Getting started](#getting-started)
- [Figure 1: the piano, layer by layer](#figure-1-the-piano-layer-by-layer)
- [Figure 2: the action of one key](#figure-2-the-action-of-one-key)
- [The numbers](#the-numbers)
- [Project layout](#project-layout)
- [Building](#building)
- [Known limitations](#known-limitations)

## Getting started

Open `piyano-aksiyonu.html` in a browser. It follows your system's light or dark setting. To always get the dark version, open `piyano-aksiyonu-koyu.html` instead.

| Where | What to do |
|---|---|
| Figure 1 | Use the step buttons under the drawing or the **← →** keys to take the piano apart. **Home** and **End** jump to the first and last step. |
| Figure 2 | **Press and hold** on the drawing, or hold the **space bar**. Let go and the key comes back up. **1**, **2** and **3** set how hard you play: p, mf or f. |
| Figure 2 | **yakın plan / tüm model** switches between the close-up and the whole model. The **ses** button turns on the sound of the note (C6). |

If you leave the page alone, both figures play through on their own. With "reduce motion" turned on in your system settings they don't, and parts move straight to where they end up.

## Figure 1: the piano, layer by layer

The piano is a 1.92 m grand drawn to scale in millimetres. The case, legs and pedal lyre stay put while the layers above them lift off, and the keyboard and action slide out at the front like a drawer. At each step the view zooms to fit whatever is on show.

| | |
|:---:|:---:|
| <img src="gorseller/01-dis-gorunus.png" alt="The closed piano" width="380"><br>**00 · Closed**<br>Black lacquer case, turned legs, brass casters and the pedal lyre | <img src="gorseller/02-kapaklar-acik.png" alt="Lid open" width="380"><br>**01 · Lids open**<br>Lid up at 58°, fallboard folded back, music desk tipped back |
| <img src="gorseller/03-dokum-cerceve.png" alt="The cast-iron plate lifting off" width="380"><br>**02 · Cast-iron plate**<br>The gold-painted plate that takes nearly 20 tonnes of string tension | <img src="gorseller/04-teller.png" alt="The strings lifting off" width="380"><br>**03 · Strings**<br>88 notes. The bottom 20 are copper-wound and cross over the rest |
| <img src="gorseller/05-ses-tablosu.png" alt="The soundboard lifting off" width="380"><br>**04 · Soundboard and bridges**<br>A 9 mm spruce board, with the case bracing and the pinblock underneath | <img src="gorseller/06-klavye-aksiyon.png" alt="The keyboard sliding out" width="380"><br>**05 · Keyboard and action**<br>88 keys and 88 hammers come out together as one unit |

Each material has its own colour: black lacquer for the case, gold for the plate, pale spruce for the soundboard, maple for the bridges, pinblock and action, ivory for the keys, copper for the bass strings and red for the felt.

<p align="center">
  <img src="gorseller/10-koyu-tema.png" alt="The piano taken apart, dark theme" width="520"><br>
  <sub>Dark theme</sub>
</p>

## Figure 2: the action of one key

This is one key from the keyboard in Figure 1: a side view of a grand action with double escapement, for the note C6 (1046.5 Hz). It runs 25 times slower than real time. Between the jack letting go and the hammer hitting the string there's only about a millisecond, so that moment slows down further, to as much as 220 times. The line under the drawing tells you what's happening and how many real milliseconds have passed.

<p align="center">
  <img src="gorseller/aksiyon.gif" alt="The key goes down, the jack escapes, the hammer hits the string and the backcheck catches it" width="640">
</p>

| At rest | Hammer hits the string | Caught by the backcheck |
|:---:|:---:|:---:|
| <img src="gorseller/07-aksiyon-dinlenme.png" alt="The action at rest" width="250"> | <img src="gorseller/08-aksiyon-vurus.png" alt="The hammer hitting the string" width="250"> | <img src="gorseller/09-aksiyon-yakalayici.png" alt="The backcheck holding the hammer" width="250"> |

Whichever part is doing the work at that moment gets a dark outline. A keystroke goes like this:

1. **Key goes down.** The key pivots on its balance pin. The capstan lifts the wippen, the wippen lifts the jack, and the jack pushes the hammer up.
2. **Jack meets the let-off button.** The jack's toe touches the button and the jack starts to tip.
3. **Escapement.** The jack slips out from under the hammer's knuckle. The hammer is now 2 mm from the string, and from here on it travels under its own momentum.
4. **Strike and rebound.** The hammer hits the string one eighth of the way along its speaking length and bounces back.
5. **Check.** As long as you hold the key down, the backcheck catches the hammer 15 mm below the string.
6. **Repetition.** Let the key rise about halfway and the repetition lever's spring holds the hammer up while the jack drops back under the knuckle. You can play the note again without letting the key all the way up. That is what double escapement means.
7. **Damper.** When you let go, the damper felt comes down on the string and the note stops.

Press slowly enough and the hammer falls back before it reaches the string, just as it does on a real piano.

## The numbers

The motion in Figure 2 comes from a kinematic model (`model.mjs`) with a small physics simulation on top of it (`sim.mjs`). The positions of the let-off button, the drop screw, the backcheck and the damper aren't drawn by eye. They are worked out from the regulation measurements a piano technician would use.

| Measurement | Value |
|---|---|
| Key dip | 10 mm |
| Jack toe reaches the let-off button | at 4.4 mm of key travel |
| Let-off | at 8.8 mm, with the hammer 2 mm from the string |
| Drop | 2 mm |
| Checking distance | 15 mm below the string |
| Blow distance | 48 mm |
| Action ratio | about 5.2 |
| Damper starts to lift | at 5 mm |
| Strike point | 1/8 of the speaking length (26.4 mm on a 211 mm string) |
| Hammer speed at the string | p 0.8 m/s · mf 1.9 m/s · f 4.2 m/s |

The figures in Figure 1 are typical for a grand: around 230 strings, close to 20 tonnes of tension in total, a 9 mm spruce soundboard, 88 keys and 88 hammers.

## Project layout

```
anatomy-piano/
├── piyano-aksiyonu.html        the built page (follows the system theme)
├── piyano-aksiyonu-koyu.html   the built page (always dark)
├── build.mjs                   builds the page: both figures, the styles and the live code
├── fig-piano.mjs               Figure 1: steps, layer movements, camera framing, material colours
├── piano.mjs                   piano geometry: case, lid, plate, strings, soundboard, keyboard, legs
├── piano-live.js               Figure 1 in the browser: motion and drawing order
├── model.mjs                   single-key kinematics and the regulation maths
├── sim.mjs                     simulation of the key, jack, repetition lever, hammer, backcheck and damper
├── parts.mjs                   the parts of Figure 2
├── live.js                     Figure 2 in the browser: motion, sound and input
└── gorseller/                  the screenshots and animations used in this README
```

## Building

After changing the code, rebuild the pages:

```sh
node build.mjs          # piyano-aksiyonu.html
node build.mjs --dark   # piyano-aksiyonu-koyu.html
```

You'll need:

- Node.js 18 or later.
- The drawing kit from the **anatomy** skill for Claude Code. Its path is set in the `SKILL` constant at the top of `build.mjs` (`~/.claude/skills/anatomy`). If the kit lives somewhere else, change that line.

The kit is only needed to build. The finished HTML has everything it needs baked in.

## Known limitations

- **Layer direction.** The layers in Figure 1 don't lift straight up. They move up and slightly towards the tail, so they don't hide each other.
- **Lid.** The lid fades out as the plate starts to lift. Left open, it would sit right where the plate and strings rise.
- **Dampers.** Figure 1 leaves them out. You can see a damper in Figure 2.
- **Repetition lever.** In Figure 2 it's moved sideways, behind the jack, so the jack stays visible. In a real action the jack passes through a slot in the middle of the lever.
- **Drawing order.** Which part is drawn in front of which was set by hand and checked against screenshots of the main poses. The kit's automatic depth check wasn't run on these drawings.
- **Sound.** The note is a simple synthesised tone, not a recording of a piano.
