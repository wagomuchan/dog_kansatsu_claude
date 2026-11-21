import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;
const _tmpVec = new THREE.Vector3();
const _fallbackDogPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

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

function dist2D(ax, az, bx, bz) {
  return Math.hypot(bx - ax, bz - az);
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function pickWeighted(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) total += items[i].weight;
  if (total <= 0) return items[0]?.item ?? null;
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= items[i].weight;
    if (r <= 0) return items[i].item;
  }
  return items[items.length - 1]?.item ?? null;
}

const BREED_DEFAULTS = {
  shiba:     { energy: 0.65, curiosity: 0.72, laziness: 0.40, sociability: 0.45, vocal: 0.45, coatWarmth: 0.75, waterLove: 0.25, digDrive: 0.55, scentDrive: 0.65, speedScale: 1.00, howlBias: 0.35 },
  corgi:     { energy: 0.80, curiosity: 0.78, laziness: 0.30, sociability: 0.80, vocal: 0.70, coatWarmth: 0.70, waterLove: 0.45, digDrive: 0.50, scentDrive: 0.60, speedScale: 0.84, howlBias: 0.25 },
  golden:    { energy: 0.72, curiosity: 0.70, laziness: 0.42, sociability: 0.95, vocal: 0.45, coatWarmth: 0.78, waterLove: 0.92, digDrive: 0.45, scentDrive: 0.60, speedScale: 1.05, howlBias: 0.25 },
  labrador:  { energy: 0.82, curiosity: 0.75, laziness: 0.32, sociability: 0.92, vocal: 0.50, coatWarmth: 0.55, waterLove: 0.95, digDrive: 0.50, scentDrive: 0.72, speedScale: 1.08, howlBias: 0.20 },
  husky:     { energy: 0.90, curiosity: 0.80, laziness: 0.25, sociability: 0.70, vocal: 0.95, coatWarmth: 0.96, waterLove: 0.45, digDrive: 0.75, scentDrive: 0.65, speedScale: 1.14, howlBias: 1.00 },
  dachshund: { energy: 0.65, curiosity: 0.88, laziness: 0.45, sociability: 0.72, vocal: 0.72, coatWarmth: 0.35, waterLove: 0.30, digDrive: 0.95, scentDrive: 0.90, speedScale: 0.78, howlBias: 0.30 },
  poodle:    { energy: 0.76, curiosity: 0.84, laziness: 0.30, sociability: 0.88, vocal: 0.60, coatWarmth: 0.50, waterLove: 0.55, digDrive: 0.30, scentDrive: 0.55, speedScale: 0.88, howlBias: 0.25 },
  beagle:    { energy: 0.78, curiosity: 0.95, laziness: 0.32, sociability: 0.82, vocal: 0.85, coatWarmth: 0.40, waterLove: 0.45, digDrive: 0.70, scentDrive: 1.00, speedScale: 0.96, howlBias: 0.65 },
};

function extractBreedProfile(breed) {
  const id = String(breed?.id || 'shiba').toLowerCase();
  const base = BREED_DEFAULTS[id] || BREED_DEFAULTS.shiba;
  const p = breed?.personality || breed?.temperament || breed?.traits || breed || {};
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : fallback);

  const energy = num(p.energy, base.energy);
  const curiosity = num(p.curiosity, base.curiosity);
  const laziness = num(p.laziness, base.laziness);
  const sociability = num(p.sociability, base.sociability);
  const vocal = num(p.vocal, base.vocal);

  // Infer slight size/coat nuances if provided on breed object
  const furLen = breed?.fur?.length ?? breed?.furLength ?? breed?.coat?.length;
  const coatWarmth = typeof furLen === 'number'
    ? clamp(lerp(base.coatWarmth, clamp(furLen * 1.4, 0.25, 0.98), 0.35), 0.2, 1.0)
    : base.coatWarmth;

  const legLen = breed?.body?.legLength ?? breed?.legLength ?? breed?.shoulderHeight ?? breed?.height;
  let speedScale = base.speedScale;
  if (typeof legLen === 'number' && legLen > 0.1 && legLen < 1.2) {
    speedScale = clamp(lerp(base.speedScale, 0.72 + legLen * 0.65, 0.35), 0.72, 1.2);
  }

  return {
    id,
    name: breed?.name || id,
    energy,
    curiosity,
    laziness,
    sociability,
    vocal,
    coatWarmth,
    waterLove: base.waterLove,
    digDrive: base.digDrive,
    scentDrive: base.scentDrive,
    speedScale,
    howlBias: base.howlBias,
    foodLove: (id === 'labrador' || id === 'beagle' || id === 'golden' || id === 'corgi') ? 1.25 : 1.0,
    cleanliness: (id === 'shiba' || id === 'poodle') ? 0.85 : 0.45,
    snowLove: clamp(coatWarmth * 0.7 + energy * 0.35, 0.25, 1.0),
  };
}

function readClock(clock) {
  if (!clock) {
    return {
      hours: 13.5,
      season: 'spring',
      seasonWeights: { spring: 1, summer: 0, autumn: 0, winter: 0 },
      sunElevation: 0.75,
      sunAzimuth: 0.4,
      isNight: false,
      speed: 30,
    };
  }
  const sw = clock.seasonWeights || {
    spring: clock.season === 'spring' ? 1 : 0,
    summer: clock.season === 'summer' ? 1 : 0,
    autumn: clock.season === 'autumn' ? 1 : 0,
    winter: clock.season === 'winter' ? 1 : 0,
  };
  const hours = typeof clock.hours === 'number' ? ((clock.hours % 24) + 24) % 24 : 12;
  const sunElevation = typeof clock.sunElevation === 'number' ? clock.sunElevation : (hours > 6 && hours < 18 ? 0.6 : -0.3);
  const sunAzimuth = typeof clock.sunAzimuth === 'number' ? clock.sunAzimuth : ((hours - 12) / 12) * Math.PI;
  const isNight = typeof clock.isNight === 'boolean' ? clock.isNight : sunElevation < -0.07;
  const speed = typeof clock.speed === 'number' && clock.speed > 0 ? clock.speed : 30;
  return {
    hours,
    season: clock.season || 'spring',
    seasonWeights: sw,
    sunElevation,
    sunAzimuth,
    isNight,
    speed,
  };
}

function computeBodyMargin(breed) {
  const bodyLen = (typeof breed?.bodyLength === 'number' && Number.isFinite(breed.bodyLength))
    ? breed.bodyLength
    : ((typeof breed?.body?.length === 'number' && Number.isFinite(breed.body.length)) ? breed.body.length : 0.5);
  return clamp(bodyLen * 0.5 + 0.15, 0.28, 0.65);
}

function isWalkable(garden, x, z, margin = 0.5) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > 14.6 || Math.abs(z) > 14.6) return false;
  if (garden && typeof garden.isInside === 'function') {
    return Boolean(garden.isInside(x, z, margin));
  }
  return Math.abs(x) < 14 - margin && Math.abs(z) < 14 - margin;
}

function getGroundY(garden, x, z) {
  if (garden && typeof garden.getGroundHeight === 'function') {
    const h = garden.getGroundHeight(x, z);
    if (Number.isFinite(h)) return h;
  }
  return 0;
}

function getPoi(garden, key) {
  const raw = garden?.poi?.[key];
  if (!raw) return null;
  let x, z;
  if (typeof raw.x === 'number' && typeof raw.z === 'number') {
    x = raw.x;
    z = raw.z;
  } else if (raw.position && typeof raw.position.x === 'number') {
    x = raw.position.x;
    z = raw.position.z;
  } else {
    return null;
  }
  const rotY = typeof raw.rotY === 'number'
    ? raw.rotY
    : (raw.rotation && typeof raw.rotation.y === 'number' ? raw.rotation.y : null);
  return { x, z, rotY, raw };
}

function randomWalkable(garden, fallbackX = 0, fallbackZ = 2, margin = 0.5) {
  const m = Math.max(0.35, margin || 0.5);
  if (garden && typeof garden.randomWalkablePoint === 'function') {
    for (let i = 0; i < 8; i++) {
      const pt = garden.randomWalkablePoint();
      if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.z) && isWalkable(garden, pt.x, pt.z, m)) {
        return { x: pt.x, z: pt.z };
      }
    }
  }
  for (let i = 0; i < 36; i++) {
    const x = randRange(-12.5, 12.5);
    const z = randRange(-9.5, 12.5);
    if (isWalkable(garden, x, z, m)) return { x, z };
  }
  if (isWalkable(garden, fallbackX, fallbackZ, m)) return { x: fallbackX, z: fallbackZ };
  return { x: 0, z: 2 };
}

function findSafePointNear(garden, x, z, minR = 0.0, maxR = 2.6, margin = 0.5) {
  const m = Math.max(0.28, margin || 0.5);
  if (minR <= 0.01 && isWalkable(garden, x, z, m)) return { x, z };
  const startR = Math.max(minR, 0.25);
  const endR = Math.max(maxR, startR + 1.0);
  const rings = 5;
  const angles = 16;
  for (let ring = 0; ring <= rings; ring++) {
    const r = lerp(startR, endR, ring / rings);
    const phase = (ring % 2) * (Math.PI / angles);
    for (let i = 0; i < angles; i++) {
      const a = (i / angles) * TWO_PI + phase;
      const nx = x + Math.sin(a) * r;
      const nz = z + Math.cos(a) * r;
      if (isWalkable(garden, nx, nz, m)) return { x: nx, z: nz };
    }
  }
  // Wider fallback search if obstacle is large (e.g. pond or flowerbed)
  for (let r = endR + 0.6; r <= endR + 3.2; r += 0.65) {
    for (let i = 0; i < angles; i++) {
      const a = (i / angles) * TWO_PI;
      const nx = x + Math.sin(a) * r;
      const nz = z + Math.cos(a) * r;
      if (isWalkable(garden, nx, nz, m)) return { x: nx, z: nz };
    }
  }
  return randomWalkable(garden, x, z, m);
}

function getObjectWorldPos(obj, out = _tmpVec) {
  if (!obj) return null;
  if (typeof obj.getWorldPosition === 'function') {
    obj.getWorldPosition(out);
    if (Number.isFinite(out.x) && Number.isFinite(out.z)) return out;
  }
  if (obj.position && Number.isFinite(obj.position.x)) {
    out.set(obj.position.x, obj.position.y || 0, obj.position.z || 0);
    return out;
  }
  if (Number.isFinite(obj.x) && Number.isFinite(obj.z)) {
    out.set(obj.x, obj.y || 0, obj.z);
    return out;
  }
  return null;
}

function findVisibleActors(list, dogPos, maxDist = 14, maxHeight = 5.0) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const res = [];
  for (let i = 0; i < list.length; i++) {
    const obj = list[i];
    if (!obj || obj.visible === false) continue;
    const pos = getObjectWorldPos(obj, new THREE.Vector3());
    if (!pos) continue;
    const d = dist2D(dogPos.x, dogPos.z, pos.x, pos.z);
    if (d <= maxDist && pos.y <= maxHeight && pos.y >= -0.5) {
      res.push({ obj, pos, dist: d });
    }
  }
  res.sort((a, b) => a.dist - b.dist);
  return res;
}

function sampleFallingTarget(garden, dogPos) {
  const ft = garden?.fallingThings;
  if (!ft) return null;
  const best = { x: 0, y: 0, z: 0, dist: Infinity, found: false };

  if (Array.isArray(ft)) {
    const step = Math.max(1, Math.floor(ft.length / 24));
    for (let i = 0; i < ft.length; i += step) {
      const item = ft[i];
      if (!item || item.visible === false) continue;
      const p = getObjectWorldPos(item);
      if (!p || p.y < 0.1 || p.y > 2.6) continue;
      const d = dist2D(dogPos.x, dogPos.z, p.x, p.z);
      if (d < best.dist && d < 9.0 && isWalkable(garden, p.x, p.z, 0.5)) {
        best.x = p.x; best.y = p.y; best.z = p.z; best.dist = d; best.found = true;
      }
    }
  } else if (ft.isPoints && ft.geometry?.attributes?.position) {
    const posAttr = ft.geometry.attributes.position;
    const count = posAttr.count;
    const step = Math.max(1, Math.floor(count / 40));
    for (let i = 0; i < count; i += step) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      if (y < 0.15 || y > 2.5) continue;
      const d = dist2D(dogPos.x, dogPos.z, x, z);
      if (d < best.dist && d < 9.0 && isWalkable(garden, x, z, 0.5)) {
        best.x = x; best.y = y; best.z = z; best.dist = d; best.found = true;
      }
    }
  } else if (ft.isInstancedMesh && ft.count > 0) {
    const mat = new THREE.Matrix4();
    const step = Math.max(1, Math.floor(ft.count / 32));
    for (let i = 0; i < ft.count; i += step) {
      ft.getMatrixAt(i, mat);
      const x = mat.elements[12];
      const y = mat.elements[13];
      const z = mat.elements[14];
      if (y < 0.15 || y > 2.5) continue;
      const d = dist2D(dogPos.x, dogPos.z, x, z);
      if (d < best.dist && d < 9.0 && isWalkable(garden, x, z, 0.5)) {
        best.x = x; best.y = y; best.z = z; best.dist = d; best.found = true;
      }
    }
  }

  return best.found ? { x: best.x, y: best.y, z: best.z } : null;
}

function computeTemperature(clk, garden) {
  const sw = clk.seasonWeights;
  const seasonalBase =
    (sw.spring || 0) * 0.52 +
    (sw.summer || 0) * 0.88 +
    (sw.autumn || 0) * 0.50 +
    (sw.winter || 0) * 0.14;
  // Diurnal swing: coldest around 5:00, warmest around 14:30
  const diurnal = Math.sin(((clk.hours - 8.5) / 24) * TWO_PI) * 0.16;
  const weather = garden?.weather || 'clear';
  const wi = garden?.weatherIntensity || 0;
  let weatherMod = 0;
  if (weather === 'cloudy') weatherMod = -0.06 * wi;
  else if (weather === 'rain') weatherMod = -0.10 * wi;
  else if (weather === 'snow') weatherMod = -0.16 * wi;
  const snowMod = -(garden?.snowCover || 0) * 0.12;
  return clamp(seasonalBase + diurnal + weatherMod + snowMod, 0, 1);
}

function findShadeSpot(garden, clk, margin = 0.5) {
  const m = Math.max(0.4, margin || 0.5);
  const tree = getPoi(garden, 'tree');
  if (tree) {
    // Opposite sun horizontal direction
    const sunDirX = Math.sin(clk.sunAzimuth);
    const sunDirZ = Math.cos(clk.sunAzimuth);
    for (const dist of [2.4, 3.0, 1.9, 3.5]) {
      for (const offset of [0, 0.45, -0.45, 0.9, -0.9]) {
        const a = Math.atan2(-sunDirX, -sunDirZ) + offset;
        const sx = tree.x + Math.sin(a) * dist;
        const sz = tree.z + Math.cos(a) * dist;
        if (isWalkable(garden, sx, sz, m + 0.05)) return { x: sx, z: sz };
      }
    }
    return findSafePointNear(garden, tree.x, tree.z, 0, 3.4, m);
  }
  const porch = getPoi(garden, 'porch');
  if (porch) return findSafePointNear(garden, porch.x, porch.z, 0, 1.2, m);
  return randomWalkable(garden, 0, 2, m);
}

function nudgeBallIfPossible(garden, fromX, fromZ, margin = 0.5) {
  const toyPoi = getPoi(garden, 'toy');
  if (!toyPoi) return;
  const ballMargin = Math.max(0.85, (margin || 0.5) + 0.35);
  const dx = toyPoi.x - fromX;
  const dz = toyPoi.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  const pushDist = randRange(1.4, 2.8);
  const spread = randRange(-0.55, 0.55);
  const baseA = Math.atan2(dx / d, dz / d) + spread;
  for (const mult of [1.0, 0.7, 0.45]) {
    const nx = toyPoi.x + Math.sin(baseA) * pushDist * mult;
    const nz = toyPoi.z + Math.cos(baseA) * pushDist * mult;
    if (isWalkable(garden, nx, nz, ballMargin)) {
      try {
        if (typeof toyPoi.raw.x === 'number') toyPoi.raw.x = nx;
        if (typeof toyPoi.raw.z === 'number') toyPoi.raw.z = nz;
        const mesh = toyPoi.raw.mesh || toyPoi.raw.object || (toyPoi.raw.isObject3D ? toyPoi.raw : null) || garden.toy || garden.ball;
        if (mesh && mesh.position) {
          const gy = getGroundY(garden, nx, nz);
          const radiusOffset = Math.max(0.12, mesh.position.y - getGroundY(garden, toyPoi.x, toyPoi.z));
          mesh.position.set(nx, gy + clamp(radiusOffset, 0.12, 0.25), nz);
        }
      } catch (_) {
        // Ignore if toy POI is read-only
      }
      break;
    }
  }
}

