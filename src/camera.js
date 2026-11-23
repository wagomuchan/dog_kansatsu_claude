import * as THREE from 'three';

const MIN_DIST = 2.5;
const MAX_DIST = 7.0;
const MAX_PAIR_DIST = 10.5;
const MIN_AVOID_DIST = 1.65;
const MIN_HEIGHT = 0.6;
const MAX_HEIGHT = 2.5;
const MAX_PAIR_HEIGHT = 3.2;
const PAIR_ENTER_DIST = 6.0;
const PAIR_EXIT_DIST = 6.6;
const DEFAULT_GARDEN_LIMIT = 14.1;
const CAM_CLEARANCE = 0.45;
const SUBBOX_CELL_SIZE = 4.0;

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

function isMaterialOccluder(mat) {
  if (!mat) return false;
  if (Array.isArray(mat)) {
    for (let i = 0; i < mat.length; i++) {
      if (isMaterialOccluder(mat[i])) return true;
    }
    return false;
  }
  if (mat.side === THREE.BackSide) return false;
  if (mat.depthWrite === false) return false;
  if (mat.transparent && mat.opacity < 0.5 && !(mat.alphaTest > 0)) return false;
  return true;
}

function isFoliageMaterial(mat) {
  if (!mat) return false;
  if (Array.isArray(mat)) {
    for (let i = 0; i < mat.length; i++) {
      if (mat[i] && mat[i].alphaTest > 0) return true;
    }
    return false;
  }
  return Boolean(mat.alphaTest > 0);
}

/**
 * 3D線分 A->B と垂直円柱の交差判定
 */
function segmentIntersectsCylinder(ax, ay, az, bx, by, bz, cx, cz, radius, minY, maxY) {
  if (Math.max(ay, by) < minY || Math.min(ay, by) > maxY) return false;
  const dx = bx - ax;
  const dz = bz - az;
  const fx = ax - cx;
  const fz = az - cz;
  const a = dx * dx + dz * dz;
  const r2 = radius * radius;

  if (a < 1e-8) {
    return fx * fx + fz * fz <= r2;
  }

  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r2;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;

  const sq = Math.sqrt(disc);
  const t0 = Math.max(0, (-b - sq) / (2 * a));
  const t1 = Math.min(1, (-b + sq) / (2 * a));
  if (t0 > t1) return false;

  const dy = by - ay;
  const y0 = ay + dy * t0;
  const y1 = ay + dy * t1;
  return !(Math.max(y0, y1) < minY || Math.min(y0, y1) > maxY);
}

/**
 * 3D線分 A->B と AABB の交差判定
 */
