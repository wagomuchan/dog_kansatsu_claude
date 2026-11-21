import * as THREE from 'three';

const VALID_POSES = new Set([
  'stand', 'sit', 'lie', 'sleepCurl', 'sleepSide', 'bellyUp',
  'play_bow', 'sniffGround', 'dig', 'drink', 'eat', 'scratch',
  'shake', 'stretch', 'roll', 'howl', 'bark', 'jump', 'pounce',
]);

const LOCOMOTION_POSES = new Set(['stand', 'sniffGround', 'bark']);
const SLEEP_POSES = new Set(['sleepCurl', 'sleepSide']);

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function frac(x) {
  return x - Math.floor(x);
}

/**
 * Evaluates biomechanical leg joint deltas for a single gait cycle phase p in [0, 1).
 * Convention (+X = left, +Y = up, +Z = forward):
 *   upperX < 0 swings leg FORWARD (+Z), upperX > 0 pushes BACKWARD (-Z)
 *   lowerX > 0 flexes elbow/stifle BACKWARD to lift paw off ground
 */
function evalLegCycle(p, isFront, cfg) {
  const duty = cfg.duty;
  const fwd = isFront ? cfg.frontFwd : cfg.backFwd;
  const back = isFront ? cfg.frontBack : cfg.backBack;
  const liftKnee = isFront ? cfg.frontLift : cfg.backLift;

  let upperX = 0;
  let lowerX = 0;
  let pawX = 0;

  if (p < duty) {
    // Stance phase: foot planted on ground sweeping from forward touchdown to backward push-off
    const u = p / duty;
    // Slight ease-out at touchdown and energetic push-off at end
    const sweep = u + 0.04 * Math.sin(u * Math.PI * 2);
    upperX = THREE.MathUtils.lerp(-fwd, back, sweep);

    // Subtle mid-stance shock-absorption bend in elbow/stifle
    const cushion = Math.sin(u * Math.PI);
    lowerX = isFront
      ? (cushion * 0.08 - (u > 0.72 ? (u - 0.72) * 0.35 : 0))
      : (-cushion * 0.14 + (u > 0.70 ? (u - 0.70) * 0.45 : 0));

    // Keep paw flat on ground until toe roll-off at end of stance
    const toeRoll = smoothstep(0.76, 1.0, u) * 0.42;
    pawX = -(upperX + lowerX) + toeRoll;
  } else {
    // Swing phase: foot lifts off, folds knee/elbow, swings forward, extends before strike
    const u = (p - duty) / (1 - duty);
    const swingEase = 0.5 - 0.5 * Math.cos(u * Math.PI);
    upperX = THREE.MathUtils.lerp(back, -fwd, swingEase);

    // Peak flexion in first half of swing, smooth extension right before heel-strike
    const flexShape = Math.sin(Math.pow(u, 0.78) * Math.PI);
    lowerX = flexShape * liftKnee;

    // Slight relaxed downward droop of paw during mid-swing, levelling at touchdown
    const pawDroop = Math.sin(u * Math.PI) * 0.34;
    pawX = -(upperX + lowerX) * 0.55 + pawDroop;
  }

  return { upperX, lowerX, pawX, inStance: p < duty };
}

// Biomechanical gait parameter presets
const GAIT_WALK = {
  duty: 0.64,
  frontFwd: 0.32,
  frontBack: 0.28,
  backFwd: 0.30,
  backBack: 0.32,
  frontLift: 0.52,
  backLift: 0.48,
  // Real canine 4-beat lateral sequence: BR -> FR -> BL -> FL
  offsets: { BR: 0.0, FR: 0.25, BL: 0.5, FL: 0.75 },
};

const GAIT_TROT = {
  duty: 0.46,
  frontFwd: 0.48,
  frontBack: 0.44,
  backFwd: 0.44,
  backBack: 0.48,
  frontLift: 0.82,
  backLift: 0.72,
  // Diagonal pairs with tiny natural stagger: (FL+BR), (FR+BL)
  offsets: { FL: 0.0, BR: 0.03, FR: 0.5, BL: 0.53 },
};

const GAIT_GALLOP = {
  duty: 0.30,
  frontFwd: 0.78,
  frontBack: 0.68,
  backFwd: 0.74,
  backBack: 0.78,
  frontLift: 1.12,
  backLift: 0.98,
  // Double-suspension rotary gallop: BL -> BR -> FR -> FL
  offsets: { BL: 0.0, BR: 0.13, FR: 0.48, FL: 0.60 },
};

export class DogAnimator {
  constructor(dogParts, breed) {
    this.dog = dogParts;
    this.joints = dogParts.joints;
    this.eyes = dogParts.eyes || [];
    this.breed = breed || {};
    this.metrics = dogParts.metrics || this._fallbackMetrics();

    this.onEvent = null;

    // Publicly inspectable state
    this.currentPose = 'stand';
    this.currentSpeed = 0;
    this.currentGait = 'idle';
    this.pantLevel = 0;

    // Targets
    this._targetSpeed = 0;
    this._targetPose = 'stand';
    this._poseTime = 0;
    this._tailMode = 'relaxed';
    this._earMode = 'relaxed';
    this._lookTarget = null;

    // Internal clocks & phase accumulators
    this._time = Math.random() * 100;
    this._gaitPhase = 0;
    this._tailPhase = Math.random() * Math.PI * 2;
    this._breathPhase = Math.random() * Math.PI * 2;
    this._pantPhase = 0;

    // Autonomous micro-life timers
    this._exertion = 0;
    this._blinkTimer = 1.8 + Math.random() * 3.5;
    this._blinkProgress = -1; // >= 0 while blinking
    this._earTwitchTimerL = 2.0 + Math.random() * 5.0;
    this._earTwitchTimerR = 3.0 + Math.random() * 5.0;
    this._earTwitchL = 0;
    this._earTwitchR = 0;
    this._idleGlanceTimer = 2.5 + Math.random() * 4.0;
    this._idleGlanceYaw = 0;
    this._idleGlancePitch = 0;
    this._headTilt = 0;
    this._headTiltTimer = 4.0 + Math.random() * 6.0;

    // Event deduplication & periodic emitters
    this._prevStance = { FL: true, FR: true, BL: true, BR: true };
    this._stepCooldown = 0;
    this._poseEventPhase = 0;
    this._snoreTimer = 2.5 + Math.random() * 2.5;
    this._pantEventTimer = 1.2;
    this._jumpLanded = true;

    // Smoothed lookAt state
    this._lookYaw = 0;
    this._lookPitch = 0;
    this._eyeYaw = 0;
    this._eyePitch = 0;

    // Smoothed pose state (all pose-level channels smoothly interpolated over 0.3..1.0s)
    this._s = this._createZeroState();
    this._t = this._createZeroState();

    // Reusable scratch vectors/quaternions (zero per-frame GC pressure)
    this._tmpVec = new THREE.Vector3();
    this._tmpHeadWorld = new THREE.Vector3();
    this._tmpInvQuat = new THREE.Quaternion();
  }

  _fallbackMetrics() {
    const H = this.breed.shoulderHeight || 0.4;
    const B = this.breed.bodyLength || 0.45;
    const cD = this.breed.chestDepth || 0.16;
    const cW = this.breed.chestWidth || 0.14;
    return {
      shoulderHeight: H,
      bodyLength: B,
      chestDepth: cD,
      chestWidth: cW,
      pelvisY: H * 0.80,
      pelvisZ: -B * 0.34,
      shoulderY: H * 0.74,
      hipY: H * 0.75,
      frontUpperLen: H * 0.32,
      frontLowerLen: H * 0.40,
      backUpperLen: H * 0.34,
      backLowerLen: H * 0.38,
      pawH: 0.02,
      legClearance: H * 0.50,
      neckLength: 0.12,
      headSize: 0.075,
      muzzleLength: 0.07,
      neutralAngles: {
        frontUpperX: 0.24,
        frontLowerX: -0.26,
        frontPawX: 0.02,
        backUpperX: -0.34,
        backLowerX: 0.50,
        backPawX: -0.16,
        neckX: 0.52,
        headX: -0.46,
        tailBaseX: 0.25,
        tailSegX: 0.10,
      },
      basePositions: {
        pelvis: [0, H * 0.80, -B * 0.34],
      },
      earBaseRot: { x: 0.10, y: 0.14, z: -0.15 },
    };
  }