function hasLineOfSight(garden, ax, az, bx, bz, margin = 0.5) {
  const d = dist2D(ax, az, bx, bz);
  if (d < 0.28) return true;
  const steps = Math.min(64, Math.max(2, Math.ceil(d / 0.32)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkable(garden, lerp(ax, bx, t), lerp(az, bz, t), margin)) return false;
  }
  return true;
}

function firstBlockedPoint(garden, ax, az, bx, bz, margin = 0.5) {
  const d = dist2D(ax, az, bx, bz);
  if (d < 0.28) return null;
  const steps = Math.min(64, Math.max(2, Math.ceil(d / 0.32)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = lerp(ax, bx, t);
    const pz = lerp(az, bz, t);
    if (!isWalkable(garden, px, pz, margin)) {
      return { x: px, z: pz, t };
    }
  }
  return null;
}

function probeRayClearance(garden, x, z, angle, distances, margin) {
  const sx = Math.sin(angle);
  const sz = Math.cos(angle);
  let clearCount = 0;
  let firstBlockedDist = Infinity;
  for (let i = 0; i < distances.length; i++) {
    const d = distances[i];
    if (isWalkable(garden, x + sx * d, z + sz * d, margin)) {
      clearCount++;
    } else {
      firstBlockedDist = d;
      break;
    }
  }
  return {
    clear: clearCount === distances.length,
    clearCount,
    firstBlockedDist,
  };
}

class NavigationHelper {
  constructor() {
    this.detour = null;
    this.detourTimer = 0;
    this.stuckTimer = 0;
    this.lastProgressX = 0;
    this.lastProgressZ = 0;
    this.avoidSide = 1;
  }

  reset(x, z) {
    this.detour = null;
    this.detourTimer = 0;
    this.stuckTimer = 0;
    this.lastProgressX = x;
    this.lastProgressZ = z;
  }

  flipAvoidSide() {
    this.avoidSide = -this.avoidSide;
    this.detour = null;
    this.detourTimer = 0;
  }

  computeSteering(
    garden,
    dogX,
    dogZ,
    dogHeading,
    goalX,
    goalZ,
    desiredSpeed,
    realDt,
    allowInterior = false,
    bodyMargin = 0.45,
    wasBlocked = false
  ) {
    if (allowInterior) {
      const distToGoal = dist2D(dogX, dogZ, goalX, goalZ);
      if (distToGoal < 0.05) {
        return { heading: dogHeading, speed: 0, stuck: false, distToGoal, goalX, goalZ, avoiding: false };
      }
      const directHeading = Math.atan2(goalX - dogX, goalZ - dogZ);
      const speed = distToGoal < 0.7 ? desiredSpeed * clamp(distToGoal / 0.7, 0.35, 1) : desiredSpeed;
      return { heading: directHeading, speed, stuck: false, distToGoal, goalX, goalZ, avoiding: false };
    }

    const margin = Math.max(0.28, bodyMargin || 0.45);
    const steerMargin = margin + 0.05;

    // 1. If the destination itself is inside an obstacle, snap it to the nearest walkable point
    if (!isWalkable(garden, goalX, goalZ, margin)) {
      const fixed = findSafePointNear(garden, goalX, goalZ, 0, 3.8, margin);
      goalX = fixed.x;
      goalZ = fixed.z;
    }

    const distToGoal = dist2D(dogX, dogZ, goalX, goalZ);
    if (distToGoal < 0.05) {
      return { heading: dogHeading, speed: 0, stuck: false, distToGoal, goalX, goalZ, avoiding: false };
    }

    this.detourTimer = Math.max(0, this.detourTimer - realDt);

    // 2. Stuck detection (counts faster when final-defense collision blocked movement)
    const moved = dist2D(dogX, dogZ, this.lastProgressX, this.lastProgressZ);
    if (moved > 0.26 && !wasBlocked) {
      this.lastProgressX = dogX;
      this.lastProgressZ = dogZ;
      this.stuckTimer = 0;
    } else if (desiredSpeed > 0.2) {
      this.stuckTimer += realDt * (wasBlocked ? 1.5 : 1.0);
    }

    // 3. Validate or clear existing detour waypoint
    if (this.detour) {
      const dd = dist2D(dogX, dogZ, this.detour.x, this.detour.z);
      const detourInvalid = !isWalkable(garden, this.detour.x, this.detour.z, margin);
      if (
        detourInvalid ||
        dd < Math.max(0.6, margin + 0.18) ||
        (this.detourTimer <= 0 && hasLineOfSight(garden, dogX, dogZ, goalX, goalZ, steerMargin))
      ) {
        this.detour = null;
      }
    }

    // 4. Create detour waypoint around left/right of obstacle if path is blocked
    if (!this.detour && distToGoal > 0.85 && !hasLineOfSight(garden, dogX, dogZ, goalX, goalZ, steerMargin)) {
      this.detour = this._findDetour(garden, dogX, dogZ, goalX, goalZ, steerMargin, false);
      this.detourTimer = 2.6;
    }

    // Replan wider detour if blocked or stuck
    if ((wasBlocked || this.stuckTimer > 1.1) && this.stuckTimer < 2.9) {
      if (wasBlocked || this.detourTimer <= 1.2) {
        if (wasBlocked && this.stuckTimer > 0.75) {
          this.avoidSide = -this.avoidSide;
        }
        const wider = this._findDetour(garden, dogX, dogZ, goalX, goalZ, steerMargin, true);
        if (wider) {
          this.detour = wider;
          this.detourTimer = 2.4;
        }
      }
    }

    const activeX = this.detour ? this.detour.x : goalX;
    const activeZ = this.detour ? this.detour.z : goalZ;
    const distToActive = dist2D(dogX, dogZ, activeX, activeZ);
    let targetAngle = Math.atan2(activeX - dogX, activeZ - dogZ);
    let avoiding = false;

    // 5. Multi-point forward path check (0.3m .. 1.5m+, clipped to active target distance so POIs near walls remain reachable)
    const rawProbes = desiredSpeed > 2.4
      ? [0.3, 0.6, 0.9, 1.2, 1.5, 1.9, 2.3]
      : [0.3, 0.6, 0.9, 1.2, 1.5];
    const maxProbe = this.detour ? rawProbes[rawProbes.length - 1] : Math.max(0.35, distToActive);
    const forwardProbes = [];
    for (let i = 0; i < rawProbes.length; i++) {
      if (rawProbes[i] <= maxProbe) forwardProbes.push(rawProbes[i]);
    }
    if (forwardProbes.length === 0) forwardProbes.push(Math.min(0.35, distToActive));

    const centerProbe = probeRayClearance(garden, dogX, dogZ, targetAngle, forwardProbes, steerMargin);

    // Side whiskers prevent grazing corners of trees, rocks, lanterns, and fences
    const whiskerProbes = [];
    if (maxProbe >= 0.4) whiskerProbes.push(0.4);
    if (maxProbe >= 0.85) whiskerProbes.push(0.85);
    const leftWhisker = whiskerProbes.length > 0
      ? probeRayClearance(garden, dogX, dogZ, targetAngle + 0.24, whiskerProbes, margin)
      : { clear: true };
    const rightWhisker = whiskerProbes.length > 0
      ? probeRayClearance(garden, dogX, dogZ, targetAngle - 0.24, whiskerProbes, margin)
      : { clear: true };

    if (!centerProbe.clear || !leftWhisker.clear || !rightWhisker.clear || wasBlocked) {
      avoiding = true;
      const steerProbes = [0.3, 0.6, 0.9, 1.2, 1.5];
      const angleOffsets = [0.28, 0.52, 0.78, 1.05, 1.35, 1.65, 2.0, 2.4, Math.PI];
      const sides = [this.avoidSide, -this.avoidSide];

      let bestAngle = targetAngle;
      let bestScore = -Infinity;
      let bestSide = this.avoidSide;

      for (let i = 0; i < angleOffsets.length; i++) {
        const off = angleOffsets[i];
        for (let s = 0; s < sides.length; s++) {
          const side = sides[s];
          const cand = wrapAngle(targetAngle + side * off);
          let res = probeRayClearance(garden, dogX, dogZ, cand, steerProbes, steerMargin);
          if (!res.clear && res.clearCount < 2) {
            res = probeRayClearance(garden, dogX, dogZ, cand, steerProbes, margin);
          }
          if (res.clearCount === 0) continue;

          const clearBonus = res.clear ? 4.0 : 0;
          const sideBonus = side === this.avoidSide ? 0.35 : 0;
          const headingAlign = -Math.abs(wrapAngle(cand - dogHeading)) * 0.25;
          const score = res.clearCount * 1.4 + clearBonus - off * 0.95 + sideBonus + headingAlign;
          if (score > bestScore) {
            bestScore = score;
            bestAngle = cand;
            bestSide = side;
          }
        }
        if (bestScore > 9.5) break;
      }

      targetAngle = bestAngle;
      this.avoidSide = bestSide;
    }

    // 6. Arrival deceleration & obstacle proximity speed control
    let speed = desiredSpeed;
    const slowRadius = clamp(0.8 + desiredSpeed * 0.35, 0.8, 2.6);
    if (!this.detour && distToGoal < slowRadius) {
      speed = desiredSpeed * clamp(distToGoal / slowRadius, 0.22, 1.0);
    }

    if (avoiding) {
      const nearFactor = centerProbe.firstBlockedDist < 0.75 ? 0.55 : 0.78;
      speed = Math.min(speed, Math.max(0.85, desiredSpeed * nearFactor));
    }

    // Check immediate clearance along the dog's ACTUAL current heading so turning doesn't clip an obstacle
    const headingProbe = probeRayClearance(garden, dogX, dogZ, dogHeading, [0.3, 0.6, 0.9], margin);
    if (!headingProbe.clear) {
      const factor = headingProbe.firstBlockedDist <= 0.35 ? 0.15 : (headingProbe.firstBlockedDist <= 0.65 ? 0.35 : 0.65);
      speed *= factor;
      avoiding = true;
    }

    // Slow down when making sharp turns
    const turnErr = Math.abs(wrapAngle(targetAngle - dogHeading));
    if (turnErr > 0.9) {
      speed *= clamp(1.0 - (turnErr - 0.9) * 0.42, 0.22, 1.0);
    }

    return {
      heading: wrapAngle(targetAngle),
      speed,
      stuck: this.stuckTimer > 2.8,
      distToGoal,
      goalX,
      goalZ,
      avoiding,
    };
  }

  _findDetour(garden, ax, az, gx, gz, margin, wide = false) {
    const dx = gx - ax;
    const dz = gz - az;
    const totalD = Math.hypot(dx, dz) || 1;
    const dirX = dx / totalD;
    const dirZ = dz / totalD;
    const perpX = -dirZ;
    const perpZ = dirX;
    const baseAngle = Math.atan2(dx, dz);

    const candidates = [];

    // A. Points around the left & right sides of the first blocking obstacle
    const blocked = firstBlockedPoint(garden, ax, az, gx, gz, margin);
    if (blocked) {
      const sideOffsets = wide ? [1.6, 2.6, 3.8, 5.2, 6.6] : [1.4, 2.3, 3.4, 4.6];
      const fwdOffsets = [0.0, 0.9, -0.5];
      for (let f = 0; f < fwdOffsets.length; f++) {
        const fo = fwdOffsets[f];
        for (let s = 0; s < sideOffsets.length; s++) {
          const so = sideOffsets[s];
          candidates.push(
            { x: blocked.x + dirX * fo + perpX * so, z: blocked.z + dirZ * fo + perpZ * so, side: 1 },
            { x: blocked.x + dirX * fo - perpX * so, z: blocked.z + dirZ * fo - perpZ * so, side: -1 },
          );
        }
      }
    }

    // B. Radial fan candidates from the dog's current position
    const angles = wide
      ? [0.55, -0.55, 0.95, -0.95, 1.4, -1.4, 1.85, -1.85, 2.35, -2.35]
      : [0.45, -0.45, 0.85, -0.85, 1.25, -1.25, 1.7, -1.7];
    const radii = wide ? [2.2, 3.6, 5.4, 6.8] : [2.0, 3.5, 5.2];
    for (let r = 0; r < radii.length; r++) {
      const dist = radii[r];
      for (let i = 0; i < angles.length; i++) {
        const ang = baseAngle + angles[i];
        candidates.push({
          x: ax + Math.sin(ang) * dist,
          z: az + Math.cos(ang) * dist,
          side: angles[i] >= 0 ? 1 : -1,
        });
      }
    }

    let best = null;
    let bestScore = Infinity;
    let bestSide = this.avoidSide;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!isWalkable(garden, c.x, c.z, margin + 0.06)) continue;
      if (!hasLineOfSight(garden, ax, az, c.x, c.z, margin * 0.95)) continue;
      const distFromDog = dist2D(ax, az, c.x, c.z);
      if (distFromDog < 0.75) continue;
      const rem = dist2D(c.x, c.z, gx, gz);
      const clearToGoal = hasLineOfSight(garden, c.x, c.z, gx, gz, margin) ? -2.8 : 0;
      const sideBias = c.side === this.avoidSide ? -0.45 : 0;
      const score = rem + distFromDog * 0.38 + clearToGoal + sideBias;
      if (score < bestScore) {
        bestScore = score;
        best = { x: c.x, z: c.z };
        bestSide = c.side;
      }
    }

    if (best) this.avoidSide = bestSide;
    return best;
  }
}

export class DogBrain {
  constructor(breed) {
    this.breed = breed;
    this.profile = extractBreedProfile(breed);
    this._bodyMargin = computeBodyMargin(breed);

    // 8 core needs (0..1)
    this.needs = {
      hunger: 0.28,
      thirst: 0.26,
      energy: 0.78,
      boredom: 0.36,
      curiosity: 0.55,
      comfort: 0.82,
      bladder: 0.22,
      social: 0.35,
    };

    this.mood = 'calm';
    this.action = { id: 'idle', label: '庭の様子をうかがっている' };

    // Output state read by Dog for smooth physics & additive animations
    this.locomotion = {
      mode: 'stop',       // 'stop' | 'move' | 'turn' | 'circle'
      targetSpeed: 0,
      targetHeading: 0,
      turnRate: 3.2,
      allowDoghouseInterior: false,
    };

    this.motionEffects = {
      headTilt: 0,
      yawnAmount: 0,
      lipLickPhase: 0,
      dreamTwitch: 0,
      legLift: 0,
      jumpHeight: 0,
      pantIntensity: 0,
    };

    this.coatDelta = {
      wetDelta: 0,
      snowDelta: 0,
      dirtDelta: 0,
      heatDelta: 0,
    };

    this.inShelter = false;
    this.isSleeping = false;

    // Internal state machine
    this._nav = new NavigationHelper();
    this._initialized = false;
    this._elapsedReal = 0;
    this._currentPlan = null;
    this._stepIndex = 0;
    this._stepElapsed = 0;
    this._stepData = {};
    this._lastDoneTime = {};
    this._recentActions = [];
    this._lastActionId = null;
    this._stimulusTimer = 0;
    this._prevWeather = null;
    this._prevFoodLevel = null;
    this._insideDoghouse = false;
    this._pendingBladderBoost = 0;
    this._postSleepTimer = 0;
    this._cameraLingerTimer = 0;
    this._lastPose = 'stand';
    this._lastTail = 'relaxed';
    this._lastEars = 'relaxed';
    this._lastLookAt = null;
    this._pantSoundTimer = 0;

    // Timed tail expression state (prevents constant wagging)
    this._tailBurstMode = null;       // 'happyWag' | 'wag' | null
    this._tailBurstTimer = 0;
    this._tailAfterMode = 'relaxed';
    this._tailAfterTimer = 0;
    this._tailStepKey = '';
    this._planSerial = 0;
  }

