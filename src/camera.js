import * as THREE from 'three';

const MIN_DIST = 2.5;
const MAX_DIST = 7.0;
const MIN_HEIGHT = 0.6;
const MAX_HEIGHT = 2.5;
const GARDEN_LIMIT = 14.1;

// アングルプリセット（犬の向きに対する相対方位オフセット・距離倍率・高さ倍率）
const ANGLE_PRESETS = [
  { name: 'side-right', relAngle: 1.32, distMul: 1.0, heightMul: 0.95, orbitDir: 1 },
  { name: 'front-left', relAngle: -0.58, distMul: 0.88, heightMul: 0.78, orbitDir: -1 },
  { name: 'high-overview', relAngle: 2.15, distMul: 1.18, heightMul: 1.35, orbitDir: 1 },
  { name: 'front-right', relAngle: 0.52, distMul: 0.9, heightMul: 0.8, orbitDir: 1 },
  { name: 'side-left', relAngle: -1.42, distMul: 1.02, heightMul: 1.0, orbitDir: -1 },
  { name: 'low-follow', relAngle: 2.65, distMul: 0.96, heightMul: 0.72, orbitDir: -1 },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function wrapAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function lerpAngle(from, to, t) {
  return from + wrapAngle(to - from) * t;
}

/**
 * 臨界減衰ばね（1軸）: オーバーシュートせずに極限まで滑らかに追従する
 */
function smoothDampScalar(current, target, velocityObj, key, smoothTime, dt) {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocityObj[key] + omega * change) * dt;
  velocityObj[key] = (velocityObj[key] - omega * temp) * exp;
  return target + (change + temp) * exp;
}

function smoothDampVec3(current, target, velocity, smoothTime, dt) {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

  const cx = current.x - target.x;
  const cy = current.y - target.y;
  const cz = current.z - target.z;

  const tx = (velocity.x + omega * cx) * dt;
  const ty = (velocity.y + omega * cy) * dt;
  const tz = (velocity.z + omega * cz) * dt;

  velocity.x = (velocity.x - omega * tx) * exp;
  velocity.y = (velocity.y - omega * ty) * exp;
  velocity.z = (velocity.z - omega * tz) * exp;

  current.x = target.x + (cx + tx) * exp;
  current.y = target.y + (cy + ty) * exp;
  current.z = target.z + (cz + tz) * exp;
}

export class FollowCamera {
  constructor(camera, garden) {
    this.camera = camera;
    this.garden = garden;

    this._initialized = false;
    this._currentPos = new THREE.Vector3(0, 1.5, 5);
    this._posVel = new THREE.Vector3();
    this._currentLookAt = new THREE.Vector3(0, 0.45, 0);
    this._lookVel = new THREE.Vector3();

    this._prevDogPos = new THREE.Vector3();
    this._dogVel = new THREE.Vector3();
    this._smoothedSpeed = 0;

    this._presetIndex = 1; // 最初は犬の顔が見えやすい斜め前から
    this._presetTimer = 24 + Math.random() * 14;
    this._orbitAngle = 0.55;
    this._orbitDrift = 0;

    this._dist = 3.8;
    this._height = 1.25;
    this._lookHeight = 0.48;
    this._scalarVel = { dist: 0, height: 0, lookHeight: 0 };

    this._elapsed = 0;
    this._tmpDesiredPos = new THREE.Vector3();
    this._tmpDesiredLook = new THREE.Vector3();
    this._tmpDogPos = new THREE.Vector3();
    this._tmpSafePos = new THREE.Vector3();
  }

