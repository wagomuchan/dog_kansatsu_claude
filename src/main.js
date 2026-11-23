import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { WorldClock } from './time.js';
import { Garden } from './environment.js';
import { BREEDS } from './dog/breeds.js';
import { Dog } from './dog/dog.js';
import { FollowCamera } from './camera.js';
import { Soundscape } from './audio.js';
import { UI } from './ui.js';

const STORAGE_KEY_BREED = 'dog_kansatsu_breed';
const STORAGE_KEY_BREED_2 = 'dog_kansatsu_breed_2';
const STORAGE_KEY_DOG_COUNT = 'dog_kansatsu_count';
const MAX_REAL_DT = 0.1;
const MAX_PIXEL_RATIO = 2;
const EMPTY_OTHERS = Object.freeze([]);

function loadStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveStorage(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // プライベートブラウジングやストレージ制限時は無視
  }
}

function loadSavedDogCount() {
  return loadStorage(STORAGE_KEY_DOG_COUNT) === '2' ? 2 : 1;
}

function findBreedById(id) {
  return BREEDS.find((b) => b.id === id) || BREEDS[0];
}

function pickDifferentBreed(firstBreed) {
  return BREEDS.find((b) => b.id !== firstBreed.id) || BREEDS[1] || BREEDS[0];
}

function resolveInitialBreeds() {
  const breed1 = findBreedById(loadStorage(STORAGE_KEY_BREED));
  const saved2 = loadStorage(STORAGE_KEY_BREED_2);
  const breed2 = saved2 && BREEDS.some((b) => b.id === saved2)
    ? findBreedById(saved2)
    : pickDifferentBreed(breed1);
  return [breed1, breed2];
}

function createFallbackEnvironment(scene, renderer) {
  // Garden 側で PMREM 環境光が設定されていない場合のフォールバック
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xb8d4ea);

  const skyLight = new THREE.HemisphereLight(0xdceeff, 0x5c6b4d, 1.4);
  envScene.add(skyLight);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6e0 })
  );
  sunDisc.position.set(10, 14, 8);
  envScene.add(sunDisc);

  const rt = pmrem.fromScene(envScene, 0.04);
  scene.environment = rt.texture;
  pmrem.dispose();
}

function wireDogEvents(dog, soundscape) {
  if (!dog) return;
  dog.onEvent = (name, pos) => {
    soundscape.playDogEvent(name, pos || dog.position);
  };
}

function isSpawnWalkable(garden, x, z, margin) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > 14.3 || Math.abs(z) > 14.3) return false;
  if (garden && typeof garden.isInside === 'function') {
    if (!garden.isInside(x, z, margin)) return false;
  }
  const dhIn = garden?.poi?.doghouseInside;
  if (dhIn && Math.hypot(x - dhIn.x, z - dhIn.z) < 1.35) {
    return false;
  }
  return true;
}

function getSafeGroundY(garden, x, z) {
  if (garden && typeof garden.getGroundHeight === 'function') {
    const y = garden.getGroundHeight(x, z);
    if (Number.isFinite(y)) return y;
  }
  return 0;
}