  setBreed(breed) {
    this.breed = breed;
    this.profile = extractBreedProfile(breed);
    this._bodyMargin = computeBodyMargin(breed);
  }

  update(worldDt, ctx = {}) {
    const clk = readClock(ctx.clock);
    const garden = ctx.garden || null;
    const dogState = ctx.dog || { position: _fallbackDogPos.set(0, 0, 0), heading: 0, speed: 0 };
    const dogPos = dogState.position || _fallbackDogPos.set(0, 0, 0);
    const dogHeading = typeof dogState.heading === 'number' ? dogState.heading : 0;
    const animator = ctx.animator || null;
    const cameraPos = ctx.cameraPos || null;
    const emitEvent = typeof ctx.emitEvent === 'function' ? ctx.emitEvent : null;

    const realDt = clamp(
      typeof ctx.realDt === 'number' && ctx.realDt > 0
        ? ctx.realDt
        : (worldDt > 0 ? worldDt / clk.speed : 0.016),
      0.001,
      0.1
    );
    const safeWorldDt = Math.max(0, worldDt || 0);
    this._elapsedReal += realDt;

    // Reset per-frame deltas
    this.coatDelta.wetDelta = 0;
    this.coatDelta.snowDelta = 0;
    this.coatDelta.dirtDelta = 0;
    this.coatDelta.heatDelta = 0;
    this._resetEffects();

    const env = this._senseEnvironment(clk, garden, dogPos, dogState, cameraPos, realDt);

    // Auto-clear insideDoghouse flag if dog is actually out in the yard
    if (this._insideDoghouse && env.doghouseInside) {
      if (dist2D(dogPos.x, dogPos.z, env.doghouseInside.x, env.doghouseInside.z) > 2.2) {
        this._insideDoghouse = false;
      }
    }

    // One-time clock-aware startup calibration
    if (!this._initialized) {
      this._initialized = true;
      this._prevWeather = env.weather;
      this._prevFoodLevel = env.foodLevel;
      this._calibrateInitialState(env);
    }

    // Update needs using worldDt
    this._updateNeeds(safeWorldDt, realDt, env, dogState);

    // Update camera linger awareness
    if (cameraPos) {
      const camDist = dist2D(dogPos.x, dogPos.z, cameraPos.x, cameraPos.z);
      if (camDist < 5.5) this._cameraLingerTimer += realDt;
      else this._cameraLingerTimer = Math.max(0, this._cameraLingerTimer - realDt * 0.5);
    }

    // Check environmental stimulus interrupts periodically
    this._stimulusTimer += realDt;
    if (this._stimulusTimer >= 0.45) {
      this._stimulusTimer = 0;
      this._checkStimuli(env, dogPos, dogState);
      this._prevWeather = env.weather;
      this._prevFoodLevel = env.foodLevel;
    }

    // Pick a new action if none active
    if (!this._currentPlan) {
      const chosen = this._chooseNextAction(env, dogPos, dogState);
      this._startAction(chosen, env, dogPos, dogHeading);
    }

    // Execute current multi-step action
    this._executeCurrentStep(realDt, env, dogPos, dogHeading, animator, emitEvent, Boolean(dogState.blocked));

    // Panting overlay when hot or after heavy exercise
    this._updatePanting(realDt, env, dogState, emitEvent);

    // Update mood
    this._updateMood(env, dogState);

    return {
      locomotion: this.locomotion,
      motionEffects: this.motionEffects,
      coatDelta: this.coatDelta,
      inShelter: this.inShelter,
      isSleeping: this.isSleeping,
    };
  }

  _resetEffects() {
    this.motionEffects.headTilt = 0;
    this.motionEffects.yawnAmount = 0;
    this.motionEffects.lipLickPhase = 0;
    this.motionEffects.dreamTwitch = 0;
    this.motionEffects.legLift = 0;
    this.motionEffects.jumpHeight = 0;
    this.motionEffects.pantIntensity = 0;
  }

  _senseEnvironment(clk, garden, dogPos, dogState, cameraPos, realDt) {
    const weather = garden?.weather || 'clear';
    const weatherIntensity = clamp(garden?.weatherIntensity ?? 0, 0, 1);
    const wetness = clamp(garden?.wetness ?? 0, 0, 1);
    const snowCover = clamp(garden?.snowCover ?? 0, 0, 1);
    const windStrength = clamp(garden?.windStrength ?? 0, 0, 1);
    const foodLevel = clamp(garden?.foodLevel ?? 0.8, 0, 1);
    const temperature = computeTemperature(clk, garden);

    const hours = clk.hours;
    const isDeepNight = hours >= 22.0 || hours < 5.5;
    const isEarlyMorning = hours >= 5.5 && hours < 9.0;
    const isMidday = hours >= 11.0 && hours < 15.5;
    const isEvening = hours >= 15.5 && hours < 19.5;
    const isHot = temperature > 0.72;
    const isCold = temperature < 0.28;
    const isRaining = weather === 'rain' && weatherIntensity > 0.15;
    const isSnowing = weather === 'snow' && weatherIntensity > 0.15;

    let sunnySpot = null;
    if (garden && typeof garden.getSunnySpot === 'function' && !clk.isNight && !isRaining) {
      const s = garden.getSunnySpot();
      if (s && Number.isFinite(s.x) && Number.isFinite(s.z)) sunnySpot = s;
    }

    const butterflies = !clk.isNight && !isRaining ? findVisibleActors(garden?.butterflies, dogPos, 11, 3.2) : [];
    const birds = !clk.isNight && !isRaining ? findVisibleActors(garden?.birds, dogPos, 13, 3.8) : [];
    const fallingSample = (!isRaining && (clk.season === 'spring' || clk.season === 'autumn' || isSnowing))
      ? sampleFallingTarget(garden, dogPos)
      : null;

    const doghouse = getPoi(garden, 'doghouse');
    const doghouseInside = getPoi(garden, 'doghouseInside') || doghouse;
    const porch = getPoi(garden, 'porch');

    return {
      clk,
      garden,
      weather,
      weatherIntensity,
      wetness,
      snowCover,
      windStrength,
      foodLevel,
      temperature,
      hours,
      isDeepNight,
      isEarlyMorning,
      isMidday,
      isEvening,
      isHot,
      isCold,
      isRaining,
      isSnowing,
      sunnySpot,
      butterflies,
      birds,
      fallingSample,
      cameraPos,
      furWetness: dogState.furWetness ?? 0,
      snowOnFur: dogState.snowOnFur ?? 0,
      dirtiness: dogState.dirtiness ?? 0,
      heatLoad: dogState.heatLoad ?? 0,
      doghouse,
      doghouseInside,
      porch,
      realDt,
    };
  }

  _calibrateInitialState(env) {
    if (env.isDeepNight) {
      this.needs.energy = 0.28;
      this.needs.boredom = 0.10;
      this.needs.curiosity = 0.20;
    } else if (env.isEarlyMorning) {
      this.needs.energy = 0.88;
      this.needs.hunger = env.foodLevel > 0.2 ? 0.55 : 0.30;
      this.needs.bladder = 0.55;
      this.needs.curiosity = 0.65;
    } else if (env.isMidday && env.isHot) {
      this.needs.energy = 0.55;
      this.needs.thirst = 0.50;
      this.needs.comfort = 0.45;
    } else if (env.isEvening) {
      this.needs.energy = 0.82;
      this.needs.hunger = env.foodLevel > 0.2 ? 0.52 : 0.32;
      this.needs.boredom = 0.55;
    } else {
      this.needs.energy = 0.78;
      this.needs.curiosity = 0.62;
      this.needs.boredom = 0.42;
    }
  }

  _updateNeeds(worldDt, realDt, env, dogState) {
    const n = this.needs;
    const p = this.profile;
    const speed = dogState.speed || 0;
    const exertion = speed > 3.5 ? 2.8 : (speed > 1.8 ? 1.6 : (speed > 0.3 ? 1.0 : 0.35));

    // Hunger & thirst evolve in world time
    n.hunger = clamp(n.hunger + worldDt * 0.000024 * (0.8 + exertion * 0.15) * p.foodLove, 0, 1);
    const heatThirst = env.isHot ? 1.7 : 1.0;
    n.thirst = clamp(n.thirst + worldDt * 0.000042 * (0.7 + exertion * 0.35) * heatThirst, 0, 1);

    // Bladder fills naturally + delayed boost after drinking
    if (this._pendingBladderBoost > 0) {
      const transfer = Math.min(this._pendingBladderBoost, realDt * 0.006);
      this._pendingBladderBoost -= transfer;
      n.bladder = clamp(n.bladder + transfer, 0, 1);
    }
    n.bladder = clamp(n.bladder + worldDt * 0.000046, 0, 1);

    // Energy drains when awake, recovers when sleeping/resting
    if (this.isSleeping) {
      const recoveryRate = this._insideDoghouse ? 0.00028 : 0.00022;
      n.energy = clamp(n.energy + worldDt * recoveryRate, 0, 1);
    } else {
      const nightDrain = env.isDeepNight ? 1.65 : 1.0;
      const idleFactor = (this._lastPose === 'lie' || this._lastPose === 'sit') ? 0.25 : exertion;
      n.energy = clamp(n.energy - worldDt * 0.000038 * idleFactor * nightDrain * (1.15 - p.energy * 0.3), 0, 1);
    }

    // Boredom & curiosity
    const activePlay = this._currentPlan && (
      this._currentPlan.id === 'zoomies' ||
      this._currentPlan.id === 'playToy' ||
      this._currentPlan.id === 'chaseButterfly' ||
      this._currentPlan.id === 'chaseFalling' ||
      this._currentPlan.id === 'playInSnow' ||
      this._currentPlan.id === 'dig' ||
      this._currentPlan.id === 'stalkBird'
    );
    if (activePlay) {
      n.boredom = clamp(n.boredom - realDt * 0.032, 0, 1);
    } else if (!this.isSleeping) {
      n.boredom = clamp(n.boredom + worldDt * 0.00014 * (0.6 + p.energy * 0.7 - p.laziness * 0.35), 0, 1);
    }

    if (!this.isSleeping) {
      n.curiosity = clamp(n.curiosity + worldDt * 0.00011 * (0.55 + p.curiosity * 0.8), 0, 1);
      n.social = clamp(n.social + worldDt * 0.000085 * (0.45 + p.sociability * 0.9), 0, 1);
    }

    // Thermal & weather comfort
    let targetComfort = 0.88;
    if (env.isRaining && !this.inShelter) targetComfort -= 0.48 * env.weatherIntensity;
    if (env.furWetness > 0.25) targetComfort -= env.furWetness * 0.35;
    if (env.isHot && !this.inShelter && this._currentPlan?.id !== 'coolInShade') {
      const heatStress = (env.temperature - 0.68) * (1.0 + p.coatWarmth * 0.9);
      targetComfort -= clamp(heatStress, 0, 0.55);
    }
    if (env.isCold && !this.inShelter) {
      const coldStress = (0.32 - env.temperature) * (1.45 - p.coatWarmth * 1.15);
      targetComfort -= clamp(coldStress, 0, 0.45);
    }
    if (this.inShelter && (env.isRaining || env.isCold || env.isHot)) {
      targetComfort = Math.max(targetComfort, 0.82);
    }
    n.comfort = clamp(lerp(n.comfort, clamp(targetComfort, 0.05, 1), clamp(realDt * 0.25, 0, 1)), 0, 1);

    if (this._postSleepTimer > 0) this._postSleepTimer = Math.max(0, this._postSleepTimer - realDt);
  }

  _checkStimuli(env, dogPos, dogState) {
    const curId = this._currentPlan?.id;
    // Uninterruptible actions
    if (
      curId === 'eat' ||
      curId === 'drink' ||
      curId === 'shakeOff' ||
      curId === 'markTree' ||
      curId === 'reactToRain' ||
      curId === 'stretch' ||
      curId === 'yawn'
    ) {
      return;
    }

    const p = this.profile;

    // 1. Sudden rain start while outdoors
    const wasRain = this._prevWeather === 'rain';
    if (!wasRain && env.isRaining && !this.inShelter && !this._insideDoghouse) {
      this._interruptWith('reactToRain', env, dogPos, dogState.heading || 0);
      return;
    }

    // 2. Just got soaked or snowy outdoors (after finishing play/rain) -> shake off!
    if ((env.furWetness > 0.58 || env.snowOnFur > 0.52) && !this.isSleeping && curId !== 'playInSnow' && curId !== 'inspectPond') {
      if (this._cooldownPassed('shakeOff', 14) && Math.random() < 0.45) {
        this._interruptWith('shakeOff', env, dogPos, dogState.heading || 0);
        return;
      }
    }

    // Don't interrupt deep night sleep for minor stimuli
    if (this.isSleeping && env.isDeepNight) return;
    // Let naps run for at least 12 real seconds before interrupting
    if (this.isSleeping && this._stepElapsed < 12) return;

    // 3. Food just refilled and dog is hungry!
    if (this._prevFoodLevel !== null && this._prevFoodLevel < 0.25 && env.foodLevel > 0.8 && this.needs.hunger > 0.35) {
      this._interruptWith('eat', env, dogPos, dogState.heading || 0);
      return;
    }

    // 4. Butterfly fluttered very close
    if (
      env.butterflies.length > 0 &&
      env.butterflies[0].dist < 4.5 &&
      !this.isSleeping &&
      curId !== 'chaseButterfly' &&
      curId !== 'zoomies' &&
      this._cooldownPassed('chaseButterfly', 18) &&
      this.needs.energy > 0.25
    ) {
      const chance = 0.14 + p.curiosity * 0.18 + p.energy * 0.14;
      if (Math.random() < chance) {
        this._interruptWith('chaseButterfly', env, dogPos, dogState.heading || 0);
        return;
      }
    }

    // 5. Bird landed nearby
    if (
      env.birds.length > 0 &&
      env.birds[0].dist < 7.2 &&
      !this.isSleeping &&
      curId !== 'stalkBird' &&
      curId !== 'barkBird' &&
      curId !== 'chaseButterfly' &&
      this._cooldownPassed('stalkBird', 22) &&
      this._cooldownPassed('barkBird', 22) &&
      this.needs.energy > 0.25
    ) {
      const chance = 0.10 + p.curiosity * 0.14 + p.energy * 0.10;
      if (Math.random() < chance) {
        const pick = (Math.random() < 0.45 + p.vocal * 0.3) ? 'barkBird' : 'stalkBird';
        this._interruptWith(pick, env, dogPos, dogState.heading || 0);
        return;
      }
    }

    // 6. Swirling petals/leaves close by in a breeze
    if (
      env.fallingSample &&
      env.windStrength > 0.22 &&
      !this.isSleeping &&
      curId !== 'chaseFalling' &&
      curId !== 'zoomies' &&
      this._cooldownPassed('chaseFalling', 24) &&
      this.needs.energy > 0.35
    ) {
      const chance = 0.08 + p.energy * 0.10 + p.curiosity * 0.08;
      if (Math.random() < chance) {
        this._interruptWith('chaseFalling', env, dogPos, dogState.heading || 0);
        return;
      }
    }

    // 7. Observer camera lingering close during calm idle -> cute head-tilt moment
    if (
      this._cameraLingerTimer > 9 &&
      (curId === 'wander' || curId === 'sitWatch' || curId === 'lieIdle' || curId === 'porchLounge') &&
      this._cooldownPassed('lookAtObserver', 35)
    ) {
      const chance = 0.08 + p.sociability * 0.14;
      if (Math.random() < chance) {
        this._cameraLingerTimer = 0;
        this._interruptWith('lookAtObserver', env, dogPos, dogState.heading || 0);
        return;
      }
    }

    // 8. Snow started falling -> playful breeds get excited!
    if (this._prevWeather !== 'snow' && env.isSnowing && !this.isSleeping && this._cooldownPassed('playInSnow', 25)) {
      if (Math.random() < 0.3 + p.snowLove * 0.45) {
        this._interruptWith('playInSnow', env, dogPos, dogState.heading || 0);
      }
    }
  }

  _interruptWith(actionId, env, dogPos, dogHeading) {
    this.isSleeping = false;
    this._startAction(actionId, env, dogPos, dogHeading);
  }