  _createZeroState() {
    return {
      pelvisX: 0,
      pelvisY: this.metrics.pelvisY,
      pelvisZ: this.metrics.pelvisZ,
      pelvisRotX: 0,
      pelvisRotY: 0,
      pelvisRotZ: 0,

      spine1X: 0, spine1Y: 0, spine1Z: 0,
      spine2X: 0, spine2Y: 0, spine2Z: 0,
      chestX: 0, chestY: 0, chestZ: 0,

      neckX: 0, neckY: 0, neckZ: 0,
      headX: 0, headY: 0, headZ: 0,

      jawX: 0,
      tongueOut: 0,
      tongueCurl: 0,
      eyelidClose: 0,

      // Per-leg offsets relative to neutral standing angles
      FL: { ux: 0, lx: 0, px: 0, az: 0 },
      FR: { ux: 0, lx: 0, px: 0, az: 0 },
      BL: { ux: 0, lx: 0, px: 0, az: 0 },
      BR: { ux: 0, lx: 0, px: 0, az: 0 },

      // Tail carriage offsets
      tailBaseX: 0,
      tailBaseY: 0,
      tailSegX: 0,
      tailCurlYaw: 0,
    };
  }

  setGait(speed) {
    this._targetSpeed = Math.max(0, Number(speed) || 0);
  }

  setPose(name) {
    const resolved = VALID_POSES.has(name) ? name : 'stand';
    if (resolved !== this._targetPose) {
      this._targetPose = resolved;
      this.currentPose = resolved;
      this._poseTime = 0;
      this._poseEventPhase = 0;
      this._jumpLanded = true;
      if (resolved === 'howl') {
        this._emit('howl');
      } else if (resolved === 'shake') {
        this._emit('shake');
      }
    }
  }

  lookAt(worldPosOrNull) {
    if (worldPosOrNull && typeof worldPosOrNull.x === 'number') {
      if (!this._lookTarget) this._lookTarget = new THREE.Vector3();
      this._lookTarget.set(worldPosOrNull.x, worldPosOrNull.y, worldPosOrNull.z);
    } else {
      this._lookTarget = null;
    }
  }

  setTail(mode) {
    if (mode === 'wag' || mode === 'happyWag' || mode === 'relaxed' || mode === 'down' || mode === 'tucked') {
      this._tailMode = mode;
    }
  }

  setEars(mode) {
    if (mode === 'alert' || mode === 'relaxed' || mode === 'back') {
      this._earMode = mode;
    }
  }

  _emit(name) {
    if (typeof this.onEvent === 'function') {
      this.onEvent(name);
    }
  }

  _resetTarget(t) {
    const m = this.metrics;
    t.pelvisX = 0;
    t.pelvisY = m.pelvisY;
    t.pelvisZ = m.pelvisZ;
    t.pelvisRotX = 0;
    t.pelvisRotY = 0;
    t.pelvisRotZ = 0;

    t.spine1X = 0; t.spine1Y = 0; t.spine1Z = 0;
    t.spine2X = 0; t.spine2Y = 0; t.spine2Z = 0;
    t.chestX = 0; t.chestY = 0; t.chestZ = 0;

    t.neckX = 0; t.neckY = 0; t.neckZ = 0;
    t.headX = 0; t.headY = 0; t.headZ = 0;

    t.jawX = 0;
    t.tongueOut = 0;
    t.tongueCurl = 0;
    t.eyelidClose = 0;

    for (const k of ['FL', 'FR', 'BL', 'BR']) {
      t[k].ux = 0;
      t[k].lx = 0;
      t[k].px = 0;
      t[k].az = 0;
    }

    t.tailBaseX = 0;
    t.tailBaseY = 0;
    t.tailSegX = 0;
    t.tailCurlYaw = 0;
  }

  _getPoseDampLambda(pose) {
    switch (pose) {
      case 'bark':
      case 'jump':
      case 'pounce':
      case 'shake':
      case 'play_bow':
      case 'dig':
        return 9.0; // ~0.35s snappy transition
      case 'stand':
      case 'sniffGround':
      case 'drink':
      case 'eat':
      case 'scratch':
      case 'howl':
        return 5.8; // ~0.55s natural transition
      default:
        return 3.8; // ~0.85s smooth relaxed transition (sit/lie/sleep/stretch/roll)
    }
  }

