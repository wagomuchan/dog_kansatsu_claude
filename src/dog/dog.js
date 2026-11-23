import * as THREE from 'three';
import { buildDog } from './body.js';
import { DogAnimator } from './animator.js';
import { DogBrain } from './brain.js';

const TWO_PI = Math.PI * 2;

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function wrapAngle(a) {
  let r = (a + Math.PI) % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r - Math.PI;
}

function isObject3D(obj) {
  return Boolean(obj && obj.rotation && typeof obj.rotation.x === 'number');
}

function getGroundY(garden, x, z) {
  if (garden && typeof garden.getGroundHeight === 'function') {
    let y = garden.getGroundHeight(x, z);
    if (Number.isFinite(y)) {
      // 犬小屋の床とクッションの上にのる
      const s = garden.doghouseSurface;
      if (s) {
        const dx = x - s.x, dz = z - s.z;
        const c = Math.cos(s.rotY), sn = Math.sin(s.rotY);
        const lx = dx * c - dz * sn;
        const lz = dx * sn + dz * c;
        if (Math.abs(lx) < s.floorHalfW && Math.abs(lz - s.floorCz) < s.floorHalfD) y = Math.max(y, s.floorTop);
        const e = Math.hypot(lx / s.cushionRx, (lz - s.cushionCz) / s.cushionRz);
        if (e < 1) {
          const k = Math.min(1, (1 - e) / 0.25); // ふちはなだらかに
          y = Math.max(y, s.floorTop + (s.cushionTop - s.floorTop) * k);
        }
      }
      return y;
    }
  }
  return 0;
}

function computeBodyMargin(breed) {
  const bodyLen = (typeof breed?.bodyLength === 'number' && Number.isFinite(breed.bodyLength))
    ? breed.bodyLength
    : ((typeof breed?.body?.length === 'number' && Number.isFinite(breed.body.length)) ? breed.body.length : 0.5);
  return clamp(bodyLen * 0.5 + 0.15, 0.28, 0.65);
}

function computeCollisionRadius(breed) {
  const bodyLen = (typeof breed?.bodyLength === 'number' && Number.isFinite(breed.bodyLength))
    ? breed.bodyLength
    : ((typeof breed?.body?.length === 'number' && Number.isFinite(breed.body.length)) ? breed.body.length : 0.5);
  return bodyLen * 0.5 + 0.1;
}

function isWalkable(garden, x, z, margin = 0.4) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > 14.7 || Math.abs(z) > 14.7) return false;
  if (garden && typeof garden.isInside === 'function') {
    return Boolean(garden.isInside(x, z, margin));
  }
  return Math.abs(x) < 14.2 - margin && Math.abs(z) < 14.2 - margin;
}

function findNearestWalkable(garden, x, z, margin) {
  if (isWalkable(garden, x, z, margin)) return { x, z };
  for (let r = 0.25; r <= 4.0; r += 0.35) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TWO_PI;
      const nx = x + Math.sin(a) * r;
      const nz = z + Math.cos(a) * r;
      if (isWalkable(garden, nx, nz, margin)) return { x: nx, z: nz };
    }
  }
  return null;
}

function findSpawnPoint(garden, margin = 0.55) {
  const safeMargin = Math.max(0.65, margin + 0.1);
  const preferred = [
    { x: 0.5, z: 2.2 },
    { x: -1.5, z: 1.5 },
    { x: 2.0, z: 0.5 },
    { x: 0.0, z: 0.0 },
  ];
  for (let i = 0; i < preferred.length; i++) {
    const p = preferred[i];
    if (isWalkable(garden, p.x, p.z, safeMargin)) return p;
  }
  if (garden && typeof garden.randomWalkablePoint === 'function') {
    for (let i = 0; i < 8; i++) {
      const pt = garden.randomWalkablePoint();
      if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.z) && isWalkable(garden, pt.x, pt.z, margin)) {
        return { x: pt.x, z: pt.z };
      }
    }
  }
  return { x: 0, z: 2 };
}

