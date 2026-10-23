// One key's action in physical time (mm, s). The finger sets a target dip and a speed;
// everything else follows from contacts: capstan, jack, repetition lever, string, backcheck, damper.

export function makeSim(M) {
  const SPEEDS = { p: 160, mf: 360, f: 720 };
  const RELEASE = 190;
  const LEVER_LIFT = 1.6;
  const LEVER_DAMP = 40;
  const JACK_RATE = 40;
  const DAMPER_FALL = 160;
  const RELEASE_CHECK = 0.9;

  function create() {
    return {
      t: 0, d: 0, target: 0, speed: SPEEDS.mf, vd: 0,
      theta: M.REST, omega: 0, tau: 0, mu: 0, nu: 0, lift: 0,
      caught: false, catchD: 0, supportPrev: M.REST,
      sound: 0, struck: 0, strikeSpeed: 0, strikeAt: -1, escapedAt: -1, lastEscape: -1, phase: "rest", events: [],
    };
  }

  // The jack is a rigid support; the repetition lever is a spring a little stronger than the hammer's weight.
  const jackSupport = (s, psi) => (Math.abs(M.jackShift(s.tau)) < M.ESCAPE ? M.thetaAtKnuckle(M.jackTopZ(psi, s.tau)) : -Infinity);
  const leverFree = (psi) => M.thetaAtKnuckle(M.leverTopAtKnuckle(psi, Math.min(0, M.muDropAt(psi))));

  function step(s, h) {
    s.t += h;
    // Finger: constant speed toward the target, eased over the last half millimetre.
    const want = s.target - s.d;
    const speed = want > 0 ? s.speed : RELEASE;
    const v = Math.sign(want) * Math.min(speed, (Math.abs(want) / 0.5) * speed);
    s.vd = v;
    s.d = Math.max(0, Math.min(M.SPEC.dip, s.d + v * h));
    const psi = M.wippenAngle(s.d);

    const wasEngaged = Math.abs(M.jackShift(s.tau)) < M.ESCAPE;
    // Jack: the let-off button tilts it; its spring returns it under the knuckle when there is room.
    const tauButton = M.tauButton(psi);
    if (s.tau < tauButton) s.tau = tauButton;
    else if (s.tau > tauButton) {
      const next = Math.max(tauButton, s.tau - JACK_RATE * h);
      const engagedNow = Math.abs(M.jackShift(s.tau)) < M.ESCAPE;
      const room = M.knuckleBottom(s.theta) - Math.max(M.jackTopZ(psi, next), M.jackTopZ(psi, 0));
      if (engagedNow || room > 0.05) s.tau = next;
    }

    // Hammer: gravity, the lever spring below its free height, the jack, the string and the backcheck.
    const thetaLever = leverFree(psi);
    if (!s.caught) {
      let accel = -M.HAMMER_G * Math.cos(s.theta);
      if (s.theta < thetaLever) accel += LEVER_LIFT * M.HAMMER_G - LEVER_DAMP * Math.min(0, s.omega) - 8 * s.omega;
      s.omega += accel * h;
      s.theta += s.omega * h;
      if (s.theta < thetaLever && s.theta > thetaLever - 0.002 && Math.abs(s.omega) < 0.05) { s.theta = thetaLever; s.omega = 0; }
    }
    const sup = jackSupport(s, psi);
    const supRate = (sup - s.supportPrev) / h;
    s.supportPrev = sup;
    if (!s.caught && s.theta < sup) {
      s.theta = sup;
      s.omega = Math.max(0, Math.min(supRate, 80));
    }
    const muTop = Math.min(0, M.muDropAt(psi));
    s.mu = s.theta < thetaLever ? Math.min(muTop, M.muKnuckle(psi, s.theta)) : muTop;
    if (wasEngaged && Math.abs(M.jackShift(s.tau)) >= M.ESCAPE && s.escapedAt < 0) {
      s.escapedAt = s.t;
      s.lastEscape = s.t;
      s.flying = true;
      s.events.push({ t: s.t, type: "escape" });
    }
    if (s.theta >= M.STRIKE) {
      s.theta = M.STRIKE;
      if (s.omega > 0) {
        s.strikeSpeed = (s.omega * M.crownRadius) / 1000;
        s.strikeAt = s.t;
        s.struck += 1;
        s.armed = true;
        s.flying = false;
        s.sound = Math.max(s.sound, Math.min(1, s.strikeSpeed / 4.5));
        s.events.push({ t: s.t, type: "strike", speed: s.strikeSpeed });
        s.omega = -M.REBOUND * s.omega;
      }
    }
    if (s.omega < 0) s.flying = false;
    if (!s.caught && s.omega < 0 && s.d > 1) {
      const thetaC = M.thetaCatch(s.d);
      const along = M.checkAlong(thetaC, s.d);
      if (s.theta <= thetaC && thetaC > Math.max(sup, M.REST - 0.1) && along > M.CHECK_SPAN[0] && along < M.CHECK_SPAN[1]) {
        s.caught = true;
        s.catchD = s.d;
        s.theta = thetaC;
        s.omega = 0;
        s.events.push({ t: s.t, type: "check" });
      }
    }
    if (s.caught) {
      const thetaC = M.thetaCatch(s.d);
      s.catchD = Math.max(s.catchD, s.d);
      if (s.catchD - s.d > RELEASE_CHECK || thetaC < sup) {
        s.caught = false;
        s.omega = 0;
        s.events.push({ t: s.t, type: "release" });
      } else s.theta = Math.max(thetaC, sup);
    }
    if (s.escapedAt >= 0 && Math.abs(M.jackShift(s.tau)) < M.ESCAPE * 0.98) s.escapedAt = -1;

    // Damper: lifted by the key's back end, falls under its own weight.
    const nuKey = M.underAngle(s.d);
    if (nuKey <= s.nu) s.nu = nuKey;
    else {
      const liftNow = M.damperLift(s.nu);
      const liftKey = M.damperLift(nuKey);
      const next = Math.max(liftKey, liftNow - DAMPER_FALL * h);
      s.nu = M.solve((a) => M.damperLift(a) - next, -0.3, 0.001);
      if (liftKey <= 0 && next <= 0) s.nu = 0;
    }
    s.lift = M.damperLift(s.nu);

    // Sound: a long decay while the damper is up, a quick one once its felt is back on the strings.
    const tauSound = s.lift > 0.25 ? 2.8 : 0.12;
    s.sound *= Math.exp(-h / tauSound);
    if (s.sound < 1e-3) s.sound = 0;

    s.phase = phaseOf(s, psi, Math.max(sup, thetaLever));
    return s;
  }

  function phaseOf(s, psi, sup) {
    const sinceStrike = s.strikeAt >= 0 ? s.t - s.strikeAt : Infinity;
    const thetaLever = leverFree(psi);
    if (s.d < 0.05 && s.target === 0) s.armed = false;
    if (sinceStrike < 0.004) return "strike";
    if (s.caught) return "check";
    const escaped = Math.abs(M.jackShift(s.tau)) >= M.ESCAPE;
    if (escaped) {
      if (s.flying && s.omega > 0.05) return "flight";
      if (s.omega > 0.05) return "lever";
      if (s.omega < -0.05) return s.strikeAt >= s.lastEscape ? "rebound" : "fall";
      if (s.theta < thetaLever - 0.002) return "lever";
      return "drop";
    }
    if (s.vd > 1e-6) return s.tau > 0.001 ? "letoff" : "press";
    if (s.armed && s.d > 0.5 && s.d < M.SPEC.dip - 0.05) return "repeat";
    if (s.vd < -1e-6) return "rise";
    if (s.d > 0.05) return "hold";
    if (s.lift < 0.2 && s.sound > 0.01) return "damp";
    return "rest";
  }

  return { create, step, SPEEDS };
}