  _fillPoseTarget(pose, pt, dt) {
    const t = this._t;
    const m = this.metrics;
    const H = m.shoulderHeight;
    const cD = m.chestDepth;
    const cW = m.chestWidth;
    const pY = m.pelvisY;
    const na = m.neutralAngles;
    // Scale neck-drop depth for ground-reaching poses (tall dogs bend steeper than Dachshund)
    const reachScale = THREE.MathUtils.clamp(H / 0.42, 0.72, 1.25);

    this._resetTarget(t);

    switch (pose) {
      case 'stand': {
        // Subtle living idle sway
        t.pelvisX = Math.sin(this._time * 0.65) * 0.004 * H;
        t.pelvisY = pY + Math.sin(this._time * 1.1) * 0.003 * H;
        break;
      }

      case 'sit': {
        // Analytically solved canine sit so front paws stay planted right at y=0 for every breed!
        const sitPelvisY = Math.max(cD * 0.43, m.pawH * 2.4);
        const torsoSpan = Math.max(0.15, m.bodyLength * 0.71);
        const sinPitch = THREE.MathUtils.clamp((m.shoulderY - sitPelvisY) / torsoSpan, 0.22, 0.86);
        const sitPitch = Math.asin(sinPitch);
        const chestLevel = sitPitch * 0.36;
        const residualFrontPitch = -(sitPitch - 0.08 - chestLevel);

        t.pelvisY = sitPelvisY;
        t.pelvisZ = m.pelvisZ - m.bodyLength * 0.04;
        t.pelvisRotX = -sitPitch; // Front of torso pitches UP
        t.spine1X = 0.04;
        t.spine2X = 0.04;
        t.chestX = chestLevel;
        // Keep neck upright and head level
        t.neckX = -(residualFrontPitch * 0.75) - 0.12;
        t.headX = -(residualFrontPitch * 0.25) + 0.12;
        // Front legs counter-rotate cleanly straight down to y = 0
        t.FL.ux = -residualFrontPitch; t.FL.lx = 0.02; t.FL.px = -0.02; t.FL.az = 0.05;
        t.FR.ux = -residualFrontPitch; t.FR.lx = 0.02; t.FR.px = -0.02; t.FR.az = -0.05;
        // Hind legs fold forward cleanly alongside thighs
        t.BL.ux = -1.04; t.BL.lx = 1.62; t.BL.px = 0.04; t.BL.az = 0.22;
        t.BR.ux = -1.04; t.BR.lx = 1.62; t.BR.px = 0.04; t.BR.az = -0.22;
        // Tail relaxes out behind seated rump
        t.tailBaseX = -0.35;
        t.tailSegX = 0.06;
        break;
      }

      case 'lie': {
        // Calm sphinx pose: chest & belly resting on ground, front paws forward, head alert
        t.pelvisY = cD * 0.44;
        t.pelvisRotX = 0.02;
        t.spine1X = -0.04;
        t.chestX = -0.04;
        t.neckX = -0.10;
        t.headX = 0.14;
        t.eyelidClose = 0.12;
        // Front legs extended forward resting on ground
        t.FL.ux = -1.24; t.FL.lx = -0.24; t.FL.px = 1.44; t.FL.az = 0.10;
        t.FR.ux = -1.24; t.FR.lx = -0.24; t.FR.px = 1.44; t.FR.az = -0.10;
        // Hind legs folded neatly beside flanks
        t.BL.ux = -1.16; t.BL.lx = 1.88; t.BL.px = -0.72; t.BL.az = 0.28;
        t.BR.ux = -1.16; t.BR.lx = 1.88; t.BR.px = -0.72; t.BR.az = -0.28;
        t.tailBaseX = -0.38;
        t.tailBaseY = 0.35;
        break;
      }

      case 'sleepCurl': {
        // Cozy curled-up donut sleep with chin tucked near paws/tail
        t.pelvisY = cD * 0.42;
        t.pelvisRotZ = 0.44;
        t.pelvisRotX = 0.06;
        t.spine1Y = 0.48;
        t.spine2Y = 0.52;
        t.chestY = 0.46;
        t.neckY = 0.46;
        t.neckX = 0.44;
        t.headY = 0.38;
        t.headX = 0.22;
        t.headZ = -0.32;
        t.eyelidClose = 1.0;

        // Tucked cozy legs
        t.FL.ux = -1.05; t.FL.lx = 0.85; t.FL.px = 0.30; t.FL.az = 0.15;
        t.FR.ux = -1.15; t.FR.lx = 0.72; t.FR.px = 0.35; t.FR.az = -0.10;
        t.BL.ux = -1.20; t.BL.lx = 1.95; t.BL.px = -0.55; t.BL.az = 0.24;
        t.BR.ux = -1.10; t.BR.lx = 1.85; t.BR.px = -0.55; t.BR.az = -0.18;

        // Tail wraps snugly around nose
        t.tailBaseX = -0.32;
        t.tailBaseY = 0.55;
        t.tailCurlYaw = 0.42;

        // Occasional dreaming paw twitch!
        const dreamPulse = Math.pow(Math.max(0, Math.sin(this._time * 0.7) * Math.sin(this._time * 1.9)), 8);
        if (dreamPulse > 0.05) {
          const tw = Math.sin(this._time * 24.0) * 0.18 * dreamPulse;
          t.FL.lx += tw;
          t.BR.lx -= tw * 0.8;
        }
        break;
      }

      case 'sleepSide': {
        // Stretched peacefully on side
        t.pelvisY = cW * 0.48;
        t.pelvisRotZ = 1.48;
        t.spine1Y = 0.12;
        t.spine2Y = 0.12;
        t.chestY = 0.10;
        t.neckX = 0.32;
        t.neckY = 0.14;
        t.headX = 0.08;
        t.headZ = -0.18;
        t.eyelidClose = 1.0;

        // Loosely relaxed extended legs
        t.FL.ux = -0.45; t.FL.lx = 0.28; t.FL.px = 0.20; t.FL.az = 0.12;
        t.FR.ux = -0.62; t.FR.lx = 0.36; t.FR.px = 0.22; t.FR.az = -0.05;
        t.BL.ux = -0.38; t.BL.lx = 0.45; t.BL.px = 0.18; t.BL.az = 0.14;
        t.BR.ux = -0.56; t.BR.lx = 0.52; t.BR.px = 0.18; t.BR.az = -0.06;

        t.tailBaseX = -0.30;
        t.tailSegX = -0.04;

        // Occasional gentle dreaming run-twitch
        const dream = Math.pow(Math.max(0, Math.sin(this._time * 0.55) * Math.cos(this._time * 1.4)), 10);
        if (dream > 0.04) {
          const runTw = Math.sin(this._time * 20.0) * 0.22 * dream;
          t.FL.ux += runTw;
          t.BL.ux -= runTw * 0.8;
        }
        break;
      }

      case 'bellyUp': {
        // Relaxed playful supine pose with slow gentle side-to-side wiggle
        const wig = Math.sin(pt * 1.6);
        t.pelvisY = cD * 0.47;
        t.pelvisRotZ = 2.92 + wig * 0.22;
        t.spine1Z = wig * 0.08;
        t.spine2Z = wig * 0.10;
        t.neckX = 0.22;
        t.headZ = -wig * 0.18;
        t.jawX = 0.12;
        t.tongueOut = 0.25;
        t.eyelidClose = 0.25;

        // Paws curled playfully up in the air
        t.FL.ux = -0.65 + wig * 0.12; t.FL.lx = 0.95; t.FL.px = 0.42; t.FL.az = 0.32;
        t.FR.ux = -0.65 - wig * 0.12; t.FR.lx = 0.95; t.FR.px = 0.42; t.FR.az = -0.32;
        t.BL.ux = -0.42 - wig * 0.10; t.BL.lx = 0.85; t.BL.px = 0.30; t.BL.az = 0.38;
        t.BR.ux = -0.42 + wig * 0.10; t.BR.lx = 0.85; t.BR.px = 0.30; t.BR.az = -0.38;
        t.tailBaseX = -0.20;
        break;
      }

      case 'play_bow': {
        // Classic play bow: elbows down near ground, rump high, excited upward gaze
        const bounce = Math.sin(pt * 5.2) * 0.03;
        t.pelvisY = pY * 0.98 + bounce * H * 0.3;
        t.pelvisRotX = 0.40 + bounce;
        t.spine1X = 0.08;
        t.spine2X = 0.04;
        t.chestX = -0.02;
        // Head tilts up excitedly toward playmate
        t.neckX = -0.46;
        t.headX = -0.26;
        t.jawX = 0.22;
        t.tongueOut = 0.45;
        // Front legs stretched forward with elbows near ground
        t.FL.ux = -1.16; t.FL.lx = -0.32; t.FL.px = 1.05; t.FL.az = 0.14;
        t.FR.ux = -1.16; t.FR.lx = -0.32; t.FR.px = 1.05; t.FR.az = -0.14;
        // Hind legs braced upright keeping rump tall
        t.BL.ux = -0.38; t.BL.lx = 0.08; t.BL.px = -0.08;
        t.BR.ux = -0.38; t.BR.lx = 0.08; t.BR.px = -0.08;
        t.tailBaseX = 0.42;
        break;
      }

      case 'sniffGround': {
        // Nose lowered to grass height; works both stationary and while walking!
        const sweep = Math.sin(pt * 4.8) * 0.20;
        const bob = Math.sin(pt * 11.0) * 0.04;
        t.spine2X = 0.08 * reachScale;
        t.chestX = 0.10 * reachScale;
        t.neckX = 0.86 * reachScale;
        t.headX = 0.34 + bob;
        t.headY = sweep;
        t.neckY = sweep * 0.45;
        break;
      }

      case 'dig': {
        // Braced front crouch + rapid alternating front-paw digging strokes
        const digFreq = 3.8;
        const pL = frac(pt * digFreq);
        const pR = frac(pt * digFreq + 0.5);

        const prevCycle = Math.floor(this._poseEventPhase * digFreq * 2);
        this._poseEventPhase += dt;
        const currCycle = Math.floor(this._poseEventPhase * digFreq * 2);
        if (currCycle > prevCycle) {
          this._emit('dig');
        }

        const scoop = (p) => {
          const s = Math.sin(p * Math.PI * 2);
          const c = Math.cos(p * Math.PI * 2);
          return {
            ux: -0.45 + s * 0.58,
            lx: 0.55 + Math.max(0, c) * 0.65,
            px: 0.25 + s * 0.30,
          };
        };
        const dL = scoop(pL);
        const dR = scoop(pR);

        t.pelvisY = pY * 0.90;
        t.pelvisRotX = 0.24;
        t.spine2X = 0.08;
        t.chestX = 0.06;
        t.chestY = Math.sin(pt * digFreq * Math.PI * 2) * 0.08;
        t.neckX = 0.68 * reachScale;
        t.headX = 0.38;
        t.jawX = 0.14;

        t.FL.ux = dL.ux; t.FL.lx = dL.lx; t.FL.px = dL.px; t.FL.az = 0.08;
        t.FR.ux = dR.ux; t.FR.lx = dR.lx; t.FR.px = dR.px; t.FR.az = -0.08;
        t.BL.ux = -0.22; t.BL.lx = 0.05;
        t.BR.ux = -0.22; t.BR.lx = 0.05;
        t.tailBaseX = 0.28;
        break;
      }

      case 'drink': {
        // Lowered over water bowl with rhythmic lapping tongue
        const lapFreq = 3.4;
        const prevLap = Math.floor(this._poseEventPhase * lapFreq);
        this._poseEventPhase += dt;
        const currLap = Math.floor(this._poseEventPhase * lapFreq);
        if (currLap > prevLap) {
          this._emit('lap');
        }
        const lapWave = 0.5 - 0.5 * Math.cos(pt * lapFreq * Math.PI * 2);

        t.pelvisY = pY * 0.96;
        t.pelvisRotX = 0.12 * reachScale;
        t.spine2X = 0.08;
        t.chestX = 0.10;
        t.neckX = 0.90 * reachScale;
        t.headX = 0.36 + lapWave * 0.07;
        t.jawX = 0.16 + lapWave * 0.16;
        t.tongueOut = 0.35 + lapWave * 0.65;
        t.tongueCurl = lapWave * 0.65;
        t.FL.ux = -0.10; t.FL.az = 0.06;
        t.FR.ux = -0.10; t.FR.az = -0.06;
        break;
      }

      case 'eat': {
        // Lowered over food bowl with rhythmic chewing & happy bob
        const chewFreq = 2.8;
        const chew = 0.5 - 0.5 * Math.cos(pt * chewFreq * Math.PI * 2);

        t.pelvisY = pY * 0.96;
        t.pelvisRotX = 0.12 * reachScale;
        t.spine2X = 0.08;
        t.chestX = 0.10;
        t.neckX = 0.88 * reachScale;
        t.headX = 0.40 + chew * 0.09;
        t.jawX = 0.06 + chew * 0.24;
        t.tongueOut = chew * 0.22;
        t.FL.ux = -0.10; t.FL.az = 0.06;
        t.FR.ux = -0.10; t.FR.az = -0.06;
        break;
      }

      case 'scratch': {
        // Seated using breed-accurate sit pitch, leaning right while left hind leg pumps near ear
        const sFreq = 4.8;
        const pump = Math.sin(pt * sFreq * Math.PI * 2);
        const sitPelvisY = Math.max(cD * 0.43, m.pawH * 2.4);
        const torsoSpan = Math.max(0.15, m.bodyLength * 0.71);
        const sitPitch = Math.asin(THREE.MathUtils.clamp((m.shoulderY - sitPelvisY) / torsoSpan, 0.22, 0.84)) * 0.92;
        const chestLevel = sitPitch * 0.34;
        const residualFrontPitch = -(sitPitch - 0.08 - chestLevel);

        t.pelvisY = sitPelvisY;
        t.pelvisRotX = -sitPitch;
        t.pelvisRotZ = -0.22; // Lean onto right hip
        t.spine1X = 0.04; t.spine1Y = 0.16;
        t.spine2X = 0.04; t.spine2Y = 0.16;
        t.chestX = chestLevel;
        // Tilt head down toward scratching left paw
        t.neckX = -(residualFrontPitch * 0.6) + 0.18; t.neckY = 0.38; t.neckZ = 0.24;
        t.headX = 0.28; t.headY = 0.16; t.headZ = 0.34;
        t.eyelidClose = 0.65; // Blissful squinted eyes!

        t.FL.ux = -residualFrontPitch + 0.04; t.FL.lx = 0.04; t.FL.az = 0.08;
        t.FR.ux = -residualFrontPitch + 0.08; t.FR.lx = 0.04; t.FR.az = -0.10;

        // Right hind leg stays grounded; left hind leg reaches forward-up and pumps!
        t.BR.ux = -1.04; t.BR.lx = 1.60; t.BR.az = -0.24;
        t.BL.ux = -1.35 + pump * 0.24;
        t.BL.lx = 0.55 - pump * 0.38;
        t.BL.px = 0.35;
        t.BL.az = 0.28;
        t.tailBaseX = -0.32;
        break;
      }

      case 'shake': {
        // Iconic wet-dog travelling torsional wave from head down to tail!
        const wFreq = 6.6;
        const prevBurst = Math.floor(this._poseEventPhase * 1.4);
        this._poseEventPhase += dt;
        const currBurst = Math.floor(this._poseEventPhase * 1.4);
        if (currBurst > prevBurst) {
          this._emit('shake');
        }

        // Smooth ramp-up envelope
        const env = smoothstep(0.0, 0.22, pt);
        const w = pt * wFreq * Math.PI * 2;
        const lag = 0.52;

        t.pelvisY = pY * 0.92;
        t.pelvisRotX = 0.08;
        t.neckX = 0.58;
        t.headX = -0.24;
        t.eyelidClose = 0.85; // Eyes squeezed shut during shake!

        // Travelling roll wave (head leads, pelvis & tail lag)
        t.headZ = Math.sin(w) * 0.62 * env;
        t.neckZ = Math.sin(w - lag * 1.0) * 0.45 * env;
        t.chestZ = Math.sin(w - lag * 2.0) * 0.34 * env;
        t.spine2Z = Math.sin(w - lag * 2.8) * 0.28 * env;
        t.spine1Z = Math.sin(w - lag * 3.5) * 0.24 * env;
        t.pelvisRotZ = Math.sin(w - lag * 4.2) * 0.22 * env;

        // Wide braced stance
        t.FL.az = 0.16; t.FR.az = -0.16;
        t.BL.az = 0.16; t.BR.az = -0.16;
        t.FL.lx = 0.14; t.FR.lx = 0.14;
        t.BL.lx = 0.12; t.BR.lx = 0.12;
        break;
      }

      case 'stretch': {
        // Luxurious downward-dog bow stretch -> yawn -> gentle forward recovery
        const phase = frac(pt * 0.26); // ~3.8s full stretch cycle
        const bowAmt = smoothstep(0.0, 0.28, phase) * (1 - smoothstep(0.72, 0.96, phase));
        const yawnAmt = smoothstep(0.28, 0.44, phase) * (1 - smoothstep(0.62, 0.78, phase));

        t.pelvisY = pY * (1.0 - 0.04 * bowAmt);
        t.pelvisZ = m.pelvisZ - m.bodyLength * 0.08 * bowAmt;
        t.pelvisRotX = 0.44 * bowAmt;
        t.spine1X = -0.12 * bowAmt; // Deep satisfying concave back arch!
        t.spine2X = -0.10 * bowAmt;
        t.chestX = 0.14 * bowAmt;
        t.neckX = -0.35 * bowAmt;
        t.headX = -0.18 * bowAmt;

        // Big cozy yawn at peak stretch
        t.jawX = 0.56 * yawnAmt;
        t.tongueOut = 0.72 * yawnAmt;
        t.tongueCurl = 0.65 * yawnAmt;
        t.eyelidClose = 0.85 * yawnAmt;

        // Front legs reaching far forward
        t.FL.ux = -1.25 * bowAmt; t.FL.lx = -0.22 * bowAmt; t.FL.px = 1.05 * bowAmt; t.FL.az = 0.08 * bowAmt;
        t.FR.ux = -1.25 * bowAmt; t.FR.lx = -0.22 * bowAmt; t.FR.px = 1.05 * bowAmt; t.FR.az = -0.08 * bowAmt;
        // Hind legs extended slightly backward
        t.BL.ux = -0.18 * bowAmt; t.BL.lx = -0.12 * bowAmt;
        t.BR.ux = -0.18 * bowAmt; t.BR.lx = -0.12 * bowAmt;
        t.tailBaseX = 0.38 * bowAmt;
        break;
      }

      case 'roll': {
        // Joyful back-rolling on grass/dirt with paddling paws!
        const rollWave = Math.sin(pt * 3.1);
        const pad = Math.sin(pt * 6.8);

        t.pelvisY = cD * 0.46;
        t.pelvisRotZ = Math.PI + rollWave * 1.15;
        t.spine1Y = rollWave * 0.24;
        t.spine2Y = -rollWave * 0.20;
        t.spine1Z = rollWave * 0.18;
        t.neckY = -rollWave * 0.30;
        t.neckX = 0.24;
        t.headZ = rollWave * 0.28;
        t.jawX = 0.20;
        t.tongueOut = 0.35;

        // Playful paddling paws in the air
        t.FL.ux = -0.62 + pad * 0.38; t.FL.lx = 0.85 + pad * 0.25; t.FL.az = 0.30;
        t.FR.ux = -0.62 - pad * 0.38; t.FR.lx = 0.85 - pad * 0.25; t.FR.az = -0.30;
        t.BL.ux = -0.45 - pad * 0.32; t.BL.lx = 0.80 - pad * 0.22; t.BL.az = 0.34;
        t.BR.ux = -0.45 + pad * 0.32; t.BR.lx = 0.80 + pad * 0.22; t.BR.az = -0.34;
        break;
      }

      case 'howl': {
        // Iconic skyward canine/husky howl!
        const swell = 0.5 + 0.5 * Math.sin(pt * 1.8);
        const prevHowl = Math.floor(this._poseEventPhase * 0.32);
        this._poseEventPhase += dt;
        const currHowl = Math.floor(this._poseEventPhase * 0.32);
        if (currHowl > prevHowl) {
          this._emit('howl');
        }

        // Proud seated/semi-tall posture tilting nose straight up to the moon
        t.pelvisY = pY * 0.96;
        t.pelvisRotX = -0.14;
        t.spine1X = -0.05;
        t.spine2X = -0.05;
        t.neckX = -0.44 - swell * 0.08;
        t.headX = -0.76 - swell * 0.12; // Nose aimed high skyward!
        t.jawX = 0.28 + swell * 0.14;
        t.eyelidClose = 0.55;
        t.FL.ux = 0.14; t.FR.ux = 0.14;
        t.BL.ux = 0.10; t.BR.ux = 0.10;
        t.tailBaseX = -0.20;
        break;
      }

      case 'bark': {
        // Punchy realistic bark lunge-and-snap rhythm
        const cycle = frac(pt * 0.95); // ~1.05s per bark
        const prevBark = Math.floor(this._poseEventPhase * 0.95 + 0.72);
        this._poseEventPhase += dt;
        const currBark = Math.floor(this._poseEventPhase * 0.95 + 0.72);
        if (currBark > prevBark) {
          this._emit('bark');
        }

        // 0.0..0.22 crouch, 0.22..0.44 explosive bark thrust, 0.44..1.0 alert settle
        const crouch = smoothstep(0.0, 0.16, cycle) * (1 - smoothstep(0.16, 0.28, cycle));
        const thrust = smoothstep(0.20, 0.30, cycle) * (1 - smoothstep(0.36, 0.56, cycle));

        t.pelvisY = pY * (1.0 - 0.06 * crouch + 0.04 * thrust);
        t.pelvisZ = m.pelvisZ + m.bodyLength * (0.04 * thrust - 0.02 * crouch);
        t.pelvisRotX = 0.10 * crouch - 0.12 * thrust;
        t.chestX = 0.08 * crouch - 0.10 * thrust;
        t.neckX = 0.16 * crouch - 0.22 * thrust;
        t.headX = 0.12 * crouch - 0.24 * thrust;
        t.jawX = 0.44 * thrust;
        t.FL.ux = -0.14 * thrust; t.FL.lx = 0.22 * crouch;
        t.FR.ux = -0.14 * thrust; t.FR.lx = 0.22 * crouch;
        t.tailBaseX = 0.32;
        break;
      }

      case 'jump': {
        // Energetic vertical joyful hop with anticipation, airborne tuck, and cushioned landing
        const cycle = frac(pt * 0.88);
        if (cycle < 0.22) {
          // Anticipation crouch
          const c = Math.sin((cycle / 0.22) * Math.PI * 0.5);
          t.pelvisY = pY * (1.0 - 0.18 * c);
          t.pelvisRotX = 0.16 * c;
          t.FL.ux = -0.18 * c; t.FL.lx = 0.48 * c;
          t.FR.ux = -0.18 * c; t.FR.lx = 0.48 * c;
          t.BL.ux = -0.28 * c; t.BL.lx = 0.54 * c;
          t.BR.ux = -0.28 * c; t.BR.lx = 0.54 * c;
          t.neckX = 0.18 * c;
        } else if (cycle < 0.74) {
          // Airborne arc
          this._jumpLanded = false;
          const u = (cycle - 0.22) / 0.52;
          const arc = Math.sin(u * Math.PI);
          const pitch = Math.cos(u * Math.PI); // Nose up on launch, nose down on descent
          t.pelvisY = pY + arc * H * 0.62;
          t.pelvisRotX = -0.34 * pitch;
          t.spine1X = -0.10 * arc;
          t.neckX = -0.24 * arc;
          t.jawX = 0.22 * arc;
          t.tongueOut = 0.40 * arc;

          // Front paws happily tucked up, hind legs extending on launch then tucking
          t.FL.ux = -0.45 * arc; t.FL.lx = 0.85 * arc;
          t.FR.ux = -0.45 * arc; t.FR.lx = 0.85 * arc;
          t.BL.ux = 0.42 * Math.max(0, pitch) - 0.35 * Math.max(0, -pitch);
          t.BR.ux = t.BL.ux;
          t.BL.lx = 0.45 * arc; t.BR.lx = 0.45 * arc;
        } else {
          // Soft cushioned landing
          if (!this._jumpLanded) {
            this._jumpLanded = true;
            this._emit('step');
          }
          const u = (cycle - 0.74) / 0.26;
          const impact = Math.sin(u * Math.PI);
          t.pelvisY = pY * (1.0 - 0.14 * impact);
          t.pelvisRotX = 0.14 * impact;
          t.FL.lx = 0.36 * impact; t.FR.lx = 0.36 * impact;
          t.BL.lx = 0.28 * impact; t.BR.lx = 0.28 * impact;
        }
        t.tailBaseX = 0.32;
        break;
      }

      case 'pounce': {
        // Fox/dog playful pounce: stalk crouch -> high diving forward arc -> two-paw slam!
        const cycle = frac(pt * 0.72);
        if (cycle < 0.30) {
          // Stalking crouch with excited rear wiggle
          const c = smoothstep(0.0, 0.22, cycle);
          const wig = Math.sin(pt * 18.0) * 0.08 * c;
          t.pelvisY = pY * (1.0 - 0.24 * c);
          t.pelvisRotX = 0.26 * c;
          t.pelvisRotY = wig;
          t.neckX = 0.32 * c;
          t.headX = -0.26 * c;
          t.FL.ux = -0.58 * c; t.FL.lx = 0.75 * c;
          t.FR.ux = -0.58 * c; t.FR.lx = 0.75 * c;
          t.BL.ux = -0.45 * c; t.BL.lx = 0.78 * c;
          t.BR.ux = -0.45 * c; t.BR.lx = 0.78 * c;
        } else if (cycle < 0.76) {
          // High arched pounce dive!
          this._jumpLanded = false;
          const u = (cycle - 0.30) / 0.46;
          const arc = Math.sin(u * Math.PI);
          const pitch = Math.cos(u * Math.PI);
          t.pelvisY = pY + arc * H * 0.78;
          t.pelvisZ = m.pelvisZ + Math.sin(u * Math.PI) * m.bodyLength * 0.18;
          t.pelvisRotX = -0.52 * pitch + 0.18;
          t.spine1X = -0.18 * arc;
          t.spine2X = -0.14 * arc;
          t.neckX = -0.20 * pitch + 0.35 * smoothstep(0.4, 0.9, u);
          t.headX = 0.16;

          // Front paws reaching straight down-forward together for pounce slam!
          t.FL.ux = -0.95 * arc; t.FL.lx = -0.15 * arc;
          t.FR.ux = -0.95 * arc; t.FR.lx = -0.15 * arc;
          t.BL.ux = 0.65 * Math.max(0, pitch) - 0.40 * Math.max(0, -pitch);
          t.BR.ux = t.BL.ux;
          t.BL.lx = 0.35 * arc; t.BR.lx = 0.35 * arc;
        } else {
          // Two-paw bouncy landing
          if (!this._jumpLanded) {
            this._jumpLanded = true;
            this._emit('step');
          }
          const u = (cycle - 0.76) / 0.24;
          const slam = Math.sin(u * Math.PI);
          t.pelvisY = pY * (1.0 - 0.22 * slam);
          t.pelvisRotX = 0.32 * slam;
          t.neckX = 0.48 * slam;
          t.headX = 0.12 * slam;
          t.FL.ux = -0.68 * slam; t.FL.lx = 0.40 * slam;
          t.FR.ux = -0.68 * slam; t.FR.lx = 0.40 * slam;
        }
        t.tailBaseX = 0.45;
        break;
      }

      default:
        break;
    }

    // Keep unused ref clean
    void na;
  }