function findSecondDogSpawn(garden, firstDog, secondDog) {
  const origin = firstDog?.position || { x: 0, z: 2 };
  const margin = Math.max(0.55, secondDog?.bodyMargin || 0.5);
  const startAngle = Math.random() * Math.PI * 2;
  const angleSteps = 24;

  // まずは仕様通り 1匹目から 2〜3m 離れた歩ける点を探す
  const preferredRadii = [2.5, 2.2, 2.8, 2.0, 3.0];
  for (let rIdx = 0; rIdx < preferredRadii.length; rIdx++) {
    const r = preferredRadii[rIdx];
    for (let i = 0; i < angleSteps; i++) {
      const a = startAngle + (i / angleSteps) * Math.PI * 2;
      const x = origin.x + Math.sin(a) * r;
      const z = origin.z + Math.cos(a) * r;
      if (isSpawnWalkable(garden, x, z, margin)) {
        const y = getSafeGroundY(garden, x, z);
        const heading = Math.atan2(origin.x - x, origin.z - z) + (Math.random() - 0.5) * 0.5;
        return { x, y, z, heading };
      }
    }
  }

  // 周囲が狭い場合は少し広げて探索
  const fallbackRadii = [3.4, 3.9, 1.75, 4.6, 5.5];
  for (let rIdx = 0; rIdx < fallbackRadii.length; rIdx++) {
    const r = fallbackRadii[rIdx];
    for (let i = 0; i < angleSteps; i++) {
      const a = startAngle + (i / angleSteps) * Math.PI * 2;
      const x = origin.x + Math.sin(a) * r;
      const z = origin.z + Math.cos(a) * r;
      if (isSpawnWalkable(garden, x, z, margin)) {
        const y = getSafeGroundY(garden, x, z);
        const heading = Math.atan2(origin.x - x, origin.z - z) + (Math.random() - 0.5) * 0.5;
        return { x, y, z, heading };
      }
    }
  }

  if (garden && typeof garden.randomWalkablePoint === 'function') {
    for (let i = 0; i < 8; i++) {
      const pt = garden.randomWalkablePoint();
      if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.z) && isSpawnWalkable(garden, pt.x, pt.z, margin)) {
        return {
          x: pt.x,
          y: getSafeGroundY(garden, pt.x, pt.z),
          z: pt.z,
          heading: Math.atan2(origin.x - pt.x, origin.z - pt.z),
        };
      }
    }
  }

  return null;
}

function createDog(index, breed, scene, garden, soundscape, firstDog = null) {
  const d = new Dog(scene, garden, breed);
  d.id = index;

  if (index > 0 && firstDog) {
    const spawn = findSecondDogSpawn(garden, firstDog, d);
    if (spawn && d.position) {
      d.position.set(spawn.x, spawn.y, spawn.z);
      d.heading = spawn.heading;
      if (d.root) {
        d.root.position.copy(d.position);
        d.root.rotation.y = d.heading;
      }
    }
  }

  wireDogEvents(d, soundscape);
  return d;
}

function switchDogBreed(currentDog, newBreed, scene, garden, soundscape, index) {
  // Dog 側が専用メソッドを持つ場合はそちらを使用
  if (typeof currentDog.setBreed === 'function') {
    currentDog.setBreed(newBreed);
    currentDog.id = index;
    wireDogEvents(currentDog, soundscape);
    return currentDog;
  }
  if (typeof currentDog.changeBreed === 'function') {
    currentDog.changeBreed(newBreed);
    currentDog.id = index;
    wireDogEvents(currentDog, soundscape);
    return currentDog;
  }

  // 持たない場合は位置・向き・欲求・行動を引き継いで再構築
  const savedPos = currentDog.position ? currentDog.position.clone() : null;
  const savedHeading = currentDog.heading;
  const prevBrain = currentDog.brain;
  const savedNeeds = prevBrain?.needs ? { ...prevBrain.needs } : null;
  const savedMood = prevBrain?.mood;
  const savedAction = currentDog.action ? { ...currentDog.action } : null;

  if (typeof currentDog.dispose === 'function') {
    currentDog.dispose();
  }

  const nextDog = new Dog(scene, garden, newBreed);
  nextDog.id = index;
  if (savedPos && nextDog.position) {
    nextDog.position.copy(savedPos);
    if (nextDog.root) nextDog.root.position.copy(savedPos);
  }
  if (Number.isFinite(savedHeading)) {
    nextDog.heading = savedHeading;
    if (nextDog.root) nextDog.root.rotation.y = savedHeading;
  }
  if (nextDog.brain) {
    if (savedNeeds && nextDog.brain.needs) {
      Object.assign(nextDog.brain.needs, savedNeeds);
    }
    if (savedMood !== undefined) {
      nextDog.brain.mood = savedMood;
    }
    if (savedAction && nextDog.brain.action) {
      Object.assign(nextDog.brain.action, savedAction);
    }
  }

  wireDogEvents(nextDog, soundscape);
  return nextDog;
}