  update(realDt, dog) {
    if (!dog || !dog.position) return;

    const dt = clamp(Number.isFinite(realDt) ? realDt : 0.016, 0.0001, 0.1);
    this._elapsed += dt;

    const dogPos = this._tmpDogPos.set(
      dog.position.x || 0,
      dog.position.y || 0,
      dog.position.z || 0
    );
    const dogHeading = Number.isFinite(dog.heading) ? dog.heading : 0;

    // 犬の移動速度を推定（滑らかに平滑化）
    if (this._initialized) {
      const vx = (dogPos.x - this._prevDogPos.x) / dt;
      const vy = (dogPos.y - this._prevDogPos.y) / dt;
      const vz = (dogPos.z - this._prevDogPos.z) / dt;
      const alpha = 1 - Math.exp(-5.0 * dt);
      this._dogVel.x += (vx - this._dogVel.x) * alpha;
      this._dogVel.y += (vy - this._dogVel.y) * alpha;
      this._dogVel.z += (vz - this._dogVel.z) * alpha;
      const horizSpeed = Math.hypot(this._dogVel.x, this._dogVel.z);
      this._smoothedSpeed += (horizSpeed - this._smoothedSpeed) * (1 - Math.exp(-3.5 * dt));
    }
    this._prevDogPos.copy(dogPos);

    // 行動モードの判定
    const profile = this._classifyBehavior(dog, this._smoothedSpeed);

    // 数十秒ごとにアングルを切り替え
    this._presetTimer -= dt;
    if (this._presetTimer <= 0 && !profile.holdAngle) {
      this._pickNextPreset(profile);
      this._presetTimer = 22 + Math.random() * 18;
    }

    const preset = ANGLE_PRESETS[this._presetIndex];

    // 距離・高さの目標値（行動 × アングル）
    let targetDist = clamp(profile.baseDist * preset.distMul, MIN_DIST, MAX_DIST);
    let targetHeight = clamp(profile.baseHeight * preset.heightMul, MIN_HEIGHT, MAX_HEIGHT);
    const targetLookHeight = profile.lookHeight;

    // ゆっくり回り込むドリフト
    const orbitSpeed = profile.holdAngle ? 0.008 : 0.038 * preset.orbitDir;
    this._orbitDrift += orbitSpeed * dt;

    // 目標方位角の算出
    let desiredAzimuth = dogHeading + preset.relAngle + this._orbitDrift;

    // 犬小屋の中または入口付近にいるときは、入口の正面側から覗き込むように誘導
    const doghouseBias = this._getDoghouseEntranceAzimuth(dogPos);
    if (doghouseBias !== null) {
      const subtleOffset = Math.sin(this._elapsed * 0.14) * 0.32;
      desiredAzimuth = doghouseBias + subtleOffset;
      targetDist = clamp(Math.min(targetDist, 3.2), MIN_DIST, MAX_DIST);
      targetHeight = clamp(Math.min(targetHeight, 1.05), MIN_HEIGHT, MAX_HEIGHT);
    } else if (profile.holdAngle) {
      // カメラを見つめているときは現在の方位をほぼ維持してアイコンタクトを楽しむ
      desiredAzimuth = this._orbitAngle + Math.sin(this._elapsed * 0.2) * 0.02;
    }

    if (!this._initialized) {
      this._orbitAngle = desiredAzimuth;
      this._dist = targetDist;
      this._height = targetHeight;
      this._lookHeight = targetLookHeight;
    } else {
      // 方位角はゆっくり滑らかに追従
      const azFollow = profile.isRunning ? 0.55 : 0.32;
      this._orbitAngle = lerpAngle(
        this._orbitAngle,
        desiredAzimuth,
        1 - Math.exp(-azFollow * dt)
      );
      this._dist = smoothDampScalar(this._dist, targetDist, this._scalarVel, 'dist', 1.6, dt);
      this._height = smoothDampScalar(
        this._height,
        targetHeight,
        this._scalarVel,
        'height',
        1.6,
        dt
      );
      this._lookHeight = smoothDampScalar(
        this._lookHeight,
        targetLookHeight,
        this._scalarVel,
        'lookHeight',
        1.2,
        dt
      );
    }

    // 障害物・柵・家・木を避けた安全なカメラ位置を探索
    const dogGroundY = this._getGroundY(dogPos.x, dogPos.z);
    const safePlacement = this._findSafeCameraPos(
      dogPos,
      dogGroundY,
      this._orbitAngle,
      this._dist,
      this._height
    );

    // 障害物回避で大きく方位が変わった場合は軌道角にもゆっくり馴染ませる
    if (safePlacement.adjusted) {
      this._orbitAngle = lerpAngle(
        this._orbitAngle,
        safePlacement.azimuth,
        1 - Math.exp(-1.4 * dt)
      );
    }

    this._tmpDesiredPos.copy(safePlacement.pos);

    // 走る時は進行方向に少し先読みしてフレーミングに余白を作る
    const leadAmount = clamp(this._smoothedSpeed * 0.16, 0, 0.75);
    const speedNorm = this._smoothedSpeed > 0.05 ? 1 / this._smoothedSpeed : 0;
    const leadX = this._dogVel.x * speedNorm * leadAmount;
    const leadZ = this._dogVel.z * speedNorm * leadAmount;

    this._tmpDesiredLook.set(
      dogPos.x + leadX,
      Math.max(dogPos.y, dogGroundY) + this._lookHeight,
      dogPos.z + leadZ
    );

    if (!this._initialized) {
      this._currentPos.copy(this._tmpDesiredPos);
      this._currentLookAt.copy(this._tmpDesiredLook);
      this._posVel.set(0, 0, 0);
      this._lookVel.set(0, 0, 0);
      this._initialized = true;
    } else {
      const posSmoothTime = profile.isRunning ? 0.55 : 1.05;
      const lookSmoothTime = profile.isRunning ? 0.28 : 0.45;
      smoothDampVec3(this._currentPos, this._tmpDesiredPos, this._posVel, posSmoothTime, dt);
      smoothDampVec3(this._currentLookAt, this._tmpDesiredLook, this._lookVel, lookSmoothTime, dt);
    }

    // 最終安全ガード: 移動途中でも絶対に地面より下に行かず、柵の外へ出ない
    this._currentPos.x = clamp(this._currentPos.x, -GARDEN_LIMIT, GARDEN_LIMIT);
    this._currentPos.z = clamp(this._currentPos.z, -GARDEN_LIMIT, GARDEN_LIMIT);
    const camGroundY = this._getGroundY(this._currentPos.x, this._currentPos.z);
    if (this._currentPos.y < camGroundY + 0.45) {
      this._currentPos.y = camGroundY + 0.45;
    }

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._currentLookAt);
  }

  _classifyBehavior(dog, speed) {
    const id = (dog.action?.id || '').toLowerCase();
    const label = dog.action?.label || '';
    const text = `${id} ${label}`;

    const isSleeping =
      /sleep|nap|curl|belly|snooze|rest|lie|doze|sunbathe|shade|porch|寝|昼寝|眠|うたた|ごろ|日なた|日陰|縁側|犬小屋|伏せ|くつろ/.test(
        text
      ) && speed < 0.35;

    const isLookingAtCam =
      /camera|observer|tilt|stare|観察|カメラ|首をかしげ|じっと/.test(text) && speed < 0.4;

    const isRunning =
      speed > 1.9 ||
      /run|dash|zoomie|sprint|gallop|chase|pounce|全力|ダッシュ|追|はしゃ|ズーミー/.test(text);

    const isCloseInteract =
      /eat|drink|dig|sniff|ball|toy|pond|scratch|shake|stretch|roll|yawn|howl|bark|食べ|飲|掘|匂|ボール|池|かいて|ブルブル|伸び|あくび|遠吠|吠|雪に顔/.test(
        text
      );

    if (isLookingAtCam) {
      return {
        baseDist: 2.9,
        baseHeight: 0.92,
        lookHeight: 0.52,
        isRunning: false,
        holdAngle: true,
        preferClose: true,
      };
    }

    if (isSleeping) {
      return {
        baseDist: 2.95,
        baseHeight: 0.88,
        lookHeight: 0.28,
        isRunning: false,
        holdAngle: false,
        preferClose: true,
      };
    }

    if (isRunning) {
      const speedExtra = clamp((speed - 1.5) * 0.42, 0, 1.5);
      return {
        baseDist: 5.0 + speedExtra,
        baseHeight: 1.65 + speedExtra * 0.28,
        lookHeight: 0.52,
        isRunning: true,
        holdAngle: false,
        preferClose: false,
      };
    }

    if (isCloseInteract) {
      return {
        baseDist: 3.55,
        baseHeight: 1.1,
        lookHeight: 0.42,
        isRunning: false,
        holdAngle: false,
        preferClose: true,
      };
    }

    return {
      baseDist: 4.35,
      baseHeight: 1.38,
      lookHeight: 0.48,
      isRunning: false,
      holdAngle: false,
      preferClose: false,
    };
  }

  _pickNextPreset(profile) {
    const candidates = [];
    for (let i = 0; i < ANGLE_PRESETS.length; i++) {
      if (i === this._presetIndex) continue;
      // 寝ているときは俯瞰ばかりにならないよう重みを少し抑える
      if (profile.preferClose && ANGLE_PRESETS[i].name === 'high-overview' && Math.random() < 0.6) {
        continue;
      }
      candidates.push(i);
    }
    if (candidates.length === 0) {
      this._presetIndex = (this._presetIndex + 1) % ANGLE_PRESETS.length;
    } else {
      this._presetIndex = candidates[Math.floor(Math.random() * candidates.length)];
    }
    this._orbitDrift = 0;
  }

  _getDoghouseEntranceAzimuth(dogPos) {
    const poi = this.garden?.poi;
    if (!poi || !poi.doghouseInside || !poi.doghouse) return null;

    const dxIn = dogPos.x - poi.doghouseInside.x;
    const dzIn = dogPos.z - poi.doghouseInside.z;
    const distSq = dxIn * dxIn + dzIn * dzIn;
    if (distSq > 2.4 * 2.4) return null;

    // 犬小屋の中から入口方向への方位角
    const ex = poi.doghouse.x - poi.doghouseInside.x;
    const ez = poi.doghouse.z - poi.doghouseInside.z;
    if (Math.hypot(ex, ez) < 0.05) {
      return Number.isFinite(poi.doghouse.rotY) ? poi.doghouse.rotY : 0;
    }
    return Math.atan2(ex, ez);
  }

  _getGroundY(x, z) {
    if (this.garden && typeof this.garden.getGroundHeight === 'function') {
      const h = this.garden.getGroundHeight(x, z);
      if (Number.isFinite(h)) return h;
    }
    return 0;
  }

  _isPositionClear(x, z) {
    if (Math.abs(x) > GARDEN_LIMIT || Math.abs(z) > GARDEN_LIMIT) {
      return false;
    }
    if (this.garden && typeof this.garden.isInside === 'function') {
      if (!this.garden.isInside(x, z, 0.55)) {
        return false;
      }
    }
    // 大きな木の幹の至近距離を避ける
    const tree = this.garden?.poi?.tree;
    if (tree) {
      const dx = x - tree.x;
      const dz = z - tree.z;
      if (dx * dx + dz * dz < 1.35 * 1.35) {
        return false;
      }
    }
    // 犬小屋の内部・壁を避ける
    const houseIn = this.garden?.poi?.doghouseInside;
    if (houseIn) {
      const dx = x - houseIn.x;
      const dz = z - houseIn.z;
      if (dx * dx + dz * dz < 1.35 * 1.35) {
        return false;
      }
    }
    return true;
  }

  _isLineOfSightClear(dogPos, camX, camZ) {
    if (!this.garden || typeof this.garden.isInside !== 'function') return true;
    const dx = camX - dogPos.x;
    const dz = camZ - dogPos.z;
    const totalDist = Math.hypot(dx, dz);
    if (totalDist < 1.2) return true;

    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      // 犬のすぐ近傍（犬小屋内など）は視線チェックから外す
      if (t * totalDist < 1.15) continue;
      const sx = dogPos.x + dx * t;
      const sz = dogPos.z + dz * t;
      if (!this.garden.isInside(sx, sz, 0.25)) {
        return false;
      }
    }
    return true;
  }

  _findSafeCameraPos(dogPos, dogGroundY, baseAzimuth, desiredDist, desiredHeight) {
    // まず元の角度→徐々に左右へずらして障害物・柵・家・木を避ける
    const angleOffsets = [
      0, 0.22, -0.22, 0.48, -0.48, 0.78, -0.78, 1.12, -1.12, 1.5, -1.5, 1.95, -1.95, 2.45, -2.45,
      Math.PI,
    ];
    const distScales = [1.0, 0.82, 0.68];

    for (let dIdx = 0; dIdx < distScales.length; dIdx++) {
      const dist = clamp(desiredDist * distScales[dIdx], MIN_DIST, MAX_DIST);
      for (let aIdx = 0; aIdx < angleOffsets.length; aIdx++) {
        const az = baseAzimuth + angleOffsets[aIdx];
        const cx = dogPos.x + Math.sin(az) * dist;
        const cz = dogPos.z + Math.cos(az) * dist;

        if (!this._isPositionClear(cx, cz)) continue;
        if (dIdx === 0 && !this._isLineOfSightClear(dogPos, cx, cz)) continue;

        const camGroundY = this._getGroundY(cx, cz);
        const relHeight = clamp(desiredHeight, MIN_HEIGHT, MAX_HEIGHT);
        const cy = Math.max(dogGroundY + relHeight, camGroundY + 0.55);

        return {
          pos: this._tmpSafePos.set(cx, cy, cz),
          azimuth: az,
          adjusted: aIdx > 0,
        };
      }
    }

    // どうしても見つからない場合のフォールバック（庭の中央寄りに引く）
    const fallbackAz = Math.atan2(-dogPos.x, -dogPos.z);
    const fx = clamp(dogPos.x + Math.sin(fallbackAz) * MIN_DIST, -GARDEN_LIMIT, GARDEN_LIMIT);
    const fz = clamp(dogPos.z + Math.cos(fallbackAz) * MIN_DIST, -GARDEN_LIMIT, GARDEN_LIMIT);
    const fy = Math.max(
      dogGroundY + clamp(desiredHeight, MIN_HEIGHT, MAX_HEIGHT),
      this._getGroundY(fx, fz) + 0.65
    );
    return {
      pos: this._tmpSafePos.set(fx, fy, fz),
      azimuth: fallbackAz,
      adjusted: true,
    };
  }
}