  _updateLookAt(dt) {
    const isAsleep = SLEEP_POSES.has(this._targetPose);
    let targetYaw = 0;
    let targetPitch = 0;

    if (this._lookTarget && !isAsleep && this.dog.root && this.joints.head) {
      // Compute direction from head to target in dog's root local space
      this.joints.head.getWorldPosition(this._tmpHeadWorld);
      this._tmpVec.copy(this._lookTarget).sub(this._tmpHeadWorld);
      const dist = this._tmpVec.length();

      if (dist > 0.05) {
        this.dog.root.getWorldQuaternion(this._tmpInvQuat).invert();
        this._tmpVec.applyQuaternion(this._tmpInvQuat);

        // +Z is forward, +X is left, +Y is up
        const rawYaw = Math.atan2(this._tmpVec.x, this._tmpVec.z);
        const horiz = Math.hypot(this._tmpVec.x, this._tmpVec.z);
        const rawPitch = -Math.atan2(this._tmpVec.y, Math.max(0.001, horiz));

        // Realistic canine neck+head range; if target is far behind, softly attenuate
        const behindFade = smoothstep(-0.35, 0.25, this._tmpVec.z / dist);
        targetYaw = THREE.MathUtils.clamp(rawYaw, -1.18, 1.18) * behindFade;
        targetPitch = THREE.MathUtils.clamp(rawPitch, -0.62, 0.58) * behindFade;
      }
    } else if (!isAsleep) {
      // Gentle natural idle glances when not locked onto a specific world target
      this._idleGlanceTimer -= dt;
      if (this._idleGlanceTimer <= 0) {
        this._idleGlanceTimer = 2.2 + Math.random() * 4.5;
        if (Math.random() < 0.65) {
          this._idleGlanceYaw = (Math.random() - 0.5) * 0.48;
          this._idleGlancePitch = (Math.random() - 0.45) * 0.22;
        } else {
          this._idleGlanceYaw = 0;
          this._idleGlancePitch = 0;
        }
      }
      const idleScale = this.currentSpeed > 1.5 ? 0.2 : 1.0;
      targetYaw = this._idleGlanceYaw * idleScale;
      targetPitch = this._idleGlancePitch * idleScale;
    }

    // Head turns smoothly; eyes flick faster for genuine biological gaze tracking
    this._lookYaw = damp(this._lookYaw, targetYaw, 5.2, dt);
    this._lookPitch = damp(this._lookPitch, targetPitch, 5.2, dt);
    this._eyeYaw = damp(this._eyeYaw, targetYaw, 14.0, dt);
    this._eyePitch = damp(this._eyePitch, targetPitch, 14.0, dt);

    // Subtle curious head-tilt when attentively looking at a close target (like observer camera!)
    this._headTiltTimer -= dt;
    if (this._headTiltTimer <= 0) {
      this._headTiltTimer = 3.5 + Math.random() * 5.5;
      if (this._lookTarget && !isAsleep && this.currentSpeed < 0.3 && Math.random() < 0.45) {
        this._headTilt = (Math.random() < 0.5 ? 1 : -1) * (0.12 + Math.random() * 0.14);
      } else {
        this._headTilt = 0;
      }
    }
    if (isAsleep || this.currentSpeed > 0.6) this._headTilt = damp(this._headTilt, 0, 5.0, dt);
  }

