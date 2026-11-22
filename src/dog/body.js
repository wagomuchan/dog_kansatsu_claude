import * as THREE from 'three';
import { BREEDS, getBreedById } from './breeds.js';

// ============================================================================
// Procedural Canvas Textures (Eye Iris, Wet Nose Leather)
// ============================================================================

function createIrisTexture(eyeColorHex, isHusky = false) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;

  const base = new THREE.Color(eyeColorHex);
  const darkOuterHex = isHusky ? '#090b0f' : '#080504';
  const limbalHex = isHusky ? '#0b1826' : '#060303';

  const dark = isHusky
    ? new THREE.Color('#133552')
    : base.clone().multiplyScalar(0.30);
  const mid = isHusky
    ? base.clone().lerp(new THREE.Color('#2d7fb5'), 0.25)
    : base.clone().multiplyScalar(0.86);
  const warm = isHusky
    ? base.clone().lerp(new THREE.Color('#bfe8ff'), 0.22)
    : base.clone().lerp(new THREE.Color('#7a4018'), 0.22);

  // Entire eyeball base is deep dark pigment (no visible white sclera)
  ctx.fillStyle = darkOuterHex;
  ctx.fillRect(0, 0, size, size);

  // Outer limbal ring smoothly blending iris edge into dark eyeball
  const limbalGrad = ctx.createRadialGradient(cx, cy, size * 0.33, cx, cy, size * 0.43);
  limbalGrad.addColorStop(0.0, limbalHex);
  limbalGrad.addColorStop(0.65, darkOuterHex);
  limbalGrad.addColorStop(1.0, darkOuterHex);
  ctx.fillStyle = limbalGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.43, 0, Math.PI * 2);
  ctx.fill();

  // Wide canine iris filling almost the entire visible eye opening
  const irisR = size * 0.37;
  const pupilR = size * (isHusky ? 0.135 : 0.165);
  const irisGrad = ctx.createRadialGradient(cx, cy, pupilR * 0.85, cx, cy, irisR);
  irisGrad.addColorStop(0.0, '#' + warm.getHexString());
  irisGrad.addColorStop(0.32, '#' + mid.getHexString());
  irisGrad.addColorStop(0.76, '#' + dark.getHexString());
  irisGrad.addColorStop(0.94, limbalHex);
  irisGrad.addColorStop(1.0, darkOuterHex);
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();

  // Subtle radial iris fibers for natural organic depth
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * Math.PI * 2 + Math.sin(i * 17.3) * 0.03;
    const innerR = pupilR * (0.95 + (i % 5) * 0.04);
    const outerR = irisR * (0.82 + Math.sin(i * 5.7) * 0.10);
    const isLight = i % 3 === 0;
    ctx.strokeStyle = isLight
      ? `rgba(${Math.round(warm.r * 255)}, ${Math.round(warm.g * 255)}, ${Math.round(warm.b * 255)}, ${isHusky ? 0.24 : 0.18})`
      : `rgba(${Math.round(dark.r * 255)}, ${Math.round(dark.g * 255)}, ${Math.round(dark.b * 255)}, 0.32)`;
    ctx.lineWidth = isLight ? 1.1 : 1.7;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
    ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
    ctx.stroke();
  }
  ctx.restore();

  // Gentle warm/sky bounce on lower iris (no painted white catchlight circles)
  const caustic = ctx.createRadialGradient(cx, cy + irisR * 0.38, 2, cx, cy + irisR * 0.38, irisR * 0.56);
  caustic.addColorStop(0, `rgba(${Math.round(warm.r * 255)}, ${Math.round(warm.g * 255)}, ${Math.round(warm.b * 255)}, ${isHusky ? 0.24 : 0.20})`);
  caustic.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = caustic;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 0.94, 0, Math.PI * 2);
  ctx.fill();

  // Large deep velvety black pupil
  const pupilGrad = ctx.createRadialGradient(cx, cy, pupilR * 0.62, cx, cy, pupilR * 1.06);
  pupilGrad.addColorStop(0.0, '#010102');
  pupilGrad.addColorStop(0.84, '#020203');
  pupilGrad.addColorStop(1.0, 'rgba(5,3,2,0)');
  ctx.fillStyle = pupilGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, pupilR * 1.06, 0, Math.PI * 2);
  ctx.fill();

  // Soft upper eyelid shadow across top of iris
  const topShadow = ctx.createLinearGradient(0, cy - irisR, 0, cy + irisR * 0.08);
  topShadow.addColorStop(0, 'rgba(0,0,0,0.50)');
  topShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createNoseBumpTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#707070';
  ctx.fillRect(0, 0, size, size);

  // Fine pebble/cobblestone leather grain of a canine rhinarium
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 460; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1.4 + rnd() * 2.2;
    const g = ctx.createRadialGradient(x, y, 0.2, x, y, r);
    g.addColorStop(0, '#e4e4e4');
    g.addColorStop(0.7, '#9c9c9c');
    g.addColorStop(1, '#343434');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 2.5);
  return tex;
}

// ============================================================================
// Shell Fur Material System (PBR MeshPhysicalMaterial + onBeforeCompile)
// ============================================================================

const PATTERN_ID = {
  solid: 0,
  urajiro: 1,
  tricolor: 2,
  saddle: 3,
  mask: 4,
};

const FUR_VERTEX_PREAMBLE = /* glsl */ `
attribute float aShellHeight;
attribute vec3 aBodyPos;
attribute vec3 aCombDir;
attribute float aFurScale;
attribute vec4 aCoatCoord;

uniform float uFurLength;
uniform float uFluffiness;
uniform float uCurl;
uniform float uWetness;
uniform float uShake;
uniform float uTime;

varying float vShellHeight;
varying vec3 vBodyPos;
varying vec4 vCoatCoord;
varying float vFurScale;
varying vec3 vCombDir;
varying vec3 vWorldNormalFur;
varying vec3 vWorldPosFur;
`;

const FUR_VERTEX_DISPLACE = /* glsl */ `
vShellHeight = aShellHeight;
vBodyPos = aBodyPos;
vCoatCoord = aCoatCoord;
vFurScale = aFurScale;
vCombDir = aCombDir;

float furNLen = length(objectNormal);
vec3 furNDir = furNLen > 0.0001 ? (objectNormal / furNLen) : vec3(0.0, 1.0, 0.0);

if (aShellHeight > 0.0001) {
  float h = aShellHeight;
  float hPow = pow(h, 1.35);
  // Wetness compresses and weighs fur down
  float wetCompress = mix(1.0, 0.58, uWetness);
  float localLen = uFurLength * aFurScale * wetCompress;

  vec3 nDir = furNDir;
  vec3 combVec = aCombDir;
  #ifdef USE_SKINNING
    combVec = (skinMatrix * vec4(combVec, 0.0)).xyz;
  #endif
  float combLen = length(combVec);
  if (combLen > 0.0001) combVec /= combLen;

  // Project comb direction onto local surface tangent plane so hair lays smoothly back-down
  vec3 tangentComb = combVec - nDir * dot(combVec, nDir);
  float tcLen = length(tangentComb);
  if (tcLen > 0.001) {
    tangentComb /= tcLen;
  } else {
    tangentComb = combVec;
  }

  // Tight natural silhouette: modest normal lift, strong tangent sweep along hair flow
  float longFactor = smoothstep(0.015, 0.030, uFurLength) * (1.0 - uCurl);
  float normalLift = mix(0.36, 0.56, uFluffiness);
  normalLift = mix(normalLift, 0.68, uCurl);
  // Clamp normal lift on feathered areas so silhouette doesn't balloon into fuzz
  float silhouetteCap = mix(1.0, 0.72, smoothstep(1.1, 1.8, aFurScale));

  float combSweep = mix(1.55, 0.90, uFluffiness) * (1.0 - uCurl * 0.65)
                  + longFactor * 0.70
                  + uWetness * 0.55;

  vec3 disp = nDir * (localLen * normalLift * silhouetteCap * h)
            + tangentComb * (localLen * combSweep * hPow);

  // Subtle flowing lock wave for long-haired coats (Golden, Husky)
  if (longFactor > 0.01) {
    float lockWave = sin(dot(aBodyPos, vec3(32.0, 20.0, 26.0))) * 0.14;
    disp += tangentComb * (localLen * longFactor * lockWave * hPow);
  }

  // Compact curly spiral offset (Toy Poodle, gentle wave on Golden)
  if (uCurl > 0.02) {
    float phase = dot(aBodyPos, vec3(95.0, 115.0, 88.0)) + h * 10.0;
    vec3 refUp = abs(nDir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 t1 = normalize(cross(nDir, refUp));
    vec3 t2 = cross(nDir, t1);
    float curlR = localLen * 0.26 * uCurl * sin(h * 3.14159);
    disp += (t1 * cos(phase) + t2 * sin(phase)) * curlR;
  }

  // Dynamic fur flutter during wet-dog shake
  if (uShake > 0.001) {
    float flutter = sin(uTime * 38.0 + aBodyPos.z * 16.0 + aBodyPos.y * 12.0);
    disp += nDir * (localLen * 0.30 * uShake * h * h * (0.5 + 0.5 * flutter));
  }

  transformed += disp;
}

vec3 furWorldN = mat3(modelMatrix) * furNDir;
float furWorldNLen = length(furWorldN);
vWorldNormalFur = furWorldNLen > 0.0001 ? (furWorldN / furWorldNLen) : vec3(0.0, 1.0, 0.0);
vWorldPosFur = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const FUR_FRAGMENT_PREAMBLE = /* glsl */ `
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec3 uTertiaryColor;
uniform float uPattern;
uniform float uFurLength;
uniform float uStrandFreq;
uniform float uFluffiness;
uniform float uCurl;
uniform float uWetness;
uniform float uSnow;
uniform float uDirt;
uniform float uIsShell;
uniform vec4 uMarkingsA; // blaze, collar, eyebrows, socks
uniform vec2 uMarkingsB; // tailTipWhite, dorsalDarken

varying float vShellHeight;
varying vec3 vBodyPos;
varying vec4 vCoatCoord;
varying float vFurScale;
varying vec3 vCombDir;
varying vec3 vWorldNormalFur;
varying vec3 vWorldPosFur;

vec3 fur_hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

float fur_hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float fur_noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = fur_hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = fur_hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = fur_hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = fur_hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = fur_hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = fur_hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = fur_hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = fur_hash31(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  return mix(mix(nx00, nx10, u.y), mix(nx01, nx11, u.y), u.z);
}

// Fast 2x2x2 3D cellular hair follicle lookup
vec2 fur_cell3D(vec3 p) {
  vec3 base = floor(p);
  vec3 f = fract(p);
  vec3 offset = step(vec3(0.5), f) - 1.0;
  float minD2 = 10.0;
  float id = 0.5;
  for (int x = 0; x <= 1; x++) {
    for (int y = 0; y <= 1; y++) {
      for (int z = 0; z <= 1; z++) {
        vec3 cell = base + offset + vec3(float(x), float(y), float(z));
        vec3 rnd = fur_hash33(cell);
        vec3 diff = (cell + 0.18 + 0.64 * rnd) - p;
        float d2 = dot(diff, diff);
        if (d2 < minD2) {
          minD2 = d2;
          id = rnd.x;
        }
      }
    }
  }
  return vec2(sqrt(minD2), id);
}