function segmentIntersectsAABB(ax, ay, az, bx, by, bz, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = 0;
  let tmax = 1;

  const dx = bx - ax;
  if (Math.abs(dx) < 1e-8) {
    if (ax < minX || ax > maxX) return false;
  } else {
    let t1 = (minX - ax) / dx;
    let t2 = (maxX - ax) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  const dy = by - ay;
  if (Math.abs(dy) < 1e-8) {
    if (ay < minY || ay > maxY) return false;
  } else {
    let t1 = (minY - ay) / dy;
    let t2 = (maxY - ay) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  const dz = bz - az;
  if (Math.abs(dz) < 1e-8) {
    if (az < minZ || az > maxZ) return false;
  } else {
    let t1 = (minZ - az) / dz;
    let t2 = (maxZ - az) / dz;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
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
    this._avoidDir = 1;

    this._dist = 3.8;
    this._height = 1.25;
    this._lookHeight = 0.48;
    this._scalarVel = { dist: 0, height: 0, lookHeight: 0 };

    this._elapsed = 0;

    // 2匹モード用の状態管理（各犬の速度・活動量・フォーカス切替）
    this._dogStates = new WeakMap();
    this._activeDogs = [];
    this._lastDogCount = 0;
    this._inPairMode = false;
    this._focusIndex = 0;
    this._focusTimer = 24 + Math.random() * 14;
    this._focusHoldMin = 0;
    this._switchTransitionTimer = 0;

    // シーン参照 & レイキャスト用オクルーダーキャッシュ
    this._scene = null;
    this._occluders = [];
    this._cachedSceneChildCount = -1;
    this._cachedDogRoots = [];
    this._lastCacheBuildTime = -10;
    this._raycaster = new THREE.Raycaster();
    this._rayHits = [];

    // 既知の障害物データ（Garden._layout / Garden.poi から構築）
    this._obstacles = this._buildObstacleData();

    // 毎フレームの割り当てを防ぐスクラッチオブジェクト
    this._tmpDesiredPos = new THREE.Vector3();
    this._tmpDesiredLook = new THREE.Vector3();
    this._tmpDogPos = new THREE.Vector3();
    this._tmpDogPos2 = new THREE.Vector3();
    this._tmpMidPos = new THREE.Vector3();
    this._tmpDogTarget = new THREE.Vector3();
    this._tmpExtraTarget0 = new THREE.Vector3();
    this._tmpExtraTarget1 = new THREE.Vector3();
    this._tmpExtraTargets = [this._tmpExtraTarget0, this._tmpExtraTarget1];
    this._tmpSafePos = new THREE.Vector3();
    this._tmpCandPos = new THREE.Vector3();
    this._tmpRayDir = new THREE.Vector3();
    this._tmpBoxHit = new THREE.Vector3();
    this._tmpRight = new THREE.Vector3();
    this._tmpUp = new THREE.Vector3();
    this._tmpWhisker = new THREE.Vector3();
    this._tmpPullPos = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);
    this._yardBox = new THREE.Box3(
      new THREE.Vector3(-16.5, -1.0, -18.8),
      new THREE.Vector3(16.5, 12.0, 16.5)
    );
  }

  getLookAtPosition() {
    return this._currentLookAt;
  }

  _normalizeDogs(dogOrDogs) {
    const out = this._activeDogs;
    out.length = 0;
    if (Array.isArray(dogOrDogs)) {
      for (let i = 0; i < dogOrDogs.length; i++) {
        const d = dogOrDogs[i];
        if (d && d.position) out.push(d);
      }
    } else if (dogOrDogs && dogOrDogs.position) {
      out.push(dogOrDogs);
    }
    return out;
  }

  _computeActivityScore(dog, speed) {
    const id = (dog.action?.id || '').toLowerCase();
    const label = dog.action?.label || '';
    const text = `${id} ${label}`;

    let actionWeight = 0.6;
    if (
      /run|dash|zoomie|sprint|gallop|chase|pounce|jump|wrestle|tug|bark|howl|dig|play|追いかけ|取っ組み|じゃれ|全力|ダッシュ|はしゃ|ズーミー|吠|遠吠|掘|ボール/.test(
        text
      )
    ) {
      actionWeight = 2.6;
    } else if (
      /walk|sniff|eat|drink|scratch|shake|stretch|roll|butterfly|bird|pond|mark|greet|groom|歩|匂|食べ|飲|かいて|ブルブル|伸び|転が|蝶|鳥|池|マーキング|あいさつ|舐め/.test(
        text
      )
    ) {
      actionWeight = 1.15;
    } else if (
      /sleep|nap|curl|belly|snooze|rest|lie|doze|sunbathe|shade|porch|寝|昼寝|眠|うたた|日なた|日陰|縁側|伏せ|くつろ/.test(
        text
      ) &&
      speed < 0.25
    ) {
      actionWeight = 0.0;
    }

    return speed * 1.35 + actionWeight;
  }

  _updateDogMotionState(dog, dt) {
    let st = this._dogStates.get(dog);
    const px = dog.position.x || 0;
    const py = dog.position.y || 0;
    const pz = dog.position.z || 0;

    if (!st) {
      st = {
        prevPos: new THREE.Vector3(px, py, pz),
        vel: new THREE.Vector3(),
        smoothedSpeed: 0,
        activityScore: this._computeActivityScore(dog, 0),
        initialized: false,
      };
      this._dogStates.set(dog, st);
    }

    if (st.initialized) {
      const vx = (px - st.prevPos.x) / dt;
      const vy = (py - st.prevPos.y) / dt;
      const vz = (pz - st.prevPos.z) / dt;
      const alpha = 1 - Math.exp(-5.0 * dt);
      st.vel.x += (vx - st.vel.x) * alpha;
      st.vel.y += (vy - st.vel.y) * alpha;
      st.vel.z += (vz - st.vel.z) * alpha;
      const horizSpeed = Math.hypot(st.vel.x, st.vel.z);
      st.smoothedSpeed += (horizSpeed - st.smoothedSpeed) * (1 - Math.exp(-3.5 * dt));

      const rawActivity = this._computeActivityScore(dog, st.smoothedSpeed);
      st.activityScore += (rawActivity - st.activityScore) * (1 - Math.exp(-0.9 * dt));
    } else {
      st.initialized = true;
    }

    st.prevPos.set(px, py, pz);
    return st;
  }

  update(realDt, dogOrDogs) {
    const dogs = this._normalizeDogs(dogOrDogs);
    if (dogs.length === 0) return;

    const dt = clamp(Number.isFinite(realDt) ? realDt : 0.016, 0.0001, 0.1);
    this._elapsed += dt;

    if (this._lastDogCount !== 0 && this._lastDogCount !== dogs.length) {
      this._switchTransitionTimer = Math.max(this._switchTransitionTimer, 1.8);
    }
    this._lastDogCount = dogs.length;
    this._switchTransitionTimer = Math.max(0, this._switchTransitionTimer - dt);

    // シーン解決とレイキャスト対象のキャッシュ更新（全犬を除外）
    this._ensureOccluders(dogs);

    // 各犬の速度・活動量を更新
    for (let i = 0; i < dogs.length; i++) {
      this._updateDogMotionState(dogs[i], dt);
    }

    if (dogs.length === 1) {
      this._updateSingleDog(dt, dogs[0], dogs);
    } else {
      this._updateTwoDogs(dt, dogs);
    }
  }

  _updateSingleDog(dt, dog, allDogs) {
    const st = this._dogStates.get(dog);
    const dogPos = this._tmpDogPos.set(
      dog.position.x || 0,
      dog.position.y || 0,
      dog.position.z || 0
    );
    const dogHeading = Number.isFinite(dog.heading) ? dog.heading : 0;

    if (st) {
      this._dogVel.copy(st.vel);
      this._smoothedSpeed = st.smoothedSpeed;
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
    const dogInDoghouse = this._isDogInDoghouse(dogPos);
    if (doghouseBias !== null) {
      const subtleOffset = Math.sin(this._elapsed * 0.14) * (dogInDoghouse ? 0.2 : 0.3);
      desiredAzimuth = doghouseBias + subtleOffset;
      targetDist = clamp(Math.min(targetDist, dogInDoghouse ? 2.95 : 3.2), MIN_DIST, MAX_DIST);
      targetHeight = clamp(Math.min(targetHeight, dogInDoghouse ? 0.92 : 1.05), MIN_HEIGHT, MAX_HEIGHT);
    } else if (profile.holdAngle) {
      // カメラを見つめているときは現在の方位をほぼ維持してアイコンタクトを楽しむ
      desiredAzimuth = this._orbitAngle + Math.sin(this._elapsed * 0.2) * 0.02;
    }

    if (!this._initialized) {
      this._orbitAngle = desiredAzimuth;
      this._dist = targetDist;
      this._height = targetHeight;
      this._lookHeight = targetLookHeight;
      this._avoidDir = preset.orbitDir >= 0 ? 1 : -1;
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

    // 視線チェック用の犬の基準点（胴〜頭付近）
    const dogGroundY = this._getGroundY(dogPos.x, dogPos.z);
    const dogBaseY = Math.max(dogPos.y, dogGroundY);
    const dogTarget = this._tmpDogTarget.set(
      dogPos.x,
      dogBaseY + Math.max(0.32, this._lookHeight),
      dogPos.z
    );

    // 障害物・木・枝葉・岩・家・犬小屋・灯篭・柵を避け、視線も確保した安全なカメラ位置を探索
    const safePlacement = this._findSafeCameraPos(
      dogPos,
      dogGroundY,
      dogTarget,
      this._orbitAngle,
      this._dist,
      this._height,
      allDogs,
      dogInDoghouse,
      MAX_DIST,
      MAX_HEIGHT,
      null
    );

    // 回避で方位が変わった場合は軌道角・ドリフトにも滑らかに馴染ませて障害物へ押し戻されないようにする
    if (safePlacement.adjusted) {
      const azDelta = wrapAngle(safePlacement.azimuth - this._orbitAngle);
      if (Math.abs(azDelta) > 0.08) {
        this._avoidDir = azDelta >= 0 ? 1 : -1;
      }
      const blend = 1 - Math.exp(-1.8 * dt);
      this._orbitAngle = lerpAngle(this._orbitAngle, safePlacement.azimuth, blend);
      if (doghouseBias === null && !profile.holdAngle && Math.abs(azDelta) > 0.25) {
        this._orbitDrift = wrapAngle(this._orbitDrift + azDelta * (1 - Math.exp(-0.9 * dt)));
      }
    }

    this._tmpDesiredPos.copy(safePlacement.pos);

    // 走る時は進行方向に少し先読みしてフレーミングに余白を作る
    const leadAmount = clamp(this._smoothedSpeed * 0.16, 0, 0.75);
    const speedNorm = this._smoothedSpeed > 0.05 ? 1 / this._smoothedSpeed : 0;
    const leadX = this._dogVel.x * speedNorm * leadAmount;
    const leadZ = this._dogVel.z * speedNorm * leadAmount;

    this._tmpDesiredLook.set(
      dogPos.x + leadX,
      dogBaseY + this._lookHeight,
      dogPos.z + leadZ
    );

    const isTransitioning = this._switchTransitionTimer > 0;
    if (!this._initialized) {
      this._currentPos.copy(this._tmpDesiredPos);
      this._currentLookAt.copy(this._tmpDesiredLook);
      this._posVel.set(0, 0, 0);
      this._lookVel.set(0, 0, 0);
      this._initialized = true;
    } else {
      // 移動経路（直線コード）が障害物を横切る場合は犬の周囲を弧状に回り込む中間目標を使う
      const detour = this._computeArcDetourIfBlocked(
        this._currentPos,
        this._tmpDesiredPos,
        dogPos,
        dogGroundY,
        dogTarget,
        allDogs,
        dogInDoghouse,
        MAX_DIST,
        MAX_HEIGHT
      );

      const posSmoothTime = isTransitioning
        ? 1.15
        : profile.isRunning
          ? 0.52
          : safePlacement.adjusted || detour
            ? 0.65
            : 1.02;
      const lookSmoothTime = isTransitioning ? 0.68 : profile.isRunning ? 0.28 : 0.45;

      smoothDampVec3(this._currentPos, this._tmpDesiredPos, this._posVel, posSmoothTime, dt);
      smoothDampVec3(this._currentLookAt, this._tmpDesiredLook, this._lookVel, lookSmoothTime, dt);
    }

    // 最終安全ガード: 移動途中でも物体内部・枝葉・地面下・柵外へ入らないようにし、視線遮蔽なら手前へ寄せる
    this._enforceCameraClearance(this._currentPos, dogGroundY, dogInDoghouse);
    this._applySpringArmPullIn(dogTarget, this._currentPos, allDogs, dogInDoghouse, dt, isTransitioning);

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._currentLookAt);
  }

  _updateTwoDogs(dt, dogs) {
    const dog0 = dogs[0];
    const dog1 = dogs[1];
    const st0 = this._dogStates.get(dog0);
    const st1 = this._dogStates.get(dog1);

    const p0 = this._tmpDogPos.set(dog0.position.x || 0, dog0.position.y || 0, dog0.position.z || 0);
    const p1 = this._tmpDogPos2.set(dog1.position.x || 0, dog1.position.y || 0, dog1.position.z || 0);
    const pairDist = Math.hypot(p1.x - p0.x, p1.z - p0.z);

    // ヒステリシス付きで「2匹まとめ撮り(6m以内)」と「1匹フォーカス」を判定
    const prevPairMode = this._inPairMode;
    if (!this._initialized) {
      this._inPairMode = pairDist <= PAIR_ENTER_DIST;
    } else if (this._inPairMode) {
      if (pairDist > PAIR_EXIT_DIST) {
        this._inPairMode = false;
      }
    } else if (pairDist <= PAIR_ENTER_DIST) {
      this._inPairMode = true;
    }

    if (this._initialized && prevPairMode !== this._inPairMode) {
      this._switchTransitionTimer = Math.max(this._switchTransitionTimer, 1.8);
      if (!this._inPairMode) {
        // 離れた瞬間は動きのある方へ自然にフォーカス
        const act0 = st0?.activityScore ?? 0;
        const act1 = st1?.activityScore ?? 0;
        this._focusIndex = act1 > act0 + 0.35 ? 1 : 0;
        this._focusHoldMin = 5.0;
        this._focusTimer = 24 + Math.random() * 14;
      }
    }

    if (!this._inPairMode) {
      // 離れているとき: より動きのある方、または数十秒ごとに交代してなめらかに追う
      this._focusTimer -= dt;
      this._focusHoldMin = Math.max(0, this._focusHoldMin - dt);

      const curIdx = this._focusIndex === 1 ? 1 : 0;
      const otherIdx = 1 - curIdx;
      const curAct = (curIdx === 0 ? st0?.activityScore : st1?.activityScore) ?? 0;
      const otherAct = (otherIdx === 0 ? st0?.activityScore : st1?.activityScore) ?? 0;

      const otherMuchMoreActive = this._focusHoldMin <= 0 && otherAct > curAct + 1.15;
      const timerExpired = this._focusTimer <= 0;

      if (otherMuchMoreActive || timerExpired) {
        this._focusIndex = otherIdx;
        this._focusHoldMin = 7.0;
        this._focusTimer = 24 + Math.random() * 16;
        this._switchTransitionTimer = 2.6;
      }

      this._updateSingleDog(dt, dogs[this._focusIndex], dogs);
      return;
    }

    // 2匹が近い（6m以内）とき: 中間点を狙って2匹とも画面に入る距離へ引く
    const s0 = st0?.smoothedSpeed ?? 0;
    const s1 = st1?.smoothedSpeed ?? 0;
    const prof0 = this._classifyBehavior(dog0, s0);
    const prof1 = this._classifyBehavior(dog1, s1);

    const profile = {
      baseDist: Math.max(prof0.baseDist, prof1.baseDist),
      baseHeight: Math.max(prof0.baseHeight, prof1.baseHeight),
      lookHeight: (prof0.lookHeight + prof1.lookHeight) * 0.5,
      isRunning: prof0.isRunning || prof1.isRunning,
      holdAngle: false,
      preferClose: prof0.preferClose && prof1.preferClose,
    };

    this._presetTimer -= dt;
    if (this._presetTimer <= 0) {
      this._pickNextPreset(profile);
      this._presetTimer = 24 + Math.random() * 18;
    }

    const preset = ANGLE_PRESETS[this._presetIndex];
    this._orbitDrift += 0.03 * preset.orbitDir * dt;

    const midPos = this._tmpMidPos.set(
      (p0.x + p1.x) * 0.5,
      (p0.y + p1.y) * 0.5,
      (p0.z + p1.z) * 0.5
    );

    // 2匹を結ぶ線に対して斜め横〜直角方向から撮ると重なりにくく2匹ともよく見える
    const dxPair = p1.x - p0.x;
    const dzPair = p1.z - p0.z;
    const avgHeading = lerpAngle(
      Number.isFinite(dog0.heading) ? dog0.heading : 0,
      Number.isFinite(dog1.heading) ? dog1.heading : 0,
      0.5
    );
    let desiredAzimuth;
    if (pairDist > 0.45) {
      const lineAngle = Math.atan2(dxPair, dzPair);
      const perpA = wrapAngle(lineAngle + Math.PI * 0.5);
      const perpB = wrapAngle(lineAngle - Math.PI * 0.5);
      const basePerp =
        Math.abs(wrapAngle(perpA - this._orbitAngle)) <= Math.abs(wrapAngle(perpB - this._orbitAngle))
          ? perpA
          : perpB;
      const presetTilt = clamp(wrapAngle(preset.relAngle) * 0.22, -0.42, 0.42);
      desiredAzimuth = wrapAngle(basePerp + presetTilt + Math.sin(this._orbitDrift) * 0.28);
    } else {
      desiredAzimuth = avgHeading + preset.relAngle + this._orbitDrift;
    }

    // FOVとアスペクト比から2匹が画面に収まる必要距離を算出
    const fovRad = THREE.MathUtils.degToRad(clamp(this.camera?.fov || 44, 25, 75));
    const tanHalfFovY = Math.tan(fovRad * 0.5);
    const aspect = clamp(this.camera?.aspect || 16 / 9, 0.45, 2.6);
    const tanHalfFovX = tanHalfFovY * aspect;
    const evalAz = this._initialized ? this._orbitAngle : desiredAzimuth;
    const projHoriz = Math.abs(dxPair * Math.cos(evalAz) - dzPair * Math.sin(evalAz));
    const projDepth = Math.abs(dxPair * Math.sin(evalAz) + dzPair * Math.cos(evalAz));

    const halfWidthNeeded = projHoriz * 0.5 + 0.82;
    const distForWidth = halfWidthNeeded / Math.max(0.15, tanHalfFovX * 0.72) + projDepth * 0.48;
    const distForHeight = (0.85 + pairDist * 0.14) / Math.max(0.15, tanHalfFovY * 0.72);
    const basePairDist = Math.max(
      profile.baseDist * preset.distMul + pairDist * 0.25,
      distForWidth,
      distForHeight
    );

    let targetDist = clamp(basePairDist, MIN_DIST, MAX_PAIR_DIST);
    let targetHeight = clamp(
      Math.max(profile.baseHeight * preset.heightMul, 0.92 + targetDist * 0.2),
      MIN_HEIGHT,
      MAX_PAIR_HEIGHT
    );
    const targetLookHeight = profile.lookHeight;

    // どちらかが犬小屋内にいて2匹とも小屋付近なら入口方向へ穏やかに誘導
    const inDh0 = this._isDogInDoghouse(p0);
    const inDh1 = this._isDogInDoghouse(p1);
    const dogInDoghouse = inDh0 || inDh1;
    let doghouseBias = null;
    if (dogInDoghouse && pairDist < 3.8) {
      doghouseBias = this._getDoghouseEntranceAzimuth(inDh0 ? p0 : p1);
      if (doghouseBias !== null) {
        desiredAzimuth = doghouseBias + Math.sin(this._elapsed * 0.14) * 0.22;
        targetHeight = clamp(Math.min(targetHeight, 1.55), MIN_HEIGHT, MAX_PAIR_HEIGHT);
      }
    }

    if (!this._initialized) {
      this._orbitAngle = desiredAzimuth;
      this._dist = targetDist;
      this._height = targetHeight;
      this._lookHeight = targetLookHeight;
      this._avoidDir = preset.orbitDir >= 0 ? 1 : -1;
    } else {
      const azFollow = profile.isRunning ? 0.5 : 0.34;
      this._orbitAngle = lerpAngle(
        this._orbitAngle,
        desiredAzimuth,
        1 - Math.exp(-azFollow * dt)
      );
      this._dist = smoothDampScalar(this._dist, targetDist, this._scalarVel, 'dist', 1.4, dt);
      this._height = smoothDampScalar(this._height, targetHeight, this._scalarVel, 'height', 1.4, dt);
      this._lookHeight = smoothDampScalar(
        this._lookHeight,
        targetLookHeight,
        this._scalarVel,
        'lookHeight',
        1.1,
        dt
      );
    }

    const gY0 = this._getGroundY(p0.x, p0.z);
    const gY1 = this._getGroundY(p1.x, p1.z);
    const midGroundY = Math.max(this._getGroundY(midPos.x, midPos.z), (gY0 + gY1) * 0.5);
    const midBaseY = Math.max(midPos.y, midGroundY);
    const midTarget = this._tmpDogTarget.set(
      midPos.x,
      midBaseY + Math.max(0.32, this._lookHeight),
      midPos.z
    );

    this._tmpExtraTarget0.set(p0.x, Math.max(p0.y, gY0) + Math.max(0.3, prof0.lookHeight), p0.z);
    this._tmpExtraTarget1.set(p1.x, Math.max(p1.y, gY1) + Math.max(0.3, prof1.lookHeight), p1.z);

    const safePlacement = this._findSafeCameraPos(
      midPos,
      midGroundY,
      midTarget,
      this._orbitAngle,
      this._dist,
      this._height,
      dogs,
      dogInDoghouse,
      MAX_PAIR_DIST,
      MAX_PAIR_HEIGHT,
      this._tmpExtraTargets
    );

    if (safePlacement.adjusted) {
      const azDelta = wrapAngle(safePlacement.azimuth - this._orbitAngle);
      if (Math.abs(azDelta) > 0.08) {
        this._avoidDir = azDelta >= 0 ? 1 : -1;
      }
      const blend = 1 - Math.exp(-1.8 * dt);
      this._orbitAngle = lerpAngle(this._orbitAngle, safePlacement.azimuth, blend);
    }

    this._tmpDesiredPos.copy(safePlacement.pos);

    const midVx = ((st0?.vel.x || 0) + (st1?.vel.x || 0)) * 0.5;
    const midVz = ((st0?.vel.z || 0) + (st1?.vel.z || 0)) * 0.5;
    const midSpeed = Math.hypot(midVx, midVz);
    const leadAmount = clamp(midSpeed * 0.14, 0, 0.65);
    const speedNorm = midSpeed > 0.05 ? 1 / midSpeed : 0;

    this._tmpDesiredLook.set(
      midPos.x + midVx * speedNorm * leadAmount,
      midBaseY + this._lookHeight,
      midPos.z + midVz * speedNorm * leadAmount
    );

    const isTransitioning = this._switchTransitionTimer > 0;
    if (!this._initialized) {
      this._currentPos.copy(this._tmpDesiredPos);
      this._currentLookAt.copy(this._tmpDesiredLook);
      this._posVel.set(0, 0, 0);
      this._lookVel.set(0, 0, 0);
      this._initialized = true;
    } else {
      const detour = this._computeArcDetourIfBlocked(
        this._currentPos,
        this._tmpDesiredPos,
        midPos,
        midGroundY,
        midTarget,
        dogs,
        dogInDoghouse,
        MAX_PAIR_DIST,
        MAX_PAIR_HEIGHT
      );

      const posSmoothTime = isTransitioning
        ? 1.05
        : profile.isRunning
          ? 0.55
          : safePlacement.adjusted || detour
            ? 0.68
            : 1.0;
      const lookSmoothTime = isTransitioning ? 0.6 : profile.isRunning ? 0.3 : 0.46;

      smoothDampVec3(this._currentPos, this._tmpDesiredPos, this._posVel, posSmoothTime, dt);
      smoothDampVec3(this._currentLookAt, this._tmpDesiredLook, this._lookVel, lookSmoothTime, dt);
    }

    this._enforceCameraClearance(this._currentPos, midGroundY, dogInDoghouse);
    this._applySpringArmPullIn(midTarget, this._currentPos, dogs, dogInDoghouse, dt, isTransitioning);

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._currentLookAt);
  }

  // ==========================================================================
  // 行動分類・プリセット選択
  // ==========================================================================
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

  _isDogInDoghouse(dogPos) {
    const dh = this._obstacles.doghouse;
    if (!dh) return false;
    const dx = dogPos.x - dh.x;
    const dz = dogPos.z - dh.z;
    return dx * dx + dz * dz < 1.35 * 1.35;
  }

  _getGroundY(x, z) {
    if (this.garden && typeof this.garden.getGroundHeight === 'function') {
      const h = this.garden.getGroundHeight(x, z);
      if (Number.isFinite(h)) return h;
    }
    return 0;
  }

  // ==========================================================================
  // シーン解決・オクルーダーキャッシュ・レイキャスト
  // ==========================================================================
  _resolveScene(dogs) {
    // 1. camera.parent をルートまで辿る
    let cur = this.camera?.parent || null;
    while (cur) {
      if (cur.isScene) return cur;
      cur = cur.parent || null;
    }
    // 2. garden.scene
    if (this.garden?.scene && Array.isArray(this.garden.scene.children)) {
      return this.garden.scene;
    }
    // 3. dog.scene または dog.root の親チェーン
    const list = Array.isArray(dogs) ? dogs : dogs ? [dogs] : [];
    for (let i = 0; i < list.length; i++) {
      const dog = list[i];
      if (dog?.scene && Array.isArray(dog.scene.children)) {
        return dog.scene;
      }
      cur = dog?.root?.parent || dog?.body?.root?.parent || null;
      while (cur) {
        if (cur.isScene) return cur;
        cur = cur.parent || null;
      }
    }
    return null;
  }

  _haveDogRootsChanged(dogs) {
    const list = Array.isArray(dogs) ? dogs : dogs ? [dogs] : [];
    if (list.length !== this._cachedDogRoots.length) return true;
    for (let i = 0; i < list.length; i++) {
      const root = list[i]?.root || list[i]?.body?.root || null;
      if (root !== this._cachedDogRoots[i]) return true;
    }
    return false;
  }

  _ensureOccluders(dogs) {
    const scene = this._resolveScene(dogs);
    if (!scene) return;
    this._scene = scene;

    const childCount = scene.children.length;
    const rootsChanged = this._haveDogRootsChanged(dogs);
    if (
      (this._cachedSceneChildCount !== childCount || rootsChanged) &&
      (this._cachedSceneChildCount === -1 || rootsChanged || this._elapsed - this._lastCacheBuildTime > 0.5)
    ) {
      this._rebuildOccluders(scene, dogs);
      this._cachedSceneChildCount = childCount;
      this._cachedDogRoots = (Array.isArray(dogs) ? dogs : dogs ? [dogs] : []).map(
        (d) => d?.root || d?.body?.root || null
      );
      this._lastCacheBuildTime = this._elapsed;
    }
  }

  _buildExcludedSet(dogs) {
    const excluded = new Set();
    const g = this.garden;
    if (g) {
      const singleSkip = [
        g._sky,
        g._nightSkyMesh,
        g._overcastMesh,
        g._stars,
        g._moonGroup,
        g._clouds,
        g._lilyGroup,
        g._bgTreeLeafMesh,
        g._petalMesh,
        g._autumnLeafMesh,
        g._snowPoints,
        g._rainMesh,
        g._splashMesh,
        g._groundLeafMesh,
        g._pebbleMesh,
        g._twigMesh,
        g._toyMesh,
        g._kibbleMesh,
      ];
      for (let i = 0; i < singleSkip.length; i++) {
        if (singleSkip[i]) excluded.add(singleSkip[i]);
      }

      const listSkip = [g.butterflies, g.birds, g.fallingThings, g._snowCapMeshes];
      for (let l = 0; l < listSkip.length; l++) {
        const arr = listSkip[l];
        if (!Array.isArray(arr)) continue;
        for (let i = 0; i < arr.length; i++) {
          if (arr[i]) excluded.add(arr[i]);
        }
      }
      if (Array.isArray(g._koiList)) {
        for (let i = 0; i < g._koiList.length; i++) {
          if (g._koiList[i]?.group) excluded.add(g._koiList[i].group);
        }
      }
    }

    const list = Array.isArray(dogs) ? dogs : dogs ? [dogs] : [];
    for (let i = 0; i < list.length; i++) {
      const dogRoot = list[i]?.root || list[i]?.body?.root;
      if (dogRoot) excluded.add(dogRoot);
    }

    return excluded;
  }

  _rebuildOccluders(scene, dogs) {
    this._occluders.length = 0;
    const excluded = this._buildExcludedSet(dogs);
    const waterMat = this.garden?._waterMat || null;

    scene.updateMatrixWorld(true);

    const tmpBox = new THREE.Box3();
    const tmpSize = new THREE.Vector3();
    const tmpMat = new THREE.Matrix4();
    const tmpWorldMat = new THREE.Matrix4();
    const tmpCenter = new THREE.Vector3();

    const visit = (obj) => {
      if (!obj || excluded.has(obj)) return;

      if (obj.isMesh && !obj.isSkinnedMesh && obj.geometry) {
        if (waterMat && obj.material === waterMat) return;
        if (!isMaterialOccluder(obj.material)) return;

        const geo = obj.geometry;
        if (!geo.boundingBox) geo.computeBoundingBox();
        if (!geo.boundingBox) return;

        const isFoliage = isFoliageMaterial(obj.material);

        if (obj.isInstancedMesh) {
          const count = obj.count || 0;
          // 芝チャンク（数千本）・雨粒・背景木など巨大InstancedMeshは除外
          if (count <= 0 || count > 1100) return;
          if (!obj.castShadow && count > 100) return;

          const overallBox = new THREE.Box3();
          const subBoxes = [];
          const usePerInstance = count <= 36;
          const cellMap = usePerInstance ? null : new Map();

          for (let i = 0; i < count; i++) {
            obj.getMatrixAt(i, tmpMat);
            tmpWorldMat.multiplyMatrices(obj.matrixWorld, tmpMat);
            tmpBox.copy(geo.boundingBox).applyMatrix4(tmpWorldMat);
            if (!tmpBox.intersectsBox(this._yardBox)) continue;
            if (tmpBox.max.y < 0.25) continue;

            overallBox.union(tmpBox);
            if (usePerInstance) {
              subBoxes.push(tmpBox.clone());
            } else {
              tmpBox.getCenter(tmpCenter);
              const gx = Math.floor(tmpCenter.x / SUBBOX_CELL_SIZE);
              const gz = Math.floor(tmpCenter.z / SUBBOX_CELL_SIZE);
              const key = `${gx},${gz}`;
              let cellBox = cellMap.get(key);
              if (!cellBox) {
                cellBox = new THREE.Box3();
                cellMap.set(key, cellBox);
                subBoxes.push(cellBox);
              }
              cellBox.union(tmpBox);
            }
          }

          if (subBoxes.length === 0 || overallBox.isEmpty()) return;
          this._occluders.push({
            mesh: obj,
            box: overallBox,
            subBoxes,
            isFoliage,
          });
          return;
        }

        // 通常メッシュ
        tmpBox.copy(geo.boundingBox).applyMatrix4(obj.matrixWorld);
        if (!tmpBox.intersectsBox(this._yardBox)) return;
        if (tmpBox.max.y < 0.25) return;

        tmpBox.getSize(tmpSize);
        // 地形・遠景丘・空ドームなど巨大な床・球体を除外
        if (tmpSize.x > 28 && tmpSize.z > 28) return;
        if (geo.attributes?.position?.count > 10000 && tmpSize.y < 1.2) return;
        // 皿・花びら・小物など微小パーツを除外
        if (tmpSize.x < 0.28 && tmpSize.y < 0.28 && tmpSize.z < 0.28) return;

        // 風の揺れ等の微小移動を考慮してわずかに余白をつける
        const box = tmpBox.clone().expandByScalar(0.08);
        this._occluders.push({
          mesh: obj,
          box,
          subBoxes: null,
          isFoliage,
        });
        return;
      }

      const children = obj.children;
      if (children && children.length > 0) {
        for (let i = 0; i < children.length; i++) {
          visit(children[i]);
        }
      }
    };

    visit(scene);
  }

  _isWorldVisible(obj) {
    let cur = obj;
    while (cur) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }
    return true;
  }

  _isDescendantOf(obj, ancestor) {
    if (!ancestor) return false;
    let cur = obj;
    while (cur) {
      if (cur === ancestor) return true;
      cur = cur.parent;
    }
    return false;
  }

  _isDescendantOfAnyDog(obj, dogs) {
    if (!dogs) return false;
    if (Array.isArray(dogs)) {
      for (let i = 0; i < dogs.length; i++) {
        const root = dogs[i]?.root || dogs[i]?.body?.root;
        if (root && this._isDescendantOf(obj, root)) return true;
      }
      return false;
    }
    const root = dogs?.root || dogs?.body?.root;
    return root ? this._isDescendantOf(obj, root) : false;
  }

  /**
   * origin -> dest (+ overshoot) のレイキャストで遮蔽物を検出する。
   * 戻り値: null（遮蔽なし）または { distance, isFoliage }
   */
  _raycastOcclusion(origin, dest, dogs, overshoot = 0, stopOnFirstHit = false) {
    if (this._occluders.length === 0) return null;

    const dir = this._tmpRayDir.subVectors(dest, origin);
    const dist = dir.length();
    if (dist < 0.12) return null;
    dir.multiplyScalar(1 / dist);

    const maxFar = dist + overshoot;
    this._raycaster.set(origin, dir);
    this._raycaster.near = 0.08;
    this._raycaster.far = maxFar;

    const ray = this._raycaster.ray;

    let bestDist = Infinity;
    let bestIsFoliage = true;

    for (let i = 0; i < this._occluders.length; i++) {
      const entry = this._occluders[i];
      const mesh = entry.mesh;
      if (!this._isWorldVisible(mesh)) continue;
      if (this._isDescendantOfAnyDog(mesh, dogs)) continue;

      const curFar = Math.min(maxFar, bestDist);
      const curFarSq = curFar * curFar;

      // 広域 AABB テスト
      const boxHit = ray.intersectBox(entry.box, this._tmpBoxHit);
      if (!boxHit) continue;
      if (origin.distanceToSquared(boxHit) > curFarSq) continue;

      // InstancedMesh は空間セル AABB でさらに絞り込む
      if (entry.subBoxes) {
        let hitAnySub = false;
        const subs = entry.subBoxes;
        for (let s = 0; s < subs.length; s++) {
          const sh = ray.intersectBox(subs[s], this._tmpBoxHit);
          if (sh && origin.distanceToSquared(sh) <= curFarSq) {
            hitAnySub = true;
            break;
          }
        }
        if (!hitAnySub) continue;
      }

      this._raycaster.far = curFar;
      this._rayHits.length = 0;
      this._raycaster.intersectObject(mesh, false, this._rayHits);

      if (this._rayHits.length > 0) {
        const hitDist = this._rayHits[0].distance;
        if (hitDist < bestDist) {
          bestDist = hitDist;
          bestIsFoliage = entry.isFoliage;
          if (stopOnFirstHit) {
            return { distance: bestDist, isFoliage: bestIsFoliage };
          }
        }
      }
    }

    if (bestDist < Infinity) {
      return { distance: bestDist, isFoliage: bestIsFoliage };
    }
    return null;
  }

  /**
   * カメラ近傍の左右・上下オフセット光線でも近接クリップがないか確認する
   */
  _isRayWhiskerClear(dogTarget, camPos, dog) {
    if (this._occluders.length === 0) return true;

    const toCam = this._tmpRayDir.subVectors(camPos, dogTarget);
    const len = toCam.length();
    if (len < 0.4) return true;
    toCam.multiplyScalar(1 / len);

    this._tmpRight.crossVectors(this._worldUp, toCam);
    if (this._tmpRight.lengthSq() < 1e-5) {
      this._tmpRight.set(1, 0, 0);
    } else {
      this._tmpRight.normalize();
    }
    this._tmpUp.crossVectors(toCam, this._tmpRight).normalize();

    const offsets = [
      [0.3, 0],
      [-0.3, 0],
      [0, 0.24],
      [0, -0.16],
    ];
    for (let i = 0; i < offsets.length; i++) {
      const [ox, oy] = offsets[i];
      this._tmpWhisker
        .copy(camPos)
        .addScaledVector(this._tmpRight, ox)
        .addScaledVector(this._tmpUp, oy);
      if (this._raycastOcclusion(dogTarget, this._tmpWhisker, dog, 0.18, true) !== null) {
        return false;
      }
    }
    return true;
  }

  // ==========================================================================
  // 既知の障害物データ構築・解析的クリアランス＆視線判定
  // ==========================================================================
  _buildObstacleData() {
    const L = this.garden?._layout || null;
    const poi = this.garden?.poi || null;

    const fenceMinX = Number.isFinite(L?.fenceMinX) ? L.fenceMinX : -DEFAULT_GARDEN_LIMIT;
    const fenceMaxX = Number.isFinite(L?.fenceMaxX) ? L.fenceMaxX : DEFAULT_GARDEN_LIMIT;
    const fenceMaxZ = Number.isFinite(L?.fenceMaxZ) ? L.fenceMaxZ : DEFAULT_GARDEN_LIMIT;
    const houseFrontZ = Number.isFinite(L?.houseFrontZ)
      ? L.houseFrontZ
      : poi?.porch
        ? poi.porch.z - 1.15
        : -10.35;

    // 大きな木（幹と枝葉の範囲）
    let tree = null;
    if (L?.treePos) {
      const gy = this._getGroundY(L.treePos.x, L.treePos.z);
      tree = {
        x: L.treePos.x,
        z: L.treePos.z,
        gy,
        trunkRadius: L.treePos.trunkRadius ?? 0.95,
        canopyRadius: L.treePos.canopyRadius ?? 4.5,
        canopyY: L.treePos.canopyY ?? 5.2,
      };
    } else if (poi?.tree) {
      // _layout が無い場合は poi.tree の向き先（根元→幹方向）を推定
      const hasRot = Number.isFinite(poi.tree.rotY);
      const tx = hasRot ? poi.tree.x + Math.sin(poi.tree.rotY) * 2.1 : poi.tree.x;
      const tz = hasRot ? poi.tree.z + Math.cos(poi.tree.rotY) * 2.1 : poi.tree.z;
      const gy = this._getGroundY(tx, tz);
      tree = {
        x: tx,
        z: tz,
        gy,
        trunkRadius: 0.95,
        canopyRadius: 4.5,
        canopyY: 5.2,
      };
    }

    // 犬小屋
    let doghouse = null;
    const dhSrc = L?.doghousePos || poi?.doghouseInside;
    if (dhSrc) {
      const gy = this._getGroundY(dhSrc.x, dhSrc.z);
      doghouse = {
        x: dhSrc.x,
        z: dhSrc.z,
        gy,
        clearR: 1.65,
        losR: 1.25,
        maxY: gy + 1.75,
      };
    }

    // 池と周囲の岩
    let pond = null;
    if (L?.pond) {
      const gy = this._getGroundY(L.pond.x, L.pond.z);
      pond = {
        x: L.pond.x,
        z: L.pond.z,
        gy,
        rx: L.pond.rx,
        rz: L.pond.rz,
      };
    } else if (poi?.pond) {
      const gy = this._getGroundY(poi.pond.x, poi.pond.z);
      pond = {
        x: poi.pond.x + 3.9,
        z: poi.pond.z + 0.6,
        gy,
        rx: 2.95,
        rz: 2.3,
      };
    }

    // 灯篭
    const lanterns = [];
    if (Array.isArray(L?.lanterns)) {
      for (let i = 0; i < L.lanterns.length; i++) {
        const lan = L.lanterns[i];
        const gy = this._getGroundY(lan.x, lan.z);
        lanterns.push({
          x: lan.x,
          z: lan.z,
          gy,
          clearR: (lan.r ?? 0.55) + 0.68,
          losR: (lan.r ?? 0.55) + 0.16,
          maxY: gy + 1.9,
        });
      }
    }

    // 隅の低木
    const shrubs = [];
    if (Array.isArray(L?.cornerShrubs)) {
      for (let i = 0; i < L.cornerShrubs.length; i++) {
        const sh = L.cornerShrubs[i];
        const gy = this._getGroundY(sh.x, sh.z);
        shrubs.push({
          x: sh.x,
          z: sh.z,
          gy,
          clearR: (sh.r ?? 1.05) + 0.65,
          losR: (sh.r ?? 1.05) + 0.12,
          maxY: gy + 1.5,
        });
      }
    }

    // 花壇
    let flowerbed = null;
    if (L?.flowerbed) {
      const gy = this._getGroundY(L.flowerbed.x, L.flowerbed.z);
      flowerbed = {
        x: L.flowerbed.x,
        z: L.flowerbed.z,
        gy,
        hx: L.flowerbed.hx,
        hz: L.flowerbed.hz,
      };
    }

    return {
      bounds: {
        minX: fenceMinX + 0.72,
        maxX: fenceMaxX - 0.72,
        minZ: houseFrontZ + 0.68,
        maxZ: fenceMaxZ - 0.72,
      },
      houseBox: {
        minX: -12.6,
        maxX: 12.6,
        minY: -0.5,
        maxY: 5.9,
        minZ: -18.8,
        maxZ: houseFrontZ + 0.25,
      },
      tree,
      doghouse,
      pond,
      lanterns,
      shrubs,
      flowerbed,
    };
  }

  /**
   * 大きな木の枝葉・樹冠の下限天井高さを返す（樹冠外は Infinity）
   */
  _getTreeCanopyMaxY(x, z) {
    const tree = this._obstacles.tree;
    if (!tree) return Infinity;
    const d = Math.hypot(x - tree.x, z - tree.z);
    const outerR = tree.canopyRadius + 1.05;
    if (d >= outerR) return Infinity;

    // 樹冠の内側では枝や葉（y ≈ 2.2m〜）より下にカメラを抑え、外側へ離れるにつれ滑らかに解放
    const innerR = tree.canopyRadius - 0.6;
    const t = clamp((d - innerR) / Math.max(0.1, outerR - innerR), 0, 1);
    const smoothT = t * t * (3 - 2 * t);
    return tree.gy + 1.82 + smoothT * 2.4;
  }

  _isPointInPondBoulders(x, y, z, extraMargin = 0) {
    const pond = this._obstacles.pond;
    if (!pond) return false;
    // 岩の高さより十分上なら岩の中ではない
    if (y > pond.gy + 1.45) return false;

    const dx = x - pond.x;
    const dz = z - pond.z;
    // 西側の開けた観賞口（poi.pond 側、ang ≈ π）には岩がない
    const ang = Math.atan2(dz, dx);
    const isWestOpening = Math.abs(wrapAngle(ang - Math.PI)) < 0.4;
    const margin = isWestOpening ? 0.45 + extraMargin : 1.15 + extraMargin;

    const nx = dx / (pond.rx + margin);
    const nz = dz / (pond.rz + margin);
    return nx * nx + nz * nz < 1.0;
  }

  _isPositionClear(x, y, z) {
    const O = this._obstacles;
    const B = O.bounds;
    if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) {
      return false;
    }

    if (this.garden && typeof this.garden.isInside === 'function') {
      if (!this.garden.isInside(x, z, 0.58)) {
        return false;
      }
    }

    // 大きな木の幹＋根元と枝葉の天井
    if (O.tree) {
      const dx = x - O.tree.x;
      const dz = z - O.tree.z;
      const trunkClear = O.tree.trunkRadius + 0.58;
      if (dx * dx + dz * dz < trunkClear * trunkClear) {
        return false;
      }
      if (y > this._getTreeCanopyMaxY(x, z)) {
        return false;
      }
    }

    // 犬小屋の内部・壁・屋根の張り出しを避ける
    if (O.doghouse) {
      const dx = x - O.doghouse.x;
      const dz = z - O.doghouse.z;
      if (dx * dx + dz * dz < O.doghouse.clearR * O.doghouse.clearR) {
        return false;
      }
    }

    // 池の縁の岩を避ける
    if (this._isPointInPondBoulders(x, y, z, 0)) {
      return false;
    }

    // 灯篭を避ける
    for (let i = 0; i < O.lanterns.length; i++) {
      const lan = O.lanterns[i];
      if (y > lan.maxY + 0.35) continue;
      const dx = x - lan.x;
      const dz = z - lan.z;
      if (dx * dx + dz * dz < lan.clearR * lan.clearR) {
        return false;
      }
    }

    // 隅の低木を避ける
    for (let i = 0; i < O.shrubs.length; i++) {
      const sh = O.shrubs[i];
      if (y > sh.maxY + 0.35) continue;
      const dx = x - sh.x;
      const dz = z - sh.z;
      if (dx * dx + dz * dz < sh.clearR * sh.clearR) {
        return false;
      }
    }

    // 花壇（夏の背の高いひまわり等も含む）
    if (O.flowerbed && y < O.flowerbed.gy + 1.65) {
      const fb = O.flowerbed;
      if (Math.abs(x - fb.x) < fb.hx + 0.65 && Math.abs(z - fb.z) < fb.hz + 0.65) {
        return false;
      }
    }

    // 地面とのクリアランス
    const groundY = this._getGroundY(x, z);
    if (y < groundY + 0.48) {
      return false;
    }

    return true;
  }

  _isAnalyticLineOfSightClear(dogTarget, cx, cy, cz, dogInDoghouse) {
    const O = this._obstacles;
    const ax = dogTarget.x;
    const ay = dogTarget.y;
    const az = dogTarget.z;

    // 地面の起伏に視線が遮られないか
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const sx = ax + (cx - ax) * t;
      const sy = ay + (cy - ay) * t;
      const sz = az + (cz - az) * t;
      if (sy < this._getGroundY(sx, sz) + 0.2) {
        return false;
      }
    }

    // 家・縁側・屋根
    const hb = O.houseBox;
    if (
      segmentIntersectsAABB(
        ax, ay, az, cx, cy, cz,
        hb.minX, hb.minY, hb.minZ, hb.maxX, hb.maxY, hb.maxZ
      )
    ) {
      return false;
    }

    // 木の幹
    if (O.tree) {
      const tr = O.tree;
      if (
        segmentIntersectsCylinder(
          ax, ay, az, cx, cy, cz,
          tr.x, tr.z, tr.trunkRadius + 0.14, tr.gy - 0.2, tr.gy + 3.4
        )
      ) {
        return false;
      }
      // 枝葉の樹冠コア（y >= 2.25m）を通過する視線を抑制
      if (
        segmentIntersectsCylinder(
          ax, ay, az, cx, cy, cz,
          tr.x, tr.z, tr.canopyRadius * 0.85, tr.gy + 2.25, tr.gy + 8.0
        )
      ) {
        return false;
      }
    }

    // 犬小屋（犬が小屋の中にいるときは出入口の3Dレイキャストに任せる）
    if (O.doghouse && !dogInDoghouse) {
      const dh = O.doghouse;
      if (
        segmentIntersectsCylinder(
          ax, ay, az, cx, cy, cz,
          dh.x, dh.z, dh.losR, dh.gy - 0.2, dh.maxY
        )
      ) {
        return false;
      }
    }

    // 灯篭
    for (let i = 0; i < O.lanterns.length; i++) {
      const lan = O.lanterns[i];
      if (
        segmentIntersectsCylinder(
          ax, ay, az, cx, cy, cz,
          lan.x, lan.z, lan.losR, lan.gy - 0.1, lan.maxY
        )
      ) {
        return false;
      }
    }

    // 隅の低木
    for (let i = 0; i < O.shrubs.length; i++) {
      const sh = O.shrubs[i];
      if (
        segmentIntersectsCylinder(
          ax, ay, az, cx, cy, cz,
          sh.x, sh.z, sh.losR, sh.gy - 0.1, sh.maxY
        )
      ) {
        return false;
      }
    }

    // シーンが取得できない場合のみ、池の岩帯の低い視線を解析的にチェック
    if (this._occluders.length === 0 && O.pond) {
      for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        const sx = ax + (cx - ax) * t;
        const sy = ay + (cy - ay) * t;
        const sz = az + (cz - az) * t;
        if (sy < O.pond.gy + 0.95 && this._isPointInPondBoulders(sx, sy, sz, -0.35)) {
          return false;
        }
      }
    }

    return true;
  }

  _isChordBlocked(pA, pB, dogInDoghouse) {
    const O = this._obstacles;
    const ax = pA.x;
    const ay = pA.y;
    const az = pA.z;
    const bx = pB.x;
    const by = pB.y;
    const bz = pB.z;

    if (O.tree) {
      const tr = O.tree;
      if (
        segmentIntersectsCylinder(
          ax, ay, az, bx, by, bz,
          tr.x, tr.z, tr.trunkRadius + 0.5, tr.gy - 0.2, tr.gy + 4.5
        )
      ) {
        return true;
      }
    }

    if (O.doghouse && !dogInDoghouse) {
      const dh = O.doghouse;
      if (
        segmentIntersectsCylinder(
          ax, ay, az, bx, by, bz,
          dh.x, dh.z, dh.clearR - 0.1, dh.gy - 0.2, dh.maxY + 0.3
        )
      ) {
        return true;
      }
    }

    for (let i = 0; i < O.lanterns.length; i++) {
      const lan = O.lanterns[i];
      if (
        segmentIntersectsCylinder(
          ax, ay, az, bx, by, bz,
          lan.x, lan.z, lan.clearR - 0.1, lan.gy - 0.1, lan.maxY + 0.2
        )
      ) {
        return true;
      }
    }

    for (let i = 0; i < O.shrubs.length; i++) {
      const sh = O.shrubs[i];
      if (
        segmentIntersectsCylinder(
          ax, ay, az, bx, by, bz,
          sh.x, sh.z, sh.clearR - 0.15, sh.gy - 0.1, sh.maxY + 0.2
        )
      ) {
        return true;
      }
    }

    return false;
  }

  // ==========================================================================
  // 安全なカメラ位置探索（回り込み・樹冠下回避・近づき）
  // ==========================================================================
  _computeCandidateY(cx, cz, dogGroundY, desiredHeight, maxHeight = MAX_HEIGHT) {
    const camGroundY = this._getGroundY(cx, cz);
    const relHeight = clamp(desiredHeight, MIN_HEIGHT, maxHeight);
    let cy = Math.max(dogGroundY + relHeight, camGroundY + 0.55);
    const canopyCap = this._getTreeCanopyMaxY(cx, cz);
    if (cy > canopyCap) {
      cy = Math.max(camGroundY + 0.52, canopyCap - 0.05);
    }
    return cy;
  }

  _isCandidateValid(dogTarget, cx, cy, cz, dogs, dogInDoghouse, checkWhiskers, extraTargets = null) {
    if (!this._isPositionClear(cx, cy, cz)) return false;
    if (!this._isAnalyticLineOfSightClear(dogTarget, cx, cy, cz, dogInDoghouse)) return false;

    if (extraTargets) {
      for (let i = 0; i < extraTargets.length; i++) {
        if (!this._isAnalyticLineOfSightClear(extraTargets[i], cx, cy, cz, dogInDoghouse)) {
          return false;
        }
      }
    }

    const cand = this._tmpCandPos.set(cx, cy, cz);
    if (this._raycastOcclusion(dogTarget, cand, dogs, CAM_CLEARANCE, true) !== null) {
      return false;
    }
    if (checkWhiskers && !this._isRayWhiskerClear(dogTarget, cand, dogs)) {
      return false;
    }
    return true;
  }

  _findSafeCameraPos(
    dogPos,
    dogGroundY,
    dogTarget,
    baseAzimuth,
    desiredDist,
    desiredHeight,
    dogs,
    dogInDoghouse,
    maxDist = MAX_DIST,
    maxHeight = MAX_HEIGHT,
    extraTargets = null
  ) {
    // 1. まず希望アングル（offset = 0）をそのまま評価
    const baseDist = clamp(desiredDist, MIN_DIST, maxDist);
    const baseX = dogPos.x + Math.sin(baseAzimuth) * baseDist;
    const baseZ = dogPos.z + Math.cos(baseAzimuth) * baseDist;
    const baseY = this._computeCandidateY(baseX, baseZ, dogGroundY, desiredHeight, maxHeight);

    if (this._isCandidateValid(dogTarget, baseX, baseY, baseZ, dogs, dogInDoghouse, true, extraTargets)) {
      return {
        pos: this._tmpSafePos.set(baseX, baseY, baseZ),
        azimuth: baseAzimuth,
        adjusted: false,
      };
    }

    // ヒステリシスを考慮した左右の探索優先方向（左右にパタパタ切り替わるのを防止）
    let prefDir = this._avoidDir >= 0 ? 1 : -1;
    if (this._initialized) {
      const curAz = Math.atan2(this._currentPos.x - dogPos.x, this._currentPos.z - dogPos.z);
      const diff = wrapAngle(curAz - baseAzimuth);
      if (Math.abs(diff) > 0.14) {
        prefDir = diff >= 0 ? 1 : -1;
      }
    }

    // 2. まずは希望距離を保って周囲へ「回り込む」（小〜中角度）
    const nearAngles = [0.22, 0.45, 0.72, 1.02];
    for (let i = 0; i < nearAngles.length; i++) {
      const step = nearAngles[i];
      for (let side = 0; side < 2; side++) {
        const dir = side === 0 ? prefDir : -prefDir;
        const az = baseAzimuth + dir * step;
        const cx = dogPos.x + Math.sin(az) * baseDist;
        const cz = dogPos.z + Math.cos(az) * baseDist;
        const cy = this._computeCandidateY(cx, cz, dogGroundY, desiredHeight, maxHeight);
        if (this._isCandidateValid(dogTarget, cx, cy, cz, dogs, dogInDoghouse, true, extraTargets)) {
          return {
            pos: this._tmpSafePos.set(cx, cy, cz),
            azimuth: az,
            adjusted: true,
          };
        }
      }
    }

    // 3. 希望方位付近でレイキャスト遮蔽距離の手前へ「近づく」（狭い場所や柵際での自然な引き寄せ）
    const pullAngles = [0, prefDir * 0.24, -prefDir * 0.24, prefDir * 0.52, -prefDir * 0.52];
    for (let i = 0; i < pullAngles.length; i++) {
      const az = baseAzimuth + pullAngles[i];
      const probeX = dogPos.x + Math.sin(az) * baseDist;
      const probeZ = dogPos.z + Math.cos(az) * baseDist;
      const probeY = this._computeCandidateY(probeX, probeZ, dogGroundY, desiredHeight, maxHeight);

      const hit = this._raycastOcclusion(
        dogTarget,
        this._tmpCandPos.set(probeX, probeY, probeZ),
        dogs,
        CAM_CLEARANCE,
        false
      );

      // レイの遮蔽手前と距離縮小候補を試す
      const pullCandidates = [];
      if (hit && hit.distance > MIN_AVOID_DIST + 0.45) {
        pullCandidates.push(clamp(hit.distance - 0.55, MIN_AVOID_DIST, baseDist * 0.92));
      }
      pullCandidates.push(
        clamp(baseDist * 0.8, MIN_DIST, maxDist),
        clamp(baseDist * 0.65, MIN_AVOID_DIST, maxDist)
      );

      for (let d = 0; d < pullCandidates.length; d++) {
        const dist = pullCandidates[d];
        const cx = dogPos.x + Math.sin(az) * dist;
        const cz = dogPos.z + Math.cos(az) * dist;
        const cy = this._computeCandidateY(cx, cz, dogGroundY, Math.min(desiredHeight, 1.45), maxHeight);
        if (this._isCandidateValid(dogTarget, cx, cy, cz, dogs, dogInDoghouse, true, null)) {
          return {
            pos: this._tmpSafePos.set(cx, cy, cz),
            azimuth: az,
            adjusted: i > 0,
          };
        }
      }
    }

    // 4. さらに広い角度へ大きく回り込む（距離も段階的に近づけながら探索）
    const wideAngles = [1.35, 1.72, 2.12, 2.55, Math.PI];
    const distScales = [1.0, 0.78, 0.58];
    for (let dIdx = 0; dIdx < distScales.length; dIdx++) {
      const minD = dIdx === 0 ? MIN_DIST : MIN_AVOID_DIST;
      const dist = clamp(baseDist * distScales[dIdx], minD, maxDist);
      const checkWhiskers = dIdx < 2;
      for (let i = 0; i < wideAngles.length; i++) {
        const step = wideAngles[i];
        const sides = step === Math.PI ? 1 : 2;
        for (let side = 0; side < sides; side++) {
          const dir = side === 0 ? prefDir : -prefDir;
          const az = baseAzimuth + dir * step;
          const cx = dogPos.x + Math.sin(az) * dist;
          const cz = dogPos.z + Math.cos(az) * dist;
          const cy = this._computeCandidateY(cx, cz, dogGroundY, desiredHeight, maxHeight);
          if (this._isCandidateValid(dogTarget, cx, cy, cz, dogs, dogInDoghouse, checkWhiskers, null)) {
            return {
              pos: this._tmpSafePos.set(cx, cy, cz),
              azimuth: az,
              adjusted: true,
            };
          }
        }
      }
    }

    // 5. 狭い空間向け最終探索: 近く低めの視線で360度から視線が通る点を探す
    const tightDist = MIN_AVOID_DIST;
    const tightHeight = clamp(desiredHeight, MIN_HEIGHT, 1.15);
    for (let k = 0; k < 12; k++) {
      const az = baseAzimuth + prefDir * (k * ((Math.PI * 2) / 12));
      const cx = dogPos.x + Math.sin(az) * tightDist;
      const cz = dogPos.z + Math.cos(az) * tightDist;
      const cy = this._computeCandidateY(cx, cz, dogGroundY, tightHeight, maxHeight);
      if (this._isCandidateValid(dogTarget, cx, cy, cz, dogs, dogInDoghouse, false, null)) {
        return {
          pos: this._tmpSafePos.set(cx, cy, cz),
          azimuth: az,
          adjusted: true,
        };
      }
    }

    // どうしても見つからない場合のフォールバック（庭の中央寄りに近づける）
    const B = this._obstacles.bounds;
    const fallbackAz = Math.atan2(-dogPos.x, -dogPos.z);
    const fx = clamp(dogPos.x + Math.sin(fallbackAz) * MIN_AVOID_DIST, B.minX, B.maxX);
    const fz = clamp(dogPos.z + Math.cos(fallbackAz) * MIN_AVOID_DIST, B.minZ, B.maxZ);
    const fy = this._computeCandidateY(fx, fz, dogGroundY, Math.min(desiredHeight, 1.2), maxHeight);
    return {
      pos: this._tmpSafePos.set(fx, fy, fz),
      azimuth: fallbackAz,
      adjusted: true,
    };
  }

  /**
   * 現在位置から目標位置への直線移動が障害物を横切る場合、
   * 犬の周りを滑らかに弧を描いて回り込む中間目標へ差し替える
   */
  _computeArcDetourIfBlocked(
    currentPos,
    desiredPos,
    dogPos,
    dogGroundY,
    dogTarget,
    dogs,
    dogInDoghouse,
    maxDist = MAX_DIST,
    maxHeight = MAX_HEIGHT
  ) {
    const curAz = Math.atan2(currentPos.x - dogPos.x, currentPos.z - dogPos.z);
    const dstAz = Math.atan2(desiredPos.x - dogPos.x, desiredPos.z - dogPos.z);
    const dAz = wrapAngle(dstAz - curAz);
    const largeTurn = Math.abs(dAz) > 0.62;
    const blockedChord = this._isChordBlocked(currentPos, desiredPos, dogInDoghouse);

    if (!largeTurn && !blockedChord) return false;

    let turnDir = dAz >= 0 ? 1 : -1;
    if (Math.abs(Math.abs(dAz) - Math.PI) < 0.35) {
      turnDir = this._avoidDir >= 0 ? 1 : -1;
    }

    const curDist = clamp(
      Math.hypot(currentPos.x - dogPos.x, currentPos.z - dogPos.z),
      MIN_AVOID_DIST,
      maxDist
    );
    const dstDist = clamp(
      Math.hypot(desiredPos.x - dogPos.x, desiredPos.z - dogPos.z),
      MIN_AVOID_DIST,
      maxDist
    );
    const stepAngle = Math.min(Math.abs(dAz), 0.58);
    const midDist = (curDist + dstDist) * 0.5;
    const midHeight = clamp(
      (currentPos.y + desiredPos.y) * 0.5 - dogGroundY,
      MIN_HEIGHT,
      maxHeight
    );

    for (let s = 0; s < 2; s++) {
      const dir = s === 0 ? turnDir : -turnDir;
      const wpAz = curAz + dir * stepAngle;
      const wx = dogPos.x + Math.sin(wpAz) * midDist;
      const wz = dogPos.z + Math.cos(wpAz) * midDist;
      const wy = this._computeCandidateY(wx, wz, dogGroundY, midHeight, maxHeight);
      if (this._isCandidateValid(dogTarget, wx, wy, wz, dogs, dogInDoghouse, false, null)) {
        this._avoidDir = dir;
        desiredPos.set(wx, wy, wz);
        return true;
      }
    }

    return blockedChord;
  }

  /**
   * 移動中の現在位置が障害物・樹冠・地面・柵の中に入らないよう押し出す
   */
  _enforceCameraClearance(pos, dogGroundY, dogInDoghouse) {
    const O = this._obstacles;
    const B = O.bounds;

    // 柵と家（縁側・軒先）の内側へ収める
    if (pos.x < B.minX) {
      pos.x = B.minX;
      if (this._posVel.x < 0) this._posVel.x = 0;
    } else if (pos.x > B.maxX) {
      pos.x = B.maxX;
      if (this._posVel.x > 0) this._posVel.x = 0;
    }
    if (pos.z < B.minZ) {
      pos.z = B.minZ;
      if (this._posVel.z < 0) this._posVel.z = 0;
    } else if (pos.z > B.maxZ) {
      pos.z = B.maxZ;
      if (this._posVel.z > 0) this._posVel.z = 0;
    }

    const pushOutCircle = (cx, cz, minR) => {
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < minR * minR) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 1e-4 ? dx / dist : 0;
        const nz = dist > 1e-4 ? dz / dist : 1;
        pos.x = cx + nx * minR;
        pos.z = cz + nz * minR;
        const vn = this._posVel.x * nx + this._posVel.z * nz;
        if (vn < 0) {
          this._posVel.x -= vn * nx;
          this._posVel.z -= vn * nz;
        }
      }
    };

    // 木の幹＋樹冠高さ上限
    if (O.tree) {
      pushOutCircle(O.tree.x, O.tree.z, O.tree.trunkRadius + 0.52);
      const maxTreeY = this._getTreeCanopyMaxY(pos.x, pos.z);
      if (pos.y > maxTreeY) {
        pos.y = maxTreeY;
        if (this._posVel.y > 0) this._posVel.y = 0;
      }
    }

    // 犬小屋
    if (O.doghouse) {
      pushOutCircle(O.doghouse.x, O.doghouse.z, dogInDoghouse ? O.doghouse.clearR : O.doghouse.clearR - 0.05);
    }

    // 灯篭
    for (let i = 0; i < O.lanterns.length; i++) {
      const lan = O.lanterns[i];
      if (pos.y < lan.maxY + 0.3) {
        pushOutCircle(lan.x, lan.z, lan.clearR - 0.08);
      }
    }

    // 隅の低木
    for (let i = 0; i < O.shrubs.length; i++) {
      const sh = O.shrubs[i];
      if (pos.y < sh.maxY + 0.3) {
        pushOutCircle(sh.x, sh.z, sh.clearR - 0.1);
      }
    }

    // 池の縁の岩
    if (O.pond && pos.y < O.pond.gy + 1.4 && this._isPointInPondBoulders(pos.x, pos.y, pos.z, -0.08)) {
      const pond = O.pond;
      const dx = pos.x - pond.x;
      const dz = pos.z - pond.z;
      const ang = Math.atan2(dz, dx);
      const isWestOpening = Math.abs(wrapAngle(ang - Math.PI)) < 0.4;
      const margin = isWestOpening ? 0.42 : 1.08;
      const rx = pond.rx + margin;
      const rz = pond.rz + margin;
      const scale = Math.hypot(dx / rx, dz / rz);
      if (scale > 1e-4 && scale < 1.0) {
        pos.x = pond.x + dx / scale;
        pos.z = pond.z + dz / scale;
      }
    }

    // 押し出し後に柵・家の外へはみ出ないよう再クランプ
    pos.x = clamp(pos.x, B.minX, B.maxX);
    pos.z = clamp(pos.z, B.minZ, B.maxZ);

    // 地面より下に行かない
    const camGroundY = this._getGroundY(pos.x, pos.z);
    const minY = Math.max(camGroundY + 0.48, dogGroundY + 0.28);
    if (pos.y < minY) {
      pos.y = minY;
      if (this._posVel.y < 0) this._posVel.y = 0;
    }
  }

  /**
   * 実際の現在位置から犬までの間に遮蔽物が割り込んだ場合、
   * スプリングアームのように遮蔽物の手前へ滑らかに寄せる
   */
  _applySpringArmPullIn(dogTarget, pos, dogs, dogInDoghouse, dt, softOnly = false) {
    const hit = this._raycastOcclusion(dogTarget, pos, dogs, 0.25, false);
    if (!hit) return;

    const dir = this._tmpRayDir.subVectors(pos, dogTarget);
    const curDist = dir.length();
    if (curDist < 0.4) return;
    dir.multiplyScalar(1 / curDist);

    const safeDist = hit.distance - 0.42;
    if (safeDist >= curDist) return;

    // 犬小屋の中や犬の至近距離にめり込むような引き寄せは行わず、回り込みに任せる
    if (safeDist < 1.2) return;

    const pullPos = this._tmpPullPos.copy(dogTarget).addScaledVector(dir, safeDist);
    const pullGroundY = this._getGroundY(pullPos.x, pullPos.z);
    pullPos.y = Math.max(pullPos.y, pullGroundY + 0.48);

    if (!this._isPositionClear(pullPos.x, pullPos.y, pullPos.z)) {
      return;
    }

    // 枝葉やフォーカス切替中はソフトに引き寄せ、固い壁・幹・岩・灯篭は視界が塞がれないよう素早く手前へ寄せる
    if (hit.isFoliage || softOnly) {
      const t = 1 - Math.exp(-(softOnly ? 5.5 : 11.0) * dt);
      pos.lerp(pullPos, t);
    } else {
      if (hit.distance < curDist - 0.25) {
        // 障害物の裏側に入り込んでいれば即座に手前へ収める
        pos.copy(pullPos);
      } else {
        // 近接クリップ手前なら滑らかに引き離す
        const t = 1 - Math.exp(-16.0 * dt);
        pos.lerp(pullPos, t);
      }
      // 外側へ向かう速度成分を抑えて壁への再突入を防ぐ
      const outwardVel = this._posVel.dot(dir);
      if (outwardVel > 0) {
        this._posVel.addScaledVector(dir, -outwardVel);
      }
    }

    // 地面・柵の最終確認
    const B = this._obstacles.bounds;
    pos.x = clamp(pos.x, B.minX, B.maxX);
    pos.z = clamp(pos.z, B.minZ, B.maxZ);
    const finalGroundY = this._getGroundY(pos.x, pos.z);
    if (pos.y < finalGroundY + 0.48) {
      pos.y = finalGroundY + 0.48;
    }
  }
}