  _updateBlinking(dt) {
    if (SLEEP_POSES.has(this._targetPose)) {
      this._blinkProgress = -1;
      return 1.0;
    }

    if (this._blinkProgress >= 0) {
      this._blinkProgress += dt / 0.15; // Crisp 150ms natural blink
      if (this._blinkProgress >= 1.0) {
        this._blinkProgress = -1;
        // Occasional quick double-blink
        this._blinkTimer = Math.random() < 0.16 ? 0.22 : (2.6 + Math.random() * 4.4);
      }
    } else {
      this._blinkTimer -= dt;
      if (this._blinkTimer <= 0) {
        this._blinkProgress = 0;
      }
    }

    if (this._blinkProgress < 0) return 0;
    return Math.sin(this._blinkProgress * Math.PI);
  }

  _updateEarTwitches(dt) {
    const isSleep = SLEEP_POSES.has(this._targetPose);
    this._earTwitchTimerL -= dt;
    if (this._earTwitchTimerL <= 0) {
      this._earTwitchTimerL = (isSleep ? 9.0 : 3.2) + Math.random() * 6.5;
      this._earTwitchL = isSleep ? 0.25 : (0.6 + Math.random() * 0.4);
    }
    this._earTwitchTimerR -= dt;
    if (this._earTwitchTimerR <= 0) {
      this._earTwitchTimerR = (isSleep ? 9.5 : 3.4) + Math.random() * 6.5;
      this._earTwitchR = isSleep ? 0.25 : (0.6 + Math.random() * 0.4);
    }
    this._earTwitchL = damp(this._earTwitchL, 0, 14.0, dt);
    this._earTwitchR = damp(this._earTwitchR, 0, 14.0, dt);
  }