  _cooldownPassed(id, minSec) {
    const last = this._lastDoneTime[id];
    if (last === undefined) return true;
    return (this._elapsedReal - last) >= minSec;
  }

  _recencyFactor(id, idealGap = 45) {
    const last = this._lastDoneTime[id];
    if (last === undefined) return 1.15; // slight novelty boost
    const dt = this._elapsedReal - last;
    if (dt < 8) return 0.04;
    if (dt < idealGap) return clamp(dt / idealGap, 0.12, 1.0);
    return 1.0 + clamp((dt - idealGap) / 180, 0, 0.35);
  }

  _chooseNextAction(env, dogPos, dogState) {
    const n = this.needs;
    const p = this.profile;
    const scores = [];

    const add = (id, rawScore, idealGap = 45) => {
      if (rawScore <= 0.01) return;
      let score = rawScore * this._recencyFactor(id, idealGap);
      if (id === this._lastActionId) score *= 0.2;
      // Small organic jitter
      score *= randRange(0.84, 1.18);
      if (score > 0.02) scores.push({ id, score });
    };

    const canGoOut = !env.isRaining || env.weatherIntensity < 0.35;
    const primeActive = (env.isEarlyMorning || env.isEvening) ? 1.35 : 1.0;
    const hotMiddaySlow = (env.isMidday && env.isHot) ? 0.35 : 1.0;

    // --- Core survival & physiological needs ---
    if (getPoi(env.garden, 'foodBowl')) {
      if (env.foodLevel > 0.06) {
        const eatScore = Math.pow(n.hunger, 1.45) * 3.8 * p.foodLove * (env.isDeepNight ? 0.3 : 1.0);
        if (n.hunger > 0.38) add('eat', eatScore, 55);
      } else if (n.hunger > 0.58 && !env.isDeepNight) {
        add('checkEmptyBowl', (n.hunger - 0.45) * 1.4, 75);
      }
    }

    if (getPoi(env.garden, 'waterBowl')) {
      const drinkScore = Math.pow(n.thirst, 1.4) * 3.5 * (env.isHot ? 1.35 : 1.0) * (this._lastActionId === 'eat' ? 1.5 : 1.0);
      if (n.thirst > 0.35) add('drink', drinkScore, 45);
    }

    if (getPoi(env.garden, 'tree') && n.bladder > 0.48) {
      const markScore = Math.pow(n.bladder, 1.5) * 3.1 * (env.isDeepNight ? 0.55 : 1.0);
      add('markTree', markScore, 50);
    }

    // --- Coat maintenance ---
    if (env.furWetness > 0.35 || env.snowOnFur > 0.35) {
      add('shakeOff', (env.furWetness + env.snowOnFur) * 2.6, 18);
    }

    // --- Post-sleep rituals ---
    if (this._postSleepTimer > 0) {
      add('stretch', 2.4, 30);
      add('yawn', 1.6, 25);
    }

    // --- Deep night behavior ---
    if (env.isDeepNight) {
      const sleepNeed = (1.15 - n.energy) * 3.2 + 1.4;
      add('sleepDoghouse', sleepNeed, 25);
      if (n.energy > 0.42 && canGoOut) {
        add('nightPatrol', 0.65 + p.curiosity * 0.4, 75);
        if (env.weather === 'clear' || env.weather === 'cloudy') {
          add('howlAtMoon', (0.35 + p.howlBias * 1.15 + p.vocal * 0.6), 95);
        }
      }
      if (n.thirst > 0.28) add('drink', n.thirst * 2.4, 55);
    }

    // --- Rain behavior ---
    if (env.isRaining) {
      add('watchRain', 1.8 + env.weatherIntensity * 1.5 + p.curiosity * 0.4, 30);
      add('sleepDoghouse', (1.0 - n.energy) * 2.4 + 0.9 + p.laziness * 0.7, 35);
      if (env.porch) add('porchLounge', 0.7 + p.laziness * 0.5, 45);
      // Water-loving dogs still occasionally wander briefly in light rain
      if (env.weatherIntensity < 0.55 && p.waterLove > 0.7) {
        add('wander', 0.55 * p.energy, 40);
      }
    }

    // --- Daytime & general canine behaviors ---
    if (!env.isDeepNight) {
      // Sleep / Nap / Comfort
      if (n.energy < 0.45) {
        add('sleepDoghouse', (0.65 - n.energy) * 2.5 + p.laziness * 0.6, 55);
      }
      if (env.sunnySpot && !env.isHot && canGoOut) {
        const sunTempBonus = env.isCold ? 1.55 : 1.15;
        add('sunbathe', ((1 - n.energy) * 1.45 + p.laziness * 0.95 + 0.35) * sunTempBonus, 55);
      }
      if (env.isHot && canGoOut) {
        add('coolInShade', (env.temperature - 0.55) * 3.8 + (1 - n.comfort) * 1.8 + p.coatWarmth * 0.9, 40);
      }
      if (env.porch) {
        add('porchLounge', (0.45 + p.laziness * 0.85 + p.sociability * 0.35 + (1 - n.energy) * 0.6) * (env.isHot ? 1.3 : 1.0), 50);
      }

      // Calm observation & resting
      add('sitWatch', 0.55 + p.curiosity * 0.45 + p.laziness * 0.35, 38);
      add('lieIdle', 0.45 + p.laziness * 0.85 + (1 - n.energy) * 0.85, 42);
      if (env.cameraPos) {
        add('lookAtObserver', 0.42 + n.social * 1.1 + p.sociability * 0.75 + p.curiosity * 0.3, 48);
      }

      // Grooming & micro-behaviors
      add('scratch', 0.36 + env.dirtiness * 0.75 + p.cleanliness * 0.25, 45);
      add('stretch', 0.34 + (this._lastActionId === 'lieIdle' || this._lastActionId === 'porchLounge' ? 1.2 : 0), 42);
      add('yawn', 0.30 + (1 - n.energy) * 0.55, 45);

      // Exploration & Play (when outdoors is okay)
      if (canGoOut) {
        add('wander', (0.72 + n.boredom * 0.6 + p.energy * 0.45) * hotMiddaySlow, 26);
        add('followScent', (0.62 + n.curiosity * 0.85 + p.scentDrive * 0.75) * primeActive * hotMiddaySlow, 35);

        if (n.energy > 0.32) {
          add('dig', (0.35 + n.boredom * 0.75 + p.digDrive * 0.85) * primeActive * hotMiddaySlow * (1.15 - p.cleanliness * 0.5), 55);
          add('bellyRoll', (0.40 + n.comfort * 0.55 + p.sociability * 0.4) * (env.wetness > 0.6 ? 0.25 : 1.0), 55);
          add('rollInDirt', (0.30 + n.boredom * 0.55 + p.digDrive * 0.45) * (1.2 - p.cleanliness * 0.85), 65);
        }

        if (getPoi(env.garden, 'toy') && n.energy > 0.35) {
          add('playToy', (0.55 + n.boredom * 1.15 + p.energy * 0.75) * primeActive * hotMiddaySlow, 42);
        }

        if (n.energy > 0.52 && !env.isHot) {
          add('zoomies', (0.38 + n.boredom * 0.95 + n.energy * 0.85 + p.energy * 0.85) * primeActive, 65);
        }

        if (getPoi(env.garden, 'pond')) {
          add('inspectPond', (0.45 + n.curiosity * 0.75 + p.waterLove * 0.65) * (env.isHot ? 1.35 : 1.0), 50);
        }

        if (getPoi(env.garden, 'flowerbed')) {
          const flowerSeason = env.clk.season === 'winter' ? 0.45 : 1.15;
          add('sniffFlowers', (0.45 + n.curiosity * 0.65 + p.scentDrive * 0.35) * flowerSeason, 50);
        }

        // Dynamic wildlife & seasonal particles
        if (env.butterflies.length > 0 && n.energy > 0.28) {
          add('chaseButterfly', (0.85 + p.curiosity * 0.7 + p.energy * 0.55) * hotMiddaySlow, 36);
        }
        if (env.birds.length > 0 && n.energy > 0.28) {
          add('stalkBird', (0.72 + p.curiosity * 0.75 + p.energy * 0.45) * hotMiddaySlow, 42);
          add('barkBird', (0.55 + p.vocal * 0.85 + p.energy * 0.45) * hotMiddaySlow, 45);
        }
        if ((env.fallingSample || (env.windStrength > 0.25 && (env.clk.season === 'spring' || env.clk.season === 'autumn'))) && n.energy > 0.35) {
          add('chaseFalling', (0.65 + p.energy * 0.55 + p.curiosity * 0.55) * hotMiddaySlow, 42);
        }

        // Winter snow joy!
        if (env.snowCover > 0.22 || env.isSnowing) {
          add('playInSnow', (0.85 + p.snowLove * 1.15 + n.energy * 0.65) * (env.isSnowing ? 1.3 : 1.0), 40);
        }

        // Occasional vocalizations
        if (p.vocal > 0.45 && n.energy > 0.35) {
          add('barkPlayful', 0.22 + p.vocal * 0.42 + n.social * 0.3, 60);
        }
      }
    }

    // Fallback safety
    if (scores.length === 0) {
      return env.isDeepNight ? 'sleepDoghouse' : 'wander';
    }

    // Softmax over top 5 candidates so the dog is smart yet naturally varied
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, 5);
    const maxS = top[0].score;
    const weighted = top.map((c) => ({
      item: c.id,
      weight: Math.exp((c.score - maxS) * 1.65),
    }));
    return pickWeighted(weighted) || top[0].id;
  }

  _startAction(id, env, dogPos, dogHeading) {
    const steps = this._buildActionSteps(id, env, dogPos, dogHeading);
    if (!steps || steps.length === 0) {
      this._currentPlan = null;
      return;
    }

    // If currently inside the doghouse and starting an outdoor action, prepend a clean exit step!
    const staysInside = (id === 'sleepDoghouse' || id === 'watchRain');
    if (this._insideDoghouse && !staysInside && env.doghouse) {
      steps.unshift({
        kind: 'move',
        x: env.doghouse.x,
        z: env.doghouse.z,
        speed: 1.05,
        interior: true,
        arriveDist: 0.45,
        label: '犬小屋から出てきた',
        tail: 'relaxed',
        ears: 'relaxed',
        onComplete: () => {
          this._insideDoghouse = false;
          this.inShelter = false;
        },
      });
    }

    this._planSerial++;
    this._currentPlan = { id, steps };
    this._stepIndex = 0;
    this._stepElapsed = 0;
    this._stepData = {};
    this._nav.reset(dogPos.x, dogPos.z);

    const first = steps[0];
    this.action = { id, label: first.label || '庭で過ごしている' };
  }

  _finishCurrentAction() {
    if (this._currentPlan) {
      const id = this._currentPlan.id;
      this._lastDoneTime[id] = this._elapsedReal;
      this._lastActionId = id;
      this._recentActions.push(id);
      if (this._recentActions.length > 8) this._recentActions.shift();
      if (id === 'sleepDoghouse' || id === 'sunbathe') {
        this._postSleepTimer = 8.0;
      }
    }
    this._currentPlan = null;
    this._stepIndex = 0;
    this._stepElapsed = 0;
    this._stepData = {};
    this.isSleeping = false;
  }

  _advanceStep(dogPos) {
    if (!this._currentPlan) return;
    const prev = this._currentPlan.steps[this._stepIndex];
    if (prev && typeof prev.onComplete === 'function') prev.onComplete();

    this._stepIndex++;
    this._stepElapsed = 0;
    this._stepData = {};
    this._nav.reset(dogPos.x, dogPos.z);

    if (this._stepIndex >= this._currentPlan.steps.length) {
      this._finishCurrentAction();
    } else {
      const next = this._currentPlan.steps[this._stepIndex];
      if (next.label) {
        this.action = { id: this._currentPlan.id, label: next.label };
      }
    }
  }

  _buildActionSteps(id, env, dogPos, dogHeading) {
    const g = env.garden;
    const m = this._bodyMargin;
    const sp = this.profile.speedScale;
    const walk = 1.25 * sp;
    const trot = 2.9 * sp;
    const gallop = 5.4 * sp;

    const resolvePoiSpot = (poi, fallbackMinR = 0.35, fallbackMaxR = 0.95) => {
      if (typeof poi.rotY === 'number' && isWalkable(g, poi.x, poi.z, m)) {
        return {
          x: poi.x,
          z: poi.z,
          heading: poi.rotY,
          lookPos: { x: poi.x + Math.sin(poi.rotY) * 0.55, y: 0.14, z: poi.z + Math.cos(poi.rotY) * 0.55 },
        };
      }
      const pt = findSafePointNear(g, poi.x, poi.z, fallbackMinR, fallbackMaxR, m);
      return {
        x: pt.x,
        z: pt.z,
        heading: Math.atan2(poi.x - pt.x, poi.z - pt.z),
        lookPos: { x: poi.x, y: 0.14, z: poi.z },
      };
    };

    switch (id) {
      case 'eat': {
        const bowl = getPoi(g, 'foodBowl');
        if (!bowl) return this._buildActionSteps('wander', env, dogPos, dogHeading);
        const spot = resolvePoiSpot(bowl, 0.35, 0.85);
        return [
          { kind: 'move', x: spot.x, z: spot.z, speed: trot * 0.85, arriveDist: 0.35, label: 'ごはん皿へ向かっている', tail: 'relaxed', tailBurst: { dur: 2.8, after: 'wag', afterDur: 2.4 }, ears: 'alert' },
          { kind: 'pose', pose: 'sniffGround', duration: randRange(1.5, 2.2), heading: spot.heading, lookPos: spot.lookPos, label: 'ごはんの匂いを嗅いでいる', tail: 'relaxed', ears: 'alert' },
          { kind: 'eat', duration: randRange(5.0, 8.0), heading: spot.heading, bowlPos: spot.lookPos, label: 'ごはんをもぐもぐ食べている', tail: 'relaxed', tailBurst: { dur: 2.2, after: 'wag', afterDur: 2.4 }, ears: 'relaxed' },
          { kind: 'lipLick', duration: 2.0, heading: spot.heading, label: '口のまわりをぺろぺろ', tail: 'relaxed', tailWag: 1.4, ears: 'relaxed' },
          { kind: 'yawn', pose: 'sit', duration: 2.3, label: 'ごはんを食べて満足そう', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      case 'checkEmptyBowl': {
        const bowl = getPoi(g, 'foodBowl');
        if (!bowl) return this._buildActionSteps('sitWatch', env, dogPos, dogHeading);
        const spot = resolvePoiSpot(bowl, 0.35, 0.85);
        return [
          { kind: 'move', x: spot.x, z: spot.z, speed: walk, arriveDist: 0.35, label: 'ごはん皿を見に行っている', tail: 'relaxed', tailWag: 2.0, ears: 'alert' },
          { kind: 'pose', pose: 'sniffGround', duration: 2.4, heading: spot.heading, lookPos: spot.lookPos, label: 'ごはん皿が空っぽ…', tail: 'down', clearTailBurst: true, ears: 'back' },
          { kind: 'lookObserver', pose: 'sit', duration: 3.4, whine: true, label: 'ごはんまだかな…', tail: 'down', clearTailBurst: true, ears: 'back' },
        ];
      }

      case 'drink': {
        const bowl = getPoi(g, 'waterBowl');
        if (!bowl) return this._buildActionSteps('wander', env, dogPos, dogHeading);
        const spot = resolvePoiSpot(bowl, 0.35, 0.82);
        return [
          { kind: 'move', x: spot.x, z: spot.z, speed: walk * 1.1, arriveDist: 0.35, label: 'お水を飲みに行っている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'sniffGround', duration: 0.9, heading: spot.heading, lookPos: spot.lookPos, label: 'お水を確かめている', tail: 'relaxed', ears: 'relaxed' },
          { kind: 'drink', duration: randRange(4.0, 6.2), heading: spot.heading, bowlPos: spot.lookPos, label: 'お水をぴちゃぴちゃ飲んでいる', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'lipLick', duration: 1.6, heading: spot.heading, label: 'お水を飲んでひと息', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      case 'wander': {
        const count = Math.floor(randRange(2, 4.5));
        const steps = [];
        let refX = dogPos.x;
        let refZ = dogPos.z;
        for (let i = 0; i < count; i++) {
          const pt = randomWalkable(g, refX, refZ, m);
          refX = pt.x; refZ = pt.z;
          steps.push({
            kind: 'move',
            x: pt.x,
            z: pt.z,
            speed: walk * randRange(0.88, 1.18),
            arriveDist: 0.6,
            label: i % 2 === 0 ? '庭をのんびり散歩中' : 'あちこち散策中',
            tail: 'relaxed',
            clearTailBurst: true,
            ears: 'relaxed',
          });
          if (Math.random() < 0.65) {
            steps.push({
              kind: 'pose',
              pose: Math.random() < 0.55 ? 'sniffGround' : 'stand',
              duration: randRange(1.5, 3.0),
              scanAround: true,
              label: '気になる場所をクンクン',
              tail: 'relaxed',
              clearTailBurst: true,
              ears: 'alert',
            });
          }
        }
        return steps;
      }

      case 'followScent': {
        const steps = [];
        let curX = dogPos.x;
        let curZ = dogPos.z;
        let dir = dogHeading + randRange(-1.0, 1.0);
        const legs = Math.floor(randRange(4, 6.5));
        for (let i = 0; i < legs; i++) {
          dir += randRange(-0.85, 0.85);
          const len = randRange(1.6, 3.2);
          let nx = curX + Math.sin(dir) * len;
          let nz = curZ + Math.cos(dir) * len;
          if (!isWalkable(g, nx, nz, m + 0.05)) {
            const alt = randomWalkable(g, curX, curZ, m);
            nx = alt.x; nz = alt.z;
            dir = Math.atan2(nx - curX, nz - curZ);
          }
          curX = nx; curZ = nz;
          steps.push({
            kind: 'move',
            x: nx,
            z: nz,
            speed: walk * 0.68,
            poseDuringMove: 'sniffGround',
            arriveDist: 0.45,
            label: '気になる匂いを辿っている',
            tail: 'relaxed',
            clearTailBurst: true,
            ears: 'relaxed',
          });
          steps.push({
            kind: 'pose',
            pose: 'sniffGround',
            duration: randRange(1.2, 2.2),
            label: '地面をクンクン嗅いでいる',
            tail: 'relaxed',
            clearTailBurst: true,
            ears: 'alert',
          });
        }
        steps.push({
          kind: 'pose',
          pose: 'stand',
          duration: 1.5,
          scanAround: true,
          label: '匂いの先を見回している',
          tail: 'relaxed',
          clearTailBurst: true,
          ears: 'alert',
          onComplete: () => { this.needs.curiosity = clamp(this.needs.curiosity - 0.32, 0, 1); },
        });
        return steps;
      }

      case 'dig': {
        const anchor = (Math.random() < 0.5 && getPoi(g, 'tree')) || (Math.random() < 0.5 && getPoi(g, 'flowerbed')) || randomWalkable(g, dogPos.x, dogPos.z, m);
        const spot = findSafePointNear(g, anchor.x, anchor.z, 1.2, 3.0, m + 0.06);
        return [
          { kind: 'move', x: spot.x, z: spot.z, speed: walk * 1.15, arriveDist: 0.48, label: '掘る場所を探している', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          { kind: 'pose', pose: 'sniffGround', duration: randRange(1.8, 2.6), label: '地面の匂いを念入りに嗅いでいる', tail: 'relaxed', ears: 'alert' },
          { kind: 'dig', duration: randRange(3.2, 5.2), label: '夢中で地面を掘っている', tail: 'relaxed', tailBurst: { dur: 2.4, after: 'wag', afterDur: 2.0 }, ears: 'alert' },
          { kind: 'pose', pose: 'sniffGround', duration: 1.8, label: '掘った穴を確認中', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          ...(Math.random() < 0.55 ? [{ kind: 'dig', duration: randRange(2.0, 3.2), label: 'もう少し掘ってみる！', tail: 'relaxed', tailWag: 2.0, ears: 'alert' }] : []),
          { kind: 'pounce', duration: 1.0, label: '掘って大満足！', tail: 'relaxed', tailWag: 1.2, ears: 'alert' },
        ];
      }

      case 'playToy': {
        const toy = getPoi(g, 'toy');
        if (!toy) return this._buildActionSteps('zoomies', env, dogPos, dogHeading);
        const approach = findSafePointNear(g, toy.x, toy.z, 0.5, 1.2, m);
        const steps = [
          { kind: 'move', x: approach.x, z: approach.z, speed: trot, arriveDist: 0.55, label: 'ボールを見つけた！', tail: 'relaxed', tailBurst: { dur: 2.8, after: 'wag', afterDur: 2.5 }, ears: 'alert' },
          { kind: 'pose', pose: 'play_bow', duration: 1.5, lookPoi: 'toy', barkOnce: Math.random() < 0.45 + this.profile.vocal * 0.35, label: 'ボールに遊ぼうポーズ', tail: 'relaxed', tailBurst: { dur: 2.4, after: 'wag', afterDur: 2.4 }, ears: 'alert' },
          { kind: 'playBall', rounds: Math.floor(randRange(2, 4)), label: 'ボールで一人遊び中', tail: 'relaxed', ears: 'alert' },
          { kind: 'pose', pose: 'sniffGround', duration: 1.5, lookPoi: 'toy', label: 'ボール遊びでご機嫌', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
        return steps;
      }

      case 'zoomies': {
        const laps = Math.floor(randRange(4, 6.5));
        const steps = [
          { kind: 'pose', pose: 'play_bow', duration: 0.95, barkOnce: Math.random() < 0.55, label: 'スイッチが入った！', tail: 'relaxed', tailBurst: { dur: 3.0, after: 'wag', afterDur: 3.0 }, ears: 'back' },
        ];
        let prevX = dogPos.x;
        let prevZ = dogPos.z;
        for (let i = 0; i < laps; i++) {
          let pt = randomWalkable(g, prevX, prevZ, m + 0.08);
          for (let tries = 0; tries < 5; tries++) {
            const cand = randomWalkable(g, prevX, prevZ, m + 0.08);
            if (dist2D(prevX, prevZ, cand.x, cand.z) > 5.5) { pt = cand; break; }
          }
          prevX = pt.x; prevZ = pt.z;
          steps.push({
            kind: 'move',
            x: pt.x,
            z: pt.z,
            speed: gallop * randRange(0.92, 1.08),
            arriveDist: 1.1,
            label: '庭を全力ダッシュ！（ズーミー）',
            tail: 'relaxed',
            ears: 'back',
          });
        }
        steps.push(
          { kind: 'jump', duration: 0.9, label: 'ぴょんと飛び跳ねた！', tail: 'relaxed', tailWag: 1.4, ears: 'alert' },
          { kind: 'pose', pose: 'stand', duration: 2.6, label: '走り回ってハアハアしている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        );
        return steps;
      }

      case 'chaseButterfly': {
        if (env.butterflies.length === 0) return this._buildActionSteps('wander', env, dogPos, dogHeading);
        const target = env.butterflies[0].obj;
        return [
          { kind: 'pose', pose: 'stand', duration: 0.85, trackObj: target, headTilt: 0.25, label: '蝶々を発見！', tail: 'relaxed', tailBurst: { dur: 2.6, after: 'wag', afterDur: 2.6 }, ears: 'alert' },
          { kind: 'chase', trackObj: target, speed: trot * 1.35, duration: randRange(6.5, 11.5), jumpClose: true, label: '蝶々を追いかけている', tail: 'relaxed', ears: 'alert' },
          { kind: 'jump', duration: 0.95, trackObj: target, label: '蝶々にジャンプ！', tail: 'relaxed', tailWag: 1.5, ears: 'alert' },
          { kind: 'pose', pose: 'stand', duration: 2.0, trackObj: target, headTilt: -0.22, label: '蝶々を見送っている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
        ];
      }

      case 'stalkBird': {
        if (env.birds.length === 0) return this._buildActionSteps('followScent', env, dogPos, dogHeading);
        const target = env.birds[0].obj;
        return [
          { kind: 'pose', pose: 'stand', duration: 1.6, trackObj: target, label: '小鳥を見つけた…', tail: 'relaxed', tailAlert: true, clearTailBurst: true, ears: 'alert' },
          { kind: 'chase', trackObj: target, speed: walk * 0.45, duration: randRange(3.5, 5.5), stopDist: 2.2, label: '小鳥にそっと忍び寄っている', tail: 'relaxed', tailAlert: true, clearTailBurst: true, ears: 'alert' },
          { kind: 'pose', pose: 'lie', duration: 1.0, trackObj: target, label: 'じっと狙いを定めている…', tail: 'relaxed', tailAlert: true, clearTailBurst: true, ears: 'alert' },
          { kind: 'pounce', duration: 1.0, trackObj: target, label: '小鳥に飛びかかった！', tail: 'relaxed', tailWag: 1.2, ears: 'alert' },
          { kind: 'pose', pose: 'stand', duration: 2.2, lookSky: true, headTilt: 0.28, label: '小鳥を見上げている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
        ];
      }

      case 'barkBird': {
        if (env.birds.length === 0) return this._buildActionSteps('barkPlayful', env, dogPos, dogHeading);
        const target = env.birds[0].obj;
        return [
          { kind: 'chase', trackObj: target, speed: trot, duration: 2.6, stopDist: 3.0, label: '小鳥を見つけて駆け寄る', tail: 'relaxed', tailBurst: { dur: 2.2, after: 'wag', afterDur: 2.0 }, ears: 'alert' },
          { kind: 'bark', count: Math.floor(randRange(2, 4)), trackObj: target, label: '小鳥に向かってワンワン！', tail: 'relaxed', ears: 'alert' },
          { kind: 'pose', pose: 'stand', duration: 2.2, trackObj: target, label: '小鳥をじっと警戒中', tail: 'relaxed', tailAlert: true, clearTailBurst: true, ears: 'alert' },
        ];
      }

      case 'chaseFalling': {
        const sLabel = env.clk.season === 'spring'
          ? '舞う桜の花びらを追いかけている'
          : (env.clk.season === 'winter' ? '舞う雪を追いかけている' : '舞う落ち葉を追いかけている');
        const bursts = Math.floor(randRange(2, 4));
        const steps = [
          { kind: 'pose', pose: 'stand', duration: 0.8, lookSky: true, headTilt: 0.22, label: 'ひらひら舞うものを発見！', tail: 'relaxed', tailBurst: { dur: 2.6, after: 'wag', afterDur: 2.4 }, ears: 'alert' },
        ];
        const windAngle = randRange(0, TWO_PI);
        let anchor = (env.fallingSample && isWalkable(g, env.fallingSample.x, env.fallingSample.z, m))
          ? env.fallingSample
          : findSafePointNear(g, dogPos.x + randRange(-3, 3), dogPos.z + randRange(-3, 3), 1.5, 4.2, m);
        for (let i = 0; i < bursts; i++) {
          const target = i === 0
            ? anchor
            : findSafePointNear(
                g,
                anchor.x + Math.sin(windAngle + randRange(-0.5, 0.5)) * randRange(1.8, 3.6),
                anchor.z + Math.cos(windAngle + randRange(-0.5, 0.5)) * randRange(1.8, 3.6),
                0.5, 2.5, m
              );
          anchor = target;
          steps.push(
            { kind: 'move', x: target.x, z: target.z, speed: trot * 1.2, arriveDist: 0.8, label: sLabel, tail: 'relaxed', ears: 'alert' },
            { kind: i % 2 === 0 ? 'jump' : 'pounce', duration: 0.9, label: sLabel, tail: 'relaxed', tailWag: 1.2, ears: 'alert' },
          );
        }
        steps.push({ kind: 'pose', pose: 'sniffGround', duration: 1.6, label: '落ちた場所をクンクン', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' });
        return steps;
      }

      case 'sleepDoghouse': {
        const entrance = env.doghouse;
        const inside = env.doghouseInside;
        if (!entrance || !inside) return this._buildActionSteps('lieIdle', env, dogPos, dogHeading);
        const safeEntrance = findSafePointNear(g, entrance.x, entrance.z, 0, 1.2, m);
        const faceOut = inside.rotY ?? entrance.rotY ?? 0;
        const sleepDuration = env.isDeepNight ? randRange(50, 90) : randRange(24, 42);
        const steps = [];
        if (!this._insideDoghouse) {
          steps.push(
            { kind: 'move', x: safeEntrance.x, z: safeEntrance.z, speed: walk * 0.9, arriveDist: 0.45, label: '犬小屋へ向かっている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
            {
              kind: 'move', x: inside.x, z: inside.z, speed: walk * 0.68, interior: true, arriveDist: 0.22,
              label: '犬小屋の中に入っている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed',
              onComplete: () => { this._insideDoghouse = true; this.inShelter = true; },
            },
          );
        }
        steps.push(
          { kind: 'circle', turns: randRange(1.8, 2.6), radius: 0.16, interior: true, finalHeading: faceOut, label: 'くるくる回って寝床を整えている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'sleep', duration: sleepDuration, heading: faceOut, inDoghouse: true, label: '犬小屋ですやすや眠っている', tail: 'relaxed', clearTailBurst: true },
          { kind: 'yawn', pose: 'lie', duration: 2.2, heading: faceOut, label: '目を覚ましてふわぁ〜', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        );
        return steps;
      }

      case 'sunbathe': {
        const spot = env.sunnySpot || randomWalkable(g, dogPos.x, dogPos.z, m);
        const safeSpot = findSafePointNear(g, spot.x, spot.z, 0, 1.4, m + 0.05);
        return [
          { kind: 'move', x: safeSpot.x, z: safeSpot.z, speed: walk, arriveDist: 0.5, label: '日なたを探している', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'sniffGround', duration: 1.4, label: 'ぽかぽかの芝生をクンクン', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'circle', turns: randRange(1.6, 2.4), radius: 0.34, label: 'くるくる回って寝る準備', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'lie', duration: 4.5, label: '日なたぼっこ中', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'sleep', duration: randRange(18, 32), sunNap: true, label: '日なたでぽかぽか昼寝中', tail: 'relaxed', clearTailBurst: true },
          { kind: 'yawn', pose: 'lie', duration: 2.2, label: '日なたぼっこから目覚めた', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      case 'coolInShade': {
        const shade = findShadeSpot(g, env.clk, m);
        return [
          { kind: 'move', x: shade.x, z: shade.z, speed: walk * 0.8, arriveDist: 0.55, label: '涼しい日陰を探している', tail: 'down', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'lie', duration: 5.0, coolDown: true, label: '木陰でぐったり涼んでいる', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'sleepSide', duration: randRange(14, 24), coolDown: true, label: '日陰でのびてひと休み', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      case 'porchLounge': {
        const porch = env.porch;
        if (!porch) return this._buildActionSteps('lieIdle', env, dogPos, dogHeading);
        const spot = findSafePointNear(g, porch.x, porch.z, 0, 1.0, m);
        const faceGarden = porch.rotY ?? 0;
        return [
          { kind: 'move', x: spot.x, z: spot.z, speed: walk, arriveDist: 0.45, label: '縁側へ向かっている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'sit', duration: 3.0, heading: faceGarden, scanAround: true, shelter: true, label: '縁側で庭を眺めている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'lie', duration: randRange(14, 24), heading: faceGarden, scanAround: true, shelter: true, label: '縁側でのんびりくつろぎ中', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      case 'sitWatch': {
        const steps = [];
        if (Math.random() < 0.5) {
          const spot = randomWalkable(g, dogPos.x, dogPos.z, m);
          steps.push({ kind: 'move', x: spot.x, z: spot.z, speed: walk, arriveDist: 0.55, label: '見晴らしのいい場所へ移動中', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' });
        }
        steps.push({
          kind: 'pose',
          pose: 'sit',
          duration: randRange(9, 16),
          scanAround: true,
          label: 'おすわりして庭を眺めている',
          tail: 'relaxed',
          clearTailBurst: true,
          ears: 'alert',
        });
        return steps;
      }

      case 'lieIdle': {
        const steps = [];
        if (Math.random() < 0.45) {
          steps.push({ kind: 'circle', turns: 1.2, radius: 0.3, label: 'ごろりと横になる準備', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' });
        }
        steps.push({
          kind: 'pose',
          pose: 'lie',
          duration: randRange(11, 20),
          scanAround: true,
          label: '伏せてぼーっとしている',
          tail: 'relaxed',
          clearTailBurst: true,
          ears: 'relaxed',
        });
        if (Math.random() < 0.5) {
          steps.push({ kind: 'yawn', pose: 'lie', duration: 2.2, label: 'のんびりあくび', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' });
        }
        return steps;
      }

      case 'lookAtObserver': {
        return [
          {
            kind: 'lookObserver',
            pose: Math.random() < 0.6 ? 'sit' : 'stand',
            duration: randRange(5.5, 8.0),
            whine: this.profile.sociability > 0.78 && Math.random() < 0.35,
            label: 'じっとこちらを見て首をかしげている',
            tail: 'relaxed',
            tailBurst: { dur: 2.6, after: 'wag', afterDur: 2.0 },
            ears: 'alert',
          },
        ];
      }

      case 'scratch': {
        return [
          { kind: 'pose', pose: 'sit', duration: 0.7, label: 'ちょっとかゆいかも…', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'scratch', duration: randRange(2.8, 4.4), label: 'かゆいところをカキカキ', tail: 'relaxed', clearTailBurst: true, ears: 'back' },
          { kind: 'pose', pose: 'stand', duration: 1.1, headTilt: 0.15, label: 'かいてすっきりした', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      case 'shakeOff': {
        return [
          { kind: 'pose', pose: 'stand', duration: 0.5, label: '体を振ろうとしている', tail: 'relaxed', clearTailBurst: true, ears: 'back' },
          { kind: 'shake', duration: randRange(2.0, 2.7), label: 'ブルブル体を振っている', tail: 'relaxed', clearTailBurst: true, ears: 'back' },
          { kind: 'pose', pose: 'stand', duration: 1.0, label: '毛並みがすっきり！', tail: 'relaxed', tailWag: 1.2, ears: 'relaxed' },
        ];
      }

      case 'stretch': {
        return [
          { kind: 'pose', pose: 'stand', duration: 0.4, label: '伸びの準備', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'stretch', duration: randRange(2.8, 3.8), label: 'うーんと大きく伸びをしている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          ...(Math.random() < 0.6 ? [{ kind: 'yawn', pose: 'stand', duration: 2.0, label: '伸びをしてすっきり！', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' }] : []),
        ];
      }

      case 'yawn': {
        return [
          { kind: 'yawn', pose: Math.random() < 0.55 ? 'sit' : 'stand', duration: 2.6, label: 'ふわぁ〜と大きなあくび', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'lipLick', duration: 1.2, label: 'ちょっと眠いかも', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      case 'bellyRoll': {
        const spot = env.sunnySpot || randomWalkable(g, dogPos.x, dogPos.z, m);
        const safe = findSafePointNear(g, spot.x, spot.z, 0, 1.5, m + 0.08);
        return [
          { kind: 'move', x: safe.x, z: safe.z, speed: walk, arriveDist: 0.55, label: '気持ちよさそうな芝生へ', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'lie', duration: 1.0, label: 'ごろんと横になる', tail: 'relaxed', ears: 'relaxed' },
          { kind: 'pose', pose: 'bellyUp', duration: 2.2, label: '仰向けになってお腹見せ', tail: 'relaxed', tailBurst: { dur: 2.5, after: 'wag', afterDur: 2.2 }, ears: 'relaxed' },
          { kind: 'pose', pose: 'roll', duration: randRange(4.0, 6.2), label: '仰向けでごろごろしている', tail: 'relaxed', ears: 'relaxed' },
          { kind: 'pose', pose: 'bellyUp', duration: 2.4, label: 'お腹を見せてご機嫌', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'stand', duration: 1.0, label: 'ごろごろして満足！', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      case 'rollInDirt': {
        const dirtPoi = getPoi(g, 'flowerbed') || getPoi(g, 'tree') || randomWalkable(g, dogPos.x, dogPos.z, m);
        const spot = findSafePointNear(g, dirtPoi.x, dirtPoi.z, 1.1, 2.4, m + 0.06);
        return [
          { kind: 'move', x: spot.x, z: spot.z, speed: walk * 1.1, arriveDist: 0.48, label: '土の匂いに引き寄せられている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          { kind: 'pose', pose: 'sniffGround', duration: 2.0, label: '土の匂いを夢中で嗅いでいる', tail: 'relaxed', tailBurst: { dur: 2.2, after: 'wag', afterDur: 2.0 }, ears: 'alert' },
          { kind: 'pose', pose: 'roll', duration: randRange(4.2, 6.2), addDirt: true, label: '土の上でごろごろ転がっている', tail: 'relaxed', ears: 'relaxed' },
          { kind: 'pose', pose: 'stand', duration: 1.3, label: '土まみれになって満足げ', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
        ];
      }

      case 'markTree': {
        const tree = getPoi(g, 'tree');
        if (!tree) return this._buildActionSteps('wander', env, dogPos, dogHeading);
        const spot = resolvePoiSpot(tree, 1.1, 1.85);
        const sideOn = wrapAngle(spot.heading - HALF_PI);
        return [
          { kind: 'move', x: spot.x, z: spot.z, speed: walk * 1.15, arriveDist: 0.45, label: '木の根元へ向かっている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          { kind: 'pose', pose: 'sniffGround', duration: 2.6, heading: spot.heading, lookPos: spot.lookPos, label: '木の根元の匂いをチェック中', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          { kind: 'mark', duration: 2.8, heading: sideOn, label: '木の根元にマーキング中', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          { kind: 'pose', pose: 'dig', duration: 1.1, heading: sideOn, label: '後ろ足で草を蹴っている', tail: 'relaxed', tailWag: 1.0, ears: 'alert' },
        ];
      }

      case 'inspectPond': {
        const pond = getPoi(g, 'pond');
        if (!pond) return this._buildActionSteps('wander', env, dogPos, dogHeading);
        const spot = resolvePoiSpot(pond, 0.25, 1.2);
        const steps = [
          { kind: 'move', x: spot.x, z: spot.z, speed: walk, arriveDist: 0.48, label: '池のほとりへ向かっている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          { kind: 'pose', pose: 'sniffGround', duration: 2.8, heading: spot.heading, headTilt: 0.22, label: '池の中をのぞきこんでいる', tail: 'relaxed', tailWag: 2.0, ears: 'alert' },
          { kind: 'pose', pose: 'sit', duration: 3.4, heading: spot.heading, headTilt: -0.26, label: '水面のゆらめきをじっと見ている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
        ];
        if (this.profile.waterLove > 0.65 && Math.random() < 0.65) {
          steps.push({ kind: 'pounce', duration: 1.1, heading: spot.heading, splashWet: true, label: '水面にぱしゃんとちょっかい！', tail: 'relaxed', tailBurst: { dur: 2.0, after: 'relaxed' }, ears: 'alert' });
        }
        return steps;
      }

      case 'playInSnow': {
        const p1 = randomWalkable(g, dogPos.x, dogPos.z, m + 0.05);
        const p2 = findSafePointNear(g, p1.x + randRange(-4, 4), p1.z + randRange(-4, 4), 1.8, 5.0, m + 0.05);
        return [
          { kind: 'pose', pose: 'play_bow', duration: 1.1, barkOnce: Math.random() < 0.5, label: '雪だ！わくわくしている', tail: 'relaxed', tailBurst: { dur: 3.0, after: 'wag', afterDur: 2.8 }, ears: 'alert' },
          { kind: 'move', x: p1.x, z: p1.z, speed: trot * 1.35, arriveDist: 0.85, label: '雪の中ではしゃいでいる！', tail: 'relaxed', ears: 'alert' },
          { kind: 'jump', duration: 0.9, label: '雪の上でぴょんぴょん！', tail: 'relaxed', tailWag: 1.5, ears: 'alert' },
          { kind: 'move', x: p2.x, z: p2.z, speed: trot * 1.25, arriveDist: 0.75, label: '雪の中を駆け回っている！', tail: 'relaxed', ears: 'alert' },
          { kind: 'snowPlunge', duration: randRange(2.8, 4.0), label: '雪に顔をつっこんでいる！', tail: 'relaxed', tailWag: 1.8, ears: 'alert' },
          { kind: 'pose', pose: 'stand', duration: 1.5, headTilt: 0.22, label: '鼻先に雪がついてうれしそう', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
        ];
      }

      case 'watchRain': {
        const entrance = env.doghouse;
        const inside = env.doghouseInside;
        if (!entrance || !inside) return this._buildActionSteps('porchLounge', env, dogPos, dogHeading);
        const safeEntrance = findSafePointNear(g, entrance.x, entrance.z, 0, 1.2, m);
        const faceOut = inside.rotY ?? entrance.rotY ?? 0;
        const stormTail = (env.weatherIntensity > 0.72 && env.windStrength > 0.52) ? 'tucked' : 'down';
        const steps = [];
        if (!this._insideDoghouse) {
          steps.push(
            { kind: 'move', x: safeEntrance.x, z: safeEntrance.z, speed: trot * 0.8, arriveDist: 0.45, label: '雨宿りしに行っている', tail: stormTail, clearTailBurst: true, ears: 'back' },
            {
              kind: 'move', x: inside.x, z: inside.z, speed: walk * 0.75, interior: true, arriveDist: 0.25,
              label: '犬小屋に入って雨宿り', tail: 'down', clearTailBurst: true, ears: 'back',
              onComplete: () => { this._insideDoghouse = true; this.inShelter = true; },
            },
          );
        }
        steps.push({
          kind: 'watchRain',
          duration: randRange(18, 32),
          heading: faceOut,
          label: '犬小屋から雨を眺めている',
          tail: 'down',
          clearTailBurst: true,
        });
        return steps;
      }

      case 'reactToRain': {
        const entrance = env.doghouse;
        const steps = [
          { kind: 'pose', pose: 'stand', duration: 1.6, lookSky: true, headTilt: 0.3, label: 'あれ、雨が降ってきた！', tail: 'down', clearTailBurst: true, ears: 'back' },
          { kind: 'shake', duration: 1.2, label: '雨粒をブルブル払っている', tail: 'down', clearTailBurst: true, ears: 'back' },
        ];
        if (entrance) {
          const safeEntrance = findSafePointNear(g, entrance.x, entrance.z, 0, 1.2, m);
          steps.push({ kind: 'move', x: safeEntrance.x, z: safeEntrance.z, speed: trot * 1.1, arriveDist: 0.45, label: '急いで犬小屋へ避難中！', tail: 'tucked', clearTailBurst: true, ears: 'back' });
          const inside = env.doghouseInside || entrance;
          const faceOut = inside.rotY ?? entrance.rotY ?? 0;
          steps.push(
            {
              kind: 'move', x: inside.x, z: inside.z, speed: walk * 0.9, interior: true, arriveDist: 0.25,
              label: '犬小屋に駆け込んだ', tail: 'down', clearTailBurst: true, ears: 'back',
              onComplete: () => { this._insideDoghouse = true; this.inShelter = true; },
            },
            { kind: 'watchRain', duration: randRange(16, 28), heading: faceOut, label: '犬小屋から雨を眺めている', tail: 'down', clearTailBurst: true },
          );
        }
        return steps;
      }

      case 'howlAtMoon': {
        const spot = randomWalkable(g, dogPos.x, dogPos.z, m);
        const steps = [
          { kind: 'move', x: spot.x, z: spot.z, speed: walk, arriveDist: 0.55, label: '月明かりの下へ歩いている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          { kind: 'pose', pose: 'sit', duration: 1.4, lookSky: true, label: '夜空の月を見上げている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          { kind: 'howl', duration: randRange(3.6, 5.2), label: '月に向かって遠吠えしている', tail: 'relaxed', clearTailBurst: true, ears: 'back' },
          { kind: 'pose', pose: 'sit', duration: 2.2, lookSky: true, label: '夜の静けさに耳を澄ませている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
        ];
        if (this.profile.howlBias > 0.7 && Math.random() < 0.65) {
          steps.push({ kind: 'howl', duration: randRange(3.0, 4.4), label: 'もう一度月に遠吠えしている', tail: 'relaxed', clearTailBurst: true, ears: 'back' });
        }
        return steps;
      }

      case 'nightPatrol': {
        const targets = [getPoi(g, 'porch'), getPoi(g, 'tree'), getPoi(g, 'pond')].filter(Boolean);
        const chosen = targets.length > 0 ? targets.sort(() => Math.random() - 0.5).slice(0, 2) : [randomWalkable(g, dogPos.x, dogPos.z, m), randomWalkable(g, dogPos.x, dogPos.z, m)];
        const steps = [];
        for (let i = 0; i < chosen.length; i++) {
          const pt = findSafePointNear(g, chosen[i].x, chosen[i].z, 0, 1.8, m);
          steps.push(
            { kind: 'move', x: pt.x, z: pt.z, speed: walk * 0.92, arriveDist: 0.55, label: '夜の庭を見回り中', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
            { kind: 'pose', pose: 'stand', duration: 2.4, scanAround: true, label: '夜の気配を確かめている', tail: 'relaxed', clearTailBurst: true, ears: 'alert' },
          );
        }
        return steps;
      }

      case 'sniffFlowers': {
        const fb = getPoi(g, 'flowerbed');
        if (!fb) return this._buildActionSteps('followScent', env, dogPos, dogHeading);
        const p1 = findSafePointNear(g, fb.x, fb.z, 0, 1.3, m);
        const p2 = findSafePointNear(g, fb.x + randRange(-1.2, 1.2), fb.z + randRange(-1.2, 1.2), 0.3, 1.5, m);
        const fLabel = env.clk.season === 'spring'
          ? 'チューリップの匂いを嗅いでいる'
          : (env.clk.season === 'summer'
            ? 'ひまわりのそばをクンクン'
            : (env.clk.season === 'autumn' ? 'コスモスの匂いを嗅いでいる' : '花壇の土をクンクン'));
        return [
          { kind: 'move', x: p1.x, z: p1.z, speed: walk, arriveDist: 0.48, label: '花壇へ向かっている', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'sniffGround', duration: 2.6, lookPos: { x: fb.x, y: 0.35, z: fb.z }, label: fLabel, tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'move', x: p2.x, z: p2.z, speed: walk * 0.75, arriveDist: 0.48, label: fLabel, tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
          { kind: 'pose', pose: 'sit', duration: 2.6, headTilt: 0.2, lookPos: { x: fb.x, y: 0.4, z: fb.z }, label: 'お花を眺めてうっとり', tail: 'relaxed', tailWag: 1.6, ears: 'relaxed' },
        ];
      }

      case 'barkPlayful': {
        return [
          { kind: 'pose', pose: 'stand', duration: 1.0, scanAround: true, label: '何か音がしたみたい', tail: 'relaxed', tailBurst: { dur: 2.2, after: 'wag', afterDur: 2.0 }, ears: 'alert' },
          { kind: 'bark', count: Math.floor(randRange(1, 3)), label: '気になってワンワン！', tail: 'relaxed', ears: 'alert' },
          { kind: 'pose', pose: 'stand', duration: 1.5, label: '異常なし！', tail: 'relaxed', clearTailBurst: true, ears: 'relaxed' },
        ];
      }

      default:
        return this._buildActionSteps('wander', env, dogPos, dogHeading);
    }
  }

  _triggerTailBurst(burstDur = 2.6, afterMode = 'relaxed', afterDur = 0) {
    this._tailBurstMode = 'happyWag';
    this._tailBurstTimer = Math.max(0.5, burstDur);
    this._tailAfterMode = afterMode === 'wag' ? 'wag' : 'relaxed';
    this._tailAfterTimer = this._tailAfterMode === 'wag'
      ? (afterDur > 0 ? afterDur : randRange(2.0, 3.2))
      : 0;
  }

  _triggerTailWag(wagDur = 2.2) {
    this._tailBurstMode = 'wag';
    this._tailBurstTimer = Math.max(0.5, wagDur);
    this._tailAfterMode = 'relaxed';
    this._tailAfterTimer = 0;
  }

  _clearTailBurst() {
    this._tailBurstMode = null;
    this._tailBurstTimer = 0;
    this._tailAfterMode = 'relaxed';
    this._tailAfterTimer = 0;
  }

  _resolveTailMode(realDt, env, step, stepTailHint) {
    // 1. Trigger step-entry tail burst/clear once per plan step
    const stepKey = `${this._planSerial}:${this._stepIndex}`;
    if (stepKey !== this._tailStepKey) {
      this._tailStepKey = stepKey;
      if (step?.tailBurst) {
        this._triggerTailBurst(step.tailBurst.dur, step.tailBurst.after, step.tailBurst.afterDur);
      } else if (typeof step?.tailWag === 'number' && step.tailWag > 0) {
        this._triggerTailWag(step.tailWag);
      } else if (
        step?.clearTailBurst ||
        step?.tailAlert ||
        step?.kind === 'sleep' ||
        step?.pose === 'sleepCurl' ||
        step?.pose === 'sleepSide' ||
        step?.pose === 'lie' ||
        stepTailHint === 'down' ||
        stepTailHint === 'tucked'
      ) {
        this._clearTailBurst();
      }
    }

    // 2. Advance timed burst state (happyWag -> wag -> relaxed)
    if (this._tailBurstTimer > 0) {
      this._tailBurstTimer -= realDt;
      if (this._tailBurstTimer <= 0) {
        if (this._tailAfterMode === 'wag' && this._tailAfterTimer > 0) {
          this._tailBurstMode = 'wag';
          this._tailBurstTimer = this._tailAfterTimer;
          this._tailAfterMode = 'relaxed';
          this._tailAfterTimer = 0;
        } else {
          this._tailBurstMode = null;
          this._tailBurstTimer = 0;
        }
      }
    }

    // 3. Sleep & deep rest -> always still ('relaxed')
    if (
      this.isSleeping ||
      step?.kind === 'sleep' ||
      step?.pose === 'sleepCurl' ||
      step?.pose === 'sleepSide'
    ) {
      return 'relaxed';
    }

    // 4. Scared / stormy heavy rain outdoors -> 'tucked'
    if (stepTailHint === 'tucked') return 'tucked';
    if (env.isRaining && !this.inShelter && env.weatherIntensity > 0.72 && env.windStrength > 0.52) {
      return 'tucked';
    }

    // 5. Rain / gloomy / disappointed / low comfort -> 'down'
    if (stepTailHint === 'down') return 'down';
    if (env.isRaining && !this.inShelter && !(this.profile.waterLove > 0.85 && env.weatherIntensity < 0.4)) {
      return 'down';
    }
    if (step?.kind === 'watchRain') {
      return (env.weatherIntensity > 0.55 || (this._stepElapsed % 14) < 7) ? 'down' : 'relaxed';
    }
    if (this.needs.comfort < 0.30) {
      return 'down';
    }

    // 6. Alert stalking (bird stalk / alert watch) -> still & poised ('relaxed')
    if (step?.tailAlert) {
      return 'relaxed';
    }

    // 7. Sleepy / exhausted mood suppresses wagging
    if (this.mood === 'sleepy' || this.needs.energy < 0.22) {
      return 'relaxed';
    }

    // 8. Active timed happyWag / wag burst
    if (this._tailBurstMode) {
      return this._tailBurstMode;
    }

    // 9. Safety time-cap if any step explicitly hints 'happyWag' or 'wag'
    const t = this._stepElapsed;
    if (stepTailHint === 'happyWag') {
      return t < 2.6 ? 'happyWag' : (t < 5.2 ? 'wag' : 'relaxed');
    }
    if (stepTailHint === 'wag') {
      return t < 3.0 ? 'wag' : 'relaxed';
    }

    return 'relaxed';
  }

  _handleMoveStuck(step, env, dogPos) {
    const planId = this._currentPlan?.id;
    this._stepData.stuckRetries = (this._stepData.stuckRetries || 0) + 1;

    const roamingActions = (
      planId === 'wander' ||
      planId === 'followScent' ||
      planId === 'zoomies' ||
      planId === 'chaseFalling' ||
      planId === 'playInSnow' ||
      planId === 'nightPatrol' ||
      planId === 'sunbathe' ||
      planId === 'coolInShade' ||
      planId === 'bellyRoll' ||
      planId === 'rollInDirt' ||
      planId === 'dig' ||
      planId === 'sitWatch' ||
      planId === 'howlAtMoon'
    );

    if (roamingActions && this._stepData.stuckRetries <= 2) {
      const fresh = randomWalkable(env.garden, dogPos.x, dogPos.z, this._bodyMargin + 0.05);
      step.x = fresh.x;
      step.z = fresh.z;
      this._nav.reset(dogPos.x, dogPos.z);
      this._nav.flipAvoidSide();
      this._stepElapsed = 0;
      return;
    }

    if (!roamingActions && !step.interior && this._stepData.stuckRetries === 1) {
      const fixed = findSafePointNear(env.garden, step.x, step.z, 0, 2.4, this._bodyMargin);
      step.x = fixed.x;
      step.z = fixed.z;
      this._nav.reset(dogPos.x, dogPos.z);
      this._nav.flipAvoidSide();
      return;
    }

    // Could not make progress after retries -> pick a brand new action & destination
    this._finishCurrentAction();
  }

  _executeCurrentStep(realDt, env, dogPos, dogHeading, animator, emitEvent, wasBlocked = false) {
    if (!this._currentPlan) return;
    const step = this._currentPlan.steps[this._stepIndex];
    if (!step) {
      this._finishCurrentAction();
      return;
    }

    this._stepElapsed += realDt;
    const t = this._stepElapsed;

    // Default locomotion: stopped
    this.locomotion.mode = 'stop';
    this.locomotion.targetSpeed = 0;
    this.locomotion.targetHeading = dogHeading;
    this.locomotion.turnRate = 3.2;
    this.locomotion.allowDoghouseInterior = Boolean(step.interior || this._insideDoghouse);
    this.inShelter = Boolean(this._insideDoghouse || step.shelter);
    this.isSleeping = false;

    const setAnim = (pose, tail, ears, lookPos = null) => {
      if (pose && pose !== this._lastPose) {
        this._lastPose = pose;
        animator?.setPose?.(pose);
      }
      const nextTail = this._resolveTailMode(realDt, env, step, tail);
      this._lastTail = nextTail;
      animator?.setTail?.(nextTail);

      const nextEars = ears || 'relaxed';
      if (nextEars !== this._lastEars) {
        this._lastEars = nextEars;
        animator?.setEars?.(nextEars);
      }
      if (lookPos) {
        _lookTarget.set(lookPos.x, lookPos.y, lookPos.z);
        animator?.lookAt?.(_lookTarget);
        this._lastLookAt = _lookTarget;
      } else if (this._lastLookAt !== null) {
        animator?.lookAt?.(null);
        this._lastLookAt = null;
      }
    };

    switch (step.kind) {
      case 'move': {
        const steer = this._nav.computeSteering(
          env.garden, dogPos.x, dogPos.z, dogHeading,
          step.x, step.z, step.speed, realDt, Boolean(step.interior),
          this._bodyMargin, wasBlocked
        );
        // Keep step destination snapped to walkable point if it was inside an obstacle
        if (!step.interior && Number.isFinite(steer.goalX) && Number.isFinite(steer.goalZ)) {
          step.x = steer.goalX;
          step.z = steer.goalZ;
        }
        const arrive = step.arriveDist || 0.5;
        if (steer.distToGoal <= arrive) {
          this._advanceStep(dogPos);
          return;
        }
        if (steer.stuck) {
          this._handleMoveStuck(step, env, dogPos);
          return;
        }
        if (t > 24) {
          this._finishCurrentAction();
          return;
        }
        this.locomotion.mode = 'move';
        this.locomotion.targetSpeed = steer.speed;
        this.locomotion.targetHeading = steer.heading;
        this.locomotion.turnRate = steer.avoiding ? 4.8 : (steer.speed > 3.6 ? 2.8 : 3.8);
        setAnim(step.poseDuringMove || 'stand', step.tail, step.ears, null);
        break;
      }

      case 'chase': {
        const objPos = getObjectWorldPos(step.trackObj);
        if (!objPos || step.trackObj?.visible === false || t >= (step.duration || 8)) {
          this._advanceStep(dogPos);
          return;
        }
        const d = dist2D(dogPos.x, dogPos.z, objPos.x, objPos.z);
        const stopDist = step.stopDist || 1.25;
        if (d <= stopDist && step.stopDist) {
          this._advanceStep(dogPos);
          return;
        }
        // Track nearest walkable point to dynamic target
        let gx = objPos.x;
        let gz = objPos.z;
        if (!isWalkable(env.garden, gx, gz, this._bodyMargin)) {
          const safe = findSafePointNear(env.garden, gx, gz, 0.3, 2.8, this._bodyMargin);
          gx = safe.x; gz = safe.z;
        }
        const steer = this._nav.computeSteering(
          env.garden, dogPos.x, dogPos.z, dogHeading,
          gx, gz, step.speed, realDt, false,
          this._bodyMargin, wasBlocked
        );
        if (steer.stuck) {
          // Target is across an obstacle (e.g. pond/fence) and unreachable -> re-pick action
          this._finishCurrentAction();
          return;
        }
        this.locomotion.mode = 'move';
        this.locomotion.targetSpeed = steer.speed;
        this.locomotion.targetHeading = steer.heading;
        this.locomotion.turnRate = steer.avoiding ? 4.8 : 3.8;

        // Playful hop when close to butterfly
        if (step.jumpClose && d < 1.9 && (Math.floor(t * 1.2) % 2 === 0)) {
          const hopPhase = (t * 2.2) % 1;
          this.motionEffects.jumpHeight = Math.sin(hopPhase * Math.PI) * 0.22;
        }
        setAnim('stand', step.tail, step.ears, objPos);
        break;
      }

      case 'circle': {
        const totalAngle = (step.turns || 2.0) * TWO_PI;
        if (!this._stepData.initialized) {
          this._stepData.initialized = true;
          this._stepData.dir = Math.random() < 0.5 ? 1 : -1;
          this._stepData.turned = 0;
          this._stepData.startHeading = dogHeading;
          const rad = step.radius || 0.3;
          let canCircle = Boolean(step.interior);
          if (!canCircle) {
            canCircle =
              isWalkable(env.garden, dogPos.x + rad, dogPos.z, this._bodyMargin) &&
              isWalkable(env.garden, dogPos.x - rad, dogPos.z, this._bodyMargin) &&
              isWalkable(env.garden, dogPos.x, dogPos.z + rad, this._bodyMargin) &&
              isWalkable(env.garden, dogPos.x, dogPos.z - rad, this._bodyMargin);
          }
          this._stepData.canCircle = canCircle;
        }
        const angSpeed = 2.6;
        this._stepData.turned += angSpeed * realDt;
        const nextHeading = wrapAngle(this._stepData.startHeading + this._stepData.dir * this._stepData.turned);
        this.locomotion.mode = this._stepData.canCircle ? 'circle' : 'turn';
        this.locomotion.targetHeading = nextHeading;
        this.locomotion.targetSpeed = this._stepData.canCircle
          ? clamp((step.radius || 0.3) * angSpeed, step.interior ? 0.22 : 0.42, 0.95)
          : 0;
        this.locomotion.turnRate = 4.5;
        setAnim('stand', step.tail, step.ears, null);

        if (this._stepData.turned >= totalAngle) {
          if (typeof step.finalHeading === 'number') {
            this.locomotion.targetHeading = step.finalHeading;
          }
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'pose': {
        if (step.barkOnce && !this._stepData.barked && t > 0.3) {
          this._stepData.barked = true;
          emitEvent?.('bark');
        }
        if (step.addDirt) {
          this.coatDelta.dirtDelta += realDt * 0.09;
        }
        if (step.coolDown) {
          this.coatDelta.heatDelta -= realDt * 0.14;
          this.needs.comfort = clamp(this.needs.comfort + realDt * 0.03, 0, 1);
        }
        if (typeof step.heading === 'number') {
          this.locomotion.mode = 'turn';
          this.locomotion.targetHeading = step.heading;
        }

        let lookPos = step.lookPos || null;
        if (step.trackObj && step.trackObj.visible !== false) {
          const p = getObjectWorldPos(step.trackObj);
          if (p) {
            lookPos = p;
            this.locomotion.mode = 'turn';
            this.locomotion.targetHeading = Math.atan2(p.x - dogPos.x, p.z - dogPos.z);
          }
        } else if (step.lookPoi) {
          const poi = getPoi(env.garden, step.lookPoi);
          if (poi) {
            lookPos = { x: poi.x, y: 0.2, z: poi.z };
            this.locomotion.mode = 'turn';
            this.locomotion.targetHeading = Math.atan2(poi.x - dogPos.x, poi.z - dogPos.z);
          }
        } else if (step.lookSky) {
          lookPos = {
            x: dogPos.x + Math.sin(dogHeading) * 5,
            y: getGroundY(env.garden, dogPos.x, dogPos.z) + 5.5,
            z: dogPos.z + Math.cos(dogHeading) * 5,
          };
        } else if (step.scanAround) {
          const scanA = dogHeading + Math.sin(t * 0.75) * 0.75;
          lookPos = {
            x: dogPos.x + Math.sin(scanA) * 6,
            y: getGroundY(env.garden, dogPos.x, dogPos.z) + 0.8 + Math.sin(t * 0.45) * 0.35,
            z: dogPos.z + Math.cos(scanA) * 6,
          };
        }

        if (typeof step.headTilt === 'number') {
          this.motionEffects.headTilt = step.headTilt * Math.sin(clamp(t / Math.max(step.duration, 0.5), 0, 1) * Math.PI);
        }

        setAnim(step.pose || 'stand', step.tail, step.ears, lookPos);
        if (t >= (step.duration || 2.0)) {
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'eat': {
        this.locomotion.mode = 'turn';
        this.locomotion.targetHeading = step.heading ?? dogHeading;
        this.needs.hunger = clamp(this.needs.hunger - realDt * 0.14, 0, 1);
        if (env.garden && typeof env.garden.foodLevel === 'number') {
          try {
            env.garden.foodLevel = clamp(env.garden.foodLevel - realDt * 0.075, 0, 1);
          } catch (_) {
            // Read-only foodLevel
          }
        }
        const look = step.bowlPos ? { x: step.bowlPos.x, y: 0.12, z: step.bowlPos.z } : null;
        setAnim('eat', step.tail || 'relaxed', 'relaxed', look);
        if (t >= (step.duration || 6.0) || this.needs.hunger <= 0.02 || (env.garden?.foodLevel ?? 1) <= 0.01) {
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'drink': {
        this.locomotion.mode = 'turn';
        this.locomotion.targetHeading = step.heading ?? dogHeading;
        this.needs.thirst = clamp(this.needs.thirst - realDt * 0.18, 0, 1);
        this.coatDelta.heatDelta -= realDt * 0.16;
        this._pendingBladderBoost = clamp(this._pendingBladderBoost + realDt * 0.045, 0, 0.35);

        if (!this._stepData.lapTimer) this._stepData.lapTimer = 0.4;
        this._stepData.lapTimer -= realDt;
        if (this._stepData.lapTimer <= 0) {
          this._stepData.lapTimer = randRange(0.45, 0.65);
          emitEvent?.('lap');
        }

        const look = step.bowlPos ? { x: step.bowlPos.x, y: 0.12, z: step.bowlPos.z } : null;
        setAnim('drink', 'relaxed', 'relaxed', look);
        if (t >= (step.duration || 5.0) || this.needs.thirst <= 0.03) {
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'dig': {
        this.coatDelta.dirtDelta += realDt * 0.085;
        this.needs.boredom = clamp(this.needs.boredom - realDt * 0.06, 0, 1);
        this.needs.energy = clamp(this.needs.energy - realDt * 0.012, 0, 1);
        if (!this._stepData.digTimer) this._stepData.digTimer = 0.35;
        this._stepData.digTimer -= realDt;
        if (this._stepData.digTimer <= 0) {
          this._stepData.digTimer = randRange(0.45, 0.7);
          emitEvent?.('dig');
        }
        setAnim('dig', step.tail || 'relaxed', 'alert', null);
        if (t >= (step.duration || 4.0)) {
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'snowPlunge': {
        this.coatDelta.snowDelta += realDt * 0.18;
        this.needs.boredom = clamp(this.needs.boredom - realDt * 0.08, 0, 1);
        const subPose = (t % 1.6) < 1.0 ? 'dig' : 'sniffGround';
        setAnim(subPose, step.tail || 'relaxed', 'alert', null);
        if (t >= (step.duration || 3.2)) {
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'shake': {
        if (!this._stepData.shook) {
          this._stepData.shook = true;
          emitEvent?.('shake');
        }
        this.coatDelta.wetDelta -= realDt * 0.28;
        this.coatDelta.snowDelta -= realDt * 0.36;
        this.coatDelta.dirtDelta -= realDt * 0.09;
        setAnim('shake', step.tail || 'relaxed', 'back', null);
        if (t >= (step.duration || 2.2)) {
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'mark': {
        this.locomotion.mode = 'turn';
        this.locomotion.targetHeading = step.heading ?? dogHeading;
        const dur = step.duration || 2.8;
        const u = clamp(t / dur, 0, 1);
        const lift = u < 0.2 ? (u / 0.2) : (u > 0.8 ? (1 - u) / 0.2 : 1);
        this.motionEffects.legLift = lift;
        setAnim('stand', 'relaxed', 'alert', null);
        if (t >= dur) {
          this.needs.bladder = 0;
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'yawn': {
        const dur = step.duration || 2.4;
        const u = clamp(t / dur, 0, 1);
        // Smooth bell curve peaking around u=0.45
        const bell = u < 0.45 ? Math.sin((u / 0.45) * HALF_PI) : Math.cos(((u - 0.45) / 0.55) * HALF_PI);
        this.motionEffects.yawnAmount = clamp(bell, 0, 1);
        if (typeof step.heading === 'number') {
          this.locomotion.mode = 'turn';
          this.locomotion.targetHeading = step.heading;
        }
        setAnim(step.pose || 'stand', step.tail || 'relaxed', 'relaxed', null);
        if (t >= dur) this._advanceStep(dogPos);
        break;
      }

      case 'lipLick': {
        const dur = step.duration || 1.8;
        this.motionEffects.lipLickPhase = (t * 2.4) % 1;
        if (typeof step.heading === 'number') {
          this.locomotion.mode = 'turn';
          this.locomotion.targetHeading = step.heading;
        }
        setAnim('stand', step.tail || 'relaxed', 'relaxed', null);
        if (t >= dur) this._advanceStep(dogPos);
        break;
      }

      case 'lookObserver': {
        const cam = env.cameraPos;
        if (cam) {
          this.locomotion.mode = 'turn';
          this.locomotion.targetHeading = Math.atan2(cam.x - dogPos.x, cam.z - dogPos.z);
        }
        const dur = step.duration || 6.0;
        // Charming head tilt left -> brief level -> right!
        let tilt = 0;
        if (t > 0.7 && t < 3.0) {
          tilt = Math.sin(clamp((t - 0.7) / 2.3, 0, 1) * Math.PI) * 0.40;
        } else if (t > 3.5 && t < dur - 0.5) {
          tilt = -Math.sin(clamp((t - 3.5) / Math.max(0.5, dur - 4.0), 0, 1) * Math.PI) * 0.34;
        }
        this.motionEffects.headTilt = tilt;
        if (step.whine && !this._stepData.whined && t > 1.8) {
          this._stepData.whined = true;
          emitEvent?.('whine');
        }
        this.needs.social = clamp(this.needs.social - realDt * 0.075, 0, 1);
        this.needs.curiosity = clamp(this.needs.curiosity - realDt * 0.04, 0, 1);
        setAnim(step.pose || 'sit', step.tail || 'relaxed', step.ears || 'alert', cam);
        if (t >= dur) this._advanceStep(dogPos);
        break;
      }

      case 'bark': {
        const count = step.count || 2;
        const interval = 0.85;
        const idx = Math.floor(t / interval);
        if (idx > (this._stepData.lastBarkIdx ?? -1) && idx < count) {
          this._stepData.lastBarkIdx = idx;
          emitEvent?.('bark');
        }
        let look = null;
        if (step.trackObj && step.trackObj.visible !== false) {
          const p = getObjectWorldPos(step.trackObj);
          if (p) {
            look = p;
            this.locomotion.mode = 'turn';
            this.locomotion.targetHeading = Math.atan2(p.x - dogPos.x, p.z - dogPos.z);
          }
        }
        const inBurst = (t % interval) < 0.52;
        setAnim(inBurst ? 'bark' : 'stand', step.tail || 'relaxed', 'alert', look);
        if (t >= count * interval + 0.25) {
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'howl': {
        if (!this._stepData.howled && t > 0.35) {
          this._stepData.howled = true;
          emitEvent?.('howl');
        }
        const skyLook = {
          x: dogPos.x + Math.sin(dogHeading) * 4,
          y: getGroundY(env.garden, dogPos.x, dogPos.z) + 6.5,
          z: dogPos.z + Math.cos(dogHeading) * 4,
        };
        this.needs.social = clamp(this.needs.social - realDt * 0.06, 0, 1);
        setAnim('howl', 'relaxed', 'back', skyLook);
        if (t >= (step.duration || 4.2)) {
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'jump':
      case 'pounce': {
        const dur = step.duration || 0.95;
        const u = clamp(t / dur, 0, 1);
        const peak = step.kind === 'jump' ? 0.42 : 0.24;
        this.motionEffects.jumpHeight = Math.sin(u * Math.PI) * peak;
        if (step.splashWet && !this._stepData.splashed && u > 0.45) {
          this._stepData.splashed = true;
          this.coatDelta.wetDelta += 0.35;
        }
        let look = null;
        if (step.trackObj && step.trackObj.visible !== false) {
          look = getObjectWorldPos(step.trackObj);
          if (look) {
            this.locomotion.mode = 'turn';
            this.locomotion.targetHeading = Math.atan2(look.x - dogPos.x, look.z - dogPos.z);
          }
        } else if (typeof step.heading === 'number') {
          this.locomotion.mode = 'turn';
          this.locomotion.targetHeading = step.heading;
        }
        setAnim(step.kind, step.tail || 'relaxed', 'alert', look);
        if (t >= dur) this._advanceStep(dogPos);
        break;
      }

      case 'playBall': {
        const toy = getPoi(env.garden, 'toy');
        if (!toy) {
          this._advanceStep(dogPos);
          return;
        }
        if (!this._stepData.phase) {
          this._stepData.phase = 'rush';
          this._stepData.round = 0;
          this._stepData.subT = 0;
          this._stepData.stuckCount = 0;
        }
        this._stepData.subT += realDt;
        const look = { x: toy.x, y: getGroundY(env.garden, toy.x, toy.z) + 0.16, z: toy.z };
        const d = dist2D(dogPos.x, dogPos.z, toy.x, toy.z);

        if (this._stepData.phase === 'rush') {
          const steer = this._nav.computeSteering(
            env.garden, dogPos.x, dogPos.z, dogHeading,
            toy.x, toy.z, 3.6 * this.profile.speedScale, realDt, false,
            this._bodyMargin, wasBlocked
          );
          this.locomotion.mode = 'move';
          this.locomotion.targetSpeed = steer.speed;
          this.locomotion.targetHeading = steer.heading;
          this.locomotion.turnRate = steer.avoiding ? 4.8 : 3.8;
          setAnim('stand', 'relaxed', 'alert', look);
          if (steer.stuck) {
            this._stepData.stuckCount++;
            if (this._stepData.stuckCount >= 2) {
              this._finishCurrentAction();
              return;
            }
            this._nav.reset(dogPos.x, dogPos.z);
            this._nav.flipAvoidSide();
            this._stepData.subT = 0;
          } else if (d < 0.85 || this._stepData.subT > 4.5) {
            this._stepData.phase = 'pounce';
            this._stepData.subT = 0;
            this._triggerTailWag(1.4);
            nudgeBallIfPossible(env.garden, dogPos.x, dogPos.z, this._bodyMargin);
            if (Math.random() < 0.35 + this.profile.vocal * 0.25) emitEvent?.('bark');
          }
        } else if (this._stepData.phase === 'pounce') {
          const u = clamp(this._stepData.subT / 0.85, 0, 1);
          this.motionEffects.jumpHeight = Math.sin(u * Math.PI) * 0.26;
          this.locomotion.mode = 'turn';
          this.locomotion.targetHeading = Math.atan2(toy.x - dogPos.x, toy.z - dogPos.z);
          setAnim('pounce', 'relaxed', 'alert', look);
          if (this._stepData.subT >= 0.85) {
            this._stepData.round++;
            if (this._stepData.round >= (step.rounds || 3)) {
              this.needs.boredom = clamp(this.needs.boredom - 0.35, 0, 1);
              this._advanceStep(dogPos);
              return;
            }
            this._stepData.phase = 'orbit';
            this._stepData.subT = 0;
            this._nav.reset(dogPos.x, dogPos.z);
            const orbitA = Math.atan2(dogPos.x - toy.x, dogPos.z - toy.z) + (Math.random() < 0.5 ? 1.4 : -1.4);
            const opt = findSafePointNear(env.garden, toy.x + Math.sin(orbitA) * 2.2, toy.z + Math.cos(orbitA) * 2.2, 0, 1.5, this._bodyMargin + 0.05);
            this._stepData.orbitX = opt.x;
            this._stepData.orbitZ = opt.z;
          }
        } else if (this._stepData.phase === 'orbit') {
          const steer = this._nav.computeSteering(
            env.garden, dogPos.x, dogPos.z, dogHeading,
            this._stepData.orbitX, this._stepData.orbitZ, 3.2 * this.profile.speedScale, realDt, false,
            this._bodyMargin, wasBlocked
          );
          this.locomotion.mode = 'move';
          this.locomotion.targetSpeed = steer.speed;
          this.locomotion.targetHeading = steer.heading;
          this.locomotion.turnRate = steer.avoiding ? 4.8 : 3.8;
          setAnim('stand', 'relaxed', 'alert', look);
          if (steer.distToGoal < 0.7 || steer.stuck || this._stepData.subT > 2.6) {
            this._nav.reset(dogPos.x, dogPos.z);
            this._stepData.phase = 'rush';
            this._stepData.subT = 0;
          }
        }
        break;
      }

      case 'sleep': {
        this.isSleeping = true;
        if (step.inDoghouse) this.inShelter = true;
        if (typeof step.heading === 'number') {
          this.locomotion.mode = 'turn';
          this.locomotion.targetHeading = step.heading;
        }

        if (!this._stepData.initialized) {
          this._stepData.initialized = true;
          this._stepData.sleepPose = step.sunNap
            ? (Math.random() < 0.5 ? 'sleepSide' : 'sleepCurl')
            : (env.isCold ? 'sleepCurl' : (Math.random() < 0.65 ? 'sleepCurl' : 'sleepSide'));
          this._stepData.nextDreamAt = randRange(7, 14);
          this._stepData.dreamEndAt = 0;
          this._stepData.nextSnoreAt = randRange(4, 9);
          this._stepData.nextShiftAt = randRange(16, 26);
        }

        // Occasional cozy sleep posture shift
        if (t >= this._stepData.nextShiftAt) {
          this._stepData.nextShiftAt = t + randRange(16, 28);
          if (step.sunNap) {
            const poses = ['sleepSide', 'bellyUp', 'sleepCurl'];
            this._stepData.sleepPose = poses[Math.floor(Math.random() * poses.length)];
          } else {
            this._stepData.sleepPose = this._stepData.sleepPose === 'sleepCurl' ? 'sleepSide' : 'sleepCurl';
          }
        }

        // Dreaming phase: leg twitching + muffled sleep talk/whine!
        if (t >= this._stepData.nextDreamAt && t > this._stepData.dreamEndAt) {
          this._stepData.dreamEndAt = t + randRange(3.5, 6.0);
          this._stepData.nextDreamAt = this._stepData.dreamEndAt + randRange(12, 22);
          if (Math.random() < 0.55) emitEvent?.('whine');
        }
        const dreaming = t < this._stepData.dreamEndAt;
        if (dreaming) {
          this.motionEffects.dreamTwitch = 0.75 + Math.sin(t * 9.0) * 0.25;
          this.action = {
            id: this._currentPlan.id,
            label: step.sunNap ? '日なたで夢を見ているみたい' : '夢を見ているみたい（脚がぴくぴく）',
          };
        } else {
          this.action = {
            id: this._currentPlan.id,
            label: step.label || 'すやすや眠っている',
          };
        }

        // Soft snoring
        if (t >= this._stepData.nextSnoreAt) {
          this._stepData.nextSnoreAt = t + randRange(4.5, 8.5);
          emitEvent?.('snore');
        }

        setAnim(this._stepData.sleepPose, 'relaxed', 'relaxed', null);

        // End sleep when duration reached (or fully rested during daytime)
        const fullyRestedDay = !env.isDeepNight && this.needs.energy > 0.94 && t > 14;
        if (t >= (step.duration || 28) || fullyRestedDay) {
          this.isSleeping = false;
          this._advanceStep(dogPos);
        }
        break;
      }

      case 'watchRain': {
        this.inShelter = true;
        this.locomotion.mode = 'turn';
        const outHeading = step.heading ?? 0;
        this.locomotion.targetHeading = outHeading;
        const lookA = outHeading + Math.sin(t * 0.5) * 0.55;
        const lookOut = {
          x: dogPos.x + Math.sin(lookA) * 5.5,
          y: getGroundY(env.garden, dogPos.x, dogPos.z) + 1.4 + Math.sin(t * 0.35) * 0.6,
          z: dogPos.z + Math.cos(lookA) * 5.5,
        };
        const pose = t < 5 ? 'sit' : 'lie';
        if (t > 12 && t < 14.5) {
          this.motionEffects.yawnAmount = Math.sin(clamp((t - 12) / 2.5, 0, 1) * Math.PI) * 0.85;
        }
        this.action = {
          id: this._currentPlan.id,
          label: t > 14 ? '雨がやむのを待っている' : '犬小屋から雨を眺めている',
        };
        setAnim(pose, null, 'relaxed', lookOut);
        if (t >= (step.duration || 22) || !env.isRaining) {
          this._advanceStep(dogPos);
        }
        break;
      }

      default:
        this._advanceStep(dogPos);
        break;
    }
  }

  _updatePanting(realDt, env, dogState, emitEvent) {
    const heat = dogState.heatLoad ?? 0;
    const blockedPose = this.isSleeping ||
      this._lastPose === 'eat' ||
      this._lastPose === 'drink' ||
      this._lastPose === 'bark' ||
      this._lastPose === 'howl' ||
      this.motionEffects.yawnAmount > 0.15;

    if (!blockedPose && heat > 0.42) {
      const intensity = clamp((heat - 0.42) / 0.58, 0, 1);
      this.motionEffects.pantIntensity = intensity;
      this._pantSoundTimer -= realDt;
      if (this._pantSoundTimer <= 0) {
        this._pantSoundTimer = lerp(3.4, 1.8, intensity);
        emitEvent?.('pant');
      }
    } else {
      this._pantSoundTimer = Math.max(0.5, this._pantSoundTimer);
    }
  }

  _updateMood(env, dogState) {
    const id = this._currentPlan?.id;
    const n = this.needs;
    if (this.isSleeping || n.energy < 0.25 || id === 'yawn') {
      this.mood = 'sleepy';
    } else if (
      id === 'zoomies' ||
      id === 'playToy' ||
      id === 'chaseButterfly' ||
      id === 'chaseFalling' ||
      id === 'playInSnow'
    ) {
      this.mood = 'excited';
    } else if (id === 'barkBird' || id === 'barkPlayful' || id === 'howlAtMoon' || id === 'nightPatrol' || id === 'reactToRain') {
      this.mood = 'alert';
    } else if (id === 'followScent' || id === 'inspectPond' || id === 'lookAtObserver' || id === 'stalkBird' || id === 'sniffFlowers' || id === 'watchRain') {
      this.mood = 'curious';
    } else if (id === 'bellyRoll' || id === 'sunbathe' || id === 'eat' || (n.comfort > 0.72 && n.hunger < 0.5 && n.thirst < 0.5 && n.energy > 0.45)) {
      this.mood = 'happy';
    } else if (n.boredom > 0.78 || n.bladder > 0.8 || n.hunger > 0.78 || (dogState.furWetness ?? 0) > 0.65) {
      this.mood = 'restless';
    } else {
      this.mood = 'calm';
    }
  }
}