function resolveLegJoints(joints) {
  if (!joints) return { FL: [], FR: [], BL: [], BR: [] };
  const sides = ['FL', 'FR', 'BL', 'BR'];
  const out = {};
  for (let i = 0; i < sides.length; i++) {
    const s = sides[i];
    const parts = [];
    const direct = joints[s] || joints[s.toLowerCase()] || joints.legs?.[s];
    if (Array.isArray(direct)) {
      for (let j = 0; j < direct.length; j++) {
        if (isObject3D(direct[j])) parts.push(direct[j]);
      }
    } else if (direct && typeof direct === 'object') {
      const order = ['shoulder', 'hip', 'upper', 'lower', 'paw'];
      for (let j = 0; j < order.length; j++) {
        if (isObject3D(direct[order[j]])) parts.push(direct[order[j]]);
      }
    } else {
      const names = [
        `shoulder${s}`, `hip${s}`, `${s}Shoulder`, `${s}Hip`, `${s}_shoulder`, `${s}_hip`,
        `upper${s}`, `${s}Upper`, `${s}_upper`,
        `lower${s}`, `${s}Lower`, `${s}_lower`,
        `paw${s}`, `${s}Paw`, `${s}_paw`,
      ];
      for (let j = 0; j < names.length; j++) {
        if (isObject3D(joints[names[j]])) parts.push(joints[names[j]]);
      }
    }
    out[s] = parts;
  }
  return out;
}

export class Dog {
  constructor(scene, garden, breed, id = 0) {
    this.scene = scene;
    this.garden = garden;
    this.breed = breed;
    this.id = typeof id === 'number' ? id : (typeof id?.id === 'number' ? id.id : 0);
    this.bodyMargin = computeBodyMargin(breed);
    this.collisionRadius = computeCollisionRadius(breed);

    const spawn = findSpawnPoint(garden, this.bodyMargin);
    this.position = new THREE.Vector3(spawn.x, getGroundY(garden, spawn.x, spawn.z), spawn.z);
    this.heading = 0.25;
    this.speed = 0;
    this._angularVel = 0;
    this._blockedLastFrame = false;
    this._escapeSide = (this.id % 2 === 0) ? 1 : -1;

    // Terrain alignment & dynamic body tilt
    this._pitch = 0;
    this._roll = 0;
    this._jumpHeight = 0;

    // Coat & thermal physiological state
    this.furWetness = 0;
    this.snowOnFur = 0;
    this.dirtiness = 0;
    this.heatLoad = 0;
    this.inShelter = false;

    // Event relay (animator.onEvent + brain vocalizations)
    this.onEvent = null;
    this._lastEventTime = {};
    this._clockSec = 0;

    // Smoothed additive micro-animation state (prevents pops & joint drift)
    this._smoothHeadTilt = 0;
    this._smoothYawn = 0;
    this._smoothLegLift = 0;
    this._smoothPant = 0;
    this._appliedAdditives = [];

    // Build brain, body, and animator
    this.brain = new DogBrain(breed);
    this.brain.dogId = this.id;
    this.body = null;
    this.animator = null;
    this._legJoints = { FL: [], FR: [], BL: [], BR: [] };

    this._mountBody(breed);
  }

  get root() {
    return this.body?.root ?? null;
  }

  get action() {
    return this.brain.action;
  }

  get mood() {
    return this.brain.mood;
  }

  get needs() {
    return this.brain.needs;
  }

  get isSleeping() {
    return this.brain.isSleeping;
  }

  _mountBody(breed) {
    const newBody = buildDog(breed);
    const newAnimator = new DogAnimator(newBody, breed);

    if (newBody?.root) {
      newBody.root.rotation.order = 'YXZ';
      newBody.root.position.copy(this.position);
      newBody.root.rotation.set(this._pitch, this.heading, this._roll);
      this.scene?.add?.(newBody.root);
    }

    newBody?.setFurWetness?.(this.furWetness);
    newBody?.setSnowOnFur?.(this.snowOnFur);
    newBody?.setDirtiness?.(this.dirtiness);

    newAnimator.onEvent = (name) => this._emitEvent(name);

    this.body = newBody;
    this.animator = newAnimator;
    this._legJoints = resolveLegJoints(newBody?.joints);
    this._appliedAdditives.length = 0;

    // Sync initial animator pose/tail/ears/lookAt with brain state
    if (this.brain) {
      newAnimator.setPose?.(this.brain._lastPose || 'stand');
      newAnimator.setTail?.(this.brain._lastTail || 'relaxed');
      newAnimator.setEars?.(this.brain._lastEars || 'relaxed');
      newAnimator.setGait?.(this.speed);
      if (this.brain._lastLookAt) {
        newAnimator.lookAt?.(this.brain._lastLookAt);
      }
    }
  }