  update(rawDt) {
    const dt = Math.min(Math.max(Number(rawDt) || 0, 0), 0.1);
    if (dt <= 0) return;

    this._time += dt;
    this._poseTime += dt;
    this._stepCooldown = Math.max(0, this._stepCooldown - dt);

    // Smooth locomotion speed damping
    const speedLambda = this._targetSpeed > this.currentSpeed ? 6.5 : 8.5;
    this.currentSpeed = damp(this.currentSpeed, this._targetSpeed, speedLambda, dt);
    if (this.currentSpeed < 0.01 && this._targetSpeed === 0) this.currentSpeed = 0;

    // Exertion & panting dynamics (ramps up from trotting/galloping/digging/jumping, cools down slowly)
    const activeEffort =
      Math.max(0, (this.currentSpeed - 1.8) / 3.8) +
      (this._targetPose === 'dig' || this._targetPose === 'jump' || this._targetPose === 'pounce' ? 0.45 : 0);
    if (activeEffort > 0.05) {
      this._exertion = Math.min(1, this._exertion + activeEffort * dt * 0.18);
    } else {
      this._exertion = Math.max(0, this._exertion - dt * 0.045);
    }
    const isSleep = SLEEP_POSES.has(this._targetPose);
    this.pantLevel = isSleep ? 0 : smoothstep(0.22, 0.85, this._exertion);

    // Periodic sleep snore & heavy pant events
    if (isSleep) {
      this._snoreTimer -= dt;
      if (this._snoreTimer <= 0) {
        this._snoreTimer = 3.6 + Math.random() * 3.2;
        this._emit('snore');
      }
    }
    if (this.pantLevel > 0.45 && this._targetPose !== 'drink' && this._targetPose !== 'bark' && this._targetPose !== 'howl') {
      this._pantEventTimer -= dt;
      if (this._pantEventTimer <= 0) {
        this._pantEventTimer = 1.6 + Math.random() * 1.2;
        this._emit('pant');
      }
    }

    // 1. Evaluate base pose targets & smoothly interpolate pose state
    this._fillPoseTarget(this._targetPose, this._poseTime, dt);
    const poseLambda = this._getPoseDampLambda(this._targetPose);
    const s = this._s;
    const t = this._t;

    s.pelvisX = damp(s.pelvisX, t.pelvisX, poseLambda, dt);
    s.pelvisY = damp(s.pelvisY, t.pelvisY, poseLambda, dt);
    s.pelvisZ = damp(s.pelvisZ, t.pelvisZ, poseLambda, dt);
    s.pelvisRotX = damp(s.pelvisRotX, t.pelvisRotX, poseLambda, dt);
    s.pelvisRotY = damp(s.pelvisRotY, t.pelvisRotY, poseLambda, dt);
    s.pelvisRotZ = damp(s.pelvisRotZ, t.pelvisRotZ, poseLambda, dt);

    s.spine1X = damp(s.spine1X, t.spine1X, poseLambda, dt);
    s.spine1Y = damp(s.spine1Y, t.spine1Y, poseLambda, dt);
    s.spine1Z = damp(s.spine1Z, t.spine1Z, poseLambda, dt);
    s.spine2X = damp(s.spine2X, t.spine2X, poseLambda, dt);
    s.spine2Y = damp(s.spine2Y, t.spine2Y, poseLambda, dt);
    s.spine2Z = damp(s.spine2Z, t.spine2Z, poseLambda, dt);
    s.chestX = damp(s.chestX, t.chestX, poseLambda, dt);
    s.chestY = damp(s.chestY, t.chestY, poseLambda, dt);
    s.chestZ = damp(s.chestZ, t.chestZ, poseLambda, dt);

    s.neckX = damp(s.neckX, t.neckX, poseLambda, dt);
    s.neckY = damp(s.neckY, t.neckY, poseLambda, dt);
    s.neckZ = damp(s.neckZ, t.neckZ, poseLambda, dt);
    s.headX = damp(s.headX, t.headX, poseLambda, dt);
    s.headY = damp(s.headY, t.headY, poseLambda, dt);
    s.headZ = damp(s.headZ, t.headZ, poseLambda, dt);

    s.jawX = damp(s.jawX, t.jawX, 14.0, dt);
    s.tongueOut = damp(s.tongueOut, t.tongueOut, 12.0, dt);
    s.tongueCurl = damp(s.tongueCurl, t.tongueCurl, 12.0, dt);
    s.eyelidClose = damp(s.eyelidClose, t.eyelidClose, 8.0, dt);

    for (const k of ['FL', 'FR', 'BL', 'BR']) {
      s[k].ux = damp(s[k].ux, t[k].ux, poseLambda, dt);
      s[k].lx = damp(s[k].lx, t[k].lx, poseLambda, dt);
      s[k].px = damp(s[k].px, t[k].px, poseLambda, dt);
      s[k].az = damp(s[k].az, t[k].az, poseLambda, dt);
    }

    s.tailBaseX = damp(s.tailBaseX, t.tailBaseX, 6.0, dt);
    s.tailBaseY = damp(s.tailBaseY, t.tailBaseY, 6.0, dt);
    s.tailSegX = damp(s.tailSegX, t.tailSegX, 6.0, dt);
    s.tailCurlYaw = damp(s.tailCurlYaw, t.tailCurlYaw, 5.0, dt);

    // 2. Locomotion Gait Engine (Walk / Trot / Gallop auto-blended)
    const canWalk = LOCOMOTION_POSES.has(this._targetPose);
    const moveBlend = canWalk ? smoothstep(0.04, 0.35, this.currentSpeed) : 0;

    const H = this.metrics.shoulderHeight;
    const sizeScale = THREE.MathUtils.clamp(Math.sqrt(H / 0.42), 0.74, 1.18);
    const effLegLen = Math.max(0.11, this.metrics.frontUpperLen + this.metrics.frontLowerLen);

    const trotBlend = smoothstep(1.55 * sizeScale, 2.25 * sizeScale, this.currentSpeed);
    const gallopBlend = smoothstep(3.55 * sizeScale, 4.45 * sizeScale, this.currentSpeed);
    const wWalk = (1 - trotBlend) * moveBlend;
    const wTrot = trotBlend * (1 - gallopBlend) * moveBlend;
    const wGallop = gallopBlend * moveBlend;

    if (moveBlend < 0.05) {
      this.currentGait = 'idle';
    } else if (wGallop > 0.5) {
      this.currentGait = 'gallop';
    } else if (wTrot > 0.5) {
      this.currentGait = 'trot';
    } else {
      this.currentGait = 'walk';
    }

    // Advance stride phase matched to ground speed & breed leg length
    let strideScale = 1.0;
    if (moveBlend > 0.001) {
      const strideLen =
        (wWalk * 2.15 + wTrot * 3.15 + wGallop * 4.95) * effLegLen / Math.max(0.001, moveBlend);
      const strideFreq = THREE.MathUtils.clamp(this.currentSpeed / Math.max(0.18, strideLen), 0.5, 4.2);
      this._gaitPhase = frac(this._gaitPhase + strideFreq * dt);
      // Scale stride amplitude gently at very slow creeping speeds
      strideScale = smoothstep(0.02, 0.65, this.currentSpeed);
    }

    const gp = this._gaitPhase;
    const gp2 = gp * Math.PI * 2;

    // Secondary locomotion body dynamics (bob, sway, counter-yaw, gallop spinal flexion!)
    let locoPelvisX = 0;
    let locoPelvisY = 0;
    let locoPelvisRotX = 0;
    let locoPelvisRotY = 0;
    let locoPelvisRotZ = 0;
    let locoSpine1X = 0;
    let locoSpine2X = 0;
    let locoSpine1Y = 0;
    let locoChestY = 0;
    let locoNeckX = 0;
    let locoHeadX = 0;

    if (moveBlend > 0.001) {
      // Walk: gentle lateral weight shift + subtle counter-yaw + double-frequency bob
      locoPelvisX += wWalk * Math.sin(gp2) * H * 0.022 * strideScale;
      locoPelvisY += wWalk * Math.abs(Math.sin(gp2)) * H * 0.024 * strideScale;
      locoPelvisRotY += wWalk * Math.sin(gp2) * 0.065 * strideScale;
      locoSpine1Y += wWalk * (-Math.sin(gp2) * 0.055) * strideScale;
      locoChestY += wWalk * (-Math.sin(gp2) * 0.055) * strideScale;
      locoPelvisRotZ += wWalk * Math.cos(gp2) * 0.032 * strideScale;
      locoHeadX += wWalk * Math.sin(gp2 * 2 + 0.6) * 0.045 * strideScale;

      // Trot: crisp springy 2-beat suspension bounce, steady head
      locoPelvisY += wTrot * (Math.abs(Math.sin(gp2)) * H * 0.065 - H * 0.015);
      locoPelvisRotX += wTrot * (0.04 + Math.sin(gp2 * 2) * 0.035);
      locoSpine1X += wTrot * Math.sin(gp2 * 2 - 0.5) * 0.03;
      locoNeckX += wTrot * (0.12 - Math.sin(gp2 * 2) * 0.04);
      locoHeadX += wTrot * (-0.08 + Math.sin(gp2 * 2) * 0.03);

      // Gallop: iconic canine double-suspension spinal flexion/extension & bounding arc!
      const gFlex = Math.sin(gp2 + 0.5); // + = gathered curl, - = extended flight
      const gPitch = Math.cos(gp2 + 0.35);
      locoPelvisY += wGallop * (Math.sin(gp2 - 0.35) * H * 0.13 + H * 0.05);
      locoPelvisRotX += wGallop * (gPitch * 0.24 + 0.05);
      locoSpine1X += wGallop * (-gFlex * 0.22);
      locoSpine2X += wGallop * (-gFlex * 0.20);
      locoNeckX += wGallop * (0.34 - gPitch * 0.14);
      locoHeadX += wGallop * (-0.28 + gPitch * 0.12);
    }

    // 3. Breathing & Panting Micro-Life
    const breathRate = isSleep ? 0.30 : (0.52 + this.pantLevel * 2.6 + moveBlend * 0.85);
    this._breathPhase += dt * breathRate * Math.PI * 2;
    const breath = Math.sin(this._breathPhase);
    const breathAmp = isSleep ? 0.032 : (0.016 + this.pantLevel * 0.022);

    this._pantPhase += dt * (3.6 + this.pantLevel * 1.1) * Math.PI * 2;
    const pantOsc = 0.5 + 0.5 * Math.sin(this._pantPhase);

    // 4. LookAt, Blinking, Ear Twitches
    this._updateLookAt(dt);
    const blinkAmt = this._updateBlinking(dt);
    this._updateEarTwitches(dt);

    // 5. Apply Transforms to Skeleton Hierarchy
    const j = this.joints;
    const na = this.metrics.neutralAngles;

    // Pelvis
    j.pelvis.position.set(
      s.pelvisX + locoPelvisX,
      s.pelvisY + locoPelvisY,
      s.pelvisZ
    );
    j.pelvis.rotation.set(
      s.pelvisRotX + locoPelvisRotX,
      s.pelvisRotY + locoPelvisRotY,
      s.pelvisRotZ + locoPelvisRotZ
    );

    // Spine1, Spine2, Chest (+ living breathing ribcage expansion!)
    j.spine1.rotation.set(s.spine1X + locoSpine1X, s.spine1Y + locoSpine1Y, s.spine1Z);
    j.spine2.rotation.set(s.spine2X + locoSpine2X, s.spine2Y, s.spine2Z);
    j.chest.rotation.set(s.chestX, s.chestY + locoChestY, s.chestZ);

    const ribScaleXZ = 1.0 + breath * breathAmp;
    const ribScaleY = 1.0 + breath * breathAmp * 0.7;
    j.chest.scale.set(ribScaleXZ, ribScaleY, 1.0);
    j.spine2.scale.set(1.0 + breath * breathAmp * 0.7, 1.0 + breath * breathAmp * 0.5, 1.0);

    // Neck & Head (+ LookAt distributed smoothly across neck -> head -> eyes)
    const lookSuppress = (this._targetPose === 'shake' || this._targetPose === 'roll' || isSleep) ? 0.1 : 1.0;
    const neckLookYaw = this._lookYaw * 0.36 * lookSuppress;
    const neckLookPitch = this._lookPitch * 0.30 * lookSuppress;
    const headLookYaw = this._lookYaw * 0.48 * lookSuppress;
    const headLookPitch = this._lookPitch * 0.48 * lookSuppress;

    j.neck.rotation.set(
      na.neckX + s.neckX + locoNeckX + neckLookPitch + breath * 0.008,
      s.neckY + neckLookYaw,
      s.neckZ
    );

    j.head.rotation.set(
      na.headX + s.headX + locoHeadX + headLookPitch,
      s.headY + headLookYaw,
      s.headZ + this._headTilt * lookSuppress
    );

    // Eyes (fast crisp gaze tracking inside fixed eyelid sockets!)
    const eyeYawDelta = THREE.MathUtils.clamp((this._eyeYaw - (neckLookYaw + headLookYaw)) * 0.65, -0.30, 0.30);
    const eyePitchDelta = THREE.MathUtils.clamp((this._eyePitch - (neckLookPitch + headLookPitch)) * 0.55, -0.22, 0.22);
    if (this.eyes.length >= 2) {
      this.eyes[0].rotation.set(eyePitchDelta, eyeYawDelta, 0);
      this.eyes[1].rotation.set(eyePitchDelta, eyeYawDelta, 0);
    }

    // Eyelids (combine pose closure + autonomous blinking)
    const lidClose = THREE.MathUtils.clamp(Math.max(s.eyelidClose, blinkAmt), 0, 1);
    const lidRot = lidClose * 1.42;
    if (j.eyelidL) j.eyelidL.rotation.x = lidRot;
    if (j.eyelidR) j.eyelidR.rotation.x = lidRot;

    // Jaw & Tongue (combine pose mouth action + exertion panting!)
    const allowPant =
      this._targetPose !== 'drink' &&
      this._targetPose !== 'eat' &&
      this._targetPose !== 'bark' &&
      this._targetPose !== 'howl' &&
      this._targetPose !== 'stretch' &&
      !isSleep;
    const pantJaw = allowPant ? this.pantLevel * (0.20 + pantOsc * 0.14) : 0;
    const pantTongue = allowPant ? this.pantLevel * (0.55 + pantOsc * 0.38) : 0;

    const finalJaw = Math.max(s.jawX, pantJaw);
    const finalTongueOut = Math.max(s.tongueOut, pantTongue);
    const finalTongueCurl = Math.max(s.tongueCurl, allowPant ? this.pantLevel * (0.25 + pantOsc * 0.25) : 0);

    if (j.jaw) j.jaw.rotation.x = finalJaw;
    if (j.tongue) {
      j.tongue.scale.set(1.0, 1.0, 0.45 + finalTongueOut * 0.82);
      j.tongue.position.z = this.metrics.headSize * 0.34 + this.metrics.muzzleLength * (0.20 + finalTongueOut * 0.22);
      j.tongue.rotation.x = 0.08 + finalTongueCurl * 0.48;
      j.tongue.visible = finalJaw > 0.05 || finalTongueOut > 0.05;
    }

    // 6. Ears (mode + breed type + gallop streamlining + shake inertia + autonomous twitches)
    this._applyEars(moveBlend, wGallop, s.headZ);

    // 7. 4 Legs (blend static pose + biomechanical walk/trot/gallop + fire footstep events)
    const legKeys = ['FL', 'FR', 'BL', 'BR'];
    for (const key of legKeys) {
      const leg = j[key];
      const isFront = key === 'FL' || key === 'FR';
      const side = key === 'FL' || key === 'BL' ? 1 : -1;

      let locoUx = 0;
      let locoLx = 0;
      let locoPx = 0;
      let domStance = true;

      if (moveBlend > 0.001) {
        const cw = evalLegCycle(frac(gp + GAIT_WALK.offsets[key]), isFront, GAIT_WALK);
        const ct = evalLegCycle(frac(gp + GAIT_TROT.offsets[key]), isFront, GAIT_TROT);
        const cg = evalLegCycle(frac(gp + GAIT_GALLOP.offsets[key]), isFront, GAIT_GALLOP);

        locoUx = (wWalk * cw.upperX + wTrot * ct.upperX + wGallop * cg.upperX) * strideScale;
        locoLx = (wWalk * cw.lowerX + wTrot * ct.lowerX + wGallop * cg.lowerX) * strideScale;
        locoPx = (wWalk * cw.pawX + wTrot * ct.pawX + wGallop * cg.pawX) * strideScale;

        domStance = wGallop > 0.5 ? cg.inStance : (wTrot > 0.5 ? ct.inStance : cw.inStance);

        if (!this._prevStance[key] && domStance && moveBlend > 0.25 && this._stepCooldown <= 0) {
          this._emit('step');
          this._stepCooldown = wGallop > 0.5 ? 0.06 : 0.085;
        }
        this._prevStance[key] = domStance;
      } else {
        this._prevStance[key] = true;
      }

      const baseUx = isFront ? na.frontUpperX : na.backUpperX;
      const baseLx = isFront ? na.frontLowerX : na.backLowerX;
      const basePx = isFront ? na.frontPawX : na.backPawX;

      // Pose leg offsets attenuate cleanly as locomotion takes over
      const poseW = 1.0 - moveBlend;
      const rootJoint = isFront ? leg.shoulder : leg.hip;
      rootJoint.rotation.z = s[key].az * poseW + (wGallop * 0.04 * side);

      leg.upper.rotation.x = baseUx + s[key].ux * poseW + locoUx;
      leg.lower.rotation.x = baseLx + s[key].lx * poseW + locoLx;
      leg.paw.rotation.x = basePx + s[key].px * poseW + locoPx;
    }

    // 8. 5-Segment Travelling-Wave Tail Animation
    this._applyTail(dt, moveBlend, wGallop);

    // 9. Update Fur Shader Dynamic Uniforms (shake flutter & time)
    if (this.dog.furUniforms) {
      this.dog.furUniforms.uTime.value = this._time;
      const targetShake = this._targetPose === 'shake' ? 1.0 : 0.0;
      this.dog.furUniforms.uShake.value = damp(this.dog.furUniforms.uShake.value, targetShake, 10.0, dt);
    }
  }

