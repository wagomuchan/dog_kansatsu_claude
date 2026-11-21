import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
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
const MAX_REAL_DT = 0.1;
const MAX_PIXEL_RATIO = 2;

function loadSavedBreedId() {
  try {
    return window.localStorage.getItem(STORAGE_KEY_BREED);
  } catch {
    return null;
  }
}

function saveBreedId(id) {
  try {
    window.localStorage.setItem(STORAGE_KEY_BREED, id);
  } catch {
    // プライベートブラウジングやストレージ制限時は無視
  }
}

function findBreedById(id) {
  return BREEDS.find((b) => b.id === id) || BREEDS[0];
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
  dog.onEvent = (name) => {
    soundscape.playDogEvent(name, dog.position);
  };
}

function switchDogBreed(currentDog, newBreed, scene, garden, soundscape) {
  // Dog 側が専用メソッドを持つ場合はそちらを使用
  if (typeof currentDog.setBreed === 'function') {
    currentDog.setBreed(newBreed);
    wireDogEvents(currentDog, soundscape);
    return currentDog;
  }
  if (typeof currentDog.changeBreed === 'function') {
    currentDog.changeBreed(newBreed);
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
  if (savedPos && nextDog.position) {
    nextDog.position.copy(savedPos);
  }
  if (Number.isFinite(savedHeading)) {
    nextDog.heading = savedHeading;
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

function init() {
  const container = document.getElementById('viewport');
  const savedId = loadSavedBreedId();
  let currentBreed = findBreedById(savedId);

  const soundscape = new Soundscape();
  let ui = null;
  let dog = null;
  let garden = null;
  let scene = null;

  ui = new UI({
    breeds: BREEDS,
    initialBreedId: currentBreed.id,
    onBreedChange: (breedId) => {
      const nextBreed = findBreedById(breedId);
      if (!nextBreed || nextBreed.id === currentBreed.id) return;
      currentBreed = nextBreed;
      saveBreedId(nextBreed.id);
      if (dog && scene && garden) {
        dog = switchDogBreed(dog, nextBreed, scene, garden, soundscape);
      }
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
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.16, 0.45, 0.92);
    const outputPass = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    // 世界時計・庭・犬・追いかけカメラ
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

    dog = new Dog(scene, garden, currentBreed);
    wireDogEvents(dog, soundscape);

    const followCamera = new FollowCamera(camera, garden);
    // 確認用: ?debug をつけると中身をのぞける
    if (location.search.includes('debug')) window.__app = { camera, followCamera, clock, garden, getDog: () => dog };

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

    // 初回フレームを描画してから読み込み画面を静かにフェードアウト
    const initWorldDt = clock.gameDtFromReal(0.016);
    garden.update(0.016, clock);
    dog.update(0.016, initWorldDt, {
      clock,
      garden,
      cameraPos: camera.position,
      camera,
    });
    followCamera.update(0.016, dog);
    ui.update(clock, garden, dog);
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
      dog.update(realDt, worldDt, {
        clock,
        garden,
        cameraPos: camera.position,
        camera,
      });
      followCamera.update(realDt, dog);
      soundscape.update(realDt, clock, garden, dog, camera.position);
      ui.update(clock, garden, dog);

      // 夜の灯りが優しく滲むようブルームをわずかに調整
      const targetBloom = clock.isNight ? 0.24 : 0.14;
      bloomPass.strength += (targetBloom - bloomPass.strength) * Math.min(1, realDt * 2);

      composer.render();
    };

    window.requestAnimationFrame(animate);
  } catch (err) {
    console.error('庭の初期化に失敗しました:', err);
    ui.showError('庭の読み込みに失敗しました。ブラウザを再読み込みしてください。');
  }
}

init();
