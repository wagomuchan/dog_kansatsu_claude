import * as THREE from 'three';
import { BREEDS, getBreedById } from './breeds.js';

// ============================================================================
// Procedural Canvas Textures (Eye Iris, Wet Nose Leather, Paw Pads)
// ============================================================================

function createIrisTexture(eyeColorHex) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;

  const base = new THREE.Color(eyeColorHex);
  const dark = base.clone().multiplyScalar(0.32);
  const mid = base.clone();
  const bright = base.clone().lerp(new THREE.Color('#fff4d6'), 0.38);

  // Outer dark sclera / pigmented canine eye margin
  ctx.fillStyle = '#19130f';
  ctx.fillRect(0, 0, size, size);

  // Subtle off-white sclera edge far outside iris (dogs show very little white)
  const scleraGrad = ctx.createRadialGradient(cx, cy, size * 0.38, cx, cy, size * 0.50);
  scleraGrad.addColorStop(0, '#231b15');
  scleraGrad.addColorStop(0.55, '#68594b');
  scleraGrad.addColorStop(1, '#c8bfb3');
  ctx.fillStyle = scleraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.50, 0, Math.PI * 2);
  ctx.fill();

  // Dark limbal ring framing the iris
  ctx.fillStyle = '#' + dark.clone().multiplyScalar(0.45).getHexString();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // Main iris gradient
  const irisGrad = ctx.createRadialGradient(cx, cy, size * 0.14, cx, cy, size * 0.40);
  irisGrad.addColorStop(0.0, '#' + bright.getHexString());
  irisGrad.addColorStop(0.38, '#' + mid.getHexString());
  irisGrad.addColorStop(0.82, '#' + dark.getHexString());
  irisGrad.addColorStop(1.0, '#0d0907');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.40, 0, Math.PI * 2);
  ctx.fill();

  // Radial iris fibers for lifelike organic depth
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * Math.PI * 2 + Math.sin(i * 17.3) * 0.03;
    const innerR = size * (0.17 + (i % 5) * 0.008);
    const outerR = size * (0.34 + Math.sin(i * 5.7) * 0.045);
    const isLight = i % 3 === 0;
    ctx.strokeStyle = isLight
      ? `rgba(${Math.round(bright.r * 255)}, ${Math.round(bright.g * 255)}, ${Math.round(bright.b * 255)}, 0.24)`
      : `rgba(${Math.round(dark.r * 255)}, ${Math.round(dark.g * 255)}, ${Math.round(dark.b * 255)}, 0.30)`;
    ctx.lineWidth = isLight ? 1.3 : 1.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
    ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
    ctx.stroke();
  }
  ctx.restore();

  // Soft warm amber reflection band on lower iris (caustic bounce)
  const caustic = ctx.createRadialGradient(cx, cy + size * 0.13, 2, cx, cy + size * 0.13, size * 0.20);
  caustic.addColorStop(0, `rgba(${Math.round(bright.r * 255)}, ${Math.round(bright.g * 255)}, ${Math.round(bright.b * 255)}, 0.32)`);
  caustic.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = caustic;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Deep black pupil with subtle inner softness
  const pupilGrad = ctx.createRadialGradient(cx, cy, size * 0.12, cx, cy, size * 0.195);
  pupilGrad.addColorStop(0, '#020203');
  pupilGrad.addColorStop(0.84, '#050406');
  pupilGrad.addColorStop(1, 'rgba(10,7,6,0)');
  ctx.fillStyle = pupilGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.195, 0, Math.PI * 2);
  ctx.fill();

  // Subtle dark shadow from upper eyelid
  const topShadow = ctx.createLinearGradient(0, cy - size * 0.42, 0, cy + size * 0.05);
  topShadow.addColorStop(0, 'rgba(0,0,0,0.45)');
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

  // Fine cobblestone/pebble leather grain of a canine rhinarium
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 420; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1.6 + rnd() * 2.4;
    const g = ctx.createRadialGradient(x, y, 0.2, x, y, r);
    g.addColorStop(0, '#dedede');
    g.addColorStop(0.7, '#9a9a9a');
    g.addColorStop(1, '#383838');
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
varying vec3 vWorldNormalFur;
varying vec3 vWorldPosFur;
`;

const FUR_VERTEX_DISPLACE = /* glsl */ `
vShellHeight = aShellHeight;
vBodyPos = aBodyPos;
vCoatCoord = aCoatCoord;
vFurScale = aFurScale;

