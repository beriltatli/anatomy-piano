// Grand piano action (double escapement), one key, in millimetres.
// x runs from the key front toward the strings, z is up from the keybed, y across the key.
// Every height that a technician regulates is solved here from the regulation spec,
// so the drawing and the motion share one set of numbers.

export function makeModel() {
  const rot = ([x, z], [cx, cz], a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [cx + (x - cx) * c - (z - cz) * s, cz + (x - cx) * s + (z - cz) * c];
  };
  const local = ([x, z], [ox, oz], a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [ox + x * c - z * s, oz + x * s + z * c];
  };
  const solve = (f, lo, hi, n = 60) => {
    let flo = f(lo);
    for (let i = 0; i < n; i++) {
      const mid = (lo + hi) / 2;
      const fm = f(mid);
      if (fm * flo > 0) { lo = mid; flo = fm; } else hi = mid;
    }
    return (lo + hi) / 2;
  };

  // Regulation spec (typical grand values).
  const SPEC = { dip: 10, letoff: 2, drop: 2, check: 15, blow: 48, damperAt: 5, strike: 1 / 8, speaking: 211 };

  // Key: balance pin at x 245, the key is a first-class lever.
  const KEY = { front: 0, head: 50, back: 545, bottom: 16, top: 38, balance: [245, 16] };
  const keyAngle = (d) => Math.asin(d / (KEY.balance[0] - KEY.front));
  const onKey = (p, d) => rot(p, KEY.balance, keyAngle(d));

  // Capstan on the key top, wippen heel resting on it.
  const CAPSTAN = { x: 337, r: 4.2, h: 10 };
  const capTop = (d) => onKey([CAPSTAN.x, KEY.top + CAPSTAN.h], d);

  const W = [300, 62];
  const HEEL = [CAPSTAN.x, KEY.top + CAPSTAN.h];
  const wippenAngle = (d) => {
    const z = capTop(d)[1];
    return solve((a) => rot(HEEL, W, a)[1] - z, -0.05, 0.3);
  };
  const onWippen = (p, psi) => rot(p, W, psi);

  // Jack: pivot on the wippen, tilt tau (positive: top escapes toward the key front).
  const J = [377, 72];
  const JACK_TOP = [384, 99.6];
  const TOE = [351.5, 79.4];
  const ESCAPE = 2.4;
  const jackPoint = (p, psi, tau) => onWippen(rot(p, J, tau), psi);
  const jackShift = (tau) => Math.hypot(JACK_TOP[0] - J[0], JACK_TOP[1] - J[1]) * Math.sin(tau);

  // Repetition lever: pivot on the wippen's flange post, relative angle mu (<= 0, stop at rest).
  const Q = [345, 97];
  const LEVER_TOP = 100;
  const LEVER_AT_KNUCKLE = [384, LEVER_TOP];
  const LEVER_AT_DROP = [361, LEVER_TOP];
  const leverPoint = (p, psi, mu) => onWippen(rot(p, Q, mu), psi);

  // Hammer: shank pivot H, angle theta (head up is positive). Local frame: shank along +x.
  const REST = -0.19;
  const KNUCKLE = { at: [19.9, -6.4], r: 4.5 };
  const CROWN = [128, 40];
  const knuckleOffset = local(KNUCKLE.at, [0, 0], REST);
  const H = [JACK_TOP[0] - knuckleOffset[0], LEVER_TOP + KNUCKLE.r - knuckleOffset[1]];
  const onHammer = (p, theta) => local(p, H, theta);
  const knuckleBottom = (theta) => onHammer(KNUCKLE.at, theta)[1] - KNUCKLE.r;
  const crown = (theta) => onHammer(CROWN, theta);
  const crownRest = crown(REST)[1];
  const STRING_R = 0.5;
  const stringZ = crownRest + SPEC.blow + STRING_R;
  const thetaAtCrown = (z) => solve((t) => crown(t)[1] - z, REST - 0.2, 0.8);
  const thetaAtKnuckle = (z) => solve((t) => knuckleBottom(t) - z, REST - 0.3, 0.8);
  const STRIKE = thetaAtCrown(stringZ - STRING_R);

  // Let-off: the jack slips off the knuckle when the crown is SPEC.letoff below the string.
  const thetaLetoff = thetaAtCrown(stringZ - STRING_R - SPEC.letoff);
  const jackTopZ = (psi, tau) => jackPoint(JACK_TOP, psi, tau)[1];
  const tauEscape = Math.asin(ESCAPE / Math.hypot(JACK_TOP[0] - J[0], JACK_TOP[1] - J[1]));
  const dLetoff = solve((d) => jackTopZ(wippenAngle(d), tauEscape) - knuckleBottom(thetaLetoff), 0, SPEC.dip);
  const BUTTON = jackPoint(TOE, wippenAngle(dLetoff), tauEscape)[1];
  const tauButton = (psi) => {
    if (jackPoint(TOE, psi, 0)[1] <= BUTTON) return 0;
    return solve((t) => jackPoint(TOE, psi, t)[1] - BUTTON, 0, 0.6);
  };
  const dButton = solve((d) => jackPoint(TOE, wippenAngle(d), 0)[1] - BUTTON, 0, SPEC.dip);

  // Drop screw: with the key down slowly, the hammer falls SPEC.drop after let-off onto the lever.
  const thetaDrop = thetaAtCrown(stringZ - STRING_R - SPEC.letoff - SPEC.drop);
  const psiLetoff = wippenAngle(dLetoff);
  const muDrop = solve((m) => leverPoint(LEVER_AT_KNUCKLE, psiLetoff, m)[1] - knuckleBottom(thetaDrop), -0.5, 0.2);
  const DROP_TIP = leverPoint(LEVER_AT_DROP, psiLetoff, muDrop)[1];
  const muDropAt = (psi) => {
    if (leverPoint(LEVER_AT_DROP, psi, 0)[1] <= DROP_TIP) return 0;
    return solve((m) => leverPoint(LEVER_AT_DROP, psi, m)[1] - DROP_TIP, -0.5, 0);
  };
  const muKnuckle = (psi, theta) => solve((m) => leverPoint(LEVER_AT_KNUCKLE, psi, m)[1] - knuckleBottom(theta), -0.6, 0.3);
  const leverTopAtKnuckle = (psi, mu) => leverPoint(LEVER_AT_KNUCKLE, psi, mu)[1];

  // Backcheck on the key's back end. Its felt face catches the hammer tail SPEC.check below the string.
  const TAIL = [[117, -3.2], [137, -3.2], [141.5, -12], [137.5, -19], [123, -17.5]];
  const TAIL_CHECK = [139.6, -15.5];
  const thetaCheck = thetaAtCrown(stringZ - STRING_R - SPEC.check);
  const keyFull = keyAngle(SPEC.dip);
  const CHECK_LEAN = 0.38;
  const checkAtFull = onHammer(TAIL_CHECK, thetaCheck);
  const CHECK_FACE = rot(checkAtFull, KEY.balance, -keyFull);
  const faceDir = [Math.sin(CHECK_LEAN), Math.cos(CHECK_LEAN)];
  const faceNormal = [-faceDir[1], faceDir[0]];
  const checkGap = (theta, d) => {
    const a = keyAngle(d);
    const p = rot(onHammer(TAIL_CHECK, theta), KEY.balance, -a);
    return (p[0] - CHECK_FACE[0]) * faceNormal[0] + (p[1] - CHECK_FACE[1]) * faceNormal[1];
  };
  const checkAlong = (theta, d) => {
    const p = rot(onHammer(TAIL_CHECK, theta), KEY.balance, -keyAngle(d));
    return (p[0] - CHECK_FACE[0]) * faceDir[0] + (p[1] - CHECK_FACE[1]) * faceDir[1];
  };
  const thetaCatch = (d) => solve((t) => checkGap(t, d), REST - 0.1, STRIKE);
  const CHECK_SPAN = [-8.5, 8];

  // Damper: underlever pivot U, the key's back end lifts it from half dip.
  const U = [612, 66];
  const LIFT_AT = 534;
  const keyTopAt = (x, d) => onKey([x, KEY.top], d)[1];
  const FELT_BOTTOM = keyTopAt(LIFT_AT, SPEC.damperAt);
  const underAngle = (d) => {
    const z = keyTopAt(LIFT_AT, d);
    if (z <= FELT_BOTTOM) return 0;
    return solve((a) => rot([LIFT_AT, FELT_BOTTOM], U, a)[1] - z, -0.3, 0);
  };
  const WIRE_X = 540;
  const WIRE_ATTACH = [WIRE_X, 70];
  const damperLift = (nu) => rot(WIRE_ATTACH, U, nu)[1] - WIRE_ATTACH[1];

  // Strings: strike point at 1/8 of the speaking length from the agraffe.
  const strikeX = crown(STRIKE)[0];
  const AGRAFFE = strikeX - SPEC.speaking * SPEC.strike;
  const BRIDGE = AGRAFFE + SPEC.speaking;

  // Hammer dynamics (SI-ish: mm, s).
  const HAMMER_G = 83;
  const REBOUND = 0.45;
  const crownRadius = Math.hypot(CROWN[0], CROWN[1]);

  const ratio = (crown(thetaLetoff)[1] - crownRest) / dLetoff;

  return {
    rot, local, solve, SPEC, KEY, keyAngle, onKey, CAPSTAN, capTop, W, HEEL, wippenAngle, onWippen,
    J, JACK_TOP, TOE, ESCAPE, jackPoint, jackShift, jackTopZ, tauEscape, tauButton, BUTTON, dButton, dLetoff,
    Q, LEVER_TOP, LEVER_AT_KNUCKLE, LEVER_AT_DROP, leverPoint, muDropAt, muKnuckle, leverTopAtKnuckle, DROP_TIP,
    REST, KNUCKLE, CROWN, H, onHammer, knuckleBottom, crown, crownRest, stringZ, STRING_R, thetaAtCrown, thetaAtKnuckle,
    STRIKE, thetaLetoff, thetaDrop, thetaCheck, TAIL, TAIL_CHECK, CHECK_FACE, CHECK_LEAN, faceDir, CHECK_SPAN, checkGap, checkAlong, thetaCatch,
    U, LIFT_AT, FELT_BOTTOM, underAngle, keyTopAt, WIRE_X, WIRE_ATTACH, damperLift, AGRAFFE, BRIDGE, strikeX,
    HAMMER_G, REBOUND, crownRadius, ratio,
  };
}