  setBreed(newBreed) {
    if (!newBreed) return;
    this._undoAdditiveJoints();

    const oldBody = this.body;
    if (oldBody?.root) {
      this.scene?.remove?.(oldBody.root);
    }
    oldBody?.dispose?.();

    this.breed = newBreed;
    this.bodyMargin = computeBodyMargin(newBreed);
    this.collisionRadius = computeCollisionRadius(newBreed);
    this.brain.setBreed(newBreed);

    // If switching to a larger breed put the dog too close to an obstacle, nudge to nearest walkable point
    if (!this.brain._insideDoghouse && !isWalkable(this.garden, this.position.x, this.position.z, this.bodyMargin)) {
      const safe = findNearestWalkable(this.garden, this.position.x, this.position.z, this.bodyMargin);
      if (safe) {
        this.position.x = safe.x;
        this.position.z = safe.z;
        this.position.y = getGroundY(this.garden, safe.x, safe.z) + this._jumpHeight;
      }
    }

    this._mountBody(newBreed);
  }

  changeBreed(newBreed) {
    this.setBreed(newBreed);
  }

  _emitEvent(name) {
    if (!name || typeof this.onEvent !== 'function') return;
    const dedupWindows = {
      bark: 0.28,
      howl: 0.6,
      whine: 0.5,
      snore: 0.6,
      shake: 0.5,
      lap: 0.22,
      dig: 0.22,
      pant: 0.4,
      step: 0.08,
    };
    const minGap = dedupWindows[name] ?? 0.15;
    const last = this._lastEventTime[name] ?? -999;
    if (this._clockSec - last < minGap) return;
    this._lastEventTime[name] = this._clockSec;
    this.onEvent(name, this.position);
  }

  update(realDt, worldDt, ctx = {}) {
    const dt = clamp(Number.isFinite(realDt) ? realDt : 0.016, 0.0001, 0.1);
    const wDt = Math.max(0, Number.isFinite(worldDt) ? worldDt : dt * 30);
    this._clockSec += dt;

    const garden = ctx.garden || this.garden;
    const clock = ctx.clock || null;
    const cameraPos = ctx.cameraPos || ctx.camera?.position || null;
    const others = Array.isArray(ctx.others)
      ? ctx.others.filter((o) => o && o !== this && o.position)
      : [];

    this.brain.dogId = this.id;

    // 1. Run AI brain
    const brainOut = this.brain.update(wDt, {
      clock,
      garden,
      dog: {
        id: this.id,
        position: this.position,
        heading: this.heading,
        speed: this.speed,
        collisionRadius: this.collisionRadius,
        furWetness: this.furWetness,
        snowOnFur: this.snowOnFur,
        dirtiness: this.dirtiness,
        heatLoad: this.heatLoad,
        inShelter: this.inShelter,
        blocked: this._blockedLastFrame,
      },
      selfDog: this,
      others,
      cameraPos,
      animator: this.animator,
      realDt: dt,
      emitEvent: (name) => this._emitEvent(name),
    });

    this.inShelter = Boolean(brainOut.inShelter);

    // 2. Smooth physical locomotion & terrain following (with inter-dog avoidance & separation)
    this._integrateLocomotion(dt, garden, brainOut.locomotion, brainOut.motionEffects, others);

    // 3. Environmental fur wetness, snow, dirtiness, and heat load
    this._updateCoatAndHeat(dt, clock, garden, brainOut.coatDelta);

    // 4. Undo previous frame's additive joint deltas before DogAnimator runs
    this._undoAdditiveJoints();

    // 5. Drive procedural animator with actual ground speed (zero foot sliding!)
    this.animator?.setGait?.(this.speed);
    this.animator?.update?.(dt);

    // 6. Apply subtle additive canine micro-animations on top
    this._applyAdditiveJoints(dt, brainOut.motionEffects);
  }