vec3 fur_computeCoatColor(vec4 cc, vec3 bp, float fineTone, float clumpN) {
  // cc.x: lateral (-1..1; for zone 3 legs: -1 = inner leg facing belly, +1 = outer leg)
  // cc.y: vertical (0=paws, 0.45=belly, 1.0=dorsal)
  // cc.z: longitudinal (-1=tail/rump, 0=midback, 0.8=chest, 1.0=neck, 1.2=skull, 1.5=muzzle tip)
  // cc.w: zone (0=torso/neck, 1=head, 2=ears, 3=legs, 4=tail)
  float ax = abs(cc.x);
  float y = cc.y;
  float z = cc.z;
  float zone = cc.w;

  // Feathery organic edge perturbation so markings look grown from hair
  float edgeN = (clumpN - 0.5) * 0.09 + (fineTone - 0.5) * 0.03;
  float blazeW = uMarkingsA.x;
  float collarW = uMarkingsA.y;
  float browW = uMarkingsA.z;
  float sockW = uMarkingsA.w;
  float tipWhite = uMarkingsB.x;
  float dorsalDark = uMarkingsB.y;

  vec3 col = uPrimaryColor;

  if (uPattern < 0.5) {
    // SOLID (Golden, Labrador, Toy Poodle): rich saturated base, subtle warm honey belly/feathering
    float bellyBlend = smoothstep(0.56, 0.30, y + edgeN) * (zone < 0.5 ? 1.0 : 0.0);
    float featherLight = smoothstep(1.15, 1.75, vFurScale) * 0.34;
    col = mix(uPrimaryColor, uSecondaryColor, clamp(bellyBlend * 0.42 + featherLight, 0.0, 0.52));
    // Richer warm reddish-gold/amber along spine, crown & ear leather
    float earShade = (zone > 1.5 && zone < 2.5) ? 0.42 : 0.0;
    float spineShade = smoothstep(0.70, 0.98, y + edgeN * 0.5) * smoothstep(0.68, 0.14, ax) * dorsalDark;
    col = mix(col, uTertiaryColor, clamp(spineShade + earShade * (0.5 + dorsalDark * 0.6), 0.0, 0.68));
  } else if (uPattern < 1.5) {
    // URAJIRO (Shiba Inu, Corgi): rich reddish-brown coat + cream ONLY on mouth, cheeks, chest, belly, inner legs
    // Torso belly & throat underside ONLY (never spills onto outer legs!)
    float underMask = (zone < 0.5) ? smoothstep(0.52, 0.34, y + edgeN) : 0.0;
    // Front chest bib & lower throat
    float chestBib = (zone < 0.5)
      ? smoothstep(0.62, 0.88, z + edgeN) * smoothstep(0.76, 0.48, y + edgeN) * smoothstep(0.74, 0.20, ax)
      : 0.0;

    // Face urajiro: mouth/chin, lower muzzle sides, and plump lower cheeks
    float faceUrajiro = 0.0;
    if (zone > 0.5 && zone < 1.5) {
      // Lower cheeks & chin
      float lowerCheek = smoothstep(0.55, 0.36, y + edgeN * 0.6) * smoothstep(0.18, 0.58, ax);
      float chinMouth = smoothstep(0.50, 0.34, y + edgeN * 0.5) * smoothstep(1.14, 1.38, z);
      // Sides of muzzle (leaving upper nose bridge rich red-brown)
      float snoutSides = smoothstep(1.24, 1.46, z) * smoothstep(0.56, 0.40, y + edgeN * 0.45);
      faceUrajiro = max(max(lowerCheek, chinMouth), snoutSides * 0.90);
      // Forehead blaze (Corgi)
      if (blazeW > 0.05) {
        float blaze = smoothstep(0.19, 0.07, ax + edgeN * 0.3) * smoothstep(1.08, 1.24, z) * smoothstep(1.48, 1.32, z);
        faceUrajiro = max(faceUrajiro, blaze * blazeW);
      }
      // Subtle pale eyebrow pips (Shiba maro)
      if (browW > 0.05) {
        vec2 browD = vec2((ax - 0.27) / 0.10, (y - 0.74) / 0.08);
        float browZ = smoothstep(1.16, 1.25, z) * smoothstep(1.36, 1.28, z);
        float browSpot = smoothstep(1.05, 0.35, length(browD)) * browZ * browW;
        faceUrajiro = max(faceUrajiro, browSpot);
      }
    }

    // White neck collar (Corgi)
    float collarMask = 0.0;
    if (collarW > 0.05 && zone < 0.5) {
      collarMask = smoothstep(0.84, 0.96, z + edgeN) * smoothstep(1.14, 1.00, z + edgeN) * collarW;
    }

    // Legs: ONLY inner side of legs (cc.x < 0) + optional paw socks (low on Shiba, higher on Corgi)
    float legMask = 0.0;
    if (zone > 2.5 && zone < 3.5) {
      float innerLeg = smoothstep(0.04, -0.58, cc.x + edgeN * 0.45) * smoothstep(0.62, 0.34, y + edgeN * 0.4);
      float pawSocks = smoothstep(0.18 + sockW * 0.14, 0.05, y + edgeN * 0.35) * sockW;
      legMask = max(innerLeg * 0.92, pawSocks);
    }

    // Tail underside & subtle tip cream (outer/top curve stays red-brown)
    float tailMask = 0.0;
    if (zone > 3.5) {
      tailMask = smoothstep(0.50, 0.34, y + edgeN);
      tailMask = max(tailMask, smoothstep(-0.80, -0.96, z + edgeN * 0.5) * tipWhite);
    }

    // Ears stay richly colored on outer pinna
    float earKeep = (zone > 1.5 && zone < 2.5) ? 0.06 : 1.0;
    float sec = clamp(max(max(underMask, chestBib), max(max(faceUrajiro, collarMask), max(legMask, tailMask))) * earKeep, 0.0, 1.0);
    col = mix(uPrimaryColor, uSecondaryColor, sec);
    // Warm deeper chestnut-red dorsal shading along back, crown & tail top
    float dorsal = smoothstep(0.72, 0.98, y + edgeN * 0.5) * smoothstep(0.58, 0.10, ax) * (1.0 - sec) * dorsalDark;
    col = mix(col, uTertiaryColor, clamp(dorsal, 0.0, 0.62));
  } else if (uPattern < 2.5) {
    // TRICOLOR (Beagle): crisp white base + jet black saddle + rich chestnut-tan head/ears/flanks
    col = uPrimaryColor;
    float tanMask = 0.0;
    if (zone > 0.5 && zone < 2.5) {
      tanMask = smoothstep(0.42, 0.62, y + edgeN * 0.6);
      if (zone > 1.5) tanMask = 0.96;
      float muzzleWhite = smoothstep(1.30, 1.46, z + edgeN * 0.4) * smoothstep(0.68, 0.46, y);
      float blaze = smoothstep(0.18, 0.06, ax + edgeN * 0.25) * smoothstep(1.10, 1.24, z) * blazeW;
      tanMask *= (1.0 - clamp(max(muzzleWhite, blaze), 0.0, 0.95));
    } else if (zone < 0.5) {
      float band = smoothstep(0.46, 0.66, y + edgeN) * smoothstep(0.95, 0.65, z + edgeN);
      tanMask = band * 0.92;
    } else if (zone > 2.5 && zone < 3.5) {
      // Upper outer thigh/shoulder tan, white lower legs
      tanMask = smoothstep(0.32, 0.54, y + edgeN) * smoothstep(-0.35, 0.25, cc.x) * 0.90;
    } else if (zone > 3.5) {
      tanMask = smoothstep(-0.85, -0.50, z + edgeN) * smoothstep(0.45, 0.65, y);
    }
    col = mix(col, uSecondaryColor, clamp(tanMask, 0.0, 1.0));

    float blackSaddle = 0.0;
    if (zone < 0.5) {
      blackSaddle = smoothstep(0.58, 0.74, y + edgeN) * smoothstep(0.68, 0.36, z + edgeN) * smoothstep(-0.98, -0.68, z + edgeN);
    } else if (zone > 3.5) {
      blackSaddle = smoothstep(-0.58, -0.32, z + edgeN) * smoothstep(0.48, 0.68, y + edgeN);
    }
    col = mix(col, uTertiaryColor, clamp(blackSaddle, 0.0, 1.0));
    if (zone > 3.5 && tipWhite > 0.2) {
      float wt = smoothstep(-0.66, -0.82, z + edgeN * 0.5) * tipWhite;
      col = mix(col, uPrimaryColor, wt);
    }
  } else if (uPattern < 3.5) {
    // SADDLE / BLACK & TAN (Dachshund): deep glossy black coat + mahogany tan points
    col = uPrimaryColor;
    float tanPt = 0.0;
    if (zone > 0.5 && zone < 1.5) {
      tanPt = smoothstep(0.54, 0.34, y + edgeN * 0.5) * smoothstep(1.08, 1.32, z);
      vec2 browD = vec2((ax - 0.26) / 0.10, (y - 0.74) / 0.08);
      float browZ = smoothstep(1.14, 1.24, z) * smoothstep(1.36, 1.27, z);
      tanPt = max(tanPt, smoothstep(1.15, 0.35, length(browD)) * browZ * browW);
    } else if (zone < 0.5) {
      float chestPatch = smoothstep(0.62, 0.88, z + edgeN) * smoothstep(0.60, 0.34, y + edgeN) * smoothstep(0.58, 0.20, ax);
      float bellyTrim = smoothstep(0.42, 0.26, y + edgeN) * 0.55;
      tanPt = max(chestPatch, bellyTrim);
    } else if (zone > 2.5 && zone < 3.5) {
      float lowerTan = smoothstep(0.44, 0.18, y + edgeN * 0.5) * sockW;
      float innerTan = smoothstep(0.0, -0.60, cc.x + edgeN * 0.3) * 0.70;
      tanPt = max(lowerTan, innerTan);
    } else if (zone > 3.5) {
      tanPt = smoothstep(0.50, 0.32, y + edgeN) * 0.85;
    }
    col = mix(col, uSecondaryColor, clamp(tanPt, 0.0, 1.0));
  } else {
    // MASK (Siberian Husky): wolf-grey/charcoal dorsal coat + snow-white mask, chest, belly, legs
    float whiteMask = (zone < 0.5) ? smoothstep(0.60, 0.40, y + edgeN) : 0.0;
    float chestWhite = (zone < 0.5)
      ? smoothstep(0.54, 0.86, z + edgeN) * smoothstep(0.82, 0.54, y + edgeN)
      : 0.0;
    whiteMask = max(whiteMask, chestWhite);

    if (zone > 0.5 && zone < 1.5) {
      float capLine = 0.68 - 0.14 * smoothstep(0.28, 0.0, ax) + 0.12 * smoothstep(1.15, 1.38, z);
      float faceWhite = smoothstep(capLine + 0.08, capLine - 0.08, y + edgeN * 0.5);
      faceWhite = max(faceWhite, smoothstep(1.26, 1.40, z + edgeN * 0.4));
      float bar = smoothstep(0.13, 0.03, ax + edgeN * 0.2) * smoothstep(1.16, 1.28, z) * blazeW;
      whiteMask = clamp(max(faceWhite, bar), 0.0, 1.0);
    } else if (zone > 1.5 && zone < 2.5) {
      whiteMask = 0.04;
    } else if (zone > 2.5 && zone < 3.5) {
      float innerW = smoothstep(0.08, -0.52, cc.x + edgeN * 0.4);
      float sockWhite = smoothstep(0.50, 0.24, y + edgeN * 0.5) * sockW;
      whiteMask = max(innerW * 0.90, sockWhite);
    } else if (zone > 3.5) {
      whiteMask = max(smoothstep(0.58, 0.38, y + edgeN), smoothstep(-0.80, -0.96, z) * tipWhite);
    }

    col = mix(uPrimaryColor, uSecondaryColor, clamp(whiteMask, 0.0, 1.0));
    float darkCap = smoothstep(0.74, 0.96, y + edgeN * 0.5) * smoothstep(0.55, 0.12, ax) * (1.0 - whiteMask) * dorsalDark;
    col = mix(col, uTertiaryColor, clamp(darkCap, 0.0, 0.68));
  }

  // Subtle organic strand-to-strand tonal variation
  float toneVar = 1.0 + (fineTone - 0.5) * 0.11 + (clumpN - 0.5) * 0.08;
  col *= toneVar;
  return col;
}
`;

const FUR_FRAGMENT_COLOR = /* glsl */ `
{
  // Elongate sampling slightly along comb flow so hair groups into natural silky locks
  float longCoat = smoothstep(0.014, 0.028, uFurLength) * (1.0 - uCurl);
  vec3 cDir = length(vCombDir) > 0.001 ? normalize(vCombDir) : vec3(0.0, -0.30, -0.95);
  vec3 flowPos = vBodyPos - cDir * (dot(vBodyPos, cDir) * mix(0.32, 0.64, longCoat));

  // Cohesive lock/clump field (flowing locks on Golden/Husky, tight velvet grain on Shiba/Lab)
  float clumpScale = mix(26.0, 15.0, longCoat) + uCurl * 14.0 - uWetness * 4.0;
  float clumpN = fur_noise3(flowPos * clumpScale);
  float clumpDetail = fur_noise3(flowPos * (clumpScale * 2.1) + vec3(4.3, 1.9, 7.1));
  float lockMask = mix(clumpN, clumpN * 0.65 + clumpDetail * 0.35, 0.5);

  // Fine high-frequency strand cellular lookup
  vec3 strandPos = flowPos * uStrandFreq + vec3(clumpN * (0.32 + longCoat * 0.52 + uWetness * 0.45));
  vec2 cell = fur_cell3D(strandPos);
  float dist = cell.x;
  float strandId = cell.y;

  float shellAlpha = 1.0;
  if (uIsShell > 0.5) {
    float h = clamp(vShellHeight, 0.0, 1.0);
    // Short coats have even plush length; long coats taper into cohesive flowing locks
    float heightSpread = mix(0.22, 0.48, longCoat + uWetness * 0.35);
    float lockHeight = mix(0.76, 1.04, lockMask);
    float strandHeight = mix(1.0 - heightSpread, 1.02, strandId);
    float maxH = clamp(mix(strandHeight, lockHeight * strandHeight, 0.42 + longCoat * 0.38), 0.25, 1.02);

    float normH = clamp(h / max(maxH, 0.01), 0.0, 1.0);
    float taperPow = mix(0.78, 0.52, uCurl);
    float radius = mix(0.80, 0.16, pow(max(normH, 0.0001), taperPow));
    radius *= mix(1.0, 0.72 + 0.48 * lockMask, longCoat * 0.55 + uWetness * 0.65);

    // Smooth anti-aliased strand mask + gentle root-to-tip alpha fade (zero harsh dotty noise)
    float strandCov = 1.0 - smoothstep(max(0.0, radius - 0.14), radius + 0.14, dist);
    float tipCov = 1.0 - smoothstep(maxH * 0.70, maxH + 0.06, h);
    float rootToTipFade = pow(max(1.0 - h * 0.92, 0.001), mix(1.15, 1.48, longCoat));

    shellAlpha = strandCov * tipCov * rootToTipFade * mix(0.72, 0.58, longCoat);
    if (shellAlpha < 0.015) {
      discard;
    }
  }

  vec3 coatCol = fur_computeCoatColor(vCoatCoord, vBodyPos, strandId, clumpN);

  // Root-to-tip depth shading: darker richly-saturated roots, brighter tips for 3D coat depth
  float hClamped = clamp(vShellHeight, 0.0, 1.0);
  vec3 rootCol = coatCol * coatCol * 0.40 + coatCol * 0.26;
  vec3 tipCol = coatCol * (1.04 + 0.12 * smoothstep(0.50, 1.0, hClamped));
  float depthCurve = pow(max(hClamped, 0.0001), 0.68);
  coatCol = uIsShell > 0.5 ? mix(rootCol, tipCol, depthCurve) : (rootCol * 0.92);

  // Subtle lock-valley ambient shading so long locks read as sculpted flowing tufts
  float lockAO = mix(0.84, 1.08, lockMask);
  coatCol *= mix(1.0, lockAO, 0.30 + longCoat * 0.38);

  // Wetness darkens coat (water-saturated fur absorbs more light)
  coatCol *= mix(1.0, 0.62, uWetness);

  // Dirtiness accumulates organically on lower paws, lower legs, belly, and muzzle tip
  if (uDirt > 0.005) {
    float lowZone = smoothstep(0.44, 0.08, vCoatCoord.y);
    float snoutDirt = (vCoatCoord.w > 0.5 && vCoatCoord.w < 1.5)
      ? smoothstep(1.26, 1.48, vCoatCoord.z) * 0.75
      : 0.0;
    float dirtPatch = fur_noise3(vBodyPos * 14.0 + vec3(3.1, 1.7, 5.4));
    float dirtAmt = clamp(max(lowZone, snoutDirt) * smoothstep(0.28, 0.75, dirtPatch) * uDirt, 0.0, 0.85);
    vec3 mudCol = vec3(0.22, 0.15, 0.10) * mix(0.65, 1.0, hClamped);
    coatCol = mix(coatCol, mudCol, dirtAmt);
  }

  // Snow dusting settles on upward-facing surfaces and outer fur tips
  if (uSnow > 0.005) {
    float upMask = smoothstep(0.28, 0.82, vWorldNormalFur.y);
    float flakeN = fur_noise3(vBodyPos * 28.0 + vec3(9.2, 4.1, 2.3));
    float tipMask = uIsShell > 0.5 ? smoothstep(0.22, 0.78, hClamped) : 0.15;
    float snowAmt = clamp(upMask * tipMask * smoothstep(0.30, 0.74, flakeN) * uSnow * 1.25, 0.0, 0.92);
    vec3 snowCol = vec3(0.93, 0.96, 1.0);
    coatCol = mix(coatCol, snowCol, snowAmt);
  }

  diffuseColor.rgb = coatCol;
  diffuseColor.a = shellAlpha;
}
`;

const FUR_FRAGMENT_ROUGHNESS = /* glsl */ `
{
  // Dry fur has soft natural sheen; sleek short coats have healthy gloss; wet fur gleams
  float baseRough = mix(0.84, 0.34, uWetness);
  baseRough -= (1.0 - uFluffiness) * 0.20;
  baseRough -= vShellHeight * 0.06;
  roughnessFactor = clamp(mix(baseRough, 0.58, uSnow * smoothstep(0.35, 0.85, vWorldNormalFur.y)), 0.24, 0.95);
}
`;

function createFurMaterial(uniforms, isShell, breed) {
  // Subtle warm sheen tinted from primary coat (never chalky white washout!)
  const sheenTint = new THREE.Color(breed.primaryColor)
    .lerp(new THREE.Color(breed.secondaryColor), 0.35)
    .lerp(new THREE.Color('#fff6e5'), 0.12);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.0,
    sheen: isShell ? 0.24 + breed.fluffiness * 0.16 : 0.16,
    sheenRoughness: 0.72,
    sheenColor: sheenTint,
    side: THREE.FrontSide,
    transparent: isShell,
    depthWrite: !isShell,
  });

  mat.customProgramCacheKey = () => (isShell ? 'dog-shell-fur-v4' : 'dog-base-fur-v4');
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.uIsShell = { value: isShell ? 1.0 : 0.0 };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FUR_VERTEX_PREAMBLE}`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>\n${FUR_VERTEX_DISPLACE}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FUR_FRAGMENT_PREAMBLE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FUR_FRAGMENT_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FUR_FRAGMENT_ROUGHNESS}`);
  };
  return mat;
}

// ============================================================================
// Organic Sculpted Loft Geometry & Shell Stack Builder
// ============================================================================

function createOrganicLoft(sections, radialSegs, bodyTransformFn) {
  const numRings = sections.length;
  const cols = radialSegs + 1;

  const positions = [];
  const uvs = [];
  const bodyPositions = [];
  const combDirs = [];
  const furScales = [];
  const coatCoords = [];
  const indices = [];

  const tmpLocal = new THREE.Vector3();
  const tmpBody = new THREE.Vector3();

  for (let i = 0; i < numRings; i++) {
    const s = sections[i];
    const [cx, cy, cz] = s.pos;
    const rx = s.rx;
    const ry = s.ry;
    const axis = s.axis || 'z';
    const topFlat = s.topFlat || 0;
    const bottomPinch = s.bottomPinch || 0;
    const sideShiftY = s.sideShiftY || 0;
    const furScale = s.furScale !== undefined ? s.furScale : 1.0;
    const coatZ = s.coatZ !== undefined ? s.coatZ : 0.0;
    const coatYCenter = s.coatYCenter !== undefined ? s.coatYCenter : 0.65;
    const coatYSpan = s.coatYSpan !== undefined ? s.coatYSpan : 0.25;
    const coatXSpan = s.coatXSpan !== undefined ? s.coatXSpan : 0.85;
    const coatZone = s.coatZone !== undefined ? s.coatZone : 0.0;
    const comb = s.combDir || (axis === 'z' ? [0, -0.32, -0.94] : [0, -0.94, -0.32]);
    const backFeather = s.backFeather || 0;
    const bottomFeather = s.bottomFeather || 0;
    const vCoord = i / Math.max(1, numRings - 1);

    for (let j = 0; j <= radialSegs; j++) {
      const uCoord = j / radialSegs;
      const a = uCoord * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      let lx, ly, lz;
      let normX, normY, normZ, backFactor, bottomFactor;

      if (axis === 'z') {
        // Cross section in XY plane: ca = +X, sa = +Y
        let sx = ca;
        let sy = sa;
        if (sy > 0 && topFlat > 0) {
          sy = Math.pow(sy, 1.0 - topFlat * 0.45) * (1.0 - topFlat * 0.14);
        }
        if (sy < 0 && bottomPinch > 0) {
          sx *= 1.0 - bottomPinch * (-sy);
        }
        sy += sideShiftY * (1.0 - sy * sy);
        lx = cx + sx * rx;
        ly = cy + sy * ry;
        lz = cz;
        normX = sx;
        normY = sy;
        normZ = 0;
        backFactor = 0;
        bottomFactor = Math.max(0, -sy);
      } else {
        // Cross section in XZ plane (for legs/neck/ears): ca = +X, sa = +Z
        let sx = ca;
        let sz = sa;
        if (sz < 0 && bottomPinch > 0) {
          sx *= 1.0 - bottomPinch * (-sz);
        }
        lx = cx + sx * rx;
        ly = cy;
        lz = cz + sz * ry;
        normX = sx;
        normY = 0;
        normZ = sz;
        backFactor = Math.max(0, -sz);
        bottomFactor = 0;
      }

      positions.push(lx, ly, lz);
      uvs.push(uCoord, vCoord);

      tmpLocal.set(lx, ly, lz);
      if (bodyTransformFn) {
        bodyTransformFn(tmpLocal, tmpBody);
      } else {
        tmpBody.copy(tmpLocal);
      }
      bodyPositions.push(tmpBody.x, tmpBody.y, tmpBody.z);

      combDirs.push(comb[0], comb[1], comb[2]);

      const fScale = furScale * (1.0 + backFactor * backFeather + bottomFactor * bottomFeather);
      furScales.push(fScale);

      const ccX = s.coatXOffset !== undefined ? s.coatXOffset + normX * coatXSpan : normX * coatXSpan;
      // On neck (axis 'y', coatZone 0), +Z is ventral throat (lower Y) and -Z is dorsal nape (higher Y)
      const ccY = axis === 'z'
        ? coatYCenter + normY * coatYSpan
        : (coatZone === 0 ? coatYCenter - normZ * coatYSpan : coatYCenter);
      coatCoords.push(ccX, ccY, coatZ, coatZone);
    }
  }

  for (let i = 0; i < numRings - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      if (sections[0].axis === 'y') {
        const dirY = sections[numRings - 1].pos[1] - sections[0].pos[1];
        if (dirY < 0) {
          indices.push(a, d, b, b, d, c);
        } else {
          indices.push(a, b, d, b, c, d);
        }
      } else {
        const dirZ = sections[numRings - 1].pos[2] - sections[0].pos[2];
        if (dirZ >= 0) {
          indices.push(a, d, b, b, d, c);
        } else {
          indices.push(a, b, d, b, c, d);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aBodyPos', new THREE.Float32BufferAttribute(bodyPositions, 3));
  geo.setAttribute('aCombDir', new THREE.Float32BufferAttribute(combDirs, 3));
  geo.setAttribute('aFurScale', new THREE.Float32BufferAttribute(furScales, 1));
  geo.setAttribute('aCoatCoord', new THREE.Float32BufferAttribute(coatCoords, 4));
  geo.setAttribute('aShellHeight', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3), 1));
  geo.computeVertexNormals();

  // Weld seam normals (j=0 and j=radialSegs) so shell extrusion never splits at the UV seam
  const normAttr = geo.getAttribute('normal');
  for (let i = 0; i < numRings; i++) {
    const i0 = i * cols;
    const i1 = i * cols + radialSegs;
    const nx = normAttr.getX(i0) + normAttr.getX(i1);
    const ny = normAttr.getY(i0) + normAttr.getY(i1);
    const nz = normAttr.getZ(i0) + normAttr.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    normAttr.setXYZ(i0, nx / len, ny / len, nz / len);
    normAttr.setXYZ(i1, nx / len, ny / len, nz / len);
  }
  normAttr.needsUpdate = true;

  return geo;
}

const IDENTITY_MAT4 = new THREE.Matrix4();

function smoothstep01(edge0, edge1, x) {
  const denom = edge1 - edge0;
  if (denom <= 1e-6) return x >= edge1 ? 1.0 : 0.0;
  const t = THREE.MathUtils.clamp((x - edge0) / denom, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

function lerpOpt(a, b, t, fallback = 0) {
  const va = a !== undefined ? a : fallback;
  const vb = b !== undefined ? b : fallback;
  return va + (vb - va) * t;
}

/**
 * Resamples anatomical control stations along a smooth centripetal Catmull-Rom curve.
 * Returns { rings, stationRingIndex, arcLengths }.
 */
function resampleSections(stations, subsPerSpan = 2) {
  const n = stations.length;
  const pts = stations.map((s) => new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);

  const rings = [];
  const stationRingIndex = new Array(n);
  const tmpP = new THREE.Vector3();

  for (let k = 0; k < n - 1; k++) {
    const subs = Array.isArray(subsPerSpan) ? subsPerSpan[k] : subsPerSpan;
    const s0 = stations[k];
    const s1 = stations[k + 1];
    stationRingIndex[k] = rings.length;

    const steps = Math.max(1, subs);
    const limit = k === n - 2 ? steps : steps - 1;
    for (let j = 0; j <= limit; j++) {
      const f = j / steps;
      const u = (k + f) / (n - 1);
      curve.getPoint(u, tmpP);

      const ring = {
        pos: [tmpP.x, tmpP.y, tmpP.z],
        rx: lerpOpt(s0.rx, s1.rx, f, 0.01),
        ry: lerpOpt(s0.ry, s1.ry, f, 0.01),
        topFlat: lerpOpt(s0.topFlat, s1.topFlat, f, 0),
        bottomFlat: lerpOpt(s0.bottomFlat, s1.bottomFlat, f, 0),
        bottomPinch: lerpOpt(s0.bottomPinch, s1.bottomPinch, f, 0),
        sideShiftY: lerpOpt(s0.sideShiftY, s1.sideShiftY, f, 0),
        furScale: lerpOpt(s0.furScale, s1.furScale, f, 1.0),
        coatZ: lerpOpt(s0.coatZ, s1.coatZ, f, 0.0),
        coatYCenter: lerpOpt(s0.coatYCenter, s1.coatYCenter, f, 0.65),
        coatYSpan: lerpOpt(s0.coatYSpan, s1.coatYSpan, f, 0.25),
        coatXOffset: lerpOpt(s0.coatXOffset, s1.coatXOffset, f, 0.0),
        coatXSpan: lerpOpt(s0.coatXSpan, s1.coatXSpan, f, 0.85),
        coatZone: s0.coatZone !== undefined ? s0.coatZone : 0.0,
        backFeather: lerpOpt(s0.backFeather, s1.backFeather, f, 0),
        bottomFeather: lerpOpt(s0.bottomFeather, s1.bottomFeather, f, 0),
      };

      if (s0.combDir && s1.combDir) {
        const cx = s0.combDir[0] + (s1.combDir[0] - s0.combDir[0]) * f;
        const cy = s0.combDir[1] + (s1.combDir[1] - s0.combDir[1]) * f;
        const cz = s0.combDir[2] + (s1.combDir[2] - s0.combDir[2]) * f;
        const cl = Math.hypot(cx, cy, cz) || 1;
        ring.combDir = [cx / cl, cy / cl, cz / cl];
      } else if (s0.combDir) {
        ring.combDir = s0.combDir;
      }

      if (j === 0 && s0.dir) ring.dir = s0.dir;
      if (j === steps && s1.dir) ring.dir = s1.dir;

      rings.push(ring);
    }
  }
  stationRingIndex[n - 1] = rings.length - 1;

  const arcLengths = new Float32Array(rings.length);
  arcLengths[0] = 0;
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1].pos;
    const b = rings[i].pos;
    arcLengths[i] = arcLengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }

  return { rings, stationRingIndex, arcLengths };
}

/**
 * Smoothly distributes 2-bone skin weights across each joint boundary along a bone chain.
 * `jointArcs` has length `numBones - 1` (boundary between bone k and bone k+1).
 */
function assignChainWeights(rings, arcLengths, jointArcs, targetBlendWidth = 0.065) {
  const numJoints = jointArcs.length;
  const totalLen = arcLengths[arcLengths.length - 1] || 1e-4;
  const halfWidths = new Float32Array(numJoints);

  for (let k = 0; k < numJoints; k++) {
    const prevArc = k === 0 ? 0 : jointArcs[k - 1];
    const nextArc = k === numJoints - 1 ? totalLen : jointArcs[k + 1];
    const segBefore = Math.max(0.004, jointArcs[k] - prevArc);
    const segAfter = Math.max(0.004, nextArc - jointArcs[k]);
    const wantHalf = (Array.isArray(targetBlendWidth) ? targetBlendWidth[k] : targetBlendWidth) * 0.5;
    halfWidths[k] = Math.min(wantHalf, segBefore * 0.46, segAfter * 0.46);
  }

  for (let i = 0; i < rings.length; i++) {
    const s = arcLengths[i];
    // Find owning bone index
    let bone = 0;
    while (bone < numJoints && s >= jointArcs[bone]) {
      bone++;
    }

    let b0 = bone;
    let w0 = 1.0;
    let b1 = 0;
    let w1 = 0.0;

    // Check blend with previous bone across joint (bone - 1)
    if (bone > 0) {
      const jc = jointArcs[bone - 1];
      const hw = halfWidths[bone - 1];
      if (s < jc + hw) {
        const t = smoothstep01(jc - hw, jc + hw, s);
        b0 = bone - 1;
        w0 = 1.0 - t;
        b1 = bone;
        w1 = t;
      }
    }
    // Check blend with next bone across joint (bone)
    if (bone < numJoints && w1 === 0.0) {
      const jc = jointArcs[bone];
      const hw = halfWidths[bone];
      if (s > jc - hw) {
        const t = smoothstep01(jc - hw, jc + hw, s);
        b0 = bone;
        w0 = 1.0 - t;
        b1 = bone + 1;
        w1 = t;
      }
    }

    rings[i].skinIndices = [b0, b1, 0, 0];
    rings[i].skinWeights = [w0, w1, 0, 0];
  }
}

/**
 * Smoothly distributes skin weights along a continuous leg:
 *   Bone 0 = chest/pelvis (torso anchor), Bone 1 = shoulder/hip (abduction),
 *   Bone 2 = upper, Bone 3 = lower, Bone 4 = paw.
 */
function assignLegWeights(rings, arcLengths, sJoint0, sJoint1, sJoint2) {
  const totalLen = arcLengths[arcLengths.length - 1] || 1e-4;
  const upperLen = Math.max(0.015, sJoint1 - sJoint0);
  const lowerLen = Math.max(0.015, sJoint2 - sJoint1);
  const pawLen = Math.max(0.015, totalLen - sJoint2);

  // 5-7cm smooth blends across every joint (clamped safely for short-legged breeds)
  const hwHip = Math.min(0.034, upperLen * 0.44);
  const hwElbow = Math.min(0.035, upperLen * 0.44, lowerLen * 0.44);
  const hwPaw = Math.min(0.028, lowerLen * 0.44, pawLen * 0.48);
  const torsoBlendEnd = Math.max(0.008, sJoint0 * 0.88);

  for (let i = 0; i < rings.length; i++) {
    const s = arcLengths[i];

    if (s <= sJoint0 + hwHip) {
      // Smoothly transition torso anchor -> shoulder/hip -> upper arm/thigh
      const fTorso = 1.0 - smoothstep01(0.0, torsoBlendEnd, s);
      const fUpper = smoothstep01(sJoint0 - hwHip, sJoint0 + hwHip, s);
      const wTorso = fTorso;
      const wRoot = (1.0 - fTorso) * (1.0 - fUpper);
      const wUpper = (1.0 - fTorso) * fUpper;
      const sum = wTorso + wRoot + wUpper || 1.0;
      rings[i].skinIndices = [0, 1, 2, 0];
      rings[i].skinWeights = [wTorso / sum, wRoot / sum, wUpper / sum, 0];
    } else if (s < sJoint1 - hwElbow) {
      rings[i].skinIndices = [2, 0, 0, 0];
      rings[i].skinWeights = [1, 0, 0, 0];
    } else if (s <= sJoint1 + hwElbow) {
      const t = smoothstep01(sJoint1 - hwElbow, sJoint1 + hwElbow, s);
      rings[i].skinIndices = [2, 3, 0, 0];
      rings[i].skinWeights = [1.0 - t, t, 0, 0];
    } else if (s < sJoint2 - hwPaw) {
      rings[i].skinIndices = [3, 0, 0, 0];
      rings[i].skinWeights = [1, 0, 0, 0];
    } else if (s <= sJoint2 + hwPaw) {
      const t = smoothstep01(sJoint2 - hwPaw, sJoint2 + hwPaw, s);
      rings[i].skinIndices = [3, 4, 0, 0];
      rings[i].skinWeights = [1.0 - t, t, 0, 0];
    } else {
      rings[i].skinIndices = [4, 0, 0, 0];
      rings[i].skinWeights = [1, 0, 0, 0];
    }
  }
}

/**
 * Builds a continuous 3D swept tubular BufferGeometry in bind-pose root space
 * with smooth swept frames (R = +X, U = cross(T, R)), coat coordinates, and skinning attributes.
 */
function createSkinnedTube(sections, radialSegs, options = {}) {
  const numRings = sections.length;
  const cols = radialSegs + 1;
  const invertU = Boolean(options.invertU);
  const autoCombFromTangent = options.autoCombFromTangent || null;
  const useCoatYSpan = options.useCoatYSpan !== false;

  // Compute smooth unit tangents along the tube centerline
  const tangents = new Array(numRings);
  const vPrev = new THREE.Vector3();
  const vNext = new THREE.Vector3();
  for (let i = 0; i < numRings; i++) {
    const s = sections[i];
    if (s.dir) {
      tangents[i] = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]).normalize();
      continue;
    }
    const p = s.pos;
    if (i === 0) {
      const q = sections[1].pos;
      tangents[i] = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize();
    } else if (i === numRings - 1) {
      const q = sections[i - 1].pos;
      tangents[i] = new THREE.Vector3(p[0] - q[0], p[1] - q[1], p[2] - q[2]).normalize();
    } else {
      const p0 = sections[i - 1].pos;
      const p1 = sections[i + 1].pos;
      vPrev.set(p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]);
      vNext.set(p1[0] - p[0], p1[1] - p[1], p1[2] - p[2]);
      if (vPrev.lengthSq() > 1e-10) vPrev.normalize();
      if (vNext.lengthSq() > 1e-10) vNext.normalize();
      const t = vPrev.clone().add(vNext);
      if (t.lengthSq() < 1e-8) t.copy(vNext.lengthSq() > 1e-8 ? vNext : new THREE.Vector3(0, 0, 1));
      tangents[i] = t.normalize();
    }
  }

  const positions = [];
  const uvs = [];
  const bodyPositions = [];
  const combDirs = [];
  const furScales = [];
  const coatCoords = [];
  const skinIndices = [];
  const skinWeights = [];
  const indices = [];

  const R = new THREE.Vector3();
  const U = new THREE.Vector3();
  const tmpComb = new THREE.Vector3();

  for (let i = 0; i < numRings; i++) {
    const s = sections[i];
    const [cx, cy, cz] = s.pos;
    const rx = s.rx;
    const ry = s.ry;
    const T = tangents[i];

    // Orthonormal swept frame: R projects +X perpendicular to T, U = cross(T, R)
    R.set(1 - T.x * T.x, -T.x * T.y, -T.x * T.z);
    if (R.lengthSq() < 1e-6) R.set(0, 0, 1);
    R.normalize();
    U.crossVectors(T, R).normalize();

    const topFlat = s.topFlat || 0;
    const bottomFlat = s.bottomFlat || 0;
    const bottomPinch = s.bottomPinch || 0;
    const sideShiftY = s.sideShiftY || 0;
    const furScale = s.furScale !== undefined ? s.furScale : 1.0;
    const coatZ = s.coatZ !== undefined ? s.coatZ : 0.0;
    const coatYCenter = s.coatYCenter !== undefined ? s.coatYCenter : 0.65;
    const coatYSpan = s.coatYSpan !== undefined ? s.coatYSpan : 0.25;
    const coatXOffset = s.coatXOffset !== undefined ? s.coatXOffset : 0.0;
    const coatXSpan = s.coatXSpan !== undefined ? s.coatXSpan : 0.85;
    const coatZone = s.coatZone !== undefined ? s.coatZone : 0.0;
    const backFeather = s.backFeather || 0;
    const bottomFeather = s.bottomFeather || 0;
    const si = s.skinIndices || [0, 0, 0, 0];
    const sw = s.skinWeights || [1, 0, 0, 0];
    const vCoord = i / Math.max(1, numRings - 1);

    let combX, combY, combZ;
    if (s.combDir) {
      combX = s.combDir[0];
      combY = s.combDir[1];
      combZ = s.combDir[2];
    } else if (autoCombFromTangent) {
      tmpComb.set(0, 0, 0)
        .addScaledVector(T, autoCombFromTangent.t || 0)
        .addScaledVector(U, autoCombFromTangent.u || 0);
      if (tmpComb.lengthSq() > 1e-8) tmpComb.normalize();
      combX = tmpComb.x;
      combY = tmpComb.y;
      combZ = tmpComb.z;
    } else {
      combX = 0;
      combY = -0.32;
      combZ = -0.94;
    }

    for (let j = 0; j <= radialSegs; j++) {
      const uCoord = j / radialSegs;
      const a = uCoord * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      let sx = ca;
      let sy = sa;
      if (sy > 0 && topFlat > 0) {
        sy = Math.pow(sy, 1.0 - topFlat * 0.45) * (1.0 - topFlat * 0.14);
      }
      if (sy < 0 && bottomFlat > 0) {
        sy = -Math.pow(-sy, 1.0 - bottomFlat * 0.45) * (1.0 - bottomFlat * 0.22);
      }
      if (sy < 0 && bottomPinch > 0) {
        sx *= 1.0 - bottomPinch * (-sy);
      }
      sy += sideShiftY * (1.0 - sy * sy);

      const lx = cx + R.x * (sx * rx) + U.x * (sy * ry);
      const ly = cy + R.y * (sx * rx) + U.y * (sy * ry);
      const lz = cz + R.z * (sx * rx) + U.z * (sy * ry);

      positions.push(lx, ly, lz);
      uvs.push(uCoord, vCoord);
      bodyPositions.push(lx, ly, lz);
      combDirs.push(combX, combY, combZ);

      const uSign = invertU ? -sy : sy;
      const backFactor = Math.max(0, -sy);
      const bottomFactor = Math.max(0, -uSign);
      furScales.push(furScale * (1.0 + backFactor * backFeather + bottomFactor * bottomFeather));

      const ccX = coatXOffset + sx * coatXSpan;
      const ccY = useCoatYSpan ? (coatYCenter + uSign * coatYSpan) : coatYCenter;
      coatCoords.push(ccX, ccY, coatZ, coatZone);

      skinIndices.push(si[0], si[1], si[2], si[3]);
      skinWeights.push(sw[0], sw[1], sw[2], sw[3]);
    }
  }

  for (let i = 0; i < numRings - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aBodyPos', new THREE.Float32BufferAttribute(bodyPositions, 3));
  geo.setAttribute('aCombDir', new THREE.Float32BufferAttribute(combDirs, 3));
  geo.setAttribute('aFurScale', new THREE.Float32BufferAttribute(furScales, 1));
  geo.setAttribute('aCoatCoord', new THREE.Float32BufferAttribute(coatCoords, 4));
  geo.setAttribute('aShellHeight', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3), 1));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  if (options.postProcess) {
    options.postProcess(geo);
  }

  geo.computeVertexNormals();
  weldSeamNormals(geo, numRings, radialSegs);
  return geo;
}

function weldSeamNormals(geo, numRings, radialSegs) {
  const cols = radialSegs + 1;
  const normAttr = geo.getAttribute('normal');
  for (let i = 0; i < numRings; i++) {
    const i0 = i * cols;
    const i1 = i * cols + radialSegs;
    const nx = normAttr.getX(i0) + normAttr.getX(i1);
    const ny = normAttr.getY(i0) + normAttr.getY(i1);
    const nz = normAttr.getZ(i0) + normAttr.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    normAttr.setXYZ(i0, nx / len, ny / len, nz / len);
    normAttr.setXYZ(i1, nx / len, ny / len, nz / len);
  }
  normAttr.needsUpdate = true;
}

/**
 * Packs `layers` concentric shell copies of `baseGeo` into a single BufferGeometry (1 draw call).
 * Drawn innermost-to-outermost so smooth translucent alpha blends cleanly.
 * Automatically preserves skinIndex and skinWeight when present on `baseGeo`.
 */
function createShellGeometry(baseGeo, layers = 20) {
  const posAttr = baseGeo.getAttribute('position');
  const normAttr = baseGeo.getAttribute('normal');
  const uvAttr = baseGeo.getAttribute('uv');
  const bodyAttr = baseGeo.getAttribute('aBodyPos');
  const combAttr = baseGeo.getAttribute('aCombDir');
  const scaleAttr = baseGeo.getAttribute('aFurScale');
  const coatAttr = baseGeo.getAttribute('aCoatCoord');
  const skinIdxAttr = baseGeo.getAttribute('skinIndex');
  const skinWgtAttr = baseGeo.getAttribute('skinWeight');
  const hasSkinning = Boolean(skinIdxAttr && skinWgtAttr);
  const baseIdx = baseGeo.getIndex();

  const vCount = posAttr.count;
  const iCount = baseIdx ? baseIdx.count : vCount;

  const totalV = vCount * layers;
  const totalI = iCount * layers;

  const positions = new Float32Array(totalV * 3);
  const normals = new Float32Array(totalV * 3);
  const uvs = new Float32Array(totalV * 2);
  const bodyPos = new Float32Array(totalV * 3);
  const combDir = new Float32Array(totalV * 3);
  const furScale = new Float32Array(totalV);
  const coatCoord = new Float32Array(totalV * 4);
  const shellHeight = new Float32Array(totalV);
  const indices = new Uint32Array(totalI);
  const skinIndices = hasSkinning ? new Uint16Array(totalV * 4) : null;
  const skinWeights = hasSkinning ? new Float32Array(totalV * 4) : null;

  for (let l = 0; l < layers; l++) {
    const h = (l + 1) / layers;
    const vOff = l * vCount;
    const iOff = l * iCount;

    positions.set(posAttr.array, vOff * 3);
    normals.set(normAttr.array, vOff * 3);
    uvs.set(uvAttr.array, vOff * 2);
    bodyPos.set(bodyAttr.array, vOff * 3);
    combDir.set(combAttr.array, vOff * 3);
    furScale.set(scaleAttr.array, vOff);
    coatCoord.set(coatAttr.array, vOff * 4);
    shellHeight.fill(h, vOff, vOff + vCount);
    if (hasSkinning) {
      skinIndices.set(skinIdxAttr.array, vOff * 4);
      skinWeights.set(skinWgtAttr.array, vOff * 4);
    }

    if (baseIdx) {
      for (let k = 0; k < iCount; k++) {
        indices[iOff + k] = baseIdx.getX(k) + vOff;
      }
    } else {
      for (let k = 0; k < iCount; k++) {
        indices[iOff + k] = k + vOff;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aBodyPos', new THREE.BufferAttribute(bodyPos, 3));
  geo.setAttribute('aCombDir', new THREE.BufferAttribute(combDir, 3));
  geo.setAttribute('aFurScale', new THREE.BufferAttribute(furScale, 1));
  geo.setAttribute('aCoatCoord', new THREE.BufferAttribute(coatCoord, 4));
  geo.setAttribute('aShellHeight', new THREE.BufferAttribute(shellHeight, 1));
  if (hasSkinning) {
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  }
  return geo;
}

/**
 * Helper to create a furred part (opaque solid base + single combined multi-shell mesh).
 */
function addFurredPart(parent, baseGeo, baseMat, shellMat, layers, disposables) {
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.renderOrder = 0;
  parent.add(baseMesh);

  const shellGeo = createShellGeometry(baseGeo, layers);
  const shellMesh = new THREE.Mesh(shellGeo, shellMat);
  shellMesh.castShadow = false;
  shellMesh.receiveShadow = true;
  shellMesh.renderOrder = 1;
  parent.add(shellMesh);

  disposables.geometries.push(baseGeo, shellGeo);
  return { baseMesh, shellMesh };
}

/**
 * Helper to create a continuous skinned furred part (opaque base SkinnedMesh + shared-skeleton shell SkinnedMesh).
 */
function addSkinnedFurredPart(parent, baseGeo, baseMat, shellMat, layers, skeleton, disposables) {
  const baseMesh = new THREE.SkinnedMesh(baseGeo, baseMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.renderOrder = 0;
  baseMesh.frustumCulled = false;
  baseMesh.bind(skeleton, IDENTITY_MAT4);
  parent.add(baseMesh);

  const shellGeo = createShellGeometry(baseGeo, layers);
  const shellMesh = new THREE.SkinnedMesh(shellGeo, shellMat);
  shellMesh.castShadow = false;
  shellMesh.receiveShadow = true;
  shellMesh.renderOrder = 1;
  shellMesh.frustumCulled = false;
  shellMesh.bind(skeleton, IDENTITY_MAT4);
  parent.add(shellMesh);

  disposables.geometries.push(baseGeo, shellGeo);
  return { baseMesh, shellMesh };
}

// ============================================================================
// Specialized Anatomical Builders (Head, Ears, Paws, Nose, Lips, Eyes)
// ============================================================================

function buildHeadGeometry(breed, bodyTransformFn, eyeCoords) {
  const hs = breed.headSize;
  const ml = breed.muzzleLength;
  const mw = hs * breed.muzzleWidth * 0.74;
  const mh = hs * breed.muzzleHeight * 0.62;
  const stop = breed.stopDepth;
  const cheek = 1.0 + breed.cheekFluff * 0.24;
  const puff = breed.curl * 0.16;

  // Continuous sculpted cranium -> plump cheeks -> orbital stop -> nasal bridge -> muzzle tip
  const sections = [
    // Occiput (back of skull)
    { pos: [0, hs * 0.10, -hs * 0.92], rx: hs * 0.14, ry: hs * 0.13, furScale: 0.72, coatZ: 1.06, coatYCenter: 0.80, coatYSpan: 0.10, coatXSpan: 0.16, coatZone: 1, combDir: [0, -0.38, -0.92] },
    { pos: [0, hs * 0.10, -hs * 0.72], rx: hs * 0.58, ry: hs * 0.56, topFlat: 0.14, furScale: 0.80, coatZ: 1.10, coatYCenter: 0.76, coatYSpan: 0.24, coatXSpan: 0.62, coatZone: 1, combDir: [0, -0.34, -0.94] },
    // Crown & plump cheeks (zygomatic arches)
    { pos: [0, hs * 0.08, -hs * 0.26], rx: hs * 0.80 * cheek, ry: hs * 0.74 * (1 + puff * 0.32), topFlat: 0.16, sideShiftY: -0.10, furScale: 0.86 + breed.cheekFluff * 0.30, coatZ: 1.15, coatYCenter: 0.68, coatYSpan: 0.32, coatXSpan: 0.92, coatZone: 1, combDir: [0, -0.28, -0.95] },
    // Forehead & full cheek width
    { pos: [0, hs * 0.06, hs * 0.16], rx: hs * 0.76 * cheek, ry: hs * 0.70 * (1 + puff * 0.24), topFlat: 0.18, bottomPinch: 0.06, sideShiftY: -0.11, furScale: 0.54 + breed.cheekFluff * 0.22, coatZ: 1.22, coatYCenter: 0.66, coatYSpan: 0.30, coatXSpan: 0.84, coatZone: 1, combDir: [0, -0.22, -0.97] },
    // Facial stop / orbital plane (eyes sit cleanly on this forward-angled transition)
    { pos: [0, hs * (0.01 - stop * 0.10), hs * 0.44], rx: hs * 0.58 * (1 + puff * 0.18), ry: hs * (0.48 - stop * 0.08), topFlat: 0.20, bottomPinch: 0.10, furScale: 0.20 + puff * 0.26, coatZ: 1.30, coatYCenter: 0.60, coatYSpan: 0.24, coatXSpan: 0.58, coatZone: 1, combDir: [0, -0.18, -0.98] },
    // Muzzle base (nasal bridge + upper lips/flews)
    { pos: [0, -hs * (0.05 + stop * 0.11), hs * 0.46 + ml * 0.38], rx: mw * (1.12 + puff * 0.22), ry: mh * (1.06 + puff * 0.18), topFlat: 0.26, bottomPinch: 0.05, sideShiftY: -0.12, furScale: 0.18 + puff * 0.36, coatZ: 1.39, coatYCenter: 0.54, coatYSpan: 0.18, coatXSpan: 0.44, coatZone: 1, combDir: [0, -0.14, -0.99] },
    // Front muzzle (whisker pads)
    { pos: [0, -hs * (0.06 + stop * 0.11), hs * 0.46 + ml * 0.82], rx: mw * (0.88 + puff * 0.16), ry: mh * (0.86 + puff * 0.14), topFlat: 0.28, sideShiftY: -0.08, furScale: 0.14 + puff * 0.28, coatZ: 1.47, coatYCenter: 0.52, coatYSpan: 0.14, coatXSpan: 0.32, coatZone: 1, combDir: [0, -0.08, -0.99] },
    // Muzzle front rim behind wet nose leather
    { pos: [0, -hs * (0.06 + stop * 0.11), hs * 0.46 + ml * 0.98], rx: mw * 0.40, ry: mh * 0.38, furScale: 0.03, coatZ: 1.50, coatYCenter: 0.52, coatYSpan: 0.08, coatXSpan: 0.14, coatZone: 1, combDir: [0, 0, -1] },
    // Tip closure
    { pos: [0, -hs * (0.06 + stop * 0.11), hs * 0.46 + ml * 1.03], rx: mw * 0.10, ry: mh * 0.10, furScale: 0.02, coatZ: 1.52, coatYCenter: 0.52, coatYSpan: 0.04, coatXSpan: 0.06, coatZone: 1, combDir: [0, 0, -1] },
  ];

  const geo = createOrganicLoft(sections, 24, bodyTransformFn);

  // Sculpt bilateral orbital sockets & clear fur cleanly around eyes so eyes + black eyeliner are crisp
  if (eyeCoords) {
    const pos = geo.getAttribute('position');
    const furScale = geo.getAttribute('aFurScale');
    const { eyeX, eyeY, eyeZ, eyeR } = eyeCoords;
    const clearR = eyeR * 2.3;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const dx = Math.abs(vx) - eyeX;
      const dy = vy - eyeY;
      const dz = vz - eyeZ;
      const d = Math.hypot(dx, dy, dz);
      if (d < clearR) {
        const w = 1.0 - d / clearR;
        const smoothW = w * w * (3.0 - 2.0 * w);
        const curFur = furScale.getX(i);
        furScale.setX(i, THREE.MathUtils.lerp(curFur, 0.02, smoothW * 0.96));
        const indent = smoothW * eyeR * 0.24;
        pos.setXYZ(i, vx * (1.0 - indent * 0.30 / Math.max(0.01, hs)), vy, vz - indent * 0.48);
      }
    }
    pos.needsUpdate = true;
    furScale.needsUpdate = true;
    geo.computeVertexNormals();
  }

  return geo;
}

function buildJawGeometry(breed, bodyTransformFn) {
  const hs = breed.headSize;
  const ml = breed.muzzleLength;
  const mw = hs * breed.muzzleWidth * 0.74 * 0.80;
  const mh = hs * breed.muzzleHeight * 0.62 * 0.54;
  const puff = breed.curl * 0.20;
  const jawLen = hs * 0.36 + ml * 0.82;

  const sections = [
    { pos: [0, 0, -hs * 0.12], rx: mw * 0.74, ry: mh * 0.64, furScale: 0.26 + puff * 0.36, coatZ: 1.24, coatYCenter: 0.40, coatYSpan: 0.08, coatXSpan: 0.35, coatZone: 1, combDir: [0, -0.45, -0.88] },
    { pos: [0, -mh * 0.10, jawLen * 0.36], rx: mw * 0.92, ry: mh * 0.84, topFlat: 0.38, furScale: 0.22 + puff * 0.36, coatZ: 1.34, coatYCenter: 0.38, coatYSpan: 0.08, coatXSpan: 0.34, coatZone: 1, combDir: [0, -0.35, -0.92] },
    { pos: [0, -mh * 0.06, jawLen * 0.78], rx: mw * 0.76, ry: mh * 0.70, topFlat: 0.38, furScale: 0.16 + puff * 0.28, coatZ: 1.44, coatYCenter: 0.40, coatYSpan: 0.07, coatXSpan: 0.26, coatZone: 1, combDir: [0, -0.25, -0.95] },
    { pos: [0, 0.0, jawLen * 0.96], rx: mw * 0.44, ry: mh * 0.42, topFlat: 0.30, furScale: 0.10 + puff * 0.20, coatZ: 1.49, coatYCenter: 0.42, coatYSpan: 0.05, coatXSpan: 0.16, coatZone: 1, combDir: [0, -0.15, -0.98] },
    { pos: [0, 0.0, jawLen * 1.03], rx: mw * 0.08, ry: mh * 0.08, furScale: 0.05, coatZ: 1.51, coatYCenter: 0.43, coatYSpan: 0.02, coatXSpan: 0.05, coatZone: 1, combDir: [0, -0.10, -0.99] },
  ];

  return createOrganicLoft(sections, 14, bodyTransformFn);
}

function buildMouthLips(breed, snoutTipY, snoutTipZ, lipMat, disposables) {
  const hs = breed.headSize;
  const ml = breed.muzzleLength;
  const mw = hs * breed.muzzleWidth * 0.74;
  const mh = hs * breed.muzzleHeight * 0.62;
  const lipR = Math.max(0.0020, hs * 0.036);

  const upperGroup = new THREE.Group();

  // Dark vertical philtrum cleft connecting nose leather down to upper lip center
  const philCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, snoutTipY + mh * 0.10, snoutTipZ + hs * 0.015),
    new THREE.Vector3(0, snoutTipY - mh * 0.74, snoutTipZ + hs * 0.005),
  ]);
  const philGeo = new THREE.TubeGeometry(philCurve, 6, lipR * 0.72, 6, false);
  const philMesh = new THREE.Mesh(philGeo, lipMat);
  upperGroup.add(philMesh);
  disposables.geometries.push(philGeo);

  // Sculpted black upper lip margin (flews + subtle natural canine smile curve)
  for (const s of [-1, 1]) {
    const lipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, snoutTipY - mh * 0.72, snoutTipZ + hs * 0.004),
      new THREE.Vector3(s * mw * 0.50, snoutTipY - mh * 0.88, snoutTipZ - ml * 0.15),
      new THREE.Vector3(s * mw * 0.90, snoutTipY - mh * 0.94, snoutTipZ - ml * 0.48),
      new THREE.Vector3(s * mw * 0.98, snoutTipY - mh * 0.76, snoutTipZ - ml * 0.82),
      new THREE.Vector3(s * mw * 0.92, snoutTipY - mh * 0.56, snoutTipZ - ml * 1.00),
    ]);
    const lipGeo = new THREE.TubeGeometry(lipCurve, 14, lipR, 7, false);
    const lipMesh = new THREE.Mesh(lipGeo, lipMat);
    upperGroup.add(lipMesh);
    disposables.geometries.push(lipGeo);
  }

  // Matching lower lip border on jaw so mouth stays crisp when open or closed
  const jawLen = hs * 0.36 + ml * 0.82;
  const lowerLipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-mw * 0.72, mh * 0.24, jawLen * 0.42),
    new THREE.Vector3(-mw * 0.58, mh * 0.26, jawLen * 0.82),
    new THREE.Vector3(0, mh * 0.28, jawLen * 0.98),
    new THREE.Vector3(mw * 0.58, mh * 0.26, jawLen * 0.82),
    new THREE.Vector3(mw * 0.72, mh * 0.24, jawLen * 0.42),
  ]);
  const lowerLipGeo = new THREE.TubeGeometry(lowerLipCurve, 14, lipR * 0.82, 6, false);
  const lowerLipMesh = new THREE.Mesh(lowerLipGeo, lipMat);
  disposables.geometries.push(lowerLipGeo);

  return { upperGroup, lowerLipMesh };
}

function buildEarMesh(breed, side, baseMat, shellMat, innerEarMat, bodyTransformFn, disposables) {
  // side: +1 = left (+X), -1 = right (-X)
  const group = new THREE.Group();
  const len = breed.earLength;
  const w = breed.earWidth;
  const th = breed.earWidth * 0.22 * breed.earThickness;
  const isPoodle = breed.curl > 0.5;
  const earFur = isPoodle ? 0.98 : (breed.earType === 'fold' ? 0.46 + breed.feathering * 0.42 : 0.36 + breed.fluffiness * 0.20);

  let sections;
  if (breed.earType === 'erect') {
    // Cupped triangular upright pinna pointing upward (+Y), concave face toward +Z
    sections = [
      { pos: [0, -len * 0.08, 0], rx: w * 0.52, ry: th * 1.32, axis: 'y', furScale: earFur * 1.05, coatZ: 1.16, coatYCenter: 0.84, coatXOffset: side * 0.45, coatXSpan: 0.14, coatZone: 2, combDir: [0, 0.42, -0.88] },
      { pos: [side * w * 0.04, len * 0.26, len * 0.03], rx: w * 0.56, ry: th * 1.05, axis: 'y', furScale: earFur * 0.95, coatZ: 1.17, coatYCenter: 0.90, coatXOffset: side * 0.50, coatXSpan: 0.14, coatZone: 2, combDir: [0, 0.72, -0.66] },
      { pos: [side * w * 0.07, len * 0.62, len * 0.05], rx: w * 0.38, ry: th * 0.76, axis: 'y', furScale: earFur * 0.80, coatZ: 1.18, coatYCenter: 0.96, coatXOffset: side * 0.54, coatXSpan: 0.10, coatZone: 2, combDir: [0, 0.86, -0.46] },
      { pos: [side * w * 0.08, len * 0.90, len * 0.04], rx: w * 0.18, ry: th * 0.46, axis: 'y', furScale: earFur * 0.58, coatZ: 1.18, coatYCenter: 1.00, coatXOffset: side * 0.55, coatXSpan: 0.06, coatZone: 2, combDir: [0, 0.92, -0.32] },
      { pos: [side * w * 0.08, len * 1.02, len * 0.02], rx: w * 0.05, ry: th * 0.16, axis: 'y', furScale: earFur * 0.35, coatZ: 1.18, coatYCenter: 1.02, coatXOffset: side * 0.55, coatXSpan: 0.03, coatZone: 2, combDir: [0, 0.96, -0.20] },
    ];
  } else if (breed.earType === 'fold') {
    // Golden/Labrador triangular folded ear: lifts slightly at base then drapes smoothly downward
    sections = [
      { pos: [0, len * 0.04, 0], rx: th * 1.15, ry: w * 0.44, axis: 'y', furScale: earFur, coatZ: 1.15, coatYCenter: 0.82, coatXOffset: side * 0.52, coatXSpan: 0.12, coatZone: 2, combDir: [side * 0.18, -0.92, 0.25] },
      { pos: [side * w * 0.18, -len * 0.18, len * 0.10], rx: th * 0.96, ry: w * 0.52, axis: 'y', furScale: earFur * 1.04, coatZ: 1.18, coatYCenter: 0.72, coatXOffset: side * 0.60, coatXSpan: 0.12, coatZone: 2, combDir: [side * 0.08, -0.96, 0.20] },
      { pos: [side * w * 0.16, -len * 0.54, len * 0.17], rx: th * 0.80, ry: w * 0.48, axis: 'y', furScale: earFur * 1.08, coatZ: 1.21, coatYCenter: 0.60, coatXOffset: side * 0.60, coatXSpan: 0.10, coatZone: 2, combDir: [0, -0.98, 0.16] },
      { pos: [side * w * 0.12, -len * 0.86, len * 0.19], rx: th * 0.58, ry: w * 0.32, axis: 'y', furScale: earFur * 0.98, coatZ: 1.22, coatYCenter: 0.50, coatXOffset: side * 0.56, coatXSpan: 0.08, coatZone: 2, combDir: [0, -0.99, 0.12] },
      { pos: [side * w * 0.08, -len * 1.00, len * 0.17], rx: th * 0.18, ry: w * 0.08, axis: 'y', furScale: earFur * 0.62, coatZ: 1.22, coatYCenter: 0.45, coatXOffset: side * 0.54, coatXSpan: 0.04, coatZone: 2, combDir: [0, -0.99, 0.08] },
    ];
  } else {
    // 'drop': Long velvety pendulous ear (Beagle, Dachshund, curly Poodle)
    sections = [
      { pos: [0, 0.0, 0], rx: th * 1.12, ry: w * 0.42, axis: 'y', furScale: earFur, coatZ: 1.15, coatYCenter: 0.76, coatXOffset: side * 0.52, coatXSpan: 0.12, coatZone: 2, combDir: [side * 0.12, -0.96, 0.18] },
      { pos: [side * w * 0.15, -len * 0.24, len * 0.08], rx: th * 0.98, ry: w * 0.54, axis: 'y', furScale: earFur * 1.04, coatZ: 1.18, coatYCenter: 0.64, coatXOffset: side * 0.58, coatXSpan: 0.12, coatZone: 2, combDir: [side * 0.04, -0.98, 0.14] },
      { pos: [side * w * 0.14, -len * 0.62, len * 0.14], rx: th * 0.90, ry: w * 0.56, axis: 'y', furScale: earFur * 1.08, coatZ: 1.20, coatYCenter: 0.52, coatXOffset: side * 0.58, coatXSpan: 0.10, coatZone: 2, combDir: [0, -0.99, 0.10] },
      { pos: [side * w * 0.09, -len * 0.90, len * 0.15], rx: th * 0.74, ry: w * 0.42, axis: 'y', furScale: earFur * 0.98, coatZ: 1.21, coatYCenter: 0.44, coatXOffset: side * 0.54, coatXSpan: 0.08, coatZone: 2, combDir: [0, -0.99, 0.08] },
      { pos: [side * w * 0.07, -len * 1.02, len * 0.14], rx: th * 0.22, ry: w * 0.12, axis: 'y', furScale: earFur * 0.68, coatZ: 1.21, coatYCenter: 0.40, coatXOffset: side * 0.52, coatXSpan: 0.04, coatZone: 2, combDir: [0, -1.0, 0.04] },
    ];
  }

  const earGeo = createOrganicLoft(sections, 14, bodyTransformFn);
  addFurredPart(group, earGeo, baseMat, shellMat, 16, disposables);

  // Subtle pinkish-warm inner ear pinna for erect ears
  if (breed.earType === 'erect') {
    const innerGeo = new THREE.SphereGeometry(1, 12, 10);
    innerGeo.scale(w * 0.27, len * 0.34, th * 0.34);
    const innerMesh = new THREE.Mesh(innerGeo, innerEarMat);
    innerMesh.position.set(side * w * 0.04, len * 0.38, th * 0.80 + len * 0.035);
    innerMesh.rotation.x = -0.05;
    group.add(innerMesh);
    disposables.geometries.push(innerGeo);
  }

  return group;
}

function buildNoseMesh(breed, noseMat, disposables) {
  const hs = breed.headSize;
  const nw = hs * breed.muzzleWidth * 0.74 * 0.52;
  const nh = hs * breed.muzzleHeight * 0.62 * 0.48;
  const nd = nw * 0.78;

  const group = new THREE.Group();
  // Sculpted wet canine rhinarium (broad upper leather, central philtrum groove, comma nostrils)
  const geo = new THREE.SphereGeometry(1, 20, 16);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    if (z > 0) z = Math.pow(z, 0.78) * 0.88;
    const widthProfile = y > 0 ? 1.0 + 0.16 * y : 1.0 + 0.30 * y;
    x *= widthProfile;

    // Central philtrum groove on lower front
    if (z > 0.2 && y < 0.15) {
      const groove = Math.exp(-x * x * 24.0) * Math.max(0, 0.2 - y) * 0.26;
      z -= groove;
    }

    // Bilateral comma-shaped nostril indentations
    if (z > 0.32) {
      const nx = Math.abs(x) - 0.42;
      const ny = y + 0.06;
      const d2 = nx * nx * 16.0 + ny * ny * 26.0;
      const nostril = Math.exp(-d2) * 0.28;
      z -= nostril;
    }

    pos.setXYZ(i, x * nw, y * nh, z * nd);
  }
  geo.computeVertexNormals();
  const noseMesh = new THREE.Mesh(geo, noseMat);
  noseMesh.castShadow = true;
  noseMesh.receiveShadow = true;
  group.add(noseMesh);

  // Dark inner nostril cavities
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x030202 });
  const holeGeo = new THREE.SphereGeometry(nw * 0.15, 8, 8);
  holeGeo.scale(1.0, 0.74, 0.5);
  for (const s of [-1, 1]) {
    const hole = new THREE.Mesh(holeGeo, darkMat);
    hole.position.set(s * nw * 0.40, -nh * 0.06, nd * 0.66);
    hole.rotation.y = s * 0.38;
    group.add(hole);
  }
  disposables.geometries.push(geo, holeGeo);
  disposables.materials.push(darkMat);
  return group;
}

function buildEyeAssembly(breed, side, irisMat, rimMat, eyelidMat, disposables) {
  const hs = breed.headSize;
  const r = hs * (breed.id === 'poodle' ? 0.168 : breed.id === 'dachshund' ? 0.154 : 0.156);

  const eyePivot = new THREE.Group();

  // Dark wet eyeball with seamless angular UV mapping (dark iris + large black pupil on +Z, dark base everywhere)
  const irisGeo = new THREE.SphereGeometry(r, 24, 18);
  const pos = irisGeo.getAttribute('position');
  const uv = irisGeo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) / r;
    const py = pos.getY(i) / r;
    const pz = THREE.MathUtils.clamp(pos.getZ(i) / r, -1, 1);
    const theta = Math.acos(pz); // 0 at +Z front center, PI/2 at equator
    const rad = Math.min(0.495, (theta / (Math.PI * 0.5)) * 0.495);
    const xyLen = Math.hypot(px, py);
    if (xyLen > 1e-5) {
      uv.setXY(i, 0.5 + (px / xyLen) * rad, 0.5 + (py / xyLen) * rad);
    } else if (pz >= 0) {
      uv.setXY(i, 0.5, 0.5);
    } else {
      uv.setXY(i, 0.995, 0.5);
    }
  }
  uv.needsUpdate = true;

  const eyeMesh = new THREE.Mesh(irisGeo, irisMat);
  eyePivot.add(eyeMesh);

  // Crisp jet-black pigmented canine eyelid rim ("eyeliner") fixed to skull while eyeball tracks
  const isAlmond = breed.id === 'shiba' || breed.id === 'husky' || breed.id === 'corgi';
  const rimGeo = new THREE.TorusGeometry(r * 0.98, r * 0.17, 10, 24);
  rimGeo.scale(isAlmond ? 1.14 : 1.08, isAlmond ? 0.85 : 0.92, 0.85);
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.position.z = r * 0.25;
  rimMesh.rotation.z = side * (isAlmond ? 0.15 : 0.04);

  // Upper eyelid shell matched to surrounding fur color for smooth natural blinking
  const eyelidPivot = new THREE.Group();
  const lidGeo = new THREE.SphereGeometry(r * 1.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const lidMesh = new THREE.Mesh(lidGeo, eyelidMat);
  lidMesh.rotation.x = -1.02; // Tucked naturally above eyeball when open
  eyelidPivot.add(lidMesh);

  disposables.geometries.push(irisGeo, rimGeo, lidGeo);
  return { eyePivot, eyeMesh, rimMesh, eyelidPivot };
}

function addPawPads(pawGroup, legR, pawH, isFront, padMat, disposables) {
  const pw = legR * (isFront ? 1.28 : 1.18);
  const pl = legR * (isFront ? 1.92 : 1.98);
  const padGeo = new THREE.SphereGeometry(1, 10, 8);

  // Plump main metacarpal/metatarsal heart pad
  const mainPad = new THREE.Mesh(padGeo, padMat);
  mainPad.scale.set(pw * 0.60, pawH * 0.20, pl * 0.28);
  mainPad.position.set(0, -pawH + pawH * 0.10, pl * 0.05);
  pawGroup.add(mainPad);

  // 4 plump rounded toe pads
  const toeOffsets = [
    [-0.54, 0.44],
    [-0.19, 0.58],
    [0.19, 0.58],
    [0.54, 0.44],
  ];
  for (const [tx, tz] of toeOffsets) {
    const tp = new THREE.Mesh(padGeo, padMat);
    tp.scale.set(pw * 0.24, pawH * 0.18, pl * 0.16);
    tp.position.set(tx * pw, -pawH + pawH * 0.10, tz * pl);
    pawGroup.add(tp);
  }
  disposables.geometries.push(padGeo);
}

// ============================================================================
// Main Dog Builder
// ============================================================================

export function buildDog(breedInput) {
  const breed = typeof breedInput === 'string'
    ? getBreedById(breedInput)
    : (breedInput && breedInput.id ? breedInput : BREEDS[0]);

  const disposables = {
    geometries: [],
    materials: [],
    textures: [],
    skeletons: [],
  };

  const root = new THREE.Group();
  root.name = `dog_${breed.id}`;

  // --- Shared Fur Uniforms ---
  const scaleRef = Math.max(0.22, breed.shoulderHeight);
  // Fine silky hair density (much finer than chunky noise so coats look soft & natural)
  const strandFreq = THREE.MathUtils.clamp(420.0 / Math.pow(scaleRef / 0.40, 0.55), 310, 560)
    * (breed.curl > 0.5 ? 0.62 : 1.0);

  const furUniforms = {
    uPrimaryColor: { value: new THREE.Color(breed.primaryColor) },
    uSecondaryColor: { value: new THREE.Color(breed.secondaryColor) },
    uTertiaryColor: { value: new THREE.Color(breed.tertiaryColor) },
    uPattern: { value: PATTERN_ID[breed.pattern] ?? 0 },
    uFurLength: { value: breed.furLength },
    uFluffiness: { value: breed.fluffiness },
    uCurl: { value: breed.curl },
    uStrandFreq: { value: strandFreq },
    uWetness: { value: 0.0 },
    uSnow: { value: 0.0 },
    uDirt: { value: 0.0 },
    uShake: { value: 0.0 },
    uTime: { value: 0.0 },
    uMarkingsA: {
      value: new THREE.Vector4(
        breed.markings?.blaze ?? 0,
        breed.markings?.collar ?? 0,
        breed.markings?.eyebrows ?? 0,
        breed.markings?.socks ?? 0
      ),
    },
    uMarkingsB: {
      value: new THREE.Vector2(
        breed.markings?.tailTipWhite ?? 0,
        breed.markings?.dorsalDarken ?? 0.25
      ),
    },
  };

  const baseCoatMat = createFurMaterial(furUniforms, false, breed);
  const shellFurMat = createFurMaterial(furUniforms, true, breed);
  disposables.materials.push(baseCoatMat, shellFurMat);

  // Secondary non-fur anatomical materials
  const noseBumpTex = createNoseBumpTexture();
  const noseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(breed.noseColor),
    roughness: 0.14,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 2.1,
    bumpMap: noseBumpTex,
    bumpScale: 0.0016,
  });

  const irisTex = createIrisTexture(breed.eyeColor, breed.id === 'husky');
  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.0,
    ior: 1.5,
    reflectivity: 0.85,
    clearcoat: 1.0,
    clearcoatRoughness: 0.035,
    envMapIntensity: 0.65,
  });
  // Crisp jet-black pigmented canine eyeliner
  const eyeRimMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#070505'),
    roughness: 0.30,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.55,
  });
  // Dark pigmented moist canine lip line
  const lipMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#130f0f'),
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.50,
    clearcoatRoughness: 0.24,
  });
  // Eyelid matches surrounding facial fur color (mask: white, tricolor: tan, others: primary)
  const eyelidColorHex = (breed.pattern === 'mask' || breed.pattern === 'tricolor')
    ? breed.secondaryColor
    : breed.primaryColor;
  const eyelidMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(eyelidColorHex).multiplyScalar(0.88),
    roughness: 0.90,
    metalness: 0.0,
  });
  const innerEarMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d4a294').lerp(new THREE.Color(breed.secondaryColor), 0.30),
    roughness: 0.78,
  });
  const padMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(breed.padColor),
    roughness: 0.78,
  });
  const mouthMat = new THREE.MeshStandardMaterial({
    color: 0x5c242a,
    roughness: 0.36,
  });
  const tongueMat = new THREE.MeshPhysicalMaterial({
    color: 0xd96b78,
    roughness: 0.26,
    clearcoat: 0.68,
    clearcoatRoughness: 0.20,
  });
  const toothMat = new THREE.MeshStandardMaterial({
    color: 0xf4efe4,
    roughness: 0.22,
  });
  const whiskerMat = new THREE.MeshBasicMaterial({
    color: breed.pattern === 'saddle' ? 0x3b332e : 0xeae2d6,
    transparent: true,
    opacity: 0.42,
  });

  disposables.textures.push(noseBumpTex, irisTex);
  disposables.materials.push(
    noseMat, irisMat, eyeRimMat, lipMat, eyelidMat,
    innerEarMat, padMat, mouthMat, tongueMat, toothMat, whiskerMat
  );

  // ==========================================================================
  // Exact Proportions & Ground-Contact Trigonometry
  // Chest bottom sits right at elbow height (H * legLengthRatio);
  // True body length from prosternum to rump = 1.0 * B.
  // ==========================================================================
  const H = breed.shoulderHeight;
  const B = breed.bodyLength;
  const legRatio = breed.legLengthRatio ?? 0.49;
  const cWidth = breed.chestWidth;
  const legR = breed.legRadius;
  const pawH = Math.max(0.017, legR * 0.98);

  // Withers = H, brisket/chest bottom = elbow height = H * legRatio
  const withersY = H;
  const elbowY = Math.max(pawH * 2.05, H * legRatio);
  const chestBottomY = elbowY;
  const cDepth = Math.max(breed.chestDepth * 0.88, withersY - chestBottomY);
  const chestCenterY = chestBottomY + cDepth * 0.5;
  const halfD = cDepth * 0.5;
  const halfW = cWidth * 0.5;

  // Level-to-gently-sloping topline (withers highest, croup ~97.5% of withers)
  const pelvisHalfD = halfD * 0.86;
  const croupTopY = withersY * 0.975;
  const pelvisY = croupTopY - pelvisHalfD;

  // Shoulder sits inside mid-chest; humerus drops to elbow right at chest bottom
  const shoulderY = elbowY + cDepth * 0.46;
  // Hip sits in upper haunch; stifle sits near elbow/underline height
  const hipY = Math.min(pelvisY + pelvisHalfD * 0.16, elbowY + cDepth * 0.54);
  const stifleY = elbowY + cDepth * 0.05;

  // Spine joint layout along Z (+Z forward): rump = -0.50*B, forechest = +0.50*B
  const pelvisZ = -B * 0.31;
  const spine1Z = B * 0.21;
  const spine2Z = B * 0.21;
  const chestZ = B * 0.20; // total pelvis->chest = 0.62 * B

  // Real canine limb angulation (humerus angles back to elbow; forearm drops vertical)
  const frontUpperX = 0.36;
  const frontLowerX = -0.36;
  const frontPawX = -(frontUpperX + frontLowerX);

  const backUpperX = -0.40;
  const backLowerX = 0.56;
  const backPawX = -(backUpperX + backLowerX);

  // Solve exact segment lengths so bottoms of ALL FOUR paws sit at y = 0.000
  const dropUpperF = Math.max(0.035, shoulderY - elbowY);
  const dropLowerF = Math.max(0.025, elbowY - pawH);
  const frontUpperLen = dropUpperF / Math.cos(frontUpperX);
  const frontLowerLen = dropLowerF / Math.cos(frontUpperX + frontLowerX);

  const dropUpperB = Math.max(0.035, hipY - stifleY);
  const dropLowerB = Math.max(0.025, stifleY - pawH);
  const backUpperLen = dropUpperB / Math.cos(backUpperX);
  const backLowerLen = dropLowerB / Math.cos(backUpperX + backLowerX);

  const legClearance = Math.max(0.035, chestBottomY);

  // ==========================================================================
  // Skeleton Hierarchy (THREE.Bone extends Object3D — exact SPEC.md hierarchy)
  // ==========================================================================
  const pelvis = new THREE.Bone();
  pelvis.name = 'pelvis';
  pelvis.position.set(0, pelvisY, pelvisZ);
  root.add(pelvis);

  const spine1 = new THREE.Bone();
  spine1.name = 'spine1';
  spine1.position.set(0, 0, spine1Z);
  pelvis.add(spine1);

  const spine2 = new THREE.Bone();
  spine2.name = 'spine2';
  spine2.position.set(0, 0, spine2Z);
  spine1.add(spine2);

  const chest = new THREE.Bone();
  chest.name = 'chest';
  chest.position.set(0, chestCenterY - pelvisY, chestZ);
  spine2.add(chest);

  const neckBaseY = halfD * 0.36;
  const neckBaseZ = B * 0.08;
  const neck = new THREE.Bone();
  neck.name = 'neck';
  neck.position.set(0, neckBaseY, neckBaseZ);
  const neckNeutralX = 0.66; // Natural forward-alert canine neck angle (~38 deg from vertical)
  neck.rotation.x = neckNeutralX;
  chest.add(neck);

  const headBaseY = breed.neckLength * 0.84;
  const headBaseZ = breed.neckLength * 0.08;
  const head = new THREE.Bone();
  head.name = 'head';
  head.position.set(0, headBaseY, headBaseZ);
  const headNeutralX = -neckNeutralX + 0.08; // Counters neck pitch so head sits gently level
  head.rotation.x = headNeutralX;
  neck.add(head);

  // Sync bind-pose world matrices in root space before building skinned geometry
  root.updateMatrixWorld(true);

  const getBonePos = (bone) => new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);

  // Neutral-pose world-position helpers for head/ears/jaw 3D fur noise continuity
  const neutralChestPos = getBonePos(chest);
  const neutralPelvisPos = getBonePos(pelvis);

  // ==========================================================================
  // Continuous Skinned Torso (pelvis -> spine1 -> spine2 -> chest)
  // ==========================================================================
  const waistFactor = 1.0 - breed.waistTuck;
  const ruffScale = 1.0 + breed.ruff * 0.42;
  const bellyFeather = breed.feathering * 0.46;

  // Align ring tops cleanly along the straight-to-gently-sloping canine topline
  const topAlignWorldY = (ringRy, targetTopWorld) => targetTopWorld - ringRy;
  const zSpine1 = pelvisZ + spine1Z;
  const zSpine2 = zSpine1 + spine2Z;
  const zChest = zSpine2 + chestZ;

  const tRy1 = pelvisHalfD * 0.74;
  const tRy2 = pelvisHalfD * 0.97;
  const tRy3 = pelvisHalfD * (0.86 + 0.12 * waistFactor);
  const tRy4 = halfD * (0.77 + 0.17 * waistFactor);
  const tRy5 = halfD * 0.94;
  const tRy6 = halfD * 0.99;

  const torsoStations = [
    // Closed rump dome (-0.50*B)
    { pos: [0, pelvisY - pelvisHalfD * 0.06, -B * 0.50], rx: halfW * 0.18, ry: pelvisHalfD * 0.18, furScale: 0.96, coatZ: -0.95, coatYCenter: 0.66, coatYSpan: 0.12, coatXSpan: 0.22, coatZone: 0 },
    { pos: [0, topAlignWorldY(tRy1, croupTopY - pelvisHalfD * 0.06), -B * 0.44], rx: halfW * 0.74, ry: tRy1, topFlat: 0.14, furScale: 1.02, coatZ: -0.84, coatYCenter: 0.68, coatYSpan: 0.24, coatXSpan: 0.74, coatZone: 0 },
    // Full pelvis / croup
    { pos: [0, topAlignWorldY(tRy2, croupTopY), -B * 0.33], rx: halfW * 0.92, ry: tRy2, topFlat: 0.20, bottomPinch: 0.16, furScale: 1.02, coatZ: -0.60, coatYCenter: 0.68, coatYSpan: 0.28, coatXSpan: 0.90, coatZone: 0, bottomFeather: bellyFeather * 0.35 },
    { pos: [0, topAlignWorldY(tRy3, withersY * 0.982), -B * 0.21], rx: halfW * 0.86 * (0.86 + 0.14 * waistFactor), ry: tRy3, topFlat: 0.22, bottomPinch: 0.20, furScale: 0.98, coatZ: -0.34, coatYCenter: 0.70, coatYSpan: 0.26, coatXSpan: 0.84, coatZone: 0, bottomFeather: bellyFeather * 0.48 },
    // Loin / smooth upward belly tuck (around spine1)
    { pos: [0, topAlignWorldY(tRy4, withersY * 0.986), -B * 0.10], rx: halfW * (0.82 + 0.16 * waistFactor), ry: tRy4, topFlat: 0.22, bottomPinch: 0.22, furScale: 0.98, coatZ: -0.08, coatYCenter: 0.71, coatYSpan: 0.26, coatXSpan: 0.82, coatZone: 0, bottomFeather: bellyFeather * 0.65 },
    // Rear ribcage
    { pos: [0, topAlignWorldY(tRy5, withersY * 0.993), B * 0.03], rx: halfW * 0.96, ry: tRy5, topFlat: 0.22, bottomPinch: 0.21, furScale: 1.00, coatZ: 0.18, coatYCenter: 0.68, coatYSpan: 0.29, coatXSpan: 0.94, coatZone: 0, bottomFeather: bellyFeather * 0.82 },
    // Deep mid-ribcage (around spine2)
    { pos: [0, topAlignWorldY(tRy6, withersY * 0.998), B * 0.16], rx: halfW * 1.01, ry: tRy6, topFlat: 0.20, bottomPinch: 0.23, furScale: 1.04, coatZ: 0.42, coatYCenter: 0.65, coatYSpan: 0.32, coatXSpan: 0.98, coatZone: 0, bottomFeather: bellyFeather * 0.85 },
    // Deepest chest / withers (around chest)
    { pos: [0, chestCenterY, B * 0.29], rx: halfW * 1.04, ry: halfD * 1.01, topFlat: 0.18, bottomPinch: 0.24, furScale: 1.06, coatZ: 0.64, coatYCenter: 0.64, coatYSpan: 0.33, coatXSpan: 1.00, coatZone: 0, bottomFeather: bellyFeather * 0.85 },
    // Muscular forechest
    { pos: [0, chestCenterY - halfD * 0.03, B * 0.40], rx: halfW * 0.94, ry: halfD * 0.92, topFlat: 0.14, bottomPinch: 0.24, furScale: ruffScale, coatZ: 0.80, coatYCenter: 0.62, coatYSpan: 0.31, coatXSpan: 0.92, coatZone: 0, bottomFeather: breed.ruff * 0.55 },
    // Prominent prosternum & front closure (+0.50*B)
    { pos: [0, chestCenterY - halfD * 0.07, B * 0.47], rx: halfW * 0.62, ry: halfD * 0.62, bottomPinch: 0.22, furScale: ruffScale * 1.02, coatZ: 0.90, coatYCenter: 0.58, coatYSpan: 0.24, coatXSpan: 0.62, coatZone: 0, bottomFeather: breed.ruff * 0.60 },
    { pos: [0, chestCenterY - halfD * 0.09, B * 0.50], rx: halfW * 0.16, ry: halfD * 0.16, furScale: ruffScale * 0.82, coatZ: 0.95, coatYCenter: 0.56, coatYSpan: 0.10, coatXSpan: 0.20, coatZone: 0 },
  ];

  const { rings: torsoRings } = resampleSections(torsoStations, [1, 2, 2, 3, 3, 3, 3, 2, 2, 1]);
  const z0Torso = torsoRings[0].pos[2];
  const torsoZArcs = Float32Array.from(torsoRings, (r) => r.pos[2] - z0Torso);
  assignChainWeights(
    torsoRings,
    torsoZArcs,
    [zSpine1 - z0Torso, zSpine2 - z0Torso, zChest - z0Torso],
    0.075
  );
  const torsoSkeleton = new THREE.Skeleton([pelvis, spine1, spine2, chest]);
  disposables.skeletons.push(torsoSkeleton);
  const torsoGeo = createSkinnedTube(torsoRings, 22);
  addSkinnedFurredPart(root, torsoGeo, baseCoatMat, shellFurMat, 18, torsoSkeleton, disposables);

  // ==========================================================================
  // Continuous Skinned Neck (chest -> neck -> head base)
  // ==========================================================================
  const nl = breed.neckLength;
  const nr = breed.neckRadius;
  const headSizeRef = breed.headSize;
  const neckNeutralWorld = getBonePos(neck);
  const neckQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(neckNeutralX, 0, 0));
  const headNeutralWorld = getBonePos(head);
  const headQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(neckNeutralX + headNeutralX, 0, 0));

  const neckAxisY = new THREE.Vector3(0, 1, 0).applyQuaternion(neckQuat);
  const neckAxisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(neckQuat);
  const headAxisY = new THREE.Vector3(0, 1, 0).applyQuaternion(headQuat);
  const headAxisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(headQuat);

  const neckPt = (yOff, zOff) => {
    const v = neckNeutralWorld.clone()
      .addScaledVector(neckAxisY, yOff)
      .addScaledVector(neckAxisZ, zOff);
    return [v.x, v.y, v.z];
  };
  const headAnchorVec = headNeutralWorld.clone()
    .addScaledVector(headAxisY, headSizeRef * 0.18)
    .addScaledVector(headAxisZ, headSizeRef * 0.05);

  const neckStations = [
    // Deep inside upper chest / withers (weighted to chest so chest-neck seam never opens)
    { pos: neckPt(-nl * 0.48, -nr * 0.24), rx: Math.min(nr * 1.42, halfW * 0.94), ry: Math.min(nr * 1.48, halfD * 0.88), furScale: ruffScale * 1.04, coatZ: 0.78, coatYCenter: 0.64, coatYSpan: 0.24, coatXSpan: 0.76, coatZone: 0, combDir: [0, -0.34, -0.94] },
    { pos: neckPt(-nl * 0.18, -nr * 0.10), rx: Math.min(nr * 1.26, halfW * 0.96), ry: Math.min(nr * 1.34, halfD * 0.90), furScale: ruffScale * 1.03, coatZ: 0.87, coatYCenter: 0.64, coatYSpan: 0.24, coatXSpan: 0.72, coatZone: 0, combDir: [0, -0.34, -0.94] },
    // Neck pivot base
    { pos: [neckNeutralWorld.x, neckNeutralWorld.y, neckNeutralWorld.z], rx: nr * 1.14, ry: nr * 1.22, furScale: ruffScale, coatZ: 0.95, coatYCenter: 0.65, coatYSpan: 0.24, coatXSpan: 0.66, coatZone: 0, combDir: [0, -0.32, -0.95] },
    // Mid neck
    { pos: neckPt(nl * 0.45, nr * 0.04), rx: nr * 0.98, ry: nr * 1.04, furScale: 0.94 + breed.ruff * 0.30, coatZ: 1.03, coatYCenter: 0.66, coatYSpan: 0.24, coatXSpan: 0.58, coatZone: 0, combDir: [0, -0.32, -0.95] },
    // Head joint pivot (blends smoothly from neck into head)
    { pos: [headNeutralWorld.x, headNeutralWorld.y, headNeutralWorld.z], rx: Math.min(nr * 0.90, headSizeRef * 0.74), ry: Math.min(nr * 0.92, headSizeRef * 0.68), furScale: 0.84 + breed.ruff * 0.18, coatZ: 1.09, coatYCenter: 0.67, coatYSpan: 0.22, coatXSpan: 0.52, coatZone: 0, combDir: [0, -0.30, -0.95] },
    // Inside cranium (weighted 100% to head so head-neck transition stays watertight at any pitch/yaw)
    { pos: [headAnchorVec.x, headAnchorVec.y, headAnchorVec.z], rx: Math.min(nr * 0.56, headSizeRef * 0.52), ry: Math.min(nr * 0.52, headSizeRef * 0.46), furScale: 0.64, coatZ: 1.13, coatYCenter: 0.68, coatYSpan: 0.16, coatXSpan: 0.32, coatZone: 0, combDir: [0, -0.30, -0.95] },
  ];

  const { rings: neckRings, stationRingIndex: neckIdx, arcLengths: neckArcs } = resampleSections(
    neckStations,
    [2, 2, 3, 3, 2]
  );
  assignChainWeights(
    neckRings,
    neckArcs,
    [neckArcs[neckIdx[2]], neckArcs[neckIdx[4]]],
    0.068
  );
  const neckSkeleton = new THREE.Skeleton([chest, neck, head]);
  disposables.skeletons.push(neckSkeleton);
  const neckGeo = createSkinnedTube(neckRings, 18);
  addSkinnedFurredPart(root, neckGeo, baseCoatMat, shellFurMat, 18, neckSkeleton, disposables);

  // Head body-space transform
  const headBodyFn = (local, out) => {
    out.copy(local).applyQuaternion(headQuat).add(headNeutralWorld);
  };

  const hs = breed.headSize;
  const ml = breed.muzzleLength;
  const stop = breed.stopDepth;
  const puff = breed.curl * 0.16;
  const upperMw = hs * breed.muzzleWidth * 0.74;
  const upperMh = hs * breed.muzzleHeight * 0.62;
  const eyeR = hs * (breed.id === 'poodle' ? 0.168 : breed.id === 'dachshund' ? 0.154 : 0.156);
  const eyeX = hs * 0.42 * (1 + puff * 0.16) * (breed.id === 'dachshund' ? 0.92 : 1.0);
  const eyeY = hs * (0.20 - stop * 0.06);
  const eyeZ = hs * (0.48 + (1.0 - stop) * 0.05);

  // Cranium + continuous muzzle (with sculpted clear orbital sockets)
  const headGeo = buildHeadGeometry(breed, headBodyFn, { eyeX, eyeY, eyeZ, eyeR });
  addFurredPart(head, headGeo, baseCoatMat, shellFurMat, 20, disposables);

  const snoutTipY = -hs * (0.06 + stop * 0.11);
  const snoutTipZ = hs * 0.46 + ml * 1.00;

  // Wet Glossy Black Nose
  const noseGroup = buildNoseMesh(breed, noseMat, disposables);
  noseGroup.position.set(0, snoutTipY + upperMh * 0.22, snoutTipZ + hs * 0.018);
  head.add(noseGroup);

  // Crisp Dark Pigmented Upper/Lower Mouth Lips & Philtrum
  const { upperGroup: upperLips, lowerLipMesh } = buildMouthLips(breed, snoutTipY, snoutTipZ, lipMat, disposables);
  head.add(upperLips);

  // Subtle translucent vibrissae (whiskers)
  const whiskerGeo = new THREE.CylinderGeometry(0.0004, 0.00015, hs * 0.56, 4);
  whiskerGeo.rotateZ(Math.PI * 0.5);
  disposables.geometries.push(whiskerGeo);
  for (const s of [-1, 1]) {
    for (let w = 0; w < 3; w++) {
      const wm = new THREE.Mesh(whiskerGeo, whiskerMat);
      wm.position.set(
        s * (upperMw * 0.85 + hs * 0.18),
        snoutTipY - upperMh * 0.20 + (w - 1) * hs * 0.036,
        snoutTipZ - ml * 0.22 - w * ml * 0.06
      );
      wm.rotation.y = -s * (0.28 + w * 0.12);
      wm.rotation.z = -s * (0.14 + w * 0.06);
      head.add(wm);
    }
  }

  // Lower Jaw, Inner Mouth, Teeth & Flexible Pink Tongue
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  jaw.position.set(0, snoutTipY - upperMh * 0.72, hs * 0.10);
  head.add(jaw);

  const jawBodyFn = (local, out) => {
    out.set(local.x, local.y + jaw.position.y, local.z + jaw.position.z)
      .applyQuaternion(headQuat)
      .add(headNeutralWorld);
  };
  const jawGeo = buildJawGeometry(breed, jawBodyFn);
  addFurredPart(jaw, jawGeo, baseCoatMat, shellFurMat, 16, disposables);
  jaw.add(lowerLipMesh);

  // Inner mouth interior (upper palate + lower floor)
  const palateGeo = new THREE.SphereGeometry(1, 10, 8);
  palateGeo.scale(upperMw * 0.68, upperMh * 0.30, ml * 0.64);
  const palateMesh = new THREE.Mesh(palateGeo, mouthMat);
  palateMesh.position.set(0, snoutTipY - upperMh * 0.42, hs * 0.46 + ml * 0.42);
  head.add(palateMesh);

  const jawFloorMesh = new THREE.Mesh(palateGeo, mouthMat);
  jawFloorMesh.scale.set(0.86, 0.75, 0.85);
  jawFloorMesh.position.set(0, upperMh * 0.12, hs * 0.30 + ml * 0.36);
  jaw.add(jawFloorMesh);
  disposables.geometries.push(palateGeo);

  // Small sculpted white canine teeth (tucked inside lips, visible during bark/yawn/pant)
  const toothGeo = new THREE.ConeGeometry(hs * 0.030, hs * 0.082, 6);
  toothGeo.rotateX(Math.PI);
  disposables.geometries.push(toothGeo);
  for (const s of [-1, 1]) {
    const upperCanine = new THREE.Mesh(toothGeo, toothMat);
    upperCanine.position.set(s * upperMw * 0.52, snoutTipY - upperMh * 0.48, snoutTipZ - ml * 0.26);
    head.add(upperCanine);
  }

  // Curved Pink Tongue
  const tongue = new THREE.Group();
  tongue.name = 'tongue';
  tongue.position.set(0, upperMh * 0.16, hs * 0.30 + ml * 0.26);
  jaw.add(tongue);

  const tongueLen = ml * 0.74 + hs * 0.16;
  const tongueW = upperMw * 0.56;
  const tongueGeo = new THREE.BoxGeometry(tongueW, hs * 0.048, tongueLen, 4, 2, 8);
  tongueGeo.translate(0, 0, tongueLen * 0.48);
  const tPos = tongueGeo.getAttribute('position');
  for (let i = 0; i < tPos.count; i++) {
    let tx = tPos.getX(i);
    let ty = tPos.getY(i);
    let tz = tPos.getZ(i);
    const u = THREE.MathUtils.clamp(tz / tongueLen, 0, 1);
    const roundW = Math.sqrt(Math.max(0.05, 1.0 - Math.pow(Math.max(0, (u - 0.65) / 0.35), 2)));
    tx *= roundW;
    ty *= (1.0 - 0.35 * u);
    const groove = Math.exp(-Math.pow(tx / (tongueW * 0.22), 2)) * hs * 0.022 * (1.0 - u * 0.5);
    ty -= groove;
    ty -= u * u * hs * 0.12;
    tPos.setXYZ(i, tx, ty, tz);
  }
  tongueGeo.computeVertexNormals();
  const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
  tongue.add(tongueMesh);
  disposables.geometries.push(tongueGeo);

  // Expressive Wet Eyes with Crisp Black Eyeliner (visible from front and side views)
  const leftEye = buildEyeAssembly(breed, 1, irisMat, eyeRimMat, eyelidMat, disposables);
  const leftSocket = new THREE.Group();
  leftSocket.position.set(eyeX, eyeY, eyeZ);
  leftSocket.rotation.y = 0.28;
  leftSocket.add(leftEye.rimMesh, leftEye.eyePivot, leftEye.eyelidPivot);
  leftEye.eyelidPivot.name = 'eyelidL';
  head.add(leftSocket);

  const rightEye = buildEyeAssembly(breed, -1, irisMat, eyeRimMat, eyelidMat, disposables);
  const rightSocket = new THREE.Group();
  rightSocket.position.set(-eyeX, eyeY, eyeZ);
  rightSocket.rotation.y = -0.28;
  rightSocket.add(rightEye.rimMesh, rightEye.eyePivot, rightEye.eyelidPivot);
  rightEye.eyelidPivot.name = 'eyelidR';
  head.add(rightSocket);

  const eyes = [leftEye.eyePivot, rightEye.eyePivot];
  eyes.left = leftEye.eyePivot;
  eyes.right = rightEye.eyePivot;

  // Ears
  const earSet = breed.earSet;
  const earX = hs * (breed.earType === 'erect' ? 0.46 : 0.64);
  const earY = hs * (0.34 + earSet * 0.36);
  const earZ = -hs * (breed.earType === 'erect' ? 0.10 : 0.04);

  const earBaseRot = breed.earType === 'erect'
    ? { x: 0.18, y: 0.20, z: -0.22 }
    : breed.earType === 'fold'
      ? { x: 0.08, y: 0.14, z: 0.06 }
      : { x: 0.04, y: 0.06, z: 0.04 };

  const earL = new THREE.Group();
  earL.name = 'earL';
  earL.position.set(earX, earY, earZ);
  earL.rotation.set(earBaseRot.x, earBaseRot.y, earBaseRot.z);
  const earLBodyFn = (local, out) => {
    out.set(local.x + earX, local.y + earY, local.z + earZ).applyQuaternion(headQuat).add(headNeutralWorld);
  };
  earL.add(buildEarMesh(breed, 1, baseCoatMat, shellFurMat, innerEarMat, earLBodyFn, disposables));
  head.add(earL);

  const earR = new THREE.Group();
  earR.name = 'earR';
  earR.position.set(-earX, earY, earZ);
  earR.rotation.set(earBaseRot.x, -earBaseRot.y, -earBaseRot.z);
  const earRBodyFn = (local, out) => {
    out.set(local.x - earX, local.y + earY, local.z + earZ).applyQuaternion(headQuat).add(headNeutralWorld);
  };
  earR.add(buildEarMesh(breed, -1, baseCoatMat, shellFurMat, innerEarMat, earRBodyFn, disposables));
  head.add(earR);

  // ==========================================================================
  // 4 Continuous Skinned Canine Legs (FL, FR, BL, BR)
  // One seamless SkinnedMesh per leg from buried torso anchor -> shoulder/hip ->
  // upper -> elbow/stifle -> lower -> ankle/wrist -> plump paw & toes!
  // coatXOffset: 0, coatXSpan: side -> cc.x = -1 on inner leg, +1 on outer leg!
  // ==========================================================================
  const legFeather = breed.feathering * 0.72;
  const shoulderOffX = halfW * 0.78;
  const shoulderOffY = shoulderY - chestCenterY;
  const shoulderOffZ = B * 0.02;

  const hipOffX = halfW * 0.76;
  const hipOffY = hipY - pelvisY;
  const hipOffZ = -B * 0.02;

  function makePawPostProcess(pPw, pw, pl) {
    const toeStartZ = pPw.z + pl * 0.20;
    return (geo) => {
      const pos = geo.getAttribute('position');
      const bodyPos = geo.getAttribute('aBodyPos');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        if (y < pawH * 1.45) {
          if (z > toeStartZ) {
            const localX = x - pPw.x;
            const toeWave = Math.cos((localX / Math.max(pw, 0.001)) * Math.PI * 3.5);
            const t = Math.min(1, (z - toeStartZ) / Math.max(0.005, pl * 0.56));
            y += Math.max(0, toeWave) * pawH * 0.13 * t;
            z += Math.max(0, toeWave) * pl * 0.055 * t;
          }
          if (y < 0) y = 0;
          pos.setXYZ(i, x, y, z);
          bodyPos.setXYZ(i, x, y, z);
        }
      }
      pos.needsUpdate = true;
      bodyPos.needsUpdate = true;
    };
  }

  function buildFrontLeg(side, label) {
    const shoulder = new THREE.Bone();
    shoulder.name = `shoulder_${label}`;
    shoulder.position.set(side * shoulderOffX, shoulderOffY, shoulderOffZ);
    chest.add(shoulder);

    const upper = new THREE.Bone();
    upper.name = `upper_${label}`;
    upper.rotation.x = frontUpperX;
    shoulder.add(upper);

    const lower = new THREE.Bone();
    lower.name = `lower_${label}`;
    lower.position.set(0, -frontUpperLen, 0);
    lower.rotation.x = frontLowerX;
    upper.add(lower);

    const paw = new THREE.Bone();
    paw.name = `paw_${label}`;
    paw.position.set(0, -frontLowerLen, legR * 0.15);
    paw.rotation.x = frontPawX;
    lower.add(paw);

    root.updateMatrixWorld(true);

    const pSh = getBonePos(shoulder);
    const pEl = getBonePos(lower);
    const pPw = getBonePos(paw);
    const pw = legR * 1.38;
    const pl = legR * 2.02;
    const shTopLift = Math.min(legR * 1.42, cDepth * 0.34);

    const stations = [
      // 0. Buried inside ribcage (weighted to chest for gap-free shoulder blend)
      { pos: [pSh.x - side * legR * 0.88, pSh.y + shTopLift, pSh.z - legR * 0.16], rx: legR * 1.05, ry: legR * 1.65, furScale: 1.00, coatZ: 0.62, coatYCenter: 0.64, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 1. Upper deltoid emerging smoothly from chest
      { pos: [pSh.x - side * legR * 0.34, pSh.y + shTopLift * 0.48, pSh.z - legR * 0.08], rx: legR * 1.44, ry: legR * 2.02, furScale: 1.02, coatZ: 0.63, coatYCenter: 0.58, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.30 },
      // 2. Shoulder pivot
      { pos: [pSh.x - side * legR * 0.08, pSh.y, pSh.z], rx: legR * 1.58, ry: legR * 2.12, furScale: 1.02, coatZ: 0.64, coatYCenter: 0.50, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.45 },
      // 3. Mid upper arm
      { pos: [pSh.x * 0.48 + pEl.x * 0.52, pSh.y * 0.48 + pEl.y * 0.52, pSh.z * 0.48 + pEl.z * 0.52], rx: legR * 1.32, ry: legR * 1.58, furScale: 0.92, coatZ: 0.62, coatYCenter: 0.40, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.68 },
      // 4. Elbow pivot
      { pos: [pEl.x, pEl.y, pEl.z], rx: legR * 1.12, ry: legR * 1.24, furScale: 0.84, coatZ: 0.60, coatYCenter: 0.32, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.85 },
      // 5. Muscular upper forearm
      { pos: [pEl.x, pEl.y - frontLowerLen * 0.36, pEl.z + legR * 0.03], rx: legR * 0.90, ry: legR * 0.96, furScale: 0.72, coatZ: 0.60, coatYCenter: 0.22, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.82 },
      // 6. Slender wrist (carpus)
      { pos: [pEl.x, pEl.y - frontLowerLen * 0.74, pEl.z + legR * 0.08], rx: legR * 0.66, ry: legR * 0.68, furScale: 0.46 + breed.curl * 0.42, coatZ: 0.61, coatYCenter: 0.14, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.35 },
      // 7. Pastern / ankle joint curving into paw
      { pos: [pPw.x, pPw.y + pawH * 0.12, pPw.z - pl * 0.04], rx: legR * 0.72, ry: legR * 0.72, furScale: 0.30 + breed.curl * 0.30, coatZ: 0.61, coatYCenter: 0.09, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 8. Plump arched mid-paw
      { pos: [pPw.x, pawH * 0.58, pPw.z + pl * 0.16], rx: pw * 1.04, ry: pawH * 0.58, topFlat: 0.08, bottomFlat: 0.65, sideShiftY: -0.14, furScale: 0.24, coatZ: 0.62, coatYCenter: 0.06, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 9. Rounded toe knuckles
      { pos: [pPw.x, pawH * 0.50, pPw.z + pl * 0.50], rx: pw * 1.08, ry: pawH * 0.52, topFlat: 0.08, bottomFlat: 0.70, sideShiftY: -0.18, furScale: 0.20, coatZ: 0.64, coatYCenter: 0.05, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 10. Plump rounded toe tips
      { pos: [pPw.x, pawH * 0.38, pPw.z + pl * 0.76], rx: pw * 0.80, ry: pawH * 0.40, bottomFlat: 0.55, sideShiftY: -0.16, furScale: 0.16, coatZ: 0.66, coatYCenter: 0.04, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 11. Tip closure
      { pos: [pPw.x, pawH * 0.24, pPw.z + pl * 0.88], rx: pw * 0.18, ry: pawH * 0.14, furScale: 0.10, coatZ: 0.67, coatYCenter: 0.03, coatXOffset: 0, coatXSpan: side, coatZone: 3, dir: [0, -0.18, 0.98] },
    ];

    const { rings, stationRingIndex: idx, arcLengths } = resampleSections(
      stations,
      [1, 2, 2, 3, 3, 2, 2, 2, 2, 1, 1]
    );
    assignLegWeights(rings, arcLengths, arcLengths[idx[2]], arcLengths[idx[4]], arcLengths[idx[7]]);

    const legSkeleton = new THREE.Skeleton([chest, shoulder, upper, lower, paw]);
    disposables.skeletons.push(legSkeleton);
    const legGeo = createSkinnedTube(rings, 14, {
      useCoatYSpan: false,
      autoCombFromTangent: { t: 0.94, u: -0.32 },
      postProcess: makePawPostProcess(pPw, pw, pl),
    });
    addSkinnedFurredPart(root, legGeo, baseCoatMat, shellFurMat, 16, legSkeleton, disposables);
    addPawPads(paw, legR, pawH, true, padMat, disposables);

    return { shoulder, upper, lower, paw };
  }

  function buildBackLeg(side, label) {
    const hip = new THREE.Bone();
    hip.name = `hip_${label}`;
    hip.position.set(side * hipOffX, hipOffY, hipOffZ);
    pelvis.add(hip);

    const upper = new THREE.Bone();
    upper.name = `upper_${label}`;
    upper.rotation.x = backUpperX;
    hip.add(upper);

    const lower = new THREE.Bone();
    lower.name = `lower_${label}`;
    lower.position.set(0, -backUpperLen, 0);
    lower.rotation.x = backLowerX;
    upper.add(lower);

    const paw = new THREE.Bone();
    paw.name = `paw_${label}`;
    paw.position.set(0, -backLowerLen, 0);
    paw.rotation.x = backPawX;
    lower.add(paw);

    root.updateMatrixWorld(true);

    const pHp = getBonePos(hip);
    const pSt = getBonePos(lower);
    const pPw = getBonePos(paw);
    const pw = legR * 1.28;
    const pl = legR * 2.08;
    const hipTopLift = Math.min(legR * 1.38, pelvisHalfD * 0.56);
    const hockJut = -Math.min(legR * 1.12, backLowerLen * 0.38);

    const lowerWorldPt = (uFrac, localZ) => {
      const v = new THREE.Vector3(0, -backLowerLen * uFrac, localZ);
      lower.localToWorld(v);
      return [v.x, v.y, v.z];
    };

    const stations = [
      // 0. Buried inside pelvis/rump (weighted to pelvis so hip junction never steps or splits)
      { pos: [pHp.x - side * legR * 0.90, pHp.y + hipTopLift, pHp.z - legR * 0.16], rx: legR * 1.05, ry: legR * 1.95, furScale: 1.04, coatZ: -0.62, coatYCenter: 0.64, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 1. Upper muscular haunch emerging smoothly from rump flank
      { pos: [pHp.x - side * legR * 0.34, pHp.y + hipTopLift * 0.48, pHp.z - legR * 0.20], rx: legR * 1.50, ry: legR * 2.40, furScale: 1.06, coatZ: -0.63, coatYCenter: 0.58, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.48 },
      // 2. Hip pivot / broad upper thigh
      { pos: [pHp.x - side * legR * 0.08, pHp.y, pHp.z - legR * 0.16], rx: legR * 1.68, ry: legR * 2.55, furScale: 1.06, coatZ: -0.64, coatYCenter: 0.50, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.72 },
      // 3. Mid thigh tapering toward stifle
      { pos: [pHp.x * 0.48 + pSt.x * 0.52, pHp.y * 0.48 + pSt.y * 0.52, pHp.z * 0.48 + pSt.z * 0.52 - legR * 0.12], rx: legR * 1.42, ry: legR * 1.88, furScale: 0.94, coatZ: -0.58, coatYCenter: 0.38, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.78 },
      // 4. Stifle (knee) pivot
      { pos: [pSt.x, pSt.y, pSt.z], rx: legR * 1.14, ry: legR * 1.34, furScale: 0.84, coatZ: -0.52, coatYCenter: 0.30, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.70 },
      // 5. Muscular gaskin
      { pos: lowerWorldPt(0.34, hockJut * 0.78), rx: legR * 0.88, ry: legR * 1.06, furScale: 0.72, coatZ: -0.58, coatYCenter: 0.22, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.55 },
      // 6. Distinct canine hock (tarsus)
      { pos: lowerWorldPt(0.54, hockJut), rx: legR * 0.72, ry: legR * 0.88, furScale: 0.58, coatZ: -0.62, coatYCenter: 0.18, coatXOffset: 0, coatXSpan: side, coatZone: 3, backFeather: legFeather * 0.30 },
      // 7. Slender vertical metatarsus
      { pos: lowerWorldPt(0.80, hockJut * 0.40), rx: legR * 0.60, ry: legR * 0.64, furScale: 0.42 + breed.curl * 0.38, coatZ: -0.58, coatYCenter: 0.12, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 8. Ankle curving smoothly into hind paw
      { pos: [pPw.x, pPw.y + pawH * 0.12, pPw.z - pl * 0.04], rx: legR * 0.66, ry: legR * 0.68, furScale: 0.30 + breed.curl * 0.30, coatZ: -0.54, coatYCenter: 0.08, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 9. Plump arched mid-paw
      { pos: [pPw.x, pawH * 0.58, pPw.z + pl * 0.16], rx: pw * 1.04, ry: pawH * 0.58, topFlat: 0.08, bottomFlat: 0.65, sideShiftY: -0.14, furScale: 0.24, coatZ: -0.50, coatYCenter: 0.06, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 10. Rounded toe knuckles
      { pos: [pPw.x, pawH * 0.50, pPw.z + pl * 0.50], rx: pw * 1.08, ry: pawH * 0.52, topFlat: 0.08, bottomFlat: 0.70, sideShiftY: -0.18, furScale: 0.20, coatZ: -0.46, coatYCenter: 0.05, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 11. Plump rounded toe tips
      { pos: [pPw.x, pawH * 0.38, pPw.z + pl * 0.76], rx: pw * 0.80, ry: pawH * 0.40, bottomFlat: 0.55, sideShiftY: -0.16, furScale: 0.16, coatZ: -0.44, coatYCenter: 0.04, coatXOffset: 0, coatXSpan: side, coatZone: 3 },
      // 12. Tip closure
      { pos: [pPw.x, pawH * 0.24, pPw.z + pl * 0.88], rx: pw * 0.18, ry: pawH * 0.14, furScale: 0.10, coatZ: -0.43, coatYCenter: 0.03, coatXOffset: 0, coatXSpan: side, coatZone: 3, dir: [0, -0.18, 0.98] },
    ];

    const { rings, stationRingIndex: idx, arcLengths } = resampleSections(
      stations,
      [1, 2, 2, 3, 3, 2, 2, 2, 2, 2, 1, 1]
    );
    assignLegWeights(rings, arcLengths, arcLengths[idx[2]], arcLengths[idx[4]], arcLengths[idx[8]]);

    const legSkeleton = new THREE.Skeleton([pelvis, hip, upper, lower, paw]);
    disposables.skeletons.push(legSkeleton);
    const legGeo = createSkinnedTube(rings, 14, {
      useCoatYSpan: false,
      autoCombFromTangent: { t: 0.94, u: -0.32 },
      postProcess: makePawPostProcess(pPw, pw, pl),
    });
    addSkinnedFurredPart(root, legGeo, baseCoatMat, shellFurMat, 16, legSkeleton, disposables);
    addPawPads(paw, legR, pawH, false, padMat, disposables);

    return { hip, upper, lower, paw };
  }

  const FL = buildFrontLeg(1, 'FL');
  const FR = buildFrontLeg(-1, 'FR');
  const BL = buildBackLeg(1, 'BL');
  const BR = buildBackLeg(-1, 'BR');

  // ==========================================================================
  // Continuous 5-Bone Skinned Tail (pelvis -> tail1..tail5)
  // ==========================================================================
  const tailLen = breed.tailLength;
  const segLen = tailLen / 5;
  const tRad = breed.tailRadius;
  const tFluff = breed.tailFluff;

  let tailBaseX = 0.25;
  let tailSegX = 0.10;
  if (breed.tailType === 'curled') {
    tailBaseX = 0.88;
    tailSegX = 0.54 * breed.tailCurl;
  } else if (breed.tailType === 'plume') {
    tailBaseX = breed.id === 'husky' ? 0.52 : (breed.id === 'poodle' ? 0.95 : -0.14);
    tailSegX = breed.id === 'husky' ? 0.26 : (breed.id === 'poodle' ? 0.12 : 0.14);
  } else if (breed.tailType === 'short') {
    tailBaseX = 0.35;
    tailSegX = 0.08;
  } else {
    tailBaseX = breed.id === 'beagle' ? 0.88 : (breed.id === 'labrador' ? -0.10 : 0.10);
    tailSegX = breed.id === 'beagle' ? 0.08 : 0.06;
  }

  const tailJoints = [];
  let tailParent = pelvis;
  const tailRootPos = new THREE.Vector3(0, pelvisHalfD * 0.42, -B * 0.16);
  const plumeFeather = breed.tailType === 'plume' ? breed.feathering * 0.72 : (breed.tailType === 'curled' ? 0.32 : 0.0);

  for (let i = 0; i < 5; i++) {
    const tj = new THREE.Bone();
    tj.name = `tail${i + 1}`;
    if (i === 0) {
      tj.position.copy(tailRootPos);
      tj.rotation.x = tailBaseX;
    } else {
      tj.position.set(0, 0, -segLen);
      tj.rotation.x = tailSegX;
    }
    tailParent.add(tj);
    tailJoints.push(tj);
    tailParent = tj;
  }

  root.updateMatrixWorld(true);

  const tailAnchorVec = tailJoints[0].localToWorld(new THREE.Vector3(0, 0, Math.min(segLen * 0.48, B * 0.07)));
  const tailNearTipVec = tailJoints[4].localToWorld(new THREE.Vector3(0, 0, -segLen * 0.72));
  const tailTipVec = tailJoints[4].localToWorld(new THREE.Vector3(0, 0, -segLen * 1.06));

  const tailRadiusAt = (u) => {
    const pom = (breed.id === 'poodle' && u >= 0.55) ? (1.0 + 0.34 * Math.sin(((u - 0.55) / 0.45) * Math.PI * 0.85)) : 1.0;
    return tRad * (1.14 - u * 0.58) * pom;
  };
  const tailFurAt = (u) => THREE.MathUtils.lerp(0.88, tFluff, Math.sin(Math.min(1, u + 0.12) * Math.PI * 0.85));

  const tailStations = [
    // 0. Buried inside rump (weighted to pelvis for seamless tail-root blend)
    { pos: [tailAnchorVec.x, tailAnchorVec.y, tailAnchorVec.z], rx: tRad * 1.24, ry: tRad * 1.24, furScale: 0.92, coatZ: -0.22, coatYCenter: 0.58, coatYSpan: 0.24, coatXSpan: 0.30, coatZone: 4, bottomFeather: plumeFeather * 0.5 },
  ];
  for (let i = 0; i < 5; i++) {
    const u = i / 5;
    const p = getBonePos(tailJoints[i]);
    const r = tailRadiusAt(u);
    tailStations.push({
      pos: [p.x, p.y, p.z],
      rx: r,
      ry: r,
      furScale: tailFurAt(u),
      coatZ: -0.25 - u * 0.72,
      coatYCenter: 0.58 - u * 0.04,
      coatYSpan: 0.24 - u * 0.02,
      coatXSpan: 0.28 - u * 0.08,
      coatZone: 4,
      bottomFeather: plumeFeather * (0.95 + 0.10 * Math.sin(u * Math.PI)),
    });
  }
  const rNearTip = tailRadiusAt(0.94) * 0.82;
  tailStations.push(
    { pos: [tailNearTipVec.x, tailNearTipVec.y, tailNearTipVec.z], rx: rNearTip, ry: rNearTip, furScale: tailFurAt(0.94), coatZ: -0.94, coatYCenter: 0.54, coatYSpan: 0.20, coatXSpan: 0.18, coatZone: 4, bottomFeather: plumeFeather * 0.75 },
    { pos: [tailTipVec.x, tailTipVec.y, tailTipVec.z], rx: tRad * 0.16, ry: tRad * 0.16, furScale: tailFurAt(1.0) * 0.78, coatZ: -1.00, coatYCenter: 0.54, coatYSpan: 0.16, coatXSpan: 0.14, coatZone: 4, bottomFeather: plumeFeather * 0.40 }
  );

  const { rings: tailRings, stationRingIndex: tailIdx, arcLengths: tailArcs } = resampleSections(
    tailStations,
    [2, 3, 3, 3, 3, 2, 1]
  );
  assignChainWeights(
    tailRings,
    tailArcs,
    [
      tailArcs[tailIdx[1]],
      tailArcs[tailIdx[2]],
      tailArcs[tailIdx[3]],
      tailArcs[tailIdx[4]],
      tailArcs[tailIdx[5]],
    ],
    0.06
  );
  const tailSkeleton = new THREE.Skeleton([pelvis, ...tailJoints]);
  disposables.skeletons.push(tailSkeleton);
  const tailGeo = createSkinnedTube(tailRings, 12, {
    invertU: true,
    autoCombFromTangent: { t: 0.92, u: 0.35 },
  });
  addSkinnedFurredPart(root, tailGeo, baseCoatMat, shellFurMat, 16, tailSkeleton, disposables);

  // ==========================================================================
  // Joints Dictionary & Metrics for Animator
  // ==========================================================================
  const joints = {
    pelvis,
    spine1,
    spine2,
    chest,
    neck,
    head,
    jaw,
    earL,
    earR,
    eyelidL: leftEye.eyelidPivot,
    eyelidR: rightEye.eyelidPivot,
    tongue,
    tail1: tailJoints[0],
    tail2: tailJoints[1],
    tail3: tailJoints[2],
    tail4: tailJoints[3],
    tail5: tailJoints[4],
    FL,
    FR,
    BL,
    BR,
  };

  const metrics = {
    shoulderHeight: H,
    bodyLength: B,
    chestDepth: cDepth,
    chestWidth: cWidth,
    pelvisY,
    pelvisZ,
    spine1Z,
    spine2Z,
    chestZ,
    shoulderY,
    hipY,
    frontUpperLen,
    frontLowerLen,
    backUpperLen,
    backLowerLen,
    pawH,
    legClearance,
    neckLength: nl,
    headSize: hs,
    muzzleLength: ml,
    neutralAngles: {
      frontUpperX,
      frontLowerX,
      frontPawX,
      backUpperX,
      backLowerX,
      backPawX,
      neckX: neckNeutralX,
      headX: headNeutralX,
      tailBaseX,
      tailSegX,
    },
    basePositions: {
      pelvis: [0, pelvisY, pelvisZ],
      spine1: [0, 0, spine1Z],
      spine2: [0, 0, spine2Z],
      chest: [0, chestCenterY - pelvisY, chestZ],
      neck: [0, neckBaseY, neckBaseZ],
      head: [0, headBaseY, headBaseZ],
      earL: [earX, earY, earZ],
      earR: [-earX, earY, earZ],
      eyeL: [eyeX, eyeY, eyeZ],
      eyeR: [-eyeX, eyeY, eyeZ],
    },
    earBaseRot,
  };

  // ==========================================================================
  // Weather / Surface Appearance Setters & Dispose
  // ==========================================================================
  function setFurWetness(w) {
    const v = THREE.MathUtils.clamp(Number(w) || 0, 0, 1);
    furUniforms.uWetness.value = v;
    noseMat.clearcoatRoughness = THREE.MathUtils.lerp(0.06, 0.02, v);
    padMat.roughness = THREE.MathUtils.lerp(0.78, 0.34, v);
  }

  function setSnowOnFur(s) {
    const v = THREE.MathUtils.clamp(Number(s) || 0, 0, 1);
    furUniforms.uSnow.value = v;
  }

  function setDirtiness(d) {
    const v = THREE.MathUtils.clamp(Number(d) || 0, 0, 1);
    furUniforms.uDirt.value = v;
  }

  function dispose() {
    for (const g of disposables.geometries) g.dispose();
    for (const m of disposables.materials) m.dispose();
    for (const t of disposables.textures) t.dispose();
    for (const s of disposables.skeletons) s.dispose();
    disposables.geometries.length = 0;
    disposables.materials.length = 0;
    disposables.textures.length = 0;
    disposables.skeletons.length = 0;
  }

  return {
    root,
    joints,
    eyes,
    metrics,
    furUniforms,
    setFurWetness,
    setSnowOnFur,
    setDirtiness,
    dispose,
  };
}