  _applyEars(moveBlend, wGallop, headRollZ) {
    const j = this.joints;
    const base = this.metrics.earBaseRot || { x: 0.10, y: 0.14, z: -0.15 };
    const earType = this.breed.earType || 'erect';
    const isSleep = SLEEP_POSES.has(this._targetPose);

    let modeX = 0;
    let modeY = 0;
    let modeZ = 0;

    if (earType === 'erect') {
      if (this._earMode === 'alert') {
        modeX = 0.16; modeY = -0.10; modeZ = 0.12; // Perked tall & forward!
      } else if (this._earMode === 'back') {
        modeX = -0.42; modeY = 0.28; modeZ = -0.34; // Pinned affectionately/aerodynamically back
      }
      if (isSleep) {
        modeX = -0.22; modeZ = -0.22;
      }
    } else {
      // Drop & fold ears lift slightly when alert, draw softly back when 'back'
      if (this._earMode === 'alert') {
        modeX = -0.18; modeY = -0.12; modeZ = 0.16;
      } else if (this._earMode === 'back') {
        modeX = 0.24; modeY = 0.18; modeZ = -0.10;
      }
    }

    // Running bounce & streamlining
    const gallopPin = wGallop * (earType === 'erect' ? -0.28 : 0.28);
    const bounceFlop = earType === 'erect'
      ? 0
      : Math.sin(this._gaitPhase * Math.PI * 4) * moveBlend * 0.16;

    // Floppy inertial slap during wet-dog shake
    const shakeFlap = this._targetPose === 'shake'
      ? Math.sin(this._poseTime * 6.6 * Math.PI * 2 - 0.85) * (earType === 'erect' ? 0.22 : 0.72)
      : 0;

    const twL = this._earTwitchL * (earType === 'erect' ? 0.24 : 0.12);
    const twR = this._earTwitchR * (earType === 'erect' ? 0.24 : 0.12);

    if (j.earL) {
      j.earL.rotation.set(
        base.x + modeX + gallopPin - twL * 0.6 + bounceFlop,
        base.y + modeY + twL * 0.5,
        base.z + modeZ - twL * 0.4 + shakeFlap - headRollZ * 0.25
      );
    }
    if (j.earR) {
      j.earR.rotation.set(
        base.x + modeX + gallopPin - twR * 0.6 + bounceFlop,
        -(base.y + modeY + twR * 0.5),
        -(base.z + modeZ - twR * 0.4) + shakeFlap - headRollZ * 0.25
      );
    }
  }