  _isPositionWalkable(garden, x, z, allowDoghouseInterior) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.abs(x) > 14.6 || Math.abs(z) > 14.6) return false;
    if (allowDoghouseInterior) {
      const dhIn = garden?.poi?.doghouseInside;
      const dhOut = garden?.poi?.doghouse;
      const nearIn = dhIn && Math.hypot(x - dhIn.x, z - dhIn.z) < 2.35;
      const nearOut = dhOut && Math.hypot(x - dhOut.x, z - dhOut.z) < 2.35;
      if (nearIn || nearOut) return true;
    }
    return isWalkable(garden, x, z, this.bodyMargin);
  }

  _getOtherRadius(other) {
    if (typeof other?.collisionRadius === 'number' && Number.isFinite(other.collisionRadius)) {
      return other.collisionRadius;
    }
    return computeCollisionRadius(other?.breed);
  }

  _collidesWithOthers(x, z, others, extraPad = 0) {
    if (!others || others.length === 0) return null;
    for (let i = 0; i < others.length; i++) {
      const o = others[i];
      if (!o || !o.position) continue;
      const minDist = this.collisionRadius + this._getOtherRadius(o) + extraPad;
      const dx = x - o.position.x;
      const dz = z - o.position.z;
      if (dx * dx + dz * dz < minDist * minDist) {
        return o;
      }
    }
    return null;
  }

  _pickEscapeHeading(garden, x, z, heading, allowInterior, others = null) {
    const stepOffsets = [0.45, 0.9, 1.35, 1.8, 2.3, Math.PI];
    const probeDists = [0.35, 0.75, 1.2];
    const sides = [this._escapeSide, -this._escapeSide];

    let bestAngle = wrapAngle(heading + this._escapeSide * 1.15);
    let bestScore = -Infinity;
    let chosenSide = this._escapeSide;

    for (let i = 0; i < stepOffsets.length; i++) {
      const off = stepOffsets[i];
      for (let s = 0; s < sides.length; s++) {
        const side = sides[s];
        const cand = wrapAngle(heading + side * off);
        const sx = Math.sin(cand);
        const sz = Math.cos(cand);
        let clearCount = 0;
        for (let d = 0; d < probeDists.length; d++) {
          const px = x + sx * probeDists[d];
          const pz = z + sz * probeDists[d];
          if (
            this._isPositionWalkable(garden, px, pz, allowInterior) &&
            !this._collidesWithOthers(px, pz, others, 0.04)
          ) {
            clearCount++;
          } else {
            break;
          }
        }
        if (clearCount === 0) continue;
        const score = clearCount * 2.5 - off * 0.55 + (side === this._escapeSide ? 0.2 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestAngle = cand;
          chosenSide = side;
        }
      }
      if (bestScore >= probeDists.length * 2.5 - off * 0.55) break;
    }

    this._escapeSide = chosenSide;
    return bestAngle;
  }

  _resolveDogCollisions(garden, others, allowInterior) {
    if (!others || others.length === 0) return;
    for (let i = 0; i < others.length; i++) {
      const other = others[i];
      if (!other || !other.position) continue;
      const otherRadius = this._getOtherRadius(other);
      const minDist = this.collisionRadius + otherRadius;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= minDist) continue;

      let ux, uz;
      if (dist > 1e-4) {
        ux = dx / dist;
        uz = dz / dist;
      } else {
        const a = ((this.id - (other.id ?? 0)) * 1.57) + 0.35;
        ux = Math.sin(a);
        uz = Math.cos(a);
      }

      const push = (minDist - dist) + 0.008;
      const baseAngle = Math.atan2(ux, uz);
      const tryOffsets = [0, 0.35, -0.35, 0.75, -0.75, 1.15, -1.15, 1.55, -1.55];
      let resolved = false;

      // Try pushing self out along separation vector (or slightly angled if near wall/obstacle)
      for (let k = 0; k < tryOffsets.length; k++) {
        const ang = baseAngle + tryOffsets[k];
        const mult = k === 0 ? 1.0 : 1.15;
        const tx = clamp(this.position.x + Math.sin(ang) * push * mult, -14.6, 14.6);
        const tz = clamp(this.position.z + Math.cos(ang) * push * mult, -14.6, 14.6);
        const newDist = Math.hypot(tx - other.position.x, tz - other.position.z);
        if (newDist >= minDist - 0.002 && this._isPositionWalkable(garden, tx, tz, allowInterior)) {
          this.position.x = tx;
          this.position.z = tz;
          resolved = true;
          break;
        }
      }

      // Fallback: if self is pinned against a wall/doghouse, nudge other gently if possible
      if (!resolved && !other.brain?._insideDoghouse) {
        const otherMargin = other.bodyMargin || computeBodyMargin(other.breed);
        const otx = clamp(other.position.x - ux * push, -14.6, 14.6);
        const otz = clamp(other.position.z - uz * push, -14.6, 14.6);
        if (isWalkable(garden, otx, otz, otherMargin)) {
          other.position.x = otx;
          other.position.z = otz;
          other.position.y = getGroundY(garden, otx, otz) + (other._jumpHeight || 0);
          if (other.body?.root) {
            other.body.root.position.copy(other.position);
          }
          resolved = true;
        }
      }

      // Final hard guarantee: never leave bodies overlapping
      if (!resolved) {
        this.position.x = clamp(other.position.x + ux * (minDist + 0.008), -14.6, 14.6);
        this.position.z = clamp(other.position.z + uz * (minDist + 0.008), -14.6, 14.6);
      }
    }
  }

  _integrateLocomotion(dt, garden, loco, fx, others = null) {
    const prevHeading = this.heading;
    const allowInterior = Boolean(loco.allowDoghouseInterior);
    const hasOthers = Boolean(others && others.length > 0);
    this._blockedLastFrame = false;

    if (loco.mode === 'move' || loco.mode === 'circle') {
      const targetSpeed = Math.max(0, loco.targetSpeed || 0);
      const accel = targetSpeed > this.speed ? (targetSpeed > 3.5 ? 6.8 : 4.2) : 6.2;
      if (this.speed < targetSpeed) {
        this.speed = Math.min(targetSpeed, this.speed + accel * dt);
      } else {
        this.speed = Math.max(targetSpeed, this.speed - accel * dt);
      }

      const turnDiff = wrapAngle((loco.targetHeading ?? this.heading) - this.heading);
      const maxTurn = (loco.turnRate || 3.4) * dt;
      const stepTurn = clamp(turnDiff, -maxTurn, maxTurn);
      this.heading = wrapAngle(this.heading + stepTurn);
    } else if (loco.mode === 'turn') {
      this.speed = Math.max(0, this.speed - 6.8 * dt);
      const turnDiff = wrapAngle((loco.targetHeading ?? this.heading) - this.heading);
      const maxTurn = (loco.turnRate || 3.0) * dt;
      this.heading = wrapAngle(this.heading + clamp(turnDiff, -maxTurn, maxTurn));
    } else {
      this.speed = Math.max(0, this.speed - 6.8 * dt);
    }

    // Final defense: advance position only if walkable; cancel move & turn away if blocked (no clipping!)
    if (this.speed > 0.005) {
      const prevX = this.position.x;
      const prevZ = this.position.z;
      const stepDist = this.speed * dt;
      const dx = Math.sin(this.heading) * stepDist;
      const dz = Math.cos(this.heading) * stepDist;
      const midX = prevX + dx * 0.5;
      const midZ = prevZ + dz * 0.5;
      const nx = prevX + dx;
      const nz = prevZ + dz;

      const envWalkable =
        this._isPositionWalkable(garden, midX, midZ, allowInterior) &&
        this._isPositionWalkable(garden, nx, nz, allowInterior);

      let dogBlocked = null;
      if (hasOthers && envWalkable) {
        const hit = this._collidesWithOthers(nx, nz, others, 0) || this._collidesWithOthers(midX, midZ, others, 0);
        if (hit) {
          // Allow movement only if it strictly increases distance away from the colliding dog
          const curDist = Math.hypot(prevX - hit.position.x, prevZ - hit.position.z);
          const nextDist = Math.hypot(nx - hit.position.x, nz - hit.position.z);
          if (nextDist <= curDist + 0.002) {
            dogBlocked = hit;
          }
        }
      }

      if (envWalkable && !dogBlocked) {
        this.position.x = nx;
        this.position.z = nz;
      } else if (dogBlocked) {
        // Slide tangentially around the other dog if possible, otherwise slow & steer away
        const rx = prevX - dogBlocked.position.x;
        const rz = prevZ - dogBlocked.position.z;
        const rd = Math.hypot(rx, rz) || 1;
        const t1x = -rz / rd;
        const t1z = rx / rd;
        const dot1 = dx * t1x + dz * t1z;
        const sign = dot1 >= 0 ? 1 : -1;
        const slideDist = stepDist * 0.72;
        const sx = prevX + t1x * sign * slideDist;
        const sz = prevZ + t1z * sign * slideDist;

        if (
          this._isPositionWalkable(garden, sx, sz, allowInterior) &&
          !this._collidesWithOthers(sx, sz, others, 0)
        ) {
          this.position.x = sx;
          this.position.z = sz;
          const slideAngle = Math.atan2(sx - prevX, sz - prevZ);
          const diff = wrapAngle(slideAngle - this.heading);
          this.heading = wrapAngle(this.heading + clamp(diff, -5.0 * dt, 5.0 * dt));
        } else {
          this._blockedLastFrame = true;
          this.position.x = prevX;
          this.position.z = prevZ;
          this.speed = Math.min(this.speed * 0.25, 0.3);
          const escapeHeading = this._pickEscapeHeading(garden, prevX, prevZ, this.heading, allowInterior, others);
          const diff = wrapAngle(escapeHeading - this.heading);
          const maxEscapeTurn = Math.max(0.32, 6.2 * dt);
          this.heading = wrapAngle(this.heading + clamp(diff, -maxEscapeTurn, maxEscapeTurn));
        }
      } else {
        // Cancel this frame's movement and turn smoothly away from the obstacle
        this._blockedLastFrame = true;
        this.position.x = prevX;
        this.position.z = prevZ;
        this.speed = Math.min(this.speed * 0.25, 0.3);

        // If somehow already slightly inside an unwalkable margin, steer back toward nearest safe point
        if (!allowInterior && !this._isPositionWalkable(garden, prevX, prevZ, false)) {
          const safe = findNearestWalkable(garden, prevX, prevZ, this.bodyMargin);
          if (safe) {
            const rx = safe.x - prevX;
            const rz = safe.z - prevZ;
            const rd = Math.hypot(rx, rz) || 1;
            const pull = Math.min(rd, Math.max(0.06, dt * 1.4));
            this.position.x = prevX + (rx / rd) * pull;
            this.position.z = prevZ + (rz / rd) * pull;
            const outAngle = Math.atan2(rx, rz);
            const diff = wrapAngle(outAngle - this.heading);
            this.heading = wrapAngle(this.heading + clamp(diff, -5.5 * dt, 5.5 * dt));
          }
        } else {
          const escapeHeading = this._pickEscapeHeading(garden, prevX, prevZ, this.heading, allowInterior, others);
          const diff = wrapAngle(escapeHeading - this.heading);
          const maxEscapeTurn = Math.max(0.32, 6.2 * dt);
          this.heading = wrapAngle(this.heading + clamp(diff, -maxEscapeTurn, maxEscapeTurn));
        }
      }
    }

    // Post-move inter-dog overlap separation (never allow clipping between dogs)
    if (hasOthers) {
      this._resolveDogCollisions(garden, others, allowInterior);
    }

    const dHeading = wrapAngle(this.heading - prevHeading);
    this._angularVel = lerp(this._angularVel, dHeading / dt, clamp(dt * 8, 0, 1));

    // Clamp to outer yard bounds as final safety net
    this.position.x = clamp(this.position.x, -14.6, 14.6);
    this.position.z = clamp(this.position.z, -14.6, 14.6);

    // Ground height & jump arc
    const groundY = getGroundY(garden, this.position.x, this.position.z);
    const targetJump = fx?.jumpHeight || 0;
    this._jumpHeight = lerp(this._jumpHeight, targetJump, clamp(dt * 18, 0, 1));
    this.position.y = groundY + this._jumpHeight;

    // Terrain slope pitch & roll + dynamic turn banking
    const fwdX = Math.sin(this.heading);
    const fwdZ = Math.cos(this.heading);
    const leftX = fwdZ;
    const leftZ = -fwdX;

    const span = 0.38;
    const hFront = getGroundY(garden, this.position.x + fwdX * span, this.position.z + fwdZ * span);
    const hBack = getGroundY(garden, this.position.x - fwdX * span, this.position.z - fwdZ * span);
    const hLeft = getGroundY(garden, this.position.x + leftX * 0.22, this.position.z + leftZ * 0.22);
    const hRight = getGroundY(garden, this.position.x - leftX * 0.22, this.position.z - leftZ * 0.22);

    // Positive X rotation pitches +Z nose down, so nose-up slope is negative
    const targetPitch = clamp(-Math.atan2(hFront - hBack, span * 2), -0.32, 0.32);
    // Banking into turns (turning left = positive angularVel -> lean left = negative Z rotation)
    const turnBank = clamp(-this._angularVel * this.speed * 0.036, -0.20, 0.20);
    const slopeRoll = clamp(Math.atan2(hLeft - hRight, 0.44) * 0.7, -0.22, 0.22);
    const targetRoll = slopeRoll + turnBank;

    const orientBlend = clamp(dt * 8.5, 0, 1);
    this._pitch = lerp(this._pitch, targetPitch, orientBlend);
    this._roll = lerp(this._roll, targetRoll, orientBlend);

    if (this.body?.root) {
      this.body.root.position.copy(this.position);
      this.body.root.rotation.set(this._pitch, this.heading, this._roll);
    }
  }

  _updateCoatAndHeat(dt, clock, garden, coatDelta) {
    const weather = garden?.weather || 'clear';
    const wi = clamp(garden?.weatherIntensity ?? 0, 0, 1);
    const groundWet = clamp(garden?.wetness ?? 0, 0, 1);
    const snowCover = clamp(garden?.snowCover ?? 0, 0, 1);
    const isSummer = (clock?.seasonWeights?.summer ?? (clock?.season === 'summer' ? 1 : 0)) > 0.45;
    const isNight = Boolean(clock?.isNight);

    // Wetness accumulation / drying
    let wet = this.furWetness + (coatDelta?.wetDelta || 0);
    if (weather === 'rain' && wi > 0.15 && !this.inShelter) {
      wet += dt * 0.055 * wi;
    } else {
      const dryRate = (weather === 'clear' && !isNight) ? (isSummer ? 0.016 : 0.011) : 0.006;
      wet -= dt * dryRate;
    }
    if (groundWet > 0.55 && this.speed > 0.8 && !this.inShelter) {
      wet += dt * 0.008 * groundWet;
    }

    // Snow on fur accumulation / melting
    let snow = this.snowOnFur + (coatDelta?.snowDelta || 0);
    if (weather === 'snow' && wi > 0.15 && !this.inShelter) {
      snow += dt * 0.032 * wi;
    } else if (snowCover > 0.35 && this.speed > 2.2 && !this.inShelter) {
      snow += dt * 0.012 * snowCover;
    } else if (snow > 0) {
      const melt = dt * (this.inShelter ? 0.025 : 0.012);
      snow -= melt;
      wet += melt * 0.35;
    }

    // Dirtiness accumulation / gradual shedding
    let dirt = this.dirtiness + (coatDelta?.dirtDelta || 0);
    if (groundWet > 0.6 && this.speed > 2.5 && !this.inShelter) {
      dirt += dt * 0.008;
    }
    if (weather === 'rain' && wi > 0.3 && !this.inShelter) {
      dirt -= dt * 0.018; // Rain gently rinses mud
    } else {
      dirt -= dt * 0.0035;
    }

    // Thermal / exertion heat load (drives panting)
    let heat = this.heatLoad + (coatDelta?.heatDelta || 0);
    if (this.speed > 2.5) {
      heat += dt * (this.speed / 5.5) * 0.095;
    } else if (isSummer && !isNight && weather === 'clear' && !this.inShelter) {
      const hours = clock?.hours ?? 12;
      if (hours > 10 && hours < 16.5) {
        heat += dt * 0.025;
      } else {
        heat -= dt * 0.018;
      }
    } else {
      heat -= dt * (this.inShelter || isNight ? 0.055 : 0.035);
    }

    this.furWetness = clamp(wet, 0, 1);
    this.snowOnFur = clamp(snow, 0, 1);
    this.dirtiness = clamp(dirt, 0, 1);
    this.heatLoad = clamp(heat, 0, 1);

    this.body?.setFurWetness?.(this.furWetness);
    this.body?.setSnowOnFur?.(this.snowOnFur);
    this.body?.setDirtiness?.(this.dirtiness);
  }

  _undoAdditiveJoints() {
    for (let i = this._appliedAdditives.length - 1; i >= 0; i--) {
      const a = this._appliedAdditives[i];
      a.joint.rotation.x -= a.dx;
      a.joint.rotation.y -= a.dy;
      a.joint.rotation.z -= a.dz;
    }
    this._appliedAdditives.length = 0;
  }

  _addJointDelta(joint, dx, dy, dz) {
    if (!isObject3D(joint)) return;
    if (Math.abs(dx) < 1e-5 && Math.abs(dy) < 1e-5 && Math.abs(dz) < 1e-5) return;
    joint.rotation.x += dx;
    joint.rotation.y += dy;
    joint.rotation.z += dz;
    this._appliedAdditives.push({ joint, dx, dy, dz });
  }

  _applyAdditiveJoints(dt, fx) {
    const joints = this.body?.joints;
    if (!joints || !fx) return;

    const blend = clamp(dt * 7.5, 0, 1);
    this._smoothHeadTilt = lerp(this._smoothHeadTilt, fx.headTilt || 0, blend);
    this._smoothYawn = lerp(this._smoothYawn, fx.yawnAmount || 0, clamp(dt * 9, 0, 1));
    this._smoothLegLift = lerp(this._smoothLegLift, fx.legLift || 0, clamp(dt * 6, 0, 1));
    this._smoothPant = lerp(this._smoothPant, fx.pantIntensity || 0, clamp(dt * 4, 0, 1));

    // 1. Charming dog head tilt (首をかしげる)
    if (Math.abs(this._smoothHeadTilt) > 0.005) {
      this._addJointDelta(joints.head, 0, 0, this._smoothHeadTilt);
      this._addJointDelta(joints.neck, 0, 0, this._smoothHeadTilt * 0.28);
      // Slight asymmetric ear response to head tilt
      this._addJointDelta(joints.earL, 0, 0, -this._smoothHeadTilt * 0.18);
      this._addJointDelta(joints.earR, 0, 0, -this._smoothHeadTilt * 0.18);
    }

    // 2. Expressive yawn (あくび)
    if (this._smoothYawn > 0.01) {
      const y = this._smoothYawn;
      this._addJointDelta(joints.jaw, y * 0.58, 0, 0);
      this._addJointDelta(joints.head, -y * 0.22, 0, 0);
      this._addJointDelta(joints.tongue, y * 0.25, 0, 0);
      this._addJointDelta(joints.eyelidL, y * 0.28, 0, 0);
      this._addJointDelta(joints.eyelidR, y * 0.28, 0, 0);
      this._addJointDelta(joints.earL, -y * 0.16, 0, 0);
      this._addJointDelta(joints.earR, -y * 0.16, 0, 0);
    }

    // 3. Lip-licking after eating/drinking (口のまわりを舐める)
    if (fx.lipLickPhase > 0.01) {
      const p = fx.lipLickPhase;
      const lick = Math.sin(p * Math.PI);
      const side = Math.sin(p * TWO_PI);
      this._addJointDelta(joints.jaw, lick * 0.16, 0, 0);
      this._addJointDelta(joints.tongue, lick * 0.35, side * 0.28, 0);
      this._addJointDelta(joints.head, -lick * 0.05, side * 0.06, 0);
    }

    // 4. Dreaming leg twitches & ear flicks during sleep (寝ながら脚をぴくぴく)
    if (fx.dreamTwitch > 0.01) {
      const amp = fx.dreamTwitch;
      const t = this._clockSec;
      const burst = Math.max(0, Math.sin(t * 17.0) * Math.sin(t * 5.3));
      const burst2 = Math.max(0, Math.sin(t * 13.7 + 1.4) * Math.cos(t * 4.1));
      const fl = this._legJoints.FL;
      const fr = this._legJoints.FR;
      const bl = this._legJoints.BL;
      if (fl[1]) this._addJointDelta(fl[1], burst * 0.14 * amp, 0, 0);
      if (fl[2]) this._addJointDelta(fl[2], -burst * 0.18 * amp, 0, 0);
      if (fr[1]) this._addJointDelta(fr[1], burst2 * 0.12 * amp, 0, 0);
      if (bl[2]) this._addJointDelta(bl[2], burst2 * 0.15 * amp, 0, 0);
      this._addJointDelta(joints.earL, burst * 0.12 * amp, 0, 0);
      this._addJointDelta(joints.tail1, 0, Math.sin(t * 9.0) * 0.06 * amp, 0);
    }

    // 5. Hind leg lift for tree marking (マーキング)
    if (this._smoothLegLift > 0.01) {
      const lift = this._smoothLegLift;
      const bl = this._legJoints.BL;
      if (bl[0]) this._addJointDelta(bl[0], -lift * 0.25, 0, lift * 0.92);
      if (bl[1]) this._addJointDelta(bl[1], lift * 0.32, 0, 0);
      if (bl[2]) this._addJointDelta(bl[2], -lift * 0.45, 0, 0);
      this._addJointDelta(joints.pelvis, 0, 0, -lift * 0.14);
    }

    // 6. Subtle panting jaw/tongue rhythm when warm or after running
    if (this._smoothPant > 0.02 && this._smoothYawn < 0.05 && fx.lipLickPhase < 0.01) {
      const pant = this._smoothPant;
      const pulse = 0.5 + 0.5 * Math.sin(this._clockSec * (16 + pant * 8));
      this._addJointDelta(joints.jaw, (0.14 + pulse * 0.10) * pant, 0, 0);
      this._addJointDelta(joints.tongue, (0.20 + pulse * 0.14) * pant, 0, 0);
    }
  }

  dispose() {
    this._undoAdditiveJoints();
    if (this.body?.root) {
      this.scene?.remove?.(this.body.root);
    }
    this.body?.dispose?.();
    this.body = null;
    this.animator = null;
    this.onEvent = null;
  }
}