function updateAllDogs(dogs, realDt, worldDt, clock, garden, camera) {
  const count = dogs.length;
  for (let i = 0; i < count; i++) {
    const d = dogs[i];
    const others = count > 1 ? dogs.filter((o) => o !== d) : EMPTY_OTHERS;
    d.update(realDt, worldDt, {
      clock,
      garden,
      cameraPos: camera.position,
      camera,
      others,
    });
  }
}

function init() {
  const container = document.getElementById('viewport');
  const currentBreeds = resolveInitialBreeds();
  let dogCount = loadSavedDogCount();

  const soundscape = new Soundscape();
  const dogs = [];
  let ui = null;
  let garden = null;
  let scene = null;

  const applyDogCount = (nextCount) => {
    const normalized = nextCount === 2 ? 2 : 1;
    dogCount = normalized;
    saveStorage(STORAGE_KEY_DOG_COUNT, normalized);
    if (!scene || !garden) return;

    if (normalized === 2 && dogs.length === 1) {
      // 1匹目の位置・状態は保ったまま、2匹目を2〜3m離れた歩ける点へ追加
      const secondDog = createDog(1, currentBreeds[1], scene, garden, soundscape, dogs[0]);
      dogs.push(secondDog);
    } else if (normalized === 1 && dogs.length > 1) {
      // 1匹目は保ったまま、2匹目のみ削除
      for (let i = dogs.length - 1; i >= 1; i--) {
        if (typeof dogs[i]?.dispose === 'function') {
          dogs[i].dispose();
        }
      }
      dogs.length = 1;
    }
  };

  ui = new UI({
    breeds: BREEDS,
    initialBreedIds: [currentBreeds[0].id, currentBreeds[1].id],
    initialCount: dogCount,
    onBreedChange: (breedId, index = 0) => {
      const slot = index === 1 ? 1 : 0;
      const nextBreed = findBreedById(breedId);
      if (!nextBreed || nextBreed.id === currentBreeds[slot].id) return;
      currentBreeds[slot] = nextBreed;
      saveStorage(slot === 0 ? STORAGE_KEY_BREED : STORAGE_KEY_BREED_2, nextBreed.id);
      if (dogs[slot] && scene && garden) {
        dogs[slot] = switchDogBreed(dogs[slot], nextBreed, scene, garden, soundscape, slot);
      }
    },
    onCountChange: (nextCount) => {
      applyDogCount(nextCount);
    },
    onSoundToggle: () => {
      const enabled = soundscape.toggle();
      ui.setSoundEnabled(enabled);
    },
  });

  try {
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

    // Renderer（画質優先設定）
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Scene & Camera
    scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 240);
    camera.position.set(0, 1.5, 5);

    // Post-processing: RenderPass -> UnrealBloomPass(弱め) -> OutputPass
    const renderTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(width * pixelRatio)),
      Math.max(1, Math.floor(height * pixelRatio)),
      {
        type: THREE.HalfFloatType,
        samples: renderer.capabilities.isWebGL2 ? 4 : 0,
      }
    );
    const composer = new EffectComposer(renderer, renderTarget);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);

    const renderPass = new RenderPass(scene, camera);
    // Guard against any NaN/Inf pixel spreading across the whole frame via UnrealBloomPass
    const sanitizePass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        float safeCh(float x) {
          return (x >= 0.0 && x < 65000.0) ? min(x, 32.0) : 0.0;
        }
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float a = (c.a >= 0.0 && c.a <= 1.0) ? c.a : 1.0;
          gl_FragColor = vec4(safeCh(c.r), safeCh(c.g), safeCh(c.b), a);
        }
      `,
    });
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.16, 0.45, 0.92);
    const outputPass = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(sanitizePass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    // 世界時計・庭・犬（配列管理）・追いかけカメラ
    const clock = new WorldClock(30);
    garden = new Garden(scene, renderer);

    // 影解像度2048・PMREM環境光の保証
    scene.traverse((obj) => {
      if (obj.isDirectionalLight && obj.castShadow) {
        if (obj.shadow.mapSize.width < 2048 || obj.shadow.mapSize.height < 2048) {
          obj.shadow.mapSize.set(2048, 2048);
        }
      }
    });
    if (!scene.environment) {
      createFallbackEnvironment(scene, renderer);
    }

    dogs.push(createDog(0, currentBreeds[0], scene, garden, soundscape));
    if (dogCount === 2) {
      dogs.push(createDog(1, currentBreeds[1], scene, garden, soundscape, dogs[0]));
    }

    const followCamera = new FollowCamera(camera, garden);
    const audioFocusProxy = { position: new THREE.Vector3() };

    // 確認用: ?debug をつけると中身をのぞける
    if (location.search.includes('debug')) {
      window.__app = {
        camera,
        followCamera,
        clock,
        garden,
        getDog: () => dogs[0],
        getDogs: () => dogs,
      };
    }

    // リサイズ対応
    const onResize = () => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const pr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setPixelRatio(pr);
      renderer.setSize(w, h);

      composer.setPixelRatio(pr);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const computeTargetExposure = (clk) => {
      const el = Number.isFinite(clk?.sunElevation) ? clk.sunElevation : 0.5;
      const t = Math.max(0, Math.min(1, (0.14 - el) / 0.22));
      const nightAdapt = t * t * (3 - 2 * t);
      return 1.05 + nightAdapt * 0.19;
    };

    // 初回フレームを描画してから読み込み画面を静かにフェードアウト
    const initWorldDt = clock.gameDtFromReal(0.016);
    garden.update(0.016, clock);
    updateAllDogs(dogs, 0.016, initWorldDt, clock, garden, camera);
    followCamera.update(0.016, dogs.length === 1 ? dogs[0] : dogs);
    ui.update(clock, garden, dogs);
    bloomPass.strength = clock.isNight ? 0.22 : 0.14;
    renderer.toneMappingExposure = computeTargetExposure(clock);
    composer.render();

    window.requestAnimationFrame(() => {
      ui.hideLoading();
    });

    // メインループ
    let lastTimeMs = performance.now();
    const animate = (nowMs) => {
      window.requestAnimationFrame(animate);

      const rawDt = (nowMs - lastTimeMs) / 1000;
      lastTimeMs = nowMs;
      const realDt = Math.min(MAX_REAL_DT, Math.max(0, Number.isFinite(rawDt) ? rawDt : 0));

      clock.update(realDt);
      const worldDt = clock.gameDtFromReal(realDt);

      garden.update(realDt, clock);
      updateAllDogs(dogs, realDt, worldDt, clock, garden, camera);
      followCamera.update(realDt, dogs.length === 1 ? dogs[0] : dogs);

      let audioTarget = dogs[0];
      if (dogs.length > 1) {
        const lookPos = followCamera.getLookAtPosition?.();
        if (lookPos) {
          audioFocusProxy.position.copy(lookPos);
          audioTarget = audioFocusProxy;
        }
      }
      soundscape.update(realDt, clock, garden, audioTarget, camera.position);
      ui.update(clock, garden, dogs);

      // 夜の灯りが優しく滲むようブルームと露出をなめらかに調整
      const targetBloom = clock.isNight ? 0.22 : 0.14;
      bloomPass.strength += (targetBloom - bloomPass.strength) * Math.min(1, realDt * 2);
      const targetExp = computeTargetExposure(clock);
      renderer.toneMappingExposure += (targetExp - renderer.toneMappingExposure) * Math.min(1, realDt * 2);

      composer.render();
    };

    window.requestAnimationFrame(animate);
  } catch (err) {
    console.error('庭の初期化に失敗しました:', err);
    ui.showError('庭の読み込みに失敗しました。ブラウザを再読み込みしてください。');
  }
}

init();