  _applyTail(dt, moveBlend, wGallop) {
    const j = this.joints;
    const na = this.metrics.neutralAngles;
    const s = this._s;
    const tailType = this.breed.tailType || 'straight';
    const isSleep = SLEEP_POSES.has(this._targetPose);

    let wagFreq = 0.9;
    let wagAmp = 0.08;
    let liftBias = 0.0;

    if (isSleep) {
      wagFreq = 0.25;
      wagAmp = 0.015;
      liftBias = -0.25;
    } else if (this._tailMode === 'happyWag' || this._targetPose === 'play_bow') {
      wagFreq = 5.0;
      wagAmp = tailType === 'curled' ? 0.30 : (tailType === 'short' ? 0.48 : 0.46);
      liftBias = 0.28;
    } else if (this._tailMode === 'wag') {
      wagFreq = 3.2;
      wagAmp = tailType === 'curled' ? 0.22 : (tailType === 'short' ? 0.36 : 0.34);
      liftBias = 0.14;
    } else if (this._tailMode === 'down') {
      wagFreq = 0.6;
      wagAmp = 0.04;
      liftBias = -0.45;
    } else if (this._tailMode === 'tucked') {
      wagFreq = 0.4;
      wagAmp = 0.02;
      liftBias = -0.95;
    } else {
      // 'relaxed'
      wagFreq = 1.0 + moveBlend * 1.4;
      wagAmp = 0.09 + moveBlend * 0.10;
      liftBias = 0.0;
    }

    // Streamline tail horizontally during full gallop for aerodynamic balance
    if (wGallop > 0.1) {
      liftBias = THREE.MathUtils.lerp(liftBias, -na.tailBaseX + 0.05, wGallop * 0.75);
      wagAmp *= (1.0 - wGallop * 0.65);
    }

    this._tailPhase += dt * wagFreq * Math.PI * 2;
    const tails = [j.tail1, j.tail2, j.tail3, j.tail4, j.tail5];

    // Shake wave propagates cleanly into tail
    const isShake = this._targetPose === 'shake';
    const shakeW = this._poseTime * 6.6 * Math.PI * 2 - 2.6;

    for (let i = 0; i < 5; i++) {
      const tj = tails[i];
      if (!tj) continue;

      // Travelling wave along tail segments for organic whip/plume feel
      const phaseLag = i * 0.44;
      const segWeight = i === 0 ? 1.0 : (0.52 + i * 0.08);
      const wagYaw = Math.sin(this._tailPhase - phaseLag) * wagAmp * segWeight;
      const shakeRoll = isShake ? Math.sin(shakeW - i * 0.45) * 0.26 : 0;

      if (i === 0) {
        const pitchBase = na.tailBaseX + s.tailBaseX + liftBias;
        tj.rotation.set(
          THREE.MathUtils.clamp(pitchBase, -1.25, 1.35),
          s.tailBaseY + wagYaw,
          shakeRoll
        );
      } else {
        // Curled tails relax their curl slightly when tucked or sleeping
        const curlScale = this._tailMode === 'tucked' ? 0.15 : (isSleep ? 0.55 : 1.0);
        const segPitch = na.tailSegX * curlScale + s.tailSegX + (this._tailMode === 'tucked' ? -0.18 : 0);
        tj.rotation.set(
          segPitch,
          wagYaw * 0.72 + s.tailCurlYaw,
          shakeRoll
        );
      }
    }
  }
}