if (aShellHeight > 0.0001) {
  float h = aShellHeight;
  float h2 = h * h;
  // Wetness compresses and weighs fur down
  float wetCompress = mix(1.0, 0.62, uWetness);
  float localLen = uFurLength * aFurScale * wetCompress;

  // Natural comb direction + gravity droop along hair length
  float combAmt = mix(0.85, 0.28, uFluffiness) + uWetness * 0.45;
  vec3 combVec = aCombDir;
  float combLen = length(combVec);
  if (combLen > 0.0001) combVec /= combLen;

  vec3 nDir = normalize(objectNormal);
  vec3 disp = nDir * (localLen * h) + combVec * (localLen * combAmt * h2);

  // Curly coat spiral offset (Toy Poodle, subtle wave on Golden)
  if (uCurl > 0.02) {
    float phase = dot(aBodyPos, vec3(92.0, 113.0, 87.0)) + h * 11.5;
    vec3 t1 = normalize(cross(nDir, abs(nDir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(nDir, t1);
    float curlR = localLen * 0.34 * uCurl * sin(h * 3.14159);
    disp += (t1 * cos(phase) + t2 * sin(phase)) * curlR;
  }

  // Subtle dynamic fur flutter during wet-dog shake
  if (uShake > 0.001) {
    float flutter = sin(uTime * 38.0 + aBodyPos.z * 16.0 + aBodyPos.y * 12.0);
    disp += nDir * (localLen * 0.35 * uShake * h2 * (0.5 + 0.5 * flutter));
  }

  transformed += disp;
}

vWorldNormalFur = normalize(mat3(modelMatrix) * objectNormal);
vWorldPosFur = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const FUR_FRAGMENT_PREAMBLE = /* glsl */ `
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec3 uTertiaryColor;
uniform float uPattern;
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
  // cc.x: lateral (-1..1), cc.y: vertical (0=paws, 0.45=belly, 1.0=dorsal)
  // cc.z: longitudinal (-1=tail/rump, 0=midback, 0.8=chest, 1.0=neck, 1.2=skull, 1.5=muzzle tip)
  // cc.w: zone (0=torso/neck, 1=head, 2=ears, 3=legs, 4=tail)
  float ax = abs(cc.x);
  float y = cc.y;
  float z = cc.z;
  float zone = cc.w;

  // Feathery organic edge perturbation so markings look grown from hair
  float edgeN = (clumpN - 0.5) * 0.11 + (fineTone - 0.5) * 0.04;
  float blazeW = uMarkingsA.x;
  float collarW = uMarkingsA.y;
  float browW = uMarkingsA.z;
  float sockW = uMarkingsA.w;
  float tipWhite = uMarkingsB.x;
  float dorsalDark = uMarkingsB.y;

  vec3 col = uPrimaryColor;

  if (uPattern < 0.5) {
    // SOLID (Golden, Labrador, Toy Poodle): rich natural shading, lighter belly/feathering
    float bellyBlend = smoothstep(0.66, 0.34, y + edgeN) * (zone < 1.5 || zone > 2.5 ? 1.0 : 0.0);
    float featherLight = smoothstep(1.05, 1.65, vFurScale) * 0.45;
    col = mix(uPrimaryColor, uSecondaryColor, clamp(bellyBlend * 0.55 + featherLight, 0.0, 0.78));
    // Slightly warmer/deeper on ear tips and dorsal back
    float earShade = (zone > 1.5 && zone < 2.5) ? 0.25 : 0.0;
    float spineShade = smoothstep(0.76, 1.0, y + edgeN * 0.5) * smoothstep(0.65, 0.15, ax) * dorsalDark;
    col = mix(col, uTertiaryColor, clamp(spineShade + earShade * dorsalDark, 0.0, 0.65));
  } else if (uPattern < 1.5) {
    // URAJIRO (Shiba Inu, Corgi): rich dorsal coat + creamy underside, cheeks, chest, inner legs
    float underMask = smoothstep(0.60, 0.42, y + edgeN);
    // Chest front bib
    float chestBib = smoothstep(0.55, 0.85, z + edgeN) * smoothstep(0.78, 0.52, y + edgeN) * smoothstep(0.70, 0.20, ax);
    // Muzzle & lower cheeks cream (urajiro face)
    float faceUrajiro = 0.0;
    if (zone > 0.5 && zone < 1.5) {
      float lowerCheek = smoothstep(0.58, 0.38, y + edgeN * 0.7);
      float snoutSides = smoothstep(1.22, 1.46, z) * smoothstep(0.66, 0.44, y + edgeN * 0.5);
      faceUrajiro = max(lowerCheek, snoutSides * 0.85);
      // Forehead blaze (Corgi)
      if (blazeW > 0.05) {
        float blaze = smoothstep(0.19, 0.07, ax + edgeN * 0.3) * smoothstep(1.08, 1.24, z) * smoothstep(1.48, 1.32, z);
        faceUrajiro = max(faceUrajiro, blaze * blazeW);
      }
      // Cute pale eyebrow pips (Shiba maro)
      if (browW > 0.05) {
        vec2 browD = vec2((ax - 0.28) / 0.11, (y - 0.76) / 0.09);
        float browZ = smoothstep(1.16, 1.25, z) * smoothstep(1.36, 1.28, z);
        float browSpot = smoothstep(1.1, 0.35, length(browD)) * browZ * browW;
        faceUrajiro = max(faceUrajiro, browSpot);
      }
    }
    // White neck collar (Corgi)
    float collarMask = 0.0;
    if (collarW > 0.05 && zone < 0.5) {
      collarMask = smoothstep(0.84, 0.96, z + edgeN) * smoothstep(1.14, 1.00, z + edgeN) * collarW;
    }
    // Legs: lower socks + inner leg urajiro
    float legMask = 0.0;
    if (zone > 2.5 && zone < 3.5) {
      legMask = smoothstep(0.36, 0.15, y + edgeN * 0.6) * sockW;
      legMask = max(legMask, smoothstep(0.55, 0.28, y + edgeN) * 0.65);
    }
    // Tail underside & tip cream
    float tailMask = 0.0;
    if (zone > 3.5) {
      tailMask = smoothstep(0.58, 0.38, y + edgeN);
      tailMask = max(tailMask, smoothstep(-0.78, -0.96, z + edgeN * 0.5) * tipWhite);
    }
    // Ears stay mostly primary on back
    float earKeep = (zone > 1.5 && zone < 2.5) ? 0.12 : 1.0;
    float sec = clamp(max(max(underMask, chestBib), max(max(faceUrajiro, collarMask), max(legMask, tailMask))) * earKeep, 0.0, 1.0);
    col = mix(uPrimaryColor, uSecondaryColor, sec);
    // Warm darker dorsal shading along back & tail top
    float dorsal = smoothstep(0.75, 0.98, y + edgeN * 0.5) * smoothstep(0.55, 0.10, ax) * (1.0 - sec) * dorsalDark;
    col = mix(col, uTertiaryColor, clamp(dorsal, 0.0, 0.60));
  } else if (uPattern < 2.5) {
    // TRICOLOR (Beagle): crisp white base + jet black saddle + rich chestnut-tan head/ears/flanks
    col = uPrimaryColor; // white base
    // Tan on head, ears, upper shoulders, thighs, and border of saddle
    float tanMask = 0.0;
    if (zone > 0.5 && zone < 2.5) {
      // Head & ears richly tan except white muzzle bottom & forehead blaze
      tanMask = smoothstep(0.42, 0.62, y + edgeN * 0.6);
      if (zone > 1.5) tanMask = 0.96; // velvety tan ears
      float muzzleWhite = smoothstep(1.30, 1.46, z + edgeN * 0.4) * smoothstep(0.70, 0.48, y);
      float blaze = smoothstep(0.18, 0.06, ax + edgeN * 0.25) * smoothstep(1.10, 1.24, z) * blazeW;
      tanMask *= (1.0 - clamp(max(muzzleWhite, blaze), 0.0, 0.95));
    } else if (zone < 0.5) {
      // Tan transition band around black saddle on flanks/rump/neck
      float band = smoothstep(0.48, 0.68, y + edgeN) * smoothstep(0.95, 0.65, z + edgeN);
      tanMask = band * 0.92;
    } else if (zone > 2.5 && zone < 3.5) {
      // Upper thigh/shoulder tan, white lower legs
      tanMask = smoothstep(0.32, 0.55, y + edgeN) * 0.85;
    } else if (zone > 3.5) {
      tanMask = smoothstep(-0.85, -0.50, z + edgeN) * smoothstep(0.45, 0.65, y);
    }
    col = mix(col, uSecondaryColor, clamp(tanMask, 0.0, 1.0));

    // Jet black saddle across mid/rear back and upper base of tail
    float blackSaddle = 0.0;
    if (zone < 0.5) {
      blackSaddle = smoothstep(0.58, 0.74, y + edgeN) * smoothstep(0.68, 0.36, z + edgeN) * smoothstep(-0.98, -0.68, z + edgeN);
    } else if (zone > 3.5) {
      // Black upper base of tail, crisp white tail tip!
      blackSaddle = smoothstep(-0.58, -0.32, z + edgeN) * smoothstep(0.48, 0.68, y + edgeN);
    }
    col = mix(col, uTertiaryColor, clamp(blackSaddle, 0.0, 1.0));
    // Crisp white tail tip
    if (zone > 3.5 && tipWhite > 0.2) {
      float wt = smoothstep(-0.66, -0.82, z + edgeN * 0.5) * tipWhite;
      col = mix(col, uPrimaryColor, wt);
    }
  } else if (uPattern < 3.5) {
    // SADDLE / BLACK & TAN (Dachshund): deep glossy black coat + mahogany tan points
    col = uPrimaryColor; // glossy black
    float tanPt = 0.0;
    if (zone > 0.5 && zone < 1.5) {
      // Tan lower muzzle & cheeks
      tanPt = smoothstep(0.54, 0.34, y + edgeN * 0.5) * smoothstep(1.08, 1.32, z);
      // Iconic distinct tan eyebrow pips!
      vec2 browD = vec2((ax - 0.26) / 0.11, (y - 0.74) / 0.09);
      float browZ = smoothstep(1.14, 1.24, z) * smoothstep(1.36, 1.27, z);
      tanPt = max(tanPt, smoothstep(1.15, 0.35, length(browD)) * browZ * browW);
    } else if (zone < 0.5) {
      // Two warm tan chest patches + subtle lower belly trim
      float chestPatch = smoothstep(0.62, 0.88, z + edgeN) * smoothstep(0.62, 0.36, y + edgeN) * smoothstep(0.58, 0.20, ax);
      float bellyTrim = smoothstep(0.42, 0.26, y + edgeN) * 0.55;
      tanPt = max(chestPatch, bellyTrim);
    } else if (zone > 2.5 && zone < 3.5) {
      // Tan lower legs & paws
      tanPt = smoothstep(0.48, 0.22, y + edgeN * 0.5) * sockW;
    } else if (zone > 3.5) {
      // Tan underside of tail
      tanPt = smoothstep(0.50, 0.32, y + edgeN) * 0.85;
    }
    col = mix(col, uSecondaryColor, clamp(tanPt, 0.0, 1.0));
  } else {
    // MASK (Siberian Husky): wolf-grey/charcoal dorsal coat + snow-white mask, chest, belly, legs
    float whiteMask = smoothstep(0.64, 0.44, y + edgeN);
    // Snow-white chest & lower neck
    float chestWhite = smoothstep(0.52, 0.86, z + edgeN) * smoothstep(0.84, 0.56, y + edgeN);
    whiteMask = max(whiteMask, chestWhite);

    if (zone > 0.5 && zone < 1.5) {
      // Iconic Husky face: dark crown cap dipping down to a widow's peak, white cheeks/eye-mask/muzzle!
      float capLine = 0.68 - 0.14 * smoothstep(0.28, 0.0, ax) + 0.12 * smoothstep(1.15, 1.38, z);
      float faceWhite = smoothstep(capLine + 0.08, capLine - 0.08, y + edgeN * 0.5);
      // Muzzle completely snow-white
      faceWhite = max(faceWhite, smoothstep(1.26, 1.40, z + edgeN * 0.4));
      // Narrow pale bar between eyes
      float bar = smoothstep(0.13, 0.03, ax + edgeN * 0.2) * smoothstep(1.16, 1.28, z) * blazeW;
      whiteMask = clamp(max(faceWhite, bar), 0.0, 1.0);
    } else if (zone > 1.5 && zone < 2.5) {
      // Dark furred outer ears
      whiteMask = 0.05;
    } else if (zone > 2.5 && zone < 3.5) {
      // White legs with soft grey upper thigh/shoulder
      whiteMask = smoothstep(0.56, 0.28, y + edgeN * 0.6) * sockW;
    } else if (zone > 3.5) {
      // Grey top brush, snow-white underside & tip
      whiteMask = max(smoothstep(0.60, 0.40, y + edgeN), smoothstep(-0.80, -0.96, z) * tipWhite);
    }

    col = mix(uPrimaryColor, uSecondaryColor, clamp(whiteMask, 0.0, 1.0));
    // Darker charcoal dorsal stripe & crown cap depth
    float darkCap = smoothstep(0.76, 0.96, y + edgeN * 0.5) * smoothstep(0.55, 0.12, ax) * (1.0 - whiteMask) * dorsalDark;
    col = mix(col, uTertiaryColor, clamp(darkCap, 0.0, 0.68));
  }

  // Organic hair-to-hair tonal richness
  float toneVar = 1.0 + (fineTone - 0.5) * 0.14 + (clumpN - 0.5) * 0.10;
  col *= toneVar;
  return col;
}
`;

const FUR_FRAGMENT_COLOR = /* glsl */ `
{
  // Clump noise for natural fur locks (stronger clumping when wet or curly)
  float clumpScale = mix(18.0, 12.0, uWetness) + uCurl * 10.0;
  float clumpN = fur_noise3(vBodyPos * clumpScale);
  vec2 cell = fur_cell3D(vBodyPos * uStrandFreq + vec3(clumpN * (0.28 + uWetness * 0.45)));
  float dist = cell.x;
  float strandId = cell.y;

  if (uIsShell > 0.5) {
    // Each strand has randomized natural height (modulated by fur clumps)
    float maxH = mix(0.42, 1.02, strandId) * mix(0.84, 1.12, clumpN);
    // Curly coat stays fuller toward tips
    float taperPower = mix(0.82, 0.52, uCurl);
    float radius = mix(0.62, 0.06, pow(clamp(vShellHeight / max(maxH, 0.01), 0.0, 1.0), taperPower));
    // Wet fur clumps into thicker pointed locks with gaps between
    radius *= mix(1.0, 0.78 + 0.38 * clumpN, uWetness);
    if (vShellHeight > maxH || dist > radius) {
      discard;
    }
  }

  vec3 coatCol = fur_computeCoatColor(vCoatCoord, vBodyPos, strandId, clumpN);

  // Ambient self-occlusion: deeper shadowed undercoat near roots, bright airy tips
  float ao = uIsShell > 0.5
    ? mix(0.36, 1.08, pow(clamp(vShellHeight, 0.0, 1.0), 0.70))
    : 0.34;
  // Slightly brighten sunlit outer tips for soft double-coat glow
  float tipLift = smoothstep(0.60, 1.0, vShellHeight) * 0.08 * uFluffiness;
  coatCol = coatCol * ao + vec3(tipLift) * coatCol;

  // Wetness darkens coat (water-saturated fur absorbs more light)
  coatCol *= mix(1.0, 0.62, uWetness);

  // Dirtiness accumulates organically on lower paws, lower legs, belly, and muzzle tip
  if (uDirt > 0.005) {
    float lowZone = smoothstep(0.46, 0.08, vCoatCoord.y);
    float snoutDirt = (vCoatCoord.w > 0.5 && vCoatCoord.w < 1.5)
      ? smoothstep(1.26, 1.48, vCoatCoord.z) * 0.75
      : 0.0;
    float dirtPatch = fur_noise3(vBodyPos * 14.0 + vec3(3.1, 1.7, 5.4));
    float dirtAmt = clamp(max(lowZone, snoutDirt) * smoothstep(0.28, 0.75, dirtPatch) * uDirt, 0.0, 0.85);
    vec3 mudCol = vec3(0.24, 0.17, 0.11) * mix(0.65, 1.0, vShellHeight);
    coatCol = mix(coatCol, mudCol, dirtAmt);
  }

  // Snow dusting settles on upward-facing surfaces and outer fur tips
  if (uSnow > 0.005) {
    float upMask = smoothstep(0.28, 0.82, vWorldNormalFur.y);
    float flakeN = fur_noise3(vBodyPos * 28.0 + vec3(9.2, 4.1, 2.3));
    float tipMask = uIsShell > 0.5 ? smoothstep(0.22, 0.78, vShellHeight) : 0.15;
    float snowAmt = clamp(upMask * tipMask * smoothstep(0.30, 0.74, flakeN) * uSnow * 1.25, 0.0, 0.92);
    vec3 snowCol = vec3(0.93, 0.96, 1.0);
    coatCol = mix(coatCol, snowCol, snowAmt);
  }

  diffuseColor.rgb = coatCol;
}
`;

const FUR_FRAGMENT_ROUGHNESS = /* glsl */ `
{
  // Dry fur is soft matte; wet fur gains damp sheen; snow is crisp matte-crystalline
  float baseRough = mix(0.86, 0.34, uWetness);
  // Short sleek coats (low fluffiness) have natural healthy coat gloss
  baseRough -= (1.0 - uFluffiness) * 0.18;
  // Tips catch slightly more soft sheen
  baseRough -= vShellHeight * 0.06;
  roughnessFactor = clamp(mix(baseRough, 0.58, uSnow * smoothstep(0.35, 0.85, vWorldNormalFur.y)), 0.24, 0.96);
}
`;

function createFurMaterial(uniforms, isShell, breed) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
    sheen: isShell ? 0.55 + breed.fluffiness * 0.25 : 0.25,
    sheenRoughness: 0.68,
    sheenColor: new THREE.Color(breed.secondaryColor).lerp(new THREE.Color('#ffffff'), 0.35),
    side: THREE.FrontSide,
  });

  mat.customProgramCacheKey = () => (isShell ? 'dog-shell-fur-v2' : 'dog-base-fur-v2');
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.uIsShell = { value: isShell ? 1.0 : 0.0 };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FUR_VERTEX_PREAMBLE}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${FUR_VERTEX_DISPLACE}`);

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

/**
 * Creates a smooth, closed anatomical lofted BufferGeometry with custom fur attributes.
 * Each section: {
 *   pos: [x,y,z], rx, ry,
 *   axis?: 'z'|'y',          // cross-section plane normal (default 'z')
 *   topFlat?: number,        // flattens top dorsal plane (0..0.4)
 *   bottomPinch?: number,    // narrows bottom keel/chest (0..0.4)
 *   sideShiftY?: number,     // shifts widest point up or down (-0.3..0.3)
 *   furScale?: number,       // fur length multiplier at this ring
 *   coatZ?: number,          // canonical longitudinal coordinate
 *   coatYCenter?: number,    // canonical vertical center
 *   coatYSpan?: number,      // canonical vertical half-span
 *   coatXSpan?: number,      // canonical lateral span
 *   coatZone?: number,       // 0=torso, 1=head, 2=ears, 3=legs, 4=tail
 *   combDir?: [x,y,z],       // local fur comb direction
 *   backFeather?: number,    // extra fur scale on -Z side (leg/tail feathering)
 *   bottomFeather?: number,  // extra fur scale on -Y side (belly/chest/plume tail)
 * }
 */
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
    const comb = s.combDir || (axis === 'z' ? [0, -0.25, -0.95] : [0, -0.92, -0.28]);
    const backFeather = s.backFeather || 0;
    const bottomFeather = s.bottomFeather || 0;
    const vCoord = i / Math.max(1, numRings - 1);

    for (let j = 0; j <= radialSegs; j++) {
      const uCoord = j / radialSegs;
      const a = uCoord * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      let lx, ly, lz;
      let normX, normY, backFactor, bottomFactor;

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
        backFactor = 0;
        bottomFactor = Math.max(0, -sy);
      } else {
        // Cross section in XZ plane (for legs/neck): ca = +X, sa = +Z
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
      const ccY = axis === 'z' ? coatYCenter + normY * coatYSpan : coatYCenter;
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
        // Downward loft (-Y progression) vs upward (+Y)
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

/**
 * Packs `layers` concentric shell copies of `baseGeo` into a single BufferGeometry (1 draw call).
 */
function createShellGeometry(baseGeo, layers = 18) {
  const posAttr = baseGeo.getAttribute('position');
  const normAttr = baseGeo.getAttribute('normal');
  const uvAttr = baseGeo.getAttribute('uv');
  const bodyAttr = baseGeo.getAttribute('aBodyPos');
  const combAttr = baseGeo.getAttribute('aCombDir');
  const scaleAttr = baseGeo.getAttribute('aFurScale');
  const coatAttr = baseGeo.getAttribute('aCoatCoord');
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
  return geo;
}

/**
 * Helper to create a furred part (opaque solid base + single combined multi-shell mesh).
 */
function addFurredPart(parent, baseGeo, baseMat, shellMat, layers, disposables) {
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  parent.add(baseMesh);

  const shellGeo = createShellGeometry(baseGeo, layers);
  const shellMesh = new THREE.Mesh(shellGeo, shellMat);
  shellMesh.castShadow = false;
  shellMesh.receiveShadow = true;
  parent.add(shellMesh);

  disposables.geometries.push(baseGeo, shellGeo);
  return { baseMesh, shellMesh };
}

// ============================================================================
// Specialized Anatomical Builders (Head, Ears, Paws, Nose, Mouth, Whiskers)
// ============================================================================

function buildHeadGeometry(breed, bodyTransformFn, eyeCoords) {
  const hs = breed.headSize;
  const ml = breed.muzzleLength;
  const mw = hs * breed.muzzleWidth;
  const mh = hs * breed.muzzleHeight;
  const stop = breed.stopDepth;
  const cheek = 1.0 + breed.cheekFluff * 0.24;
  const puff = breed.curl * 0.20;

  // Continuous sculpted cranium -> cheeks -> brow/stop -> nasal bridge -> muzzle tip
  const sections = [
    // Occiput (back of skull)
    { pos: [0, hs * 0.14, -hs * 0.96], rx: hs * 0.12, ry: hs * 0.10, furScale: 0.72, coatZ: 1.06, coatYCenter: 0.80, coatYSpan: 0.08, coatXSpan: 0.12, coatZone: 1, combDir: [0, -0.35, -0.92] },
    { pos: [0, hs * 0.14, -hs * 0.78], rx: hs * 0.66, ry: hs * 0.62, topFlat: 0.12, furScale: 0.78, coatZ: 1.10, coatYCenter: 0.76, coatYSpan: 0.22, coatXSpan: 0.55, coatZone: 1, combDir: [0, -0.30, -0.94] },
    // Crown & wide cheeks (zygomatic arches)
    { pos: [0, hs * 0.12, -hs * 0.34], rx: hs * 0.98 * cheek, ry: hs * 0.88 * (1 + puff * 0.4), topFlat: 0.16, sideShiftY: -0.06, furScale: 0.85 + breed.cheekFluff * 0.35, coatZ: 1.15, coatYCenter: 0.70, coatYSpan: 0.30, coatXSpan: 0.88, coatZone: 1, combDir: [0, -0.25, -0.95] },
    // Forehead & brow plane
    { pos: [0, hs * 0.10, hs * 0.14], rx: hs * 0.92 * cheek, ry: hs * 0.82 * (1 + puff * 0.3), topFlat: 0.18, bottomPinch: 0.08, sideShiftY: -0.08, furScale: 0.56 + breed.cheekFluff * 0.24, coatZ: 1.22, coatYCenter: 0.68, coatYSpan: 0.28, coatXSpan: 0.80, coatZone: 1, combDir: [0, -0.20, -0.96] },
    // Facial stop / orbital slope (eyes sit cleanly on this forward transition!)
    { pos: [0, hs * (0.00 - stop * 0.14), hs * 0.44], rx: hs * 0.66 * (1 + puff * 0.20), ry: hs * (0.52 - stop * 0.10), topFlat: 0.20, bottomPinch: 0.14, furScale: 0.24 + puff * 0.32, coatZ: 1.30, coatYCenter: 0.62, coatYSpan: 0.22, coatXSpan: 0.56, coatZone: 1, combDir: [0, -0.15, -0.98] },
    // Mid-muzzle (nasal bridge + upper lips/flews)
    { pos: [0, -hs * (0.07 + stop * 0.13), hs * 0.48 + ml * 0.44], rx: mw * (1.06 + puff * 0.30), ry: mh * (1.02 + puff * 0.24), topFlat: 0.28, bottomPinch: 0.06, sideShiftY: -0.10, furScale: 0.22 + puff * 0.48, coatZ: 1.40, coatYCenter: 0.56, coatYSpan: 0.18, coatXSpan: 0.44, coatZone: 1, combDir: [0, -0.10, -0.99] },
    // Front muzzle (around whisker pads)
    { pos: [0, -hs * (0.09 + stop * 0.13), hs * 0.50 + ml * 0.86], rx: mw * (0.86 + puff * 0.20), ry: mh * (0.84 + puff * 0.16), topFlat: 0.30, sideShiftY: -0.06, furScale: 0.18 + puff * 0.36, coatZ: 1.48, coatYCenter: 0.54, coatYSpan: 0.14, coatXSpan: 0.32, coatZone: 1, combDir: [0, -0.05, -0.99] },
    // Muzzle tip cap (behind nose leather)
    { pos: [0, -hs * (0.08 + stop * 0.13), hs * 0.50 + ml * 1.02], rx: mw * 0.22, ry: mh * 0.20, furScale: 0.12, coatZ: 1.52, coatYCenter: 0.54, coatYSpan: 0.06, coatXSpan: 0.10, coatZone: 1, combDir: [0, 0, -1] },
  ];

  const geo = createOrganicLoft(sections, 22, bodyTransformFn);

  // Sculpt subtle bilateral orbital sockets & shorten fur immediately around eyelids
  // so the glossy eyes are ALWAYS crisp, expressive, and unobstructed on every breed
  if (eyeCoords) {
    const pos = geo.getAttribute('position');
    const furScale = geo.getAttribute('aFurScale');
    const { eyeX, eyeY, eyeZ, eyeR } = eyeCoords;
    const clearR = eyeR * 2.1;

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
        // Shorten eyelid-area fur cleanly
        const curFur = furScale.getX(i);
        furScale.setX(i, THREE.MathUtils.lerp(curFur, 0.12, smoothW * 0.88));
        // Gentle socket depression directly behind eyeball center
        const indent = smoothW * eyeR * 0.24;
        pos.setXYZ(i, vx * (1.0 - indent * 0.35 / Math.max(0.01, hs)), vy, vz - indent * 0.55);
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
  const mw = hs * breed.muzzleWidth * 0.78;
  const mh = hs * breed.muzzleHeight * 0.46;
  const puff = breed.curl * 0.25;
  const jawLen = hs * 0.42 + ml * 0.84;

  const sections = [
    { pos: [0, 0, -hs * 0.14], rx: mw * 0.72, ry: mh * 0.60, furScale: 0.32 + puff * 0.45, coatZ: 1.24, coatYCenter: 0.42, coatYSpan: 0.08, coatXSpan: 0.35, coatZone: 1, combDir: [0, -0.45, -0.88] },
    { pos: [0, -mh * 0.10, jawLen * 0.35], rx: mw * 0.92, ry: mh * 0.82, topFlat: 0.38, furScale: 0.28 + puff * 0.45, coatZ: 1.34, coatYCenter: 0.40, coatYSpan: 0.08, coatXSpan: 0.34, coatZone: 1, combDir: [0, -0.35, -0.92] },
    { pos: [0, -mh * 0.06, jawLen * 0.78], rx: mw * 0.76, ry: mh * 0.68, topFlat: 0.38, furScale: 0.22 + puff * 0.35, coatZ: 1.44, coatYCenter: 0.42, coatYSpan: 0.07, coatXSpan: 0.26, coatZone: 1, combDir: [0, -0.25, -0.95] },
    { pos: [0, 0.0, jawLen * 0.96], rx: mw * 0.42, ry: mh * 0.40, topFlat: 0.30, furScale: 0.16 + puff * 0.25, coatZ: 1.49, coatYCenter: 0.44, coatYSpan: 0.05, coatXSpan: 0.16, coatZone: 1, combDir: [0, -0.15, -0.98] },
    { pos: [0, 0.0, jawLen * 1.03], rx: mw * 0.08, ry: mh * 0.08, furScale: 0.12, coatZ: 1.51, coatYCenter: 0.45, coatYSpan: 0.02, coatXSpan: 0.05, coatZone: 1, combDir: [0, -0.10, -0.99] },
  ];

  return createOrganicLoft(sections, 14, bodyTransformFn);
}

function buildEarMesh(breed, side, baseMat, shellMat, innerEarMat, bodyTransformFn, disposables) {
  // side: +1 = left (+X), -1 = right (-X)
  const group = new THREE.Group();
  const len = breed.earLength;
  const w = breed.earWidth;
  const th = breed.earWidth * 0.24 * breed.earThickness;
  const isPoodle = breed.curl > 0.5;
  const earFur = isPoodle ? 1.15 : (breed.earType === 'fold' ? 0.55 + breed.feathering * 0.55 : 0.42 + breed.fluffiness * 0.22);

  let sections;
  if (breed.earType === 'erect') {
    // Cupped triangular upright pinna pointing upward (+Y), concave face toward +Z
    sections = [
      { pos: [0, -len * 0.06, 0], rx: w * 0.48, ry: th * 1.30, axis: 'y', furScale: earFur * 1.1, coatZ: 1.16, coatYCenter: 0.84, coatXOffset: side * 0.45, coatXSpan: 0.14, coatZone: 2, combDir: [0, 0.45, -0.85] },
      { pos: [side * w * 0.04, len * 0.26, len * 0.03], rx: w * 0.54, ry: th * 1.05, axis: 'y', furScale: earFur, coatZ: 1.17, coatYCenter: 0.90, coatXOffset: side * 0.50, coatXSpan: 0.14, coatZone: 2, combDir: [0, 0.72, -0.65] },
      { pos: [side * w * 0.08, len * 0.62, len * 0.05], rx: w * 0.38, ry: th * 0.78, axis: 'y', furScale: earFur * 0.85, coatZ: 1.18, coatYCenter: 0.96, coatXOffset: side * 0.54, coatXSpan: 0.10, coatZone: 2, combDir: [0, 0.85, -0.45] },
      { pos: [side * w * 0.09, len * 0.90, len * 0.04], rx: w * 0.18, ry: th * 0.48, axis: 'y', furScale: earFur * 0.65, coatZ: 1.18, coatYCenter: 1.00, coatXOffset: side * 0.55, coatXSpan: 0.06, coatZone: 2, combDir: [0, 0.92, -0.30] },
      { pos: [side * w * 0.09, len * 1.02, len * 0.02], rx: w * 0.04, ry: th * 0.15, axis: 'y', furScale: earFur * 0.40, coatZ: 1.18, coatYCenter: 1.02, coatXOffset: side * 0.55, coatXSpan: 0.03, coatZone: 2, combDir: [0, 0.96, -0.20] },
    ];
  } else if (breed.earType === 'fold') {
    // Golden/Labrador triangular folded ear: lifts slightly at base then drapes forward-down
    sections = [
      { pos: [0, len * 0.05, 0], rx: th * 1.25, ry: w * 0.44, axis: 'y', furScale: earFur, coatZ: 1.15, coatYCenter: 0.82, coatXOffset: side * 0.52, coatXSpan: 0.12, coatZone: 2, combDir: [side * 0.25, -0.88, 0.35] },
      { pos: [side * w * 0.22, -len * 0.16, len * 0.10], rx: th * 1.05, ry: w * 0.52, axis: 'y', furScale: earFur * 1.08, coatZ: 1.18, coatYCenter: 0.72, coatXOffset: side * 0.62, coatXSpan: 0.12, coatZone: 2, combDir: [side * 0.12, -0.94, 0.28] },
      { pos: [side * w * 0.20, -len * 0.52, len * 0.18], rx: th * 0.86, ry: w * 0.48, axis: 'y', furScale: earFur * 1.12, coatZ: 1.21, coatYCenter: 0.60, coatXOffset: side * 0.62, coatXSpan: 0.10, coatZone: 2, combDir: [0, -0.96, 0.22] },
      { pos: [side * w * 0.14, -len * 0.84, len * 0.20], rx: th * 0.64, ry: w * 0.32, axis: 'y', furScale: earFur * 1.05, coatZ: 1.22, coatYCenter: 0.50, coatXOffset: side * 0.58, coatXSpan: 0.08, coatZone: 2, combDir: [0, -0.98, 0.16] },
      { pos: [side * w * 0.10, -len * 1.00, len * 0.18], rx: th * 0.20, ry: w * 0.08, axis: 'y', furScale: earFur * 0.70, coatZ: 1.22, coatYCenter: 0.45, coatXOffset: side * 0.55, coatXSpan: 0.04, coatZone: 2, combDir: [0, -0.99, 0.10] },
    ];
  } else {
    // 'drop': Long velvety pendulous ear (Beagle, Dachshund, fluffy Poodle)
    sections = [
      { pos: [0, 0.0, 0], rx: th * 1.20, ry: w * 0.42, axis: 'y', furScale: earFur, coatZ: 1.15, coatYCenter: 0.76, coatXOffset: side * 0.52, coatXSpan: 0.12, coatZone: 2, combDir: [side * 0.15, -0.95, 0.20] },
      { pos: [side * w * 0.18, -len * 0.24, len * 0.08], rx: th * 1.05, ry: w * 0.54, axis: 'y', furScale: earFur * 1.05, coatZ: 1.18, coatYCenter: 0.64, coatXOffset: side * 0.60, coatXSpan: 0.12, coatZone: 2, combDir: [side * 0.05, -0.97, 0.16] },
      { pos: [side * w * 0.16, -len * 0.62, len * 0.14], rx: th * 0.96, ry: w * 0.56, axis: 'y', furScale: earFur * 1.12, coatZ: 1.20, coatYCenter: 0.52, coatXOffset: side * 0.60, coatXSpan: 0.10, coatZone: 2, combDir: [0, -0.98, 0.14] },
      { pos: [side * w * 0.10, -len * 0.90, len * 0.15], rx: th * 0.80, ry: w * 0.42, axis: 'y', furScale: earFur * 1.05, coatZ: 1.21, coatYCenter: 0.44, coatXOffset: side * 0.56, coatXSpan: 0.08, coatZone: 2, combDir: [0, -0.99, 0.10] },
      { pos: [side * w * 0.08, -len * 1.02, len * 0.14], rx: th * 0.25, ry: w * 0.12, axis: 'y', furScale: earFur * 0.75, coatZ: 1.21, coatYCenter: 0.40, coatXOffset: side * 0.54, coatXSpan: 0.04, coatZone: 2, combDir: [0, -1.0, 0.05] },
    ];
  }

  const earGeo = createOrganicLoft(sections, 14, bodyTransformFn);
  addFurredPart(group, earGeo, baseMat, shellMat, 14, disposables);

  // Subtle pinkish-warm inner ear pinna for erect ears
  if (breed.earType === 'erect') {
    const innerGeo = new THREE.SphereGeometry(1, 12, 10);
    innerGeo.scale(w * 0.28, len * 0.34, th * 0.35);
    const innerMesh = new THREE.Mesh(innerGeo, innerEarMat);
    innerMesh.position.set(side * w * 0.04, len * 0.38, th * 0.82 + len * 0.035);
    innerMesh.rotation.x = -0.05;
    group.add(innerMesh);
    disposables.geometries.push(innerGeo);
  }

  return group;
}

function buildNoseMesh(breed, noseMat, disposables) {
  const hs = breed.headSize;
  const nw = hs * breed.muzzleWidth * 0.44;
  const nh = hs * breed.muzzleHeight * 0.34;
  const nd = nw * 0.68;

  const group = new THREE.Group();
  // Sculpted canine rhinarium (heart-bulbous leather shape with central philtrum & nostril indentations)
  const geo = new THREE.SphereGeometry(1, 18, 14);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Flatten front slightly, broaden upper bridge, narrow lower chin edge
    if (z > 0) z = Math.pow(z, 0.78) * 0.88;
    const widthProfile = y > 0 ? 1.0 + 0.14 * y : 1.0 + 0.28 * y;
    x *= widthProfile;

    // Central philtrum groove on lower front
    if (z > 0.2 && y < 0.15) {
      const groove = Math.exp(-x * x * 24.0) * Math.max(0, 0.2 - y) * 0.24;
      z -= groove;
    }

    // Bilateral comma-shaped nostril indentations
    if (z > 0.35) {
      const nx = Math.abs(x) - 0.42;
      const ny = y + 0.06;
      const d2 = nx * nx * 16.0 + ny * ny * 26.0;
      const nostril = Math.exp(-d2) * 0.26;
      z -= nostril;
    }

    pos.setXYZ(i, x * nw, y * nh, z * nd);
  }
  geo.computeVertexNormals();
  const noseMesh = new THREE.Mesh(geo, noseMat);
  noseMesh.castShadow = true;
  noseMesh.receiveShadow = true;
  group.add(noseMesh);

  // Dark inner nostril cavities for realism up close
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x050404 });
  const holeGeo = new THREE.SphereGeometry(nw * 0.15, 8, 8);
  holeGeo.scale(1.0, 0.72, 0.5);
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

function buildEyeAssembly(breed, side, irisMat, corneaMat, rimMat, eyelidMat, disposables) {
  const hs = breed.headSize;
  const r = hs * (breed.id === 'poodle' ? 0.175 : breed.id === 'dachshund' ? 0.165 : 0.158);

  const eyePivot = new THREE.Group();

  // Inner iris sphere (textured with iris + pupil centered on +Z)
  const irisGeo = new THREE.SphereGeometry(r, 18, 14);
  // Map front hemisphere (+Z) planarly onto the circular iris canvas texture
  const pos = irisGeo.getAttribute('position');
  const uv = irisGeo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) / r;
    const py = pos.getY(i) / r;
    const pz = pos.getZ(i) / r;
    if (pz >= -0.1) {
      uv.setXY(i, 0.5 + px * 0.52, 0.5 + py * 0.52);
    } else {
      uv.setXY(i, 0.02, 0.02);
    }
  }
  uv.needsUpdate = true;

  const eyeMesh = new THREE.Mesh(irisGeo, irisMat);
  eyePivot.add(eyeMesh);

  // Outer wet glossy cornea dome for sharp sky/sun catchlights
  const corneaGeo = new THREE.SphereGeometry(r * 1.045, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  corneaGeo.rotateX(Math.PI * 0.5);
  const corneaMesh = new THREE.Mesh(corneaGeo, corneaMat);
  eyePivot.add(corneaMesh);

  // Dark pigmented canine eyelid rim ("eyeliner") stays fixed to skull while eyeball tracks
  const rimGeo = new THREE.TorusGeometry(r * 1.03, r * 0.15, 8, 18);
  rimGeo.scale(1.06, 0.90, 0.72);
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.position.z = r * 0.20;

  // Upper eyelid shell for smooth natural blinking
  const eyelidPivot = new THREE.Group();
  const lidGeo = new THREE.SphereGeometry(r * 1.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.54);
  const lidMesh = new THREE.Mesh(lidGeo, eyelidMat);
  lidMesh.rotation.x = -0.78; // Neutral open position (pulled back over top of eyeball)
  eyelidPivot.add(lidMesh);

  disposables.geometries.push(irisGeo, corneaGeo, rimGeo, lidGeo);
  return { eyePivot, eyeMesh, rimMesh, eyelidPivot };
}

function buildPawGeometry(legR, pawH, isFront, coatXOff, bodyTransformFn) {
  const pw = legR * (isFront ? 1.24 : 1.14);
  const pl = legR * (isFront ? 1.95 : 2.05);

  const sections = [
    // Heel / pastern back
    { pos: [0, pawH * 0.55, -pl * 0.34], rx: pw * 0.62, ry: pawH * 0.48, furScale: 0.30, coatZ: isFront ? 0.55 : -0.55, coatYCenter: 0.08, coatYSpan: 0.05, coatXOffset: coatXOff, coatXSpan: 0.08, coatZone: 3, combDir: [0, -0.70, 0.70] },
    // Mid-paw arch
    { pos: [0, pawH * 0.52, pl * 0.06], rx: pw * 0.98, ry: pawH * 0.54, topFlat: 0.14, sideShiftY: -0.18, furScale: 0.28, coatZ: isFront ? 0.60 : -0.50, coatYCenter: 0.06, coatYSpan: 0.05, coatXOffset: coatXOff, coatXSpan: 0.10, coatZone: 3, combDir: [0, -0.55, 0.82] },
    // Knuckles / toes
    { pos: [0, pawH * 0.44, pl * 0.48], rx: pw * 1.02, ry: pawH * 0.46, topFlat: 0.10, sideShiftY: -0.22, furScale: 0.24, coatZ: isFront ? 0.64 : -0.46, coatYCenter: 0.05, coatYSpan: 0.04, coatXOffset: coatXOff, coatXSpan: 0.10, coatZone: 3, combDir: [0, -0.40, 0.90] },
    // Rounded toe tips
    { pos: [0, pawH * 0.34, pl * 0.72], rx: pw * 0.72, ry: pawH * 0.34, sideShiftY: -0.20, furScale: 0.18, coatZ: isFront ? 0.66 : -0.44, coatYCenter: 0.04, coatYSpan: 0.03, coatXOffset: coatXOff, coatXSpan: 0.08, coatZone: 3, combDir: [0, -0.25, 0.96] },
    { pos: [0, pawH * 0.24, pl * 0.82], rx: pw * 0.16, ry: pawH * 0.12, furScale: 0.12, coatZ: isFront ? 0.67 : -0.43, coatYCenter: 0.03, coatYSpan: 0.02, coatXOffset: coatXOff, coatXSpan: 0.03, coatZone: 3, combDir: [0, -0.20, 0.98] },
  ];

  const geo = createOrganicLoft(sections, 14, bodyTransformFn);

  // Subtle 4-toe ridges along the front of the paw + flat ground contact at y = 0
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    if (z > pl * 0.25) {
      const toeWave = Math.cos((x / Math.max(pw, 0.001)) * Math.PI * 3.5);
      const t = Math.min(1, (z - pl * 0.25) / (pl * 0.50));
      y += Math.max(0, toeWave) * pawH * 0.10 * t;
      z += Math.max(0, toeWave) * pl * 0.045 * t;
    }
    // Flatten underside cleanly at y = 0 (paw joint sits at y = pawH above ground)
    const localBottom = y - pawH;
    const clampedY = Math.max(-pawH, localBottom);
    pos.setXYZ(i, x, clampedY, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function addPawPads(pawGroup, legR, pawH, isFront, padMat, disposables) {
  const pw = legR * (isFront ? 1.15 : 1.05);
  const pl = legR * (isFront ? 1.85 : 1.95);
  const padGeo = new THREE.SphereGeometry(1, 8, 6);

  // Main metacarpal/metatarsal heart pad
  const mainPad = new THREE.Mesh(padGeo, padMat);
  mainPad.scale.set(pw * 0.56, pawH * 0.14, pl * 0.26);
  mainPad.position.set(0, -pawH + pawH * 0.08, pl * 0.04);
  pawGroup.add(mainPad);

  // 4 small toe pads
  const toeOffsets = [
    [-0.52, 0.42],
    [-0.18, 0.54],
    [0.18, 0.54],
    [0.52, 0.42],
  ];
  for (const [tx, tz] of toeOffsets) {
    const tp = new THREE.Mesh(padGeo, padMat);
    tp.scale.set(pw * 0.20, pawH * 0.12, pl * 0.14);
    tp.position.set(tx * pw, -pawH + pawH * 0.08, tz * pl);
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
  };

  const root = new THREE.Group();
  root.name = `dog_${breed.id}`;

  // --- Shared Fur Uniforms ---
  const scaleRef = Math.max(0.22, breed.shoulderHeight);
  // Fine plush hair density (~3.5-5mm hair-tuft spacing scaled naturally to breed size)
  const strandFreq = THREE.MathUtils.clamp(235.0 / Math.pow(scaleRef / 0.40, 0.55), 175, 340)
    * (breed.curl > 0.5 ? 0.68 : 1.0);

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
    roughness: 0.24,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.14,
    bumpMap: noseBumpTex,
    bumpScale: 0.0018,
  });

  const irisTex = createIrisTexture(breed.eyeColor);
  const irisMat = new THREE.MeshStandardMaterial({
    map: irisTex,
    roughness: 0.14,
    metalness: 0.0,
  });
  const corneaMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.02,
    metalness: 0.0,
    transmission: 0.0,
    transparent: true,
    opacity: 0.24,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    envMapIntensity: 1.8,
    depthWrite: false,
  });
  const eyeRimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(breed.noseColor).lerp(new THREE.Color('#2a1d17'), 0.25),
    roughness: 0.42,
  });
  const eyelidMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(breed.pattern === 'mask' ? breed.secondaryColor : breed.primaryColor),
    roughness: 0.85,
  });
  const innerEarMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d8a89a').lerp(new THREE.Color(breed.secondaryColor), 0.35),
    roughness: 0.78,
  });
  const padMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(breed.padColor),
    roughness: 0.82,
  });
  const mouthMat = new THREE.MeshStandardMaterial({
    color: 0x5c262c,
    roughness: 0.38,
  });
  const tongueMat = new THREE.MeshPhysicalMaterial({
    color: 0xd96e7a,
    roughness: 0.28,
    clearcoat: 0.65,
    clearcoatRoughness: 0.22,
  });
  const toothMat = new THREE.MeshStandardMaterial({
    color: 0xf4efe4,
    roughness: 0.22,
  });
  const whiskerMat = new THREE.MeshBasicMaterial({
    color: breed.pattern === 'saddle' ? 0x3b332e : 0xeae2d6,
    transparent: true,
    opacity: 0.45,
  });

  disposables.textures.push(noseBumpTex, irisTex);
  disposables.materials.push(
    noseMat, irisMat, corneaMat, eyeRimMat, eyelidMat,
    innerEarMat, padMat, mouthMat, tongueMat, toothMat, whiskerMat
  );

  // ==========================================================================
  // Exact Proportions & Ground-Contact Trigonometry
  // ==========================================================================
  const H = breed.shoulderHeight;
  const B = breed.bodyLength;
  const cDepth = breed.chestDepth;
  const cWidth = breed.chestWidth;
  const legR = breed.legRadius;
  const pawH = Math.max(0.014, legR * 0.82);

  // Withers (top of shoulders) = H. Spine centerline sits just below withers.
  const withersY = H;
  const chestCenterY = withersY - cDepth * 0.46;
  const shoulderY = withersY - cDepth * 0.56;
  const hipY = shoulderY * 1.02;
  const pelvisY = withersY - cDepth * 0.42;

  // Spine joint layout along Z (+Z forward)
  const pelvisZ = -B * 0.34;
  const spine1Z = B * 0.23;
  const spine2Z = B * 0.24;
  const chestZ = B * 0.24; // total pelvis->chest = 0.71 * B

  // Neutral standing leg angles (real canine angulation!)
  const frontUpperX = 0.24;   // Humerus angled slightly backward from shoulder to elbow
  const frontLowerX = -0.26;  // Forearm drops almost vertically down from elbow to wrist
  const frontPawX = -(frontUpperX + frontLowerX);

  const backUpperX = -0.34;   // Femur angled forward from hip to stifle
  const backLowerX = 0.50;    // Tibia+hock angled back (+0.16 world) to hind paw
  const backPawX = -(backUpperX + backLowerX);

  // Solve exact segment lengths so bottoms of ALL FOUR paws sit at y = 0.000
  const effDropF = Math.max(0.06, shoulderY - pawH);
  const frontUpperLen = (effDropF * 0.43) / Math.cos(frontUpperX);
  const frontLowerLen = (effDropF * 0.57) / Math.cos(frontUpperX + frontLowerX);

  const effDropB = Math.max(0.06, hipY - pawH);
  const backUpperLen = (effDropB * 0.47) / Math.cos(backUpperX);
  const backLowerLen = (effDropB * 0.53) / Math.cos(backUpperX + backLowerX);

  const legClearance = Math.max(0.04, chestCenterY - cDepth * 0.52);

  // ==========================================================================
  // Skeleton Hierarchy (matching SPEC.md joints)
  // ==========================================================================
  const pelvis = new THREE.Group();
  pelvis.name = 'pelvis';
  pelvis.position.set(0, pelvisY, pelvisZ);
  root.add(pelvis);

  const spine1 = new THREE.Group();
  spine1.name = 'spine1';
  spine1.position.set(0, 0, spine1Z);
  pelvis.add(spine1);

  const spine2 = new THREE.Group();
  spine2.name = 'spine2';
  spine2.position.set(0, 0, spine2Z);
  spine1.add(spine2);

  const chest = new THREE.Group();
  chest.name = 'chest';
  chest.position.set(0, chestCenterY - pelvisY, chestZ);
  spine2.add(chest);

  const neckBaseY = cDepth * 0.24;
  const neckBaseZ = B * 0.14;
  const neck = new THREE.Group();
  neck.name = 'neck';
  neck.position.set(0, neckBaseY, neckBaseZ);
  const neckNeutralX = 0.52; // +X tilts +Y neck forward (~30 deg forward from vertical)
  neck.rotation.x = neckNeutralX;
  chest.add(neck);

  const headBaseY = breed.neckLength * 0.94;
  const headBaseZ = breed.neckLength * 0.06;
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, headBaseY, headBaseZ);
  const headNeutralX = -neckNeutralX + 0.06; // Counters neck pitch so head looks gently level forward
  head.rotation.x = headNeutralX;
  neck.add(head);

  // Neutral-pose world-position helpers for seamless 3D fur noise across joints
  const neutralChestPos = new THREE.Vector3(0, chestCenterY, pelvisZ + spine1Z + spine2Z + chestZ);
  const neutralPelvisPos = new THREE.Vector3(0, pelvisY, pelvisZ);
  const neutralSpine1Pos = new THREE.Vector3(0, pelvisY, pelvisZ + spine1Z);
  const neutralSpine2Pos = new THREE.Vector3(0, pelvisY, pelvisZ + spine1Z + spine2Z);

  const makeOffsetTransform = (ox, oy, oz) => (local, out) => {
    out.set(local.x + ox, local.y + oy, local.z + oz);
  };

  // ==========================================================================
  // Torso Sculpting (Pelvis, Spine1, Spine2, Chest — overlapping seamlessly)
  // ==========================================================================
  const halfW = cWidth * 0.5;
  const halfD = cDepth * 0.5;
  const waistFactor = 1.0 - breed.waistTuck;
  const ruffScale = 1.0 + breed.ruff * 0.52;
  const bellyFeather = breed.feathering * 0.55;

  // 1. Pelvis / Rump
  const pelvisGeo = createOrganicLoft([
    { pos: [0, -halfD * 0.10, -B * 0.22], rx: halfW * 0.18, ry: halfD * 0.18, furScale: 1.05, coatZ: -0.95, coatYCenter: 0.66, coatYSpan: 0.10, coatXSpan: 0.22, coatZone: 0 },
    { pos: [0, -halfD * 0.04, -B * 0.16], rx: halfW * 0.72, ry: halfD * 0.64, topFlat: 0.12, furScale: 1.05, coatZ: -0.85, coatYCenter: 0.68, coatYSpan: 0.24, coatXSpan: 0.72, coatZone: 0 },
    { pos: [0, 0.0, -B * 0.04], rx: halfW * 0.86, ry: halfD * 0.78, topFlat: 0.20, bottomPinch: 0.16, furScale: 1.02, coatZ: -0.62, coatYCenter: 0.70, coatYSpan: 0.28, coatXSpan: 0.86, coatZone: 0, bottomFeather: bellyFeather * 0.4 },
    { pos: [0, halfD * 0.03, B * 0.10], rx: halfW * 0.82 * waistFactor * 1.06, ry: halfD * 0.74 * (0.85 + 0.15 * waistFactor), topFlat: 0.22, bottomPinch: 0.22, furScale: 0.98, coatZ: -0.35, coatYCenter: 0.72, coatYSpan: 0.26, coatXSpan: 0.82, coatZone: 0, bottomFeather: bellyFeather * 0.5 },
    { pos: [0, halfD * 0.04, B * 0.22], rx: halfW * 0.72 * waistFactor, ry: halfD * 0.64 * waistFactor, topFlat: 0.20, furScale: 0.94, coatZ: -0.15, coatYCenter: 0.72, coatYSpan: 0.22, coatXSpan: 0.72, coatZone: 0 },
  ], 20, makeOffsetTransform(neutralPelvisPos.x, neutralPelvisPos.y, neutralPelvisPos.z));
  addFurredPart(pelvis, pelvisGeo, baseCoatMat, shellFurMat, 18, disposables);

  // 2. Spine1 (Loins / tucked waist)
  const spine1Geo = createOrganicLoft([
    { pos: [0, halfD * 0.02, -B * 0.14], rx: halfW * 0.78, ry: halfD * 0.70, topFlat: 0.20, bottomPinch: 0.18, furScale: 0.96, coatZ: -0.35, coatYCenter: 0.72, coatYSpan: 0.25, coatXSpan: 0.78, coatZone: 0 },
    { pos: [0, halfD * 0.06, 0.0], rx: halfW * 0.79 * (0.78 + 0.22 * waistFactor), ry: halfD * 0.74 * (0.78 + 0.22 * waistFactor), topFlat: 0.22, bottomPinch: 0.22, furScale: 0.98, coatZ: -0.08, coatYCenter: 0.73, coatYSpan: 0.25, coatXSpan: 0.80, coatZone: 0, bottomFeather: bellyFeather * 0.7 },
    { pos: [0, halfD * 0.03, B * 0.15], rx: halfW * 0.88, ry: halfD * 0.86, topFlat: 0.22, bottomPinch: 0.18, furScale: 1.00, coatZ: 0.16, coatYCenter: 0.70, coatYSpan: 0.28, coatXSpan: 0.88, coatZone: 0, bottomFeather: bellyFeather * 0.85 },
    { pos: [0, 0.0, B * 0.25], rx: halfW * 0.82, ry: halfD * 0.82, topFlat: 0.18, furScale: 0.96, coatZ: 0.30, coatYCenter: 0.68, coatYSpan: 0.26, coatXSpan: 0.82, coatZone: 0 },
  ], 20, makeOffsetTransform(neutralSpine1Pos.x, neutralSpine1Pos.y, neutralSpine1Pos.z));
  addFurredPart(spine1, spine1Geo, baseCoatMat, shellFurMat, 18, disposables);

  // 3. Spine2 (Mid-ribcage)
  const spine2Geo = createOrganicLoft([
    { pos: [0, halfD * 0.04, -B * 0.14], rx: halfW * 0.80, ry: halfD * 0.78, topFlat: 0.20, bottomPinch: 0.18, furScale: 0.98, coatZ: 0.05, coatYCenter: 0.71, coatYSpan: 0.26, coatXSpan: 0.82, coatZone: 0 },
    { pos: [0, 0.0, 0.0], rx: halfW * 0.96, ry: halfD * 0.95, topFlat: 0.22, bottomPinch: 0.16, furScale: 1.04, coatZ: 0.28, coatYCenter: 0.68, coatYSpan: 0.30, coatXSpan: 0.94, coatZone: 0, bottomFeather: bellyFeather * 0.9 },
    { pos: [0, -halfD * 0.03, B * 0.16], rx: halfW * 1.00, ry: halfD * 1.00, topFlat: 0.22, bottomPinch: 0.18, furScale: 1.06, coatZ: 0.50, coatYCenter: 0.66, coatYSpan: 0.31, coatXSpan: 0.98, coatZone: 0, bottomFeather: bellyFeather * 0.9 },
    { pos: [0, -halfD * 0.04, B * 0.26], rx: halfW * 0.88, ry: halfD * 0.88, topFlat: 0.16, furScale: 1.02, coatZ: 0.64, coatYCenter: 0.66, coatYSpan: 0.28, coatXSpan: 0.86, coatZone: 0 },
  ], 20, makeOffsetTransform(neutralSpine2Pos.x, neutralSpine2Pos.y, neutralSpine2Pos.z));
  addFurredPart(spine2, spine2Geo, baseCoatMat, shellFurMat, 18, disposables);

  // 4. Chest / Forechest (deep keel, muscular withers, prominent prosternum)
  const chestGeo = createOrganicLoft([
    { pos: [0, 0.02 * halfD, -B * 0.16], rx: halfW * 0.88, ry: halfD * 0.90, topFlat: 0.20, bottomPinch: 0.16, furScale: 1.04, coatZ: 0.44, coatYCenter: 0.68, coatYSpan: 0.29, coatXSpan: 0.90, coatZone: 0 },
    { pos: [0, 0.0, -B * 0.02], rx: halfW * 1.02, ry: halfD * 1.04, topFlat: 0.20, bottomPinch: 0.20, furScale: 1.10, coatZ: 0.64, coatYCenter: 0.66, coatYSpan: 0.32, coatXSpan: 1.00, coatZone: 0, bottomFeather: bellyFeather * 0.9 },
    { pos: [0, -halfD * 0.02, B * 0.13], rx: halfW * 0.94, ry: halfD * 0.96, topFlat: 0.16, bottomPinch: 0.24, furScale: ruffScale, coatZ: 0.80, coatYCenter: 0.64, coatYSpan: 0.30, coatXSpan: 0.92, coatZone: 0, bottomFeather: breed.ruff * 0.65 },
    // Forechest / prosternum rounding smoothly forward
    { pos: [0, -halfD * 0.06, B * 0.24], rx: halfW * 0.64, ry: halfD * 0.68, bottomPinch: 0.22, furScale: ruffScale * 1.05, coatZ: 0.90, coatYCenter: 0.60, coatYSpan: 0.24, coatXSpan: 0.62, coatZone: 0, bottomFeather: breed.ruff * 0.70 },
    { pos: [0, -halfD * 0.08, B * 0.29], rx: halfW * 0.18, ry: halfD * 0.18, furScale: ruffScale * 0.85, coatZ: 0.95, coatYCenter: 0.58, coatYSpan: 0.10, coatXSpan: 0.20, coatZone: 0 },
  ], 22, makeOffsetTransform(neutralChestPos.x, neutralChestPos.y, neutralChestPos.z));
  addFurredPart(chest, chestGeo, baseCoatMat, shellFurMat, 18, disposables);

  // ==========================================================================
  // Neck & Head Assembly
  // ==========================================================================
  const nl = breed.neckLength;
  const nr = breed.neckRadius;
  const neckNeutralWorld = new THREE.Vector3(0, chestCenterY + neckBaseY, neutralChestPos.z + neckBaseZ);
  const neckQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(neckNeutralX, 0, 0));
  const neckBodyFn = (local, out) => {
    out.copy(local).applyQuaternion(neckQuat).add(neckNeutralWorld);
  };

  const neckGeo = createOrganicLoft([
    { pos: [0, -nl * 0.24, -nr * 0.12], rx: nr * 1.24, ry: nr * 1.32, axis: 'y', furScale: ruffScale * 1.05, coatZ: 0.88, coatYCenter: 0.74, coatXSpan: 0.72, coatZone: 0, combDir: [0, -0.78, -0.60] },
    { pos: [0, nl * 0.12, 0.0], rx: nr * 1.08, ry: nr * 1.15, axis: 'y', furScale: ruffScale, coatZ: 0.96, coatYCenter: 0.76, coatXSpan: 0.66, coatZone: 0, combDir: [0, -0.82, -0.56] },
    { pos: [0, nl * 0.56, nr * 0.05], rx: nr * 0.90, ry: nr * 0.94, axis: 'y', furScale: 0.92 + breed.ruff * 0.36, coatZ: 1.04, coatYCenter: 0.78, coatXSpan: 0.58, coatZone: 0, combDir: [0, -0.84, -0.52] },
    { pos: [0, nl * 0.98, nr * 0.08], rx: nr * 0.82, ry: nr * 0.84, axis: 'y', furScale: 0.82 + breed.ruff * 0.20, coatZ: 1.10, coatYCenter: 0.78, coatXSpan: 0.52, coatZone: 0, combDir: [0, -0.85, -0.50] },
    { pos: [0, nl * 1.12, nr * 0.08], rx: nr * 0.45, ry: nr * 0.45, axis: 'y', furScale: 0.65, coatZ: 1.12, coatYCenter: 0.78, coatXSpan: 0.30, coatZone: 0, combDir: [0, -0.85, -0.50] },
  ], 18, neckBodyFn);
  addFurredPart(neck, neckGeo, baseCoatMat, shellFurMat, 18, disposables);

  // Head body-space transform
  const headNeutralWorld = new THREE.Vector3(0, headBaseY, headBaseZ).applyQuaternion(neckQuat).add(neckNeutralWorld);
  const headQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(neckNeutralX + headNeutralX, 0, 0));
  const headBodyFn = (local, out) => {
    out.copy(local).applyQuaternion(headQuat).add(headNeutralWorld);
  };

  const hs = breed.headSize;
  const ml = breed.muzzleLength;
  const stop = breed.stopDepth;
  const puff = breed.curl * 0.20;
  const eyeR = hs * (breed.id === 'poodle' ? 0.175 : breed.id === 'dachshund' ? 0.165 : 0.158);
  const eyeX = hs * 0.48 * (1 + puff * 0.18) * (breed.id === 'dachshund' ? 0.92 : 1.0);
  const eyeY = hs * (0.24 - stop * 0.08);
  const eyeZ = hs * (0.50 + (1.0 - stop) * 0.05);

  // Cranium + continuous muzzle (with sculpted eye-socket clear zone)
  const headGeo = buildHeadGeometry(breed, headBodyFn, { eyeX, eyeY, eyeZ, eyeR });
  addFurredPart(head, headGeo, baseCoatMat, shellFurMat, 18, disposables);

  const snoutTipY = -hs * (0.08 + stop * 0.13);
  const snoutTipZ = hs * 0.50 + ml * 1.00;

  // Wet Nose
  const noseGroup = buildNoseMesh(breed, noseMat, disposables);
  noseGroup.position.set(0, snoutTipY + hs * 0.055, snoutTipZ + hs * 0.02);
  head.add(noseGroup);

  // Whiskers (subtle translucent vibrissae on muzzle sides)
  const whiskerGeo = new THREE.CylinderGeometry(0.0004, 0.00015, hs * 0.65, 4);
  whiskerGeo.rotateZ(Math.PI * 0.5);
  disposables.geometries.push(whiskerGeo);
  for (const s of [-1, 1]) {
    for (let w = 0; w < 3; w++) {
      const wm = new THREE.Mesh(whiskerGeo, whiskerMat);
      wm.position.set(
        s * (hs * breed.muzzleWidth * 0.75 + hs * 0.22),
        snoutTipY - hs * 0.04 + (w - 1) * hs * 0.045,
        snoutTipZ - ml * 0.22 - w * ml * 0.06
      );
      wm.rotation.y = -s * (0.28 + w * 0.12);
      wm.rotation.z = -s * (0.14 + w * 0.06);
      head.add(wm);
    }
  }

  // Lower Jaw, Inner Mouth, Subtle Teeth & Flexible Pink Tongue
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  jaw.position.set(0, -hs * (0.28 + stop * 0.06), hs * 0.08);
  head.add(jaw);

  const jawBodyFn = (local, out) => {
    out.set(local.x, local.y + jaw.position.y, local.z + jaw.position.z)
      .applyQuaternion(headQuat)
      .add(headNeutralWorld);
  };
  const jawGeo = buildJawGeometry(breed, jawBodyFn);
  addFurredPart(jaw, jawGeo, baseCoatMat, shellFurMat, 14, disposables);

  // Dark inner mouth interior (upper palate + lower floor)
  const palateGeo = new THREE.SphereGeometry(1, 10, 8);
  palateGeo.scale(hs * breed.muzzleWidth * 0.58, hs * 0.14, ml * 0.66);
  const palateMesh = new THREE.Mesh(palateGeo, mouthMat);
  palateMesh.position.set(0, snoutTipY - hs * 0.13, hs * 0.50 + ml * 0.42);
  head.add(palateMesh);

  const jawFloorMesh = new THREE.Mesh(palateGeo, mouthMat);
  jawFloorMesh.scale.set(0.86, 0.75, 0.85);
  jawFloorMesh.position.set(0, hs * 0.04, hs * 0.34 + ml * 0.36);
  jaw.add(jawFloorMesh);
  disposables.geometries.push(palateGeo);

  // Small sculpted white canine teeth (tucked neatly inside lips, visible during bark, yawn, pant)
  const toothGeo = new THREE.ConeGeometry(hs * 0.036, hs * 0.095, 6);
  toothGeo.rotateX(Math.PI);
  disposables.geometries.push(toothGeo);
  for (const s of [-1, 1]) {
    const upperCanine = new THREE.Mesh(toothGeo, toothMat);
    upperCanine.position.set(s * hs * breed.muzzleWidth * 0.44, snoutTipY - hs * 0.145, snoutTipZ - ml * 0.26);
    head.add(upperCanine);
  }

  // Curved Pink Tongue
  const tongue = new THREE.Group();
  tongue.name = 'tongue';
  tongue.position.set(0, hs * 0.06, hs * 0.34 + ml * 0.26);
  jaw.add(tongue);

  const tongueLen = ml * 0.74 + hs * 0.18;
  const tongueW = hs * breed.muzzleWidth * 0.44;
  const tongueGeo = new THREE.BoxGeometry(tongueW, hs * 0.055, tongueLen, 4, 2, 8);
  tongueGeo.translate(0, 0, tongueLen * 0.48);
  const tPos = tongueGeo.getAttribute('position');
  for (let i = 0; i < tPos.count; i++) {
    let tx = tPos.getX(i);
    let ty = tPos.getY(i);
    let tz = tPos.getZ(i);
    const u = THREE.MathUtils.clamp(tz / tongueLen, 0, 1);
    // Round the tongue tip and curve gently downward near tip + central groove
    const roundW = Math.sqrt(Math.max(0.05, 1.0 - Math.pow(Math.max(0, (u - 0.65) / 0.35), 2)));
    tx *= roundW;
    ty *= (1.0 - 0.35 * u);
    const groove = Math.exp(-Math.pow(tx / (tongueW * 0.22), 2)) * hs * 0.025 * (1.0 - u * 0.5);
    ty -= groove;
    ty -= u * u * hs * 0.14; // soft downward curl at tip
    tPos.setXYZ(i, tx, ty, tz);
  }
  tongueGeo.computeVertexNormals();
  const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
  tongue.add(tongueMesh);
  disposables.geometries.push(tongueGeo);

  // Eyes & Eyelids (placed flush in sculpted orbital sockets; rim stays fixed to skull while eyeball tracks)
  const leftEye = buildEyeAssembly(breed, 1, irisMat, corneaMat, eyeRimMat, eyelidMat, disposables);
  const leftSocket = new THREE.Group();
  leftSocket.position.set(eyeX, eyeY, eyeZ);
  leftSocket.rotation.y = 0.24; // Subtle natural outward canine eye angle
  leftSocket.add(leftEye.rimMesh, leftEye.eyePivot, leftEye.eyelidPivot);
  leftEye.eyelidPivot.name = 'eyelidL';
  head.add(leftSocket);

  const rightEye = buildEyeAssembly(breed, -1, irisMat, corneaMat, eyeRimMat, eyelidMat, disposables);
  const rightSocket = new THREE.Group();
  rightSocket.position.set(-eyeX, eyeY, eyeZ);
  rightSocket.rotation.y = -0.24;
  rightSocket.add(rightEye.rimMesh, rightEye.eyePivot, rightEye.eyelidPivot);
  rightEye.eyelidPivot.name = 'eyelidR';
  head.add(rightSocket);

  const eyes = [leftEye.eyePivot, rightEye.eyePivot];
  eyes.left = leftEye.eyePivot;
  eyes.right = rightEye.eyePivot;

  // Ears
  const earSet = breed.earSet;
  const earX = hs * (breed.earType === 'erect' ? 0.58 : 0.78);
  const earY = hs * (0.36 + earSet * 0.46);
  const earZ = -hs * (breed.earType === 'erect' ? 0.14 : 0.06);

  const earBaseRot = breed.earType === 'erect'
    ? { x: 0.14, y: 0.20, z: -0.24 }  // Left ear leans gently outward (-Z roll) & slightly forward
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
  // 4 Sculpted Canine Legs (FL, FR, BL, BR)
  // ==========================================================================
  const legFeather = breed.feathering * 0.85;
  const shoulderOffX = halfW * 0.82;
  const shoulderOffY = shoulderY - chestCenterY;
  const shoulderOffZ = B * 0.07;

  const hipOffX = halfW * 0.78;
  const hipOffY = hipY - pelvisY;
  const hipOffZ = -B * 0.03;

  function buildFrontLeg(side, label) {
    // side: +1 = FL, -1 = FR
    const shoulder = new THREE.Group();
    shoulder.name = `shoulder_${label}`;
    shoulder.position.set(side * shoulderOffX, shoulderOffY, shoulderOffZ);
    chest.add(shoulder);

    const upper = new THREE.Group();
    upper.name = `upper_${label}`;
    upper.rotation.x = frontUpperX;
    shoulder.add(upper);

    const sWorld = new THREE.Vector3(side * shoulderOffX, shoulderY, neutralChestPos.z + shoulderOffZ);
    const uQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(frontUpperX, 0, 0));
    const upperBodyFn = (local, out) => out.copy(local).applyQuaternion(uQuat).add(sWorld);

    // Muscular shoulder blade / upper arm (humerus) overlapping chest seamlessly
    const upperGeo = createOrganicLoft([
      { pos: [-side * legR * 0.25, legR * 0.90, -legR * 0.10], rx: legR * 1.15, ry: legR * 1.55, axis: 'y', furScale: 1.0, coatZ: 0.62, coatYCenter: 0.60, coatXOffset: side * 0.65, coatXSpan: 0.14, coatZone: 3 },
      { pos: [0, 0.0, 0.0], rx: legR * 1.38, ry: legR * 1.72, axis: 'y', furScale: 1.02, coatZ: 0.64, coatYCenter: 0.50, coatXOffset: side * 0.68, coatXSpan: 0.16, coatZone: 3, backFeather: legFeather * 0.55 },
      { pos: [0, -frontUpperLen * 0.55, 0.0], rx: legR * 1.12, ry: legR * 1.30, axis: 'y', furScale: 0.92, coatZ: 0.62, coatYCenter: 0.38, coatXOffset: side * 0.65, coatXSpan: 0.14, coatZone: 3, backFeather: legFeather * 0.75 },
      { pos: [0, -frontUpperLen * 1.04, 0.0], rx: legR * 0.90, ry: legR * 1.02, axis: 'y', furScale: 0.85, coatZ: 0.60, coatYCenter: 0.30, coatXOffset: side * 0.62, coatXSpan: 0.12, coatZone: 3, backFeather: legFeather * 0.85 },
    ], 14, upperBodyFn);
    addFurredPart(upper, upperGeo, baseCoatMat, shellFurMat, 16, disposables);

    const lower = new THREE.Group();
    lower.name = `lower_${label}`;
    lower.position.set(0, -frontUpperLen, 0);
    lower.rotation.x = frontLowerX;
    upper.add(lower);

    const elbowWorld = new THREE.Vector3(0, -frontUpperLen, 0).applyQuaternion(uQuat).add(sWorld);
    const lQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(frontUpperX + frontLowerX, 0, 0));
    const lowerBodyFn = (local, out) => out.copy(local).applyQuaternion(lQuat).add(elbowWorld);

    // Sculpted forearm (radius/ulna) tapering down to wrist/pastern
    const lowerGeo = createOrganicLoft([
      { pos: [0, legR * 0.35, 0], rx: legR * 0.94, ry: legR * 1.04, axis: 'y', furScale: 0.85, coatZ: 0.60, coatYCenter: 0.30, coatXOffset: side * 0.62, coatXSpan: 0.12, coatZone: 3, backFeather: legFeather },
      { pos: [0, -frontLowerLen * 0.32, 0], rx: legR * 0.82, ry: legR * 0.88, axis: 'y', furScale: 0.76, coatZ: 0.60, coatYCenter: 0.22, coatXOffset: side * 0.60, coatXSpan: 0.10, coatZone: 3, backFeather: legFeather * 0.95 },
      { pos: [0, -frontLowerLen * 0.72, legR * 0.06], rx: legR * 0.70, ry: legR * 0.72, axis: 'y', furScale: 0.56 + breed.curl * 0.45, coatZ: 0.61, coatYCenter: 0.14, coatXOffset: side * 0.58, coatXSpan: 0.08, coatZone: 3, backFeather: legFeather * 0.45 },
      { pos: [0, -frontLowerLen * 1.02, legR * 0.18], rx: legR * 0.74, ry: legR * 0.78, axis: 'y', furScale: 0.40 + breed.curl * 0.40, coatZ: 0.62, coatYCenter: 0.08, coatXOffset: side * 0.56, coatXSpan: 0.08, coatZone: 3 },
    ], 12, lowerBodyFn);
    addFurredPart(lower, lowerGeo, baseCoatMat, shellFurMat, 14, disposables);

    const paw = new THREE.Group();
    paw.name = `paw_${label}`;
    paw.position.set(0, -frontLowerLen, legR * 0.16);
    paw.rotation.x = frontPawX;
    lower.add(paw);

    const pawWorld = new THREE.Vector3(0, -frontLowerLen, legR * 0.16).applyQuaternion(lQuat).add(elbowWorld);
    const pawBodyFn = (local, out) => out.copy(local).add(pawWorld);
    const pawGeo = buildPawGeometry(legR, pawH, true, side * 0.56, pawBodyFn);
    addFurredPart(paw, pawGeo, baseCoatMat, shellFurMat, 12, disposables);
    addPawPads(paw, legR, pawH, true, padMat, disposables);

    return { shoulder, upper, lower, paw };
  }

  function buildBackLeg(side, label) {
    // side: +1 = BL, -1 = BR
    const hip = new THREE.Group();
    hip.name = `hip_${label}`;
    hip.position.set(side * hipOffX, hipOffY, hipOffZ);
    pelvis.add(hip);

    const upper = new THREE.Group();
    upper.name = `upper_${label}`;
    upper.rotation.x = backUpperX;
    hip.add(upper);

    const hWorld = new THREE.Vector3(side * hipOffX, hipY, neutralPelvisPos.z + hipOffZ);
    const uQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(backUpperX, 0, 0));
    const upperBodyFn = (local, out) => out.copy(local).applyQuaternion(uQuat).add(hWorld);

    // Broad muscular canine thigh / haunch (wider front-to-back!)
    const upperGeo = createOrganicLoft([
      { pos: [-side * legR * 0.22, legR * 1.0, -legR * 0.15], rx: legR * 1.20, ry: legR * 1.85, axis: 'y', furScale: 1.05, coatZ: -0.62, coatYCenter: 0.62, coatXOffset: side * 0.65, coatXSpan: 0.16, coatZone: 3 },
      { pos: [0, 0.0, -legR * 0.20], rx: legR * 1.48, ry: legR * 2.15, axis: 'y', furScale: 1.08, coatZ: -0.64, coatYCenter: 0.50, coatXOffset: side * 0.68, coatXSpan: 0.18, coatZone: 3, backFeather: legFeather * 0.85 },
      { pos: [0, -backUpperLen * 0.55, -legR * 0.16], rx: legR * 1.18, ry: legR * 1.56, axis: 'y', furScale: 0.96, coatZ: -0.58, coatYCenter: 0.38, coatXOffset: side * 0.64, coatXSpan: 0.14, coatZone: 3, backFeather: legFeather * 0.90 },
      { pos: [0, -backUpperLen * 1.04, 0.0], rx: legR * 0.92, ry: legR * 1.08, axis: 'y', furScale: 0.86, coatZ: -0.52, coatYCenter: 0.30, coatXOffset: side * 0.60, coatXSpan: 0.12, coatZone: 3, backFeather: legFeather * 0.70 },
    ], 14, upperBodyFn);
    addFurredPart(upper, upperGeo, baseCoatMat, shellFurMat, 16, disposables);

    const lower = new THREE.Group();
    lower.name = `lower_${label}`;
    lower.position.set(0, -backUpperLen, 0);
    lower.rotation.x = backLowerX;
    upper.add(lower);

    const stifleWorld = new THREE.Vector3(0, -backUpperLen, 0).applyQuaternion(uQuat).add(hWorld);
    const lQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(backUpperX + backLowerX, 0, 0));
    const lowerBodyFn = (local, out) => out.copy(local).applyQuaternion(lQuat).add(stifleWorld);

    // Sculpted tibia + prominent canine hock (tarsus) + vertical metatarsus!
    const hockJut = -legR * 1.15; // Backward hock silhouette!
    const lowerGeo = createOrganicLoft([
      { pos: [0, legR * 0.36, 0], rx: legR * 0.92, ry: legR * 1.10, axis: 'y', furScale: 0.86, coatZ: -0.52, coatYCenter: 0.30, coatXOffset: side * 0.60, coatXSpan: 0.12, coatZone: 3, backFeather: legFeather * 0.80 },
      { pos: [0, -backLowerLen * 0.36, hockJut * 0.82], rx: legR * 0.76, ry: legR * 0.94, axis: 'y', furScale: 0.74, coatZ: -0.58, coatYCenter: 0.22, coatXOffset: side * 0.58, coatXSpan: 0.10, coatZone: 3, backFeather: legFeather * 0.65 },
      // Hock joint (tarsus point)
      { pos: [0, -backLowerLen * 0.52, hockJut], rx: legR * 0.68, ry: legR * 0.82, axis: 'y', furScale: 0.62, coatZ: -0.62, coatYCenter: 0.18, coatXOffset: side * 0.56, coatXSpan: 0.08, coatZone: 3, backFeather: legFeather * 0.35 },
      // Metatarsus curving cleanly forward down to paw
      { pos: [0, -backLowerLen * 0.82, hockJut * 0.45], rx: legR * 0.64, ry: legR * 0.68, axis: 'y', furScale: 0.48 + breed.curl * 0.40, coatZ: -0.58, coatYCenter: 0.12, coatXOffset: side * 0.55, coatXSpan: 0.08, coatZone: 3 },
      { pos: [0, -backLowerLen * 1.02, 0.0], rx: legR * 0.70, ry: legR * 0.74, axis: 'y', furScale: 0.38 + breed.curl * 0.35, coatZ: -0.55, coatYCenter: 0.07, coatXOffset: side * 0.54, coatXSpan: 0.08, coatZone: 3 },
    ], 12, lowerBodyFn);
    addFurredPart(lower, lowerGeo, baseCoatMat, shellFurMat, 14, disposables);

    const paw = new THREE.Group();
    paw.name = `paw_${label}`;
    paw.position.set(0, -backLowerLen, 0);
    paw.rotation.x = backPawX;
    lower.add(paw);

    const pawWorld = new THREE.Vector3(0, -backLowerLen, 0).applyQuaternion(lQuat).add(stifleWorld);
    const pawBodyFn = (local, out) => out.copy(local).add(pawWorld);
    const pawGeo = buildPawGeometry(legR, pawH, false, side * 0.54, pawBodyFn);
    addFurredPart(paw, pawGeo, baseCoatMat, shellFurMat, 12, disposables);
    addPawPads(paw, legR, pawH, false, padMat, disposables);

    return { hip, upper, lower, paw };
  }

  const FL = buildFrontLeg(1, 'FL');
  const FR = buildFrontLeg(-1, 'FR');
  const BL = buildBackLeg(1, 'BL');
  const BR = buildBackLeg(-1, 'BR');

  // ==========================================================================
  // 5-Segment Articulated Tail (tail1..tail5)
  // ==========================================================================
  const tailLen = breed.tailLength;
  const segLen = tailLen / 5;
  const tRad = breed.tailRadius;
  const tFluff = breed.tailFluff;

  // Natural neutral tail carriage per breed type (+X rotation curls tail UP over back)
  let tailBaseX = 0.25;
  let tailSegX = 0.10;
  if (breed.tailType === 'curled') {
    tailBaseX = 0.85;
    tailSegX = 0.54 * breed.tailCurl;
  } else if (breed.tailType === 'plume') {
    tailBaseX = breed.id === 'husky' ? 0.52 : (breed.id === 'poodle' ? 0.95 : -0.18);
    tailSegX = breed.id === 'husky' ? 0.26 : (breed.id === 'poodle' ? 0.12 : 0.16);
  } else if (breed.tailType === 'short') {
    tailBaseX = 0.35;
    tailSegX = 0.08;
  } else {
    // 'straight' (Labrador otter tail, Beagle upright hound tail, Dachshund sleek)
    tailBaseX = breed.id === 'beagle' ? 0.88 : (breed.id === 'labrador' ? -0.12 : 0.10);
    tailSegX = breed.id === 'beagle' ? 0.08 : 0.06;
  }

  const tailJoints = [];
  let tailParent = pelvis;
  const tailRootPos = new THREE.Vector3(0, halfD * 0.26, -B * 0.19);
  const plumeFeather = breed.tailType === 'plume' ? breed.feathering * 0.95 : (breed.tailType === 'curled' ? 0.45 : 0.0);

  for (let i = 0; i < 5; i++) {
    const tj = new THREE.Group();
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

    const u0 = i / 5;
    const u1 = (i + 1) / 5;
    const r0 = tRad * (1.12 - u0 * 0.55) * (breed.id === 'poodle' && i >= 3 ? 1.35 : 1.0);
    const r1 = tRad * (1.12 - u1 * 0.65) * (breed.id === 'poodle' && i >= 3 ? 1.30 : 1.0);
    const segFur0 = THREE.MathUtils.lerp(0.9, tFluff, Math.sin(Math.min(1, u0 + 0.15) * Math.PI * 0.85));
    const segFur1 = THREE.MathUtils.lerp(0.9, tFluff, Math.sin(Math.min(1, u1 + 0.10) * Math.PI * 0.85));

    const segBodyFn = (local, out) => {
      out.set(local.x, pelvisY + tailRootPos.y + local.y, neutralPelvisPos.z + tailRootPos.z - i * segLen + local.z);
    };

    const segSections = [
      { pos: [0, 0, segLen * 0.22], rx: r0 * 0.96, ry: r0 * 0.96, furScale: segFur0, coatZ: -0.25 - u0 * 0.72, coatYCenter: 0.58, coatYSpan: 0.24, coatXSpan: 0.28, coatZone: 4, combDir: [0, -0.30, -0.94], bottomFeather: plumeFeather },
      { pos: [0, 0, -segLen * 0.45], rx: (r0 + r1) * 0.52, ry: (r0 + r1) * 0.52, furScale: (segFur0 + segFur1) * 0.52, coatZ: -0.25 - (u0 + u1) * 0.36, coatYCenter: 0.56, coatYSpan: 0.24, coatXSpan: 0.24, coatZone: 4, combDir: [0, -0.35, -0.92], bottomFeather: plumeFeather * 1.15 },
      { pos: [0, 0, -segLen * (i === 4 ? 1.08 : 1.14)], rx: i === 4 ? r1 * 0.22 : r1 * 0.92, ry: i === 4 ? r1 * 0.22 : r1 * 0.92, furScale: i === 4 ? segFur1 * 0.85 : segFur1, coatZ: -0.25 - u1 * 0.75, coatYCenter: 0.54, coatYSpan: 0.20, coatXSpan: 0.18, coatZone: 4, combDir: [0, -0.30, -0.94], bottomFeather: plumeFeather * (i === 4 ? 0.6 : 1.1) },
    ];

    const segGeo = createOrganicLoft(segSections, 12, segBodyFn);
    addFurredPart(tj, segGeo, baseCoatMat, shellFurMat, 14, disposables);
  }

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
    noseMat.clearcoatRoughness = THREE.MathUtils.lerp(0.14, 0.05, v);
    padMat.roughness = THREE.MathUtils.lerp(0.82, 0.36, v);
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
    disposables.geometries.length = 0;
    disposables.materials.length = 0;
    disposables.textures.length = 0;
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
