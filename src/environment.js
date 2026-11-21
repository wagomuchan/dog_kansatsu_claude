import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// ============================================================================
// Deterministic PRNG & Math Helpers
// ============================================================================
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ============================================================================
// Procedural Canvas Texture Generators (Zero External Assets)
// ============================================================================
function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function makeWoodTextures(anisotropy = 4, {
  baseA = '#7b5538',
  baseB = '#5d3e27',
  grain = '#3e2716',
  planks = 6,
  repeatX = 1,
  repeatY = 1,
  seed = 101,
} = {}) {
  const rand = mulberry32(seed);
  const w = 512;
  const h = 512;
  const cColor = createCanvas(w, h);
  const ctx = cColor.getContext('2d');
  const cBump = createCanvas(w, h);
  const bCtx = cBump.getContext('2d');

  ctx.fillStyle = baseA;
  ctx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  const plankH = h / planks;
  const colA = new THREE.Color(baseA);
  const colB = new THREE.Color(baseB);
  const tmp = new THREE.Color();

  for (let p = 0; p < planks; p++) {
    const y0 = p * plankH;
    tmp.copy(colA).lerp(colB, rand() * 0.85);
    ctx.fillStyle = `#${tmp.getHexString()}`;
    ctx.fillRect(0, y0, w, plankH);

    // Subtle wood grain fibers
    for (let i = 0; i < 90; i++) {
      const fy = y0 + rand() * plankH;
      const alpha = 0.04 + rand() * 0.12;
      ctx.strokeStyle = grain;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 0.7 + rand() * 2.0;
      ctx.beginPath();
      ctx.moveTo(0, fy);
      const wave = (rand() - 0.5) * 8;
      ctx.bezierCurveTo(w * 0.33, fy + wave, w * 0.66, fy - wave, w, fy + (rand() - 0.5) * 3);
      ctx.stroke();

      bCtx.strokeStyle = rand() > 0.5 ? '#9c9c9c' : '#646464';
      bCtx.globalAlpha = alpha * 1.1;
      bCtx.lineWidth = 1.0;
      bCtx.beginPath();
      bCtx.moveTo(0, fy);
      bCtx.lineTo(w, fy + (rand() - 0.5) * 3);
      bCtx.stroke();
    }
    ctx.globalAlpha = 1;
    bCtx.globalAlpha = 1;

    // Occasional knot
    if (rand() < 0.45) {
      const kx = 40 + rand() * (w - 80);
      const ky = y0 + plankH * (0.25 + rand() * 0.5);
      const kr = 4 + rand() * 7;
      const g = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr * 2.2);
      g.addColorStop(0, 'rgba(35,20,10,0.65)');
      g.addColorStop(0.5, 'rgba(55,34,18,0.35)');
      g.addColorStop(1, 'rgba(55,34,18,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(kx, ky, kr * 2.2, kr * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Plank seam
    ctx.fillStyle = 'rgba(20, 12, 6, 0.58)';
    ctx.fillRect(0, y0, w, 2.2);
    bCtx.fillStyle = '#181818';
    bCtx.fillRect(0, y0, w, 3);
  }

  return {
    map: finalizeTexture(cColor, { repeatX, repeatY, srgb: true, anisotropy }),
    bumpMap: finalizeTexture(cBump, { repeatX, repeatY, srgb: false, anisotropy }),
  };
}

function makeKawaraRoofTextures(anisotropy = 4) {
  const rand = mulberry32(202);
  const w = 512;
  const h = 512;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const b = createCanvas(w, h);
  const bCtx = b.getContext('2d');

  ctx.fillStyle = '#383d44';
  ctx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, w, h);

  const cols = 12;
  const rows = 10;
  const cw = w / cols;
  const rh = h / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw;
      const y = r * rh;
      const shade = 52 + Math.floor((rand() - 0.5) * 16);

      // Curved Japanese tile gradient across width
      const grad = ctx.createLinearGradient(x, y, x + cw, y);
      grad.addColorStop(0.0, `rgb(${shade - 14},${shade - 12},${shade - 7})`);
      grad.addColorStop(0.32, `rgb(${shade + 16},${shade + 18},${shade + 22})`);
      grad.addColorStop(0.68, `rgb(${shade + 5},${shade + 7},${shade + 11})`);
      grad.addColorStop(1.0, `rgb(${shade - 18},${shade - 16},${shade - 12})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cw + 0.5, rh + 0.5);

      // Bottom overlap shadow
      const sg = ctx.createLinearGradient(0, y + rh - 10, 0, y + rh);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(1, 'rgba(10,12,16,0.65)');
      ctx.fillStyle = sg;
      ctx.fillRect(x, y + rh - 10, cw, 10);

      // Bump curvature
      const bg = bCtx.createLinearGradient(x, y, x + cw, y);
      bg.addColorStop(0, '#303030');
      bg.addColorStop(0.35, '#e8e8e8');
      bg.addColorStop(0.7, '#989898');
      bg.addColorStop(1, '#252525');
      bCtx.fillStyle = bg;
      bCtx.fillRect(x, y, cw + 0.5, rh);
      bCtx.fillStyle = '#181818';
      bCtx.fillRect(x, y + rh - 3, cw, 3);
    }
  }

  return {
    map: finalizeTexture(c, { repeatX: 4, repeatY: 2.2, srgb: true, anisotropy }),
    bumpMap: finalizeTexture(b, { repeatX: 4, repeatY: 2.2, srgb: false, anisotropy }),
  };
}

function makeShikkuiTexture(anisotropy = 4) {
  const rand = mulberry32(303);
  const w = 256;
  const h = 256;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ebe3d3';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 2400; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 1 + rand() * 5;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,252,245,0.14)' : 'rgba(182,168,144,0.14)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeTexture(c, { repeatX: 3, repeatY: 1.5, srgb: true, anisotropy });
}

function makeShojiTexture(anisotropy = 4) {
  const rand = mulberry32(404);
  const w = 256;
  const h = 512;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');

  // Warm fibrous washi paper
  ctx.fillStyle = '#f5eedc';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(225,212,188,0.35)' : 'rgba(255,252,242,0.4)';
    ctx.lineWidth = 0.6 + rand() * 0.8;
    const x = rand() * w;
    const y = rand() * h;
    const len = 6 + rand() * 14;
    const ang = rand() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  // Kumiko lattice
  ctx.fillStyle = '#4e3522';
  const vCols = 4;
  const hRows = 8;
  const bar = 5;
  for (let i = 0; i <= vCols; i++) {
    const x = (i / vCols) * (w - bar);
    ctx.fillRect(x, 0, bar, h);
  }
  for (let j = 0; j <= hRows; j++) {
    const y = (j / hRows) * (h - bar);
    ctx.fillRect(0, y, w, bar);
  }
  // Outer frame
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#3d2818';
  ctx.strokeRect(0, 0, w, h);

  return finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true, anisotropy });
}

function makeStoneTextures(anisotropy = 4, { base = '#8c8a82', mossy = true, seed = 505 } = {}) {
  const rand = mulberry32(seed);
  const w = 256;
  const h = 256;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const b = createCanvas(w, h);
  const bCtx = b.getContext('2d');

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 3200; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.7 + rand() * 3.2;
    const v = rand();
    if (v < 0.35) {
      ctx.fillStyle = 'rgba(42,40,38,0.22)';
      bCtx.fillStyle = 'rgba(50,50,50,0.25)';
    } else if (v < 0.75) {
      ctx.fillStyle = 'rgba(218,215,205,0.2)';
      bCtx.fillStyle = 'rgba(205,205,205,0.25)';
    } else {
      ctx.fillStyle = 'rgba(120,115,105,0.22)';
      bCtx.fillStyle = 'rgba(128,128,128,0.2)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  if (mossy) {
    for (let m = 0; m < 18; m++) {
      const mx = rand() * w;
      const my = rand() * h;
      const mr = 8 + rand() * 20;
      const g = ctx.createRadialGradient(mx, my, 1, mx, my, mr);
      g.addColorStop(0, 'rgba(84,106,60,0.42)');
      g.addColorStop(1, 'rgba(84,106,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    map: finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true, anisotropy }),
    bumpMap: finalizeTexture(b, { repeatX: 1, repeatY: 1, srgb: false, anisotropy }),
  };
}

function makeSakuraBarkTextures(anisotropy = 4) {
  const rand = mulberry32(606);
  const w = 512;
  const h = 512;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const b = createCanvas(w, h);
  const bCtx = b.getContext('2d');

  ctx.fillStyle = '#4a3a35';
  ctx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#7c7c7c';
  bCtx.fillRect(0, 0, w, h);

  // Vertical bark furrows
  for (let i = 0; i < 420; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 30 + rand() * 140;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(30,22,18,0.34)' : 'rgba(98,79,71,0.25)';
    ctx.lineWidth = 1.2 + rand() * 3.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 6, y + len);
    ctx.stroke();

    bCtx.strokeStyle = rand() > 0.5 ? 'rgba(30,30,30,0.4)' : 'rgba(200,200,200,0.3)';
    bCtx.lineWidth = 2 + rand() * 3;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + (rand() - 0.5) * 5, y + len);
    bCtx.stroke();
  }

  // Characteristic horizontal sakura lenticels (皮目)
  for (let i = 0; i < 240; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 10 + rand() * 32;
    ctx.strokeStyle = 'rgba(148,118,104,0.42)';
    ctx.lineWidth = 1.5 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 2);
    ctx.stroke();

    bCtx.strokeStyle = 'rgba(220,220,220,0.5)';
    bCtx.lineWidth = 2;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + len, y);
    bCtx.stroke();
  }

  // Lichen patches
  for (let i = 0; i < 25; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 6 + rand() * 16;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(116,134,96,0.38)');
    g.addColorStop(1, 'rgba(116,134,96,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    map: finalizeTexture(c, { repeatX: 2, repeatY: 3, srgb: true, anisotropy }),
    bumpMap: finalizeTexture(b, { repeatX: 2, repeatY: 3, srgb: false, anisotropy }),
  };
}

function makeFoliageClusterTexture(isSakura = false, anisotropy = 4) {
  const rand = mulberry32(isSakura ? 707 : 708);
  const s = 256;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);

  if (isSakura) {
    // Cluster of delicate 5-petal cherry blossoms
    const blossomCount = 15;
    for (let b = 0; b < blossomCount; b++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * 78;
      const cx = s * 0.5 + Math.cos(ang) * dist;
      const cy = s * 0.5 + Math.sin(ang) * dist;
      const r = 18 + rand() * 14;
      const rot = rand() * Math.PI * 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      const tint = rand();
      const outerCol = tint < 0.35 ? '#fff3f7' : tint < 0.75 ? '#ffd2e1' : '#f8b4cb';
      const innerCol = '#f282a8';

      for (let p = 0; p < 5; p++) {
        ctx.save();
        ctx.rotate((p / 5) * Math.PI * 2);
        const pg = ctx.createRadialGradient(0, r * 0.15, 1, 0, r * 0.5, r);
        pg.addColorStop(0, innerCol);
        pg.addColorStop(0.35, outerCol);
        pg.addColorStop(1, '#fff6f9');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-r * 0.52, r * 0.35, -r * 0.42, r * 0.96, -r * 0.08, r * 0.92);
        ctx.lineTo(0, r * 0.78); // Sakura petal notch
        ctx.lineTo(r * 0.08, r * 0.92);
        ctx.bezierCurveTo(r * 0.42, r * 0.96, r * 0.52, r * 0.35, 0, 0);
        ctx.fill();
        ctx.restore();
      }

      // Rosy stamen center
      ctx.fillStyle = '#d44872';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe596';
      for (let st = 0; st < 6; st++) {
        const sa = (st / 6) * Math.PI * 2 + rot;
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * r * 0.22, Math.sin(sa) * r * 0.22, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else {
    // Neutral-luminance botanical leaf cluster (tinted dynamically by seasonal color)
    const leafCount = 24;
    for (let l = 0; l < leafCount; l++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * 78;
      const cx = s * 0.5 + Math.cos(ang) * dist;
      const cy = s * 0.5 + Math.sin(ang) * dist;
      const len = 26 + rand() * 24;
      const wid = len * (0.42 + rand() * 0.16);
      const rot = ang + (rand() - 0.5) * 1.1;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      const shade = Math.floor(170 + rand() * 82);
      const g = ctx.createLinearGradient(-len * 0.5, 0, len * 0.5, 0);
      g.addColorStop(0, `rgb(${shade - 42},${shade - 38},${shade - 45})`);
      g.addColorStop(0.55, `rgb(${shade},${shade},${shade})`);
      g.addColorStop(1, `rgb(${Math.min(255, shade + 24)},${Math.min(255, shade + 24)},${Math.min(255, shade + 20)})`);
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.moveTo(-len * 0.5, 0);
      ctx.quadraticCurveTo(0, -wid, len * 0.5, 0);
      ctx.quadraticCurveTo(0, wid, -len * 0.5, 0);
      ctx.fill();

      // Central vein
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-len * 0.44, 0);
      ctx.lineTo(len * 0.42, 0);
      ctx.stroke();

      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function makeSoftGlowTexture() {
  const s = 64;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.2)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makeMoonTexture() {
  const rand = mulberry32(808);
  const s = 256;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);

  const g = ctx.createRadialGradient(s * 0.45, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.48);
  g.addColorStop(0, '#fffdf4');
  g.addColorStop(0.75, '#efe8d5');
  g.addColorStop(0.95, '#d7ceb8');
  g.addColorStop(1, 'rgba(215,206,184,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.47, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.45, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 22; i++) {
    const x = s * (0.2 + rand() * 0.6);
    const y = s * (0.2 + rand() * 0.6);
    const r = 6 + rand() * 24;
    ctx.fillStyle = 'rgba(135,130,122,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeButterflyWingTexture(variant = 0) {
  const s = 128;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);

  const palettes = [
    { main: '#f6d84c', edge: '#26211c', spot: '#fff8d4', accent: '#e87838' }, // Swallowtail
    { main: '#fbfaf2', edge: '#3a3834', spot: '#fffef8', accent: '#d8d4c4' }, // Cabbage White
    { main: '#f28c38', edge: '#231812', spot: '#fff5e2', accent: '#d4421e' }, // Fritillary/Monarch
  ];
  const pal = palettes[variant % palettes.length];

  // Forewing (upper) & Hindwing (lower), hinged along x = 4
  ctx.save();
  // Forewing
  ctx.fillStyle = pal.main;
  ctx.beginPath();
  ctx.moveTo(4, 58);
  ctx.bezierCurveTo(18, 12, 92, 6, 118, 34);
  ctx.bezierCurveTo(122, 58, 72, 74, 4, 66);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = pal.edge;
  ctx.stroke();

  // Hindwing
  ctx.fillStyle = pal.main;
  ctx.beginPath();
  ctx.moveTo(4, 64);
  ctx.bezierCurveTo(58, 66, 98, 86, 86, 112);
  ctx.bezierCurveTo(64, 126, 16, 110, 4, 80);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.edge;
  ctx.stroke();

  // Accent veins & spots
  ctx.strokeStyle = pal.edge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 56); ctx.lineTo(86, 30);
  ctx.moveTo(8, 60); ctx.lineTo(96, 46);
  ctx.moveTo(8, 68); ctx.lineTo(74, 96);
  ctx.stroke();

  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(62, 96, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal.spot;
  ctx.beginPath();
  ctx.arc(98, 34, 5, 0, Math.PI * 2);
  ctx.arc(88, 50, 4, 0, Math.PI * 2);
  ctx.arc(72, 102, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeKibbleTexture() {
  const rand = mulberry32(909);
  const s = 128;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c381f';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 360; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const r = 2.5 + rand() * 3.8;
    const tone = rand();
    ctx.fillStyle = tone < 0.33 ? '#7c4c29' : tone < 0.66 ? '#653b1e' : '#8b5a34';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(35,18,8,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeBallTexture() {
  const s = 256;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e0483e';
  ctx.fillRect(0, 0, s, s);
  // Crisp cream stripe & seam lines
  ctx.fillStyle = '#faf3e4';
  ctx.fillRect(0, s * 0.42, s, s * 0.16);
  ctx.fillStyle = '#c4342b';
  ctx.fillRect(0, s * 0.4, s, 4);
  ctx.fillRect(0, s * 0.58, s, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeTerrainUnderlayTexture(anisotropy = 4) {
  const rand = mulberry32(1010);
  const s = 512;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#485b34';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 6500; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const r = 1 + rand() * 6;
    const t = rand();
    ctx.fillStyle =
      t < 0.35
        ? 'rgba(56,74,36,0.22)'
        : t < 0.7
          ? 'rgba(88,108,58,0.18)'
          : 'rgba(72,62,42,0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeTexture(c, { repeatX: 12, repeatY: 12, srgb: true, anisotropy });
}

// ============================================================================
// Seasonal Color Palettes
// ============================================================================
const SEASON_COLORS = {
  grassBase: {
    spring: new THREE.Color('#2c5c1f'),
    summer: new THREE.Color('#1c4617'),
    autumn: new THREE.Color('#4a461e'),
    winter: new THREE.Color('#4e4430'),
  },
  grassTip: {
    spring: new THREE.Color('#80c94d'),
    summer: new THREE.Color('#4c912b'),
    autumn: new THREE.Color('#b89238'),
    winter: new THREE.Color('#978564'),
  },
  groundBase: {
    spring: new THREE.Color('#4a6e30'),
    summer: new THREE.Color('#345924'),
    autumn: new THREE.Color('#685c32'),
    winter: new THREE.Color('#5e5440'),
  },
  treeLeafA: {
    spring: new THREE.Color('#7cc949'),
    summer: new THREE.Color('#2d6e26'),
    autumn: new THREE.Color('#c8361c'),
    winter: new THREE.Color('#7a5338'),
  },
  treeLeafB: {
    spring: new THREE.Color('#4da034'),
    summer: new THREE.Color('#4f9436'),
    autumn: new THREE.Color('#e68d22'),
    winter: new THREE.Color('#684630'),
  },
  shrub: {
    spring: new THREE.Color('#4f8f37'),
    summer: new THREE.Color('#2b6325'),
    autumn: new THREE.Color('#8c622b'),
    winter: new THREE.Color('#4f523a'),
  },
  distantHill: {
    spring: new THREE.Color('#5c7e52'),
    summer: new THREE.Color('#3f623d'),
    autumn: new THREE.Color('#7c6745'),
    winter: new THREE.Color('#6a6c6d'),
  },
};

function blendSeasonColor(out, palette, weights) {
  out.setRGB(
    palette.spring.r * weights.spring +
      palette.summer.r * weights.summer +
      palette.autumn.r * weights.autumn +
      palette.winter.r * weights.winter,
    palette.spring.g * weights.spring +
      palette.summer.g * weights.summer +
      palette.autumn.g * weights.autumn +
      palette.winter.g * weights.winter,
    palette.spring.b * weights.spring +
      palette.summer.b * weights.summer +
      palette.autumn.b * weights.autumn +
      palette.winter.b * weights.winter
  );
  return out;
}

// ============================================================================
// Garden Class (Exported Interface per SPEC.md)
// ============================================================================
export class Garden {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer || null;
    this._maxAniso = this.renderer
      ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
      : 4;

    // Public dynamic state
    this.weather = 'clear';
    this.weatherIntensity = 0.0;
    this.wetness = 0.0;
    this.snowCover = 0.0;
    this.windStrength = 0.18;
    this.foodLevel = 1.0;

    // Public interactive collections
    this.butterflies = [];
    this.birds = [];
    this.fallingThings = [];

    // Internal weather & time tracking
    this._targetWeather = 'clear';
    this._weatherTimerHours = 4.2;
    this._lastMealSlot = null;
    this._elapsed = 0;
    this._sunDir = new THREE.Vector3(0.4, 0.7, 0.5).normalize();
    this._moonDir = new THREE.Vector3(-0.4, 0.6, -0.5).normalize();
    this._sunElevation = 0.7;
    this._isNight = false;

    // PMREM state
    this._pmremGenerator = null;
    this._envScene = null;
    this._envSky = null;
    this._envGround = null;
    this._envNightDome = null;
    this._envRT = null;
    this._lastEnvUpdate = -10;
    this._lastEnvSunY = -99;
    this._lastEnvWeatherKey = '';

    // Layout constants (single source of truth for visuals & colliders)
    this._layout = {
      fenceMinX: -14.2,
      fenceMaxX: 14.2,
      fenceMaxZ: 14.2,
      houseFrontZ: -10.35,
      doghousePos: { x: -7.2, z: -6.8, rotY: 0.45 },
      waterBowlPos: { x: -4.4, z: -8.2 },
      foodBowlPos: { x: -3.2, z: -8.2 },
      treePos: { x: 6.8, z: -3.8, trunkRadius: 0.95, canopyRadius: 4.5, canopyY: 5.2 },
      pond: { x: 6.2, z: 6.2, rx: 2.95, rz: 2.3, waterY: -0.1 },
      flowerbed: { x: -7.6, z: 5.4, hx: 2.35, hz: 1.2 },
      lanterns: [
        { x: 9.3, z: 3.8, r: 0.55 },
        { x: -10.2, z: -1.0, r: 0.55 },
      ],
      cornerShrubs: [
        { x: -12.9, z: 12.9, r: 1.1 },
        { x: 12.8, z: 12.8, r: 1.15 },
        { x: 12.8, z: -8.8, r: 1.05 },
        { x: -12.8, z: -8.8, r: 0.95 },
      ],
      steppingStones: [
        { x: -0.5, z: -9.85, rx: 0.62, rz: 0.36, rot: 0.04 },
        { x: -0.35, z: -8.55, rx: 0.34, rz: 0.28, rot: 0.2 },
        { x: 0.05, z: -7.1, rx: 0.33, rz: 0.29, rot: -0.15 },
        { x: 0.45, z: -5.5, rx: 0.36, rz: 0.28, rot: 0.3 },
        { x: 0.72, z: -3.9, rx: 0.32, rz: 0.27, rot: -0.25 },
        { x: 0.95, z: -2.2, rx: 0.36, rz: 0.3, rot: 0.1 },
        { x: 1.15, z: -0.45, rx: 0.33, rz: 0.28, rot: -0.3 },
        { x: 1.4, z: 1.25, rx: 0.35, rz: 0.28, rot: 0.22 },
        { x: 1.75, z: 2.9, rx: 0.34, rz: 0.29, rot: -0.12 },
        { x: 2.15, z: 4.4, rx: 0.37, rz: 0.3, rot: 0.18 },
        // Small branch toward bowls & doghouse
        { x: -1.65, z: -8.25, rx: 0.3, rz: 0.25, rot: 0.1 },
        { x: -2.6, z: -7.9, rx: 0.28, rz: 0.24, rot: -0.2 },
        // Small branch toward west lantern / flowerbed
        { x: -1.1, z: -1.8, rx: 0.3, rz: 0.26, rot: -0.35 },
        { x: -2.6, z: -1.2, rx: 0.31, rz: 0.25, rot: 0.18 },
        { x: -4.1, z: -0.4, rx: 0.32, rz: 0.26, rot: -0.22 },
      ],
    };

    // Points of interest (strictly matching SPEC.md)
    this.poi = {
      doghouse: { x: -6.35, z: -5.05, rotY: 0.45 },
      doghouseInside: { x: -7.2, z: -6.8, rotY: 0.45 },
      waterBowl: { x: -4.4, z: -7.45, rotY: Math.PI },
      foodBowl: { x: -3.2, z: -7.45, rotY: Math.PI },
      tree: { x: 5.0, z: -2.5, rotY: Math.atan2(1.8, -1.3) },
      flowerbed: { x: -4.3, z: 5.4, rotY: -Math.PI / 2 },
      porch: { x: -0.5, z: -9.2, rotY: 0 },
      pond: { x: 2.3, z: 5.6, rotY: Math.atan2(3.9, 0.6) },
      toy: { x: -1.2, z: 2.6 },
    };

    // Shared shader uniforms updated every frame
    this._sharedUniforms = {
      uTime: { value: 0 },
      uWindStrength: { value: 0.18 },
      uWindDir: { value: new THREE.Vector2(0.85, 0.52) },
      uSnowCover: { value: 0 },
      uWetness: { value: 0 },
      uGrassBaseColor: { value: SEASON_COLORS.grassBase.spring.clone() },
      uGrassTipColor: { value: SEASON_COLORS.grassTip.spring.clone() },
      uGroundColor: { value: SEASON_COLORS.groundBase.spring.clone() },
      uSunColor: { value: new THREE.Color('#fff4e0') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
      uSkyColor: { value: new THREE.Color('#8ec3f0') },
      uSunIntensity: { value: 1.0 },
      uRainIntensity: { value: 0.0 },
      uWaterLevel: { value: this._layout.pond.waterY },
    };

    // Reusable scratch objects (zero per-frame allocations)
    this._dummy = new THREE.Object3D();
    this._tmpVec = new THREE.Vector3();
    this._tmpVec2 = new THREE.Vector3();
    this._tmpColor = new THREE.Color();
    this._tmpColor2 = new THREE.Color();
    this._tmpColor3 = new THREE.Color();

    // Lists of materials that react to wetness / snow
    this._wettableMaterials = [];
    this._snowCapMeshes = [];

    // Shared procedural textures
    this._tex = {
      woodCedar: makeWoodTextures(this._maxAniso, {
        baseA: '#8b6343',
        baseB: '#6d4b30',
        grain: '#422a18',
        planks: 6,
        repeatX: 2,
        repeatY: 1,
        seed: 101,
      }),
      woodDark: makeWoodTextures(this._maxAniso, {
        baseA: '#4e3726',
        baseB: '#3a2719',
        grain: '#22160d',
        planks: 5,
        repeatX: 2,
        repeatY: 1,
        seed: 102,
      }),
      woodEngawa: makeWoodTextures(this._maxAniso, {
        baseA: '#a3784f',
        baseB: '#8a623d',
        grain: '#593b21',
        planks: 8,
        repeatX: 3,
        repeatY: 1,
        seed: 103,
      }),
      kawara: makeKawaraRoofTextures(this._maxAniso),
      shikkui: makeShikkuiTexture(this._maxAniso),
      shoji: makeShojiTexture(this._maxAniso),
      stone: makeStoneTextures(this._maxAniso, { base: '#8a8981', mossy: true, seed: 505 }),
      stoneDark: makeStoneTextures(this._maxAniso, { base: '#696b68', mossy: true, seed: 506 }),
      bark: makeSakuraBarkTextures(this._maxAniso),
      sakuraCluster: makeFoliageClusterTexture(true, this._maxAniso),
      leafCluster: makeFoliageClusterTexture(false, this._maxAniso),
      glow: makeSoftGlowTexture(),
      moon: makeMoonTexture(),
      kibble: makeKibbleTexture(),
      ball: makeBallTexture(),
      terrain: makeTerrainUnderlayTexture(this._maxAniso),
      butterflyWings: [
        makeButterflyWingTexture(0),
        makeButterflyWingTexture(1),
        makeButterflyWingTexture(2),
      ],
    };

    // Build entire environment
    this._buildSkyAndLighting();
    this._buildTerrainAndHills();
    this._buildGrass();
    this._buildHouseAndEngawa();
    this._buildFence();
    this._buildDoghouseAndBowls();
    this._buildHeroTree();
    this._buildPond();
    this._buildFlowerbed();
    this._buildSteppingStonesAndProps();
    this._buildButterflies();
    this._buildBirds();
    this._buildParticles();

    // Initial environment map build
    this._updatePMREM(true);
  }

  // ==========================================================================
  // Terrain Height & Walkability API
  // ==========================================================================
  getGroundHeight(x, z) {
    // Gentle organic lawn undulations
    let h =
      0.11 * Math.sin(x * 0.16 + 0.5) * Math.cos(z * 0.14 - 0.3) +
      0.065 * Math.sin(x * 0.31 - z * 0.24 + 1.1) +
      0.03 * Math.cos((x + z) * 0.45);

    // Flatten smoothly near house & engawa apron (z < -7.5)
    const houseFlat = smoothstep(-7.2, -10.4, z);
    h *= 1.0 - houseFlat * 0.92;

    // Flatten subtly around doghouse & bowls
    const dDog = Math.hypot(x - this._layout.doghousePos.x, z - this._layout.doghousePos.z);
    h *= 1.0 - (1.0 - smoothstep(1.4, 3.2, dDog)) * 0.85;

    // Gentle mound around hero tree roots
    const dTree = Math.hypot(x - this._layout.treePos.x, z - this._layout.treePos.z);
    h += (1.0 - smoothstep(0.6, 3.0, dTree)) * 0.16;

    // Carve natural pond basin
    const pond = this._layout.pond;
    const pdx = (x - pond.x) / pond.rx;
    const pdz = (z - pond.z) / pond.rz;
    const pDist = Math.hypot(pdx, pdz);
    if (pDist < 1.38) {
      // Smooth rim depression down into pond bed
      const rim = 1.0 - smoothstep(0.72, 1.35, pDist);
      const deep = 1.0 - smoothstep(0.1, 0.95, pDist);
      h = lerp(h, -0.04, rim) - deep * 0.54;
    }

    return h;
  }

  isInside(x, z, margin = 0) {
    const m = Math.max(0, margin || 0);
    const L = this._layout;

    // Yard interior within fence and south of engawa
    if (x < L.fenceMinX + 0.55 + m || x > L.fenceMaxX - 0.55 - m) return false;
    if (z > L.fenceMaxZ - 0.55 - m || z < L.houseFrontZ + 0.15 + m) return false;

    // Doghouse collider
    const dhx = x - L.doghousePos.x;
    const dhz = z - L.doghousePos.z;
    if (dhx * dhx + dhz * dhz < (1.1 + m) * (1.1 + m)) return false;

    // Water & Food bowl tiny colliders (keep POI approach clear)
    const wbx = x - L.waterBowlPos.x;
    const wbz = z - L.waterBowlPos.z;
    if (wbx * wbx + wbz * wbz < (0.2 + m * 0.35) * (0.2 + m * 0.35)) return false;

    const fbx = x - L.foodBowlPos.x;
    const fbz = z - L.foodBowlPos.z;
    if (fbx * fbx + fbz * fbz < (0.2 + m * 0.35) * (0.2 + m * 0.35)) return false;

    // Hero tree trunk collider
    const tx = x - L.treePos.x;
    const tz = z - L.treePos.z;
    const tr = L.treePos.trunkRadius + m;
    if (tx * tx + tz * tz < tr * tr) return false;

    // Pond collider (ellipse)
    const px = (x - L.pond.x) / (L.pond.rx + 0.25 + m);
    const pz = (z - L.pond.z) / (L.pond.rz + 0.25 + m);
    if (px * px + pz * pz < 1.0) return false;

    // Flowerbed collider (rounded rect)
    const fx = Math.abs(x - L.flowerbed.x) - L.flowerbed.hx;
    const fz = Math.abs(z - L.flowerbed.z) - L.flowerbed.hz;
    const fOutX = Math.max(fx, 0);
    const fOutZ = Math.max(fz, 0);
    if (fx < m + 0.15 && fz < m + 0.15 && fOutX * fOutX + fOutZ * fOutZ < (m + 0.15) * (m + 0.15)) {
      return false;
    }

    // Stone lanterns
    for (let i = 0; i < L.lanterns.length; i++) {
      const lan = L.lanterns[i];
      const lx = x - lan.x;
      const lz = z - lan.z;
      const lr = lan.r + m;
      if (lx * lx + lz * lz < lr * lr) return false;
    }

    // Corner decorative shrubs
    for (let i = 0; i < L.cornerShrubs.length; i++) {
      const sh = L.cornerShrubs[i];
      const sx = x - sh.x;
      const sz = z - sh.z;
      const sr = sh.r + m;
      if (sx * sx + sz * sz < sr * sr) return false;
    }

    return true;
  }

  randomWalkablePoint() {
    for (let i = 0; i < 64; i++) {
      const x = -12.8 + Math.random() * 25.6;
      const z = -9.2 + Math.random() * 22.0;
      if (this.isInside(x, z, 0.65)) {
        return { x, z };
      }
    }
    return { x: 0, z: 1.5 };
  }

  getSunnySpot() {
    if (this._isNight || this._sunElevation < 0.07) return null;
    if (this.weather === 'rain' || this.weather === 'snow') return null;
    if (this.weather === 'cloudy' && this.weatherIntensity > 0.72) return null;

    const sx = this._sunDir.x;
    const sy = Math.max(0.12, this._sunDir.y);
    const sz = this._sunDir.z;

    const isInShadow = (x, z) => {
      const y = this.getGroundHeight(x, z) + 0.35;

      // Tree canopy sphere shadow ray check
      const tree = this._layout.treePos;
      const tToTreeX = tree.x - x;
      const tToTreeY = tree.canopyY - y;
      const tToTreeZ = tree.z - z;
      const proj = tToTreeX * sx + tToTreeY * sy + tToTreeZ * sz;
      if (proj > 0) {
        const cx = tToTreeX - proj * sx;
        const cy = tToTreeY - proj * sy;
        const cz = tToTreeZ - proj * sz;
        if (cx * cx + cy * cy + cz * cz < tree.canopyRadius * tree.canopyRadius * 0.85) {
          return true;
        }
      }

      // House shadow check (house occupies z in [-17.5, -10.5], height ~5.8m)
      if (sz < -0.05) {
        const distZ = (-10.5 - z) / sz;
        if (distZ > 0) {
          const hitY = y + distZ * sy;
          const hitX = x + distZ * sx;
          if (hitY < 5.6 && Math.abs(hitX) < 12.8) return true;
        }
      }

      // Doghouse shadow check
      const dh = this._layout.doghousePos;
      const tDh = ((dh.x - x) * sx + (1.0 - y) * sy + (dh.z - z) * sz);
      if (tDh > 0 && tDh < 6.0) {
        const dx = dh.x - (x + tDh * sx);
        const dy = 0.85 - (y + tDh * sy);
        const dz = dh.z - (z + tDh * sz);
        if (dx * dx + dy * dy + dz * dz < 1.2) return true;
      }

      // Fence low-angle shadow check
      if (sy < 0.38) {
        const fenceH = 1.65;
        const shadowLen = (fenceH - 0.3) / sy;
        if (sx < -0.1 && x < this._layout.fenceMinX + shadowLen * (-sx) + 0.4) return true;
        if (sx > 0.1 && x > this._layout.fenceMaxX - shadowLen * sx - 0.4) return true;
        if (sz > 0.1 && z > this._layout.fenceMaxZ - shadowLen * sz - 0.4) return true;
      }

      return false;
    };

    // Preferred cozy sunny spots first (near engawa, center meadow, near flowerbed)
    const favorites = [
      { x: -0.6, z: -7.8 },
      { x: 1.5, z: -6.5 },
      { x: -1.8, z: 0.4 },
      { x: 0.6, z: 3.4 },
      { x: -3.6, z: 2.2 },
      { x: -2.2, z: 7.4 },
      { x: 2.0, z: -1.5 },
    ];
    // Shuffle start index slightly so dog doesn't always pick identical pixel
    const offset = Math.floor(Math.random() * favorites.length);
    for (let i = 0; i < favorites.length; i++) {
      const p = favorites[(i + offset) % favorites.length];
      const jitterX = p.x + (Math.random() - 0.5) * 1.4;
      const jitterZ = p.z + (Math.random() - 0.5) * 1.4;
      if (this.isInside(jitterX, jitterZ, 0.7) && !isInShadow(jitterX, jitterZ)) {
        return { x: jitterX, z: jitterZ };
      }
    }

    // Fallback random sampling across the walkable garden
    for (let i = 0; i < 40; i++) {
      const pt = this.randomWalkablePoint();
      if (!isInShadow(pt.x, pt.z)) return pt;
    }

    return null;
  }

  // ==========================================================================
  // 1. Sky, Sun, Moon, Stars, Clouds, Lighting & PMREM
  // ==========================================================================
  _buildSkyAndLighting() {
    // Three.js physical Sky dome
    this._sky = new Sky();
    this._sky.scale.setScalar(450);
    this.scene.add(this._sky);

    // Night sky luminous indigo dome (fades in smoothly when sun sets)
    const nightGeo = new THREE.SphereGeometry(410, 32, 20);
    this._nightSkyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: 0.0 },
        uZenithColor: { value: new THREE.Color('#070d20') },
        uHorizonColor: { value: new THREE.Color('#182848') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uZenithColor, pow(max(h, 0.0001), 0.55));
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });
    this._nightSkyMesh = new THREE.Mesh(nightGeo, this._nightSkyMat);
    this._nightSkyMesh.renderOrder = -2;
    this.scene.add(this._nightSkyMesh);

    // Overcast sky veil (softly dims and tints sky during cloudy/rain/snow)
    const overcastGeo = new THREE.SphereGeometry(390, 28, 16);
    this._overcastMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: 0.0 },
        uTopColor: { value: new THREE.Color('#6f7b8a') },
        uHorizonColor: { value: new THREE.Color('#a4aeb8') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(max(h, 0.0001), 0.6));
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });
    this._overcastMesh = new THREE.Mesh(overcastGeo, this._overcastMat);
    this._overcastMesh.renderOrder = -1;
    this.scene.add(this._overcastMesh);

    // Twinkling Starfield
    const rand = mulberry32(1111);
    const starCount = 1400;
    const starPos = new Float32Array(starCount * 3);
    const starSize = new Float32Array(starCount);
    const starPhase = new Float32Array(starCount);
    const starColor = new Float32Array(starCount * 3);
    const starPalette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#cfe2ff'),
      new THREE.Color('#ffe9c4'),
      new THREE.Color('#d8e8ff'),
    ];
    for (let i = 0; i < starCount; i++) {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(0.06 + v * 0.94); // Above horizon
      const r = 340;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      starSize[i] = 1.2 + Math.pow(rand(), 3.0) * 3.8;
      starPhase[i] = rand() * Math.PI * 2;
      const c = starPalette[Math.floor(rand() * starPalette.length)];
      starColor[i * 3] = c.r;
      starColor[i * 3 + 1] = c.g;
      starColor[i * 3 + 2] = c.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColor, 3));

    this._starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this._sharedUniforms.uTime,
        uOpacity: { value: 0.0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        uniform float uTime;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vColor = aColor;
          vTwinkle = 0.65 + 0.35 * sin(uTime * 1.9 + aPhase);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (340.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.05, d) * uOpacity * vTwinkle;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor * 1.15, alpha);
        }
      `,
    });
    this._stars = new THREE.Points(starGeo, this._starMat);
    this.scene.add(this._stars);

    // Moon disc & soft halo
    this._moonGroup = new THREE.Group();
    this._moonMat = new THREE.SpriteMaterial({
      map: this._tex.moon,
      color: 0xfff8e6,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      fog: false,
    });
    const moonSprite = new THREE.Sprite(this._moonMat);
    moonSprite.scale.set(22, 22, 1);
    this._moonGroup.add(moonSprite);

    this._moonHaloMat = new THREE.SpriteMaterial({
      map: this._tex.glow,
      color: 0xaec8f5,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const moonHalo = new THREE.Sprite(this._moonHaloMat);
    moonHalo.scale.set(68, 68, 1);
    this._moonGroup.add(moonHalo);
    this.scene.add(this._moonGroup);

    // Procedural drifting FBM sky cloud dome
    const cloudGeo = new THREE.SphereGeometry(290, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    this._cloudMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: this._sharedUniforms.uTime,
        uCoverage: { value: 0.25 },
        uCloudBright: { value: new THREE.Color('#ffffff') },
        uCloudShadow: { value: new THREE.Color('#b8cadb') },
        uSunDir: this._sharedUniforms.uSunDir,
        uSunGlowColor: { value: new THREE.Color('#ffd9a8') },
        uOpacity: { value: 0.85 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uCoverage;
        uniform vec3 uCloudBright;
        uniform vec3 uCloudShadow;
        uniform vec3 uSunDir;
        uniform vec3 uSunGlowColor;
        uniform float uOpacity;
        varying vec3 vWorldDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            v += amp * noise(p);
            p = p * 2.03 + vec2(13.7, 7.1);
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vWorldDir);
          if (d.y < 0.02) discard;
          vec2 uv = d.xz / (d.y + 0.16);
          vec2 drift = vec2(uTime * 0.009, uTime * 0.005);
          float n1 = fbm(uv * 0.65 + drift);
          float n2 = fbm(uv * 1.45 - drift * 0.6 + vec2(3.2, 8.4));
          float density = n1 * 0.72 + n2 * 0.28;

          float threshold = mix(0.66, 0.24, uCoverage);
          float cloud = smoothstep(threshold, threshold + 0.26, density);
          float horizonFade = smoothstep(0.02, 0.22, d.y);
          float alpha = cloud * horizonFade * uOpacity;
          if (alpha < 0.005) discard;

          float sunAlign = max(0.0, dot(d, normalize(uSunDir)));
          float lightFactor = clamp(smoothstep(threshold, threshold + 0.4, density + 0.15) * 0.7 + 0.3, 0.0, 1.0);
          vec3 col = mix(uCloudShadow, uCloudBright, lightFactor);
          col += uSunGlowColor * pow(max(sunAlign, 0.0001), 5.0) * 0.45 * (1.0 - cloud * 0.4);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this._clouds = new THREE.Mesh(cloudGeo, this._cloudMat);
    this.scene.add(this._clouds);

    // Key Directional Light (Sun by day, Moon by night)
    this._keyLight = new THREE.DirectionalLight(0xfff4e0, 2.8);
    this._keyLight.castShadow = true;
    this._keyLight.shadow.mapSize.set(2048, 2048);
    this._keyLight.shadow.camera.left = -19;
    this._keyLight.shadow.camera.right = 19;
    this._keyLight.shadow.camera.top = 19;
    this._keyLight.shadow.camera.bottom = -19;
    this._keyLight.shadow.camera.near = 2;
    this._keyLight.shadow.camera.far = 92;
    this._keyLight.shadow.bias = -0.0004;
    this._keyLight.shadow.normalBias = 0.028;
    this._keyLight.shadow.radius = 2.4;
    this._keyLight.target.position.set(0, 0, -1);
    this.scene.add(this._keyLight);
    this.scene.add(this._keyLight.target);

    // Hemisphere sky/ground bounce light
    this._hemiLight = new THREE.HemisphereLight(0x9bc8f5, 0x4e6b35, 0.72);
    this.scene.add(this._hemiLight);

    // Atmospheric fog
    this._fog = new THREE.FogExp2(0xc9dcf0, 0.0045);
    this.scene.fog = this._fog;

    // Dedicated mini-scene for PMREM sky environment reflections
    if (this.renderer) {
      this._pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this._envScene = new THREE.Scene();
      this._envSky = new Sky();
      this._envSky.scale.setScalar(100);
      this._envScene.add(this._envSky);

      this._envGround = new THREE.Mesh(
        new THREE.SphereGeometry(90, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        new THREE.MeshBasicMaterial({ color: 0x4a6636, side: THREE.BackSide })
      );
      this._envScene.add(this._envGround);

      this._envNightDome = new THREE.Mesh(
        new THREE.SphereGeometry(85, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
        new THREE.MeshBasicMaterial({
          color: 0x162442,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.0,
        })
      );
      this._envScene.add(this._envNightDome);
    }
  }

  _updatePMREM(force = false) {
    if (!this._pmremGenerator || !this._envScene) return;
    const weatherKey = `${this.weather}_${Math.round(this.weatherIntensity * 4)}_${Math.round(this.snowCover * 4)}`;
    const sunDelta = Math.abs(this._sunDir.y - this._lastEnvSunY);
    if (!force && this._elapsed - this._lastEnvUpdate < 1.8 && sunDelta < 0.04 && weatherKey === this._lastEnvWeatherKey) {
      return;
    }
    this._lastEnvUpdate = this._elapsed;
    this._lastEnvSunY = this._sunDir.y;
    this._lastEnvWeatherKey = weatherKey;

    // Mirror current sky parameters into envSky
    const srcU = this._sky.material.uniforms;
    const dstU = this._envSky.material.uniforms;
    dstU.turbidity.value = srcU.turbidity.value;
    dstU.rayleigh.value = srcU.rayleigh.value;
    dstU.mieCoefficient.value = srcU.mieCoefficient.value;
    dstU.mieDirectionalG.value = srcU.mieDirectionalG.value;
    dstU.sunPosition.value.copy(srcU.sunPosition.value);

    // Sync ground bounce & night tint
    this._envGround.material.color
      .copy(this._sharedUniforms.uGroundColor.value)
      .lerp(this._tmpColor.set('#dde5ee'), this.snowCover * 0.85)
      .multiplyScalar(this._isNight ? 0.25 : 0.9);
    this._envNightDome.material.opacity = this._nightSkyMat.uniforms.uOpacity.value * 0.9;

    const prevRT = this._envRT;
    this._envRT = this._pmremGenerator.fromScene(this._envScene, 0.04);
    this.scene.environment = this._envRT.texture;
    if (prevRT) prevRT.dispose();
  }

  // ==========================================================================
  // 2. Terrain & Distant Rolling Horizon Hills
  // ==========================================================================
  _buildTerrainAndHills() {
    // Yard terrain mesh (high resolution for smooth undulations & pond basin)
    const size = 34;
    const segs = 112;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const pond = this._layout.pond;
    const fbed = this._layout.flowerbed;
    const soilMask = new Float32Array(pos.count);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getGroundHeight(x, z);
      pos.setY(i, y);

      // Mark soil / pond-bed regions (0 = grass ground, 1 = dark earth/pebble)
      let mask = 0;
      const pd = Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
      if (pd < 1.15) {
        mask = Math.max(mask, 1.0 - smoothstep(0.75, 1.15, pd));
      }
      if (Math.abs(x - fbed.x) < fbed.hx + 0.1 && Math.abs(z - fbed.z) < fbed.hz + 0.1) {
        mask = 1.0;
      }
      // Subtle earthy patch under doghouse & tree base
      const dTree = Math.hypot(x - this._layout.treePos.x, z - this._layout.treePos.z);
      if (dTree < 1.7) {
        mask = Math.max(mask, (1.0 - smoothstep(0.7, 1.7, dTree)) * 0.75);
      }
      soilMask[i] = mask;
    }
    geo.setAttribute('aSoilMask', new THREE.BufferAttribute(soilMask, 1));
    geo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this._tex.terrain,
      roughness: 0.94,
      metalness: 0.0,
    });

    const u = this._sharedUniforms;
    terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uGroundColor = u.uGroundColor;
      shader.uniforms.uSnowCover = u.uSnowCover;
      shader.uniforms.uWetness = u.uWetness;
      shader.uniforms.uWaterLevel = u.uWaterLevel;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aSoilMask;
          varying float vSoilMask;
          varying vec3 vTerrainWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vSoilMask = aSoilMask;
          vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uGroundColor;
          uniform float uSnowCover;
          uniform float uWetness;
          uniform float uWaterLevel;
          varying float vSoilMask;
          varying vec3 vTerrainWorldPos;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 lawnTint = diffuseColor.rgb * uGroundColor * 2.15;
          vec3 soilCol = vec3(0.24, 0.18, 0.12) * (0.7 + 0.6 * diffuseColor.r);
          vec3 pebbleCol = vec3(0.32, 0.30, 0.25) * (0.75 + 0.5 * diffuseColor.g);
          float underwater = 1.0 - smoothstep(uWaterLevel - 0.08, uWaterLevel + 0.05, vTerrainWorldPos.y);
          vec3 baseCol = mix(lawnTint, soilCol, vSoilMask);
          baseCol = mix(baseCol, pebbleCol, underwater);

          // Wetness darkens earth & grass underlay
          float localWet = max(uWetness, underwater);
          baseCol *= mix(1.0, 0.68, localWet);

          // Snow blanket (never underwater, patchy transition)
          float patchNoise = sin(vTerrainWorldPos.x * 0.7) * cos(vTerrainWorldPos.z * 0.65) * 0.14
                           + sin((vTerrainWorldPos.x + vTerrainWorldPos.z) * 1.6) * 0.06;
          float snowAmt = smoothstep(0.05, 0.78, uSnowCover + patchNoise) * (1.0 - underwater);
          vec3 snowCol = vec3(0.92, 0.95, 0.99);
          diffuseColor.rgb = mix(baseCol, snowCol, snowAmt);`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float wetR = mix(roughnessFactor, 0.32, uWetness * (1.0 - uSnowCover * 0.8));
          roughnessFactor = mix(wetR, 0.82, uSnowCover);`
        );
    };

    const terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // Distant rolling hills & surrounding countryside ground skirt
    const outerGeo = new THREE.RingGeometry(15.5, 195, 72, 14);
    outerGeo.rotateX(-Math.PI / 2);
    const oPos = outerGeo.attributes.position;
    for (let i = 0; i < oPos.count; i++) {
      const x = oPos.getX(i);
      const z = oPos.getZ(i);
      const dist = Math.hypot(x, z);
      const hillFactor = smoothstep(22, 120, dist);
      const ang = Math.atan2(z, x);
      const hillH =
        (Math.sin(ang * 3.0 + 0.6) * 7.5 +
          Math.cos(ang * 5.0 - 1.2) * 4.5 +
          Math.sin(ang * 8.0 + dist * 0.04) * 2.5 +
          10.0) *
        hillFactor;
      oPos.setY(i, hillH - 0.25);
    }
    outerGeo.computeVertexNormals();
    this._hillMat = new THREE.MeshStandardMaterial({
      color: SEASON_COLORS.distantHill.spring.clone(),
      roughness: 0.96,
      metalness: 0.0,
    });
    const outerHills = new THREE.Mesh(outerGeo, this._hillMat);
    outerHills.receiveShadow = false;
    this.scene.add(outerHills);

    // Distant neighborhood tree silhouettes outside the fence (soft atmospheric depth)
    const rand = mulberry32(1212);
    const crownGeo = new THREE.DodecahedronGeometry(1, 1);
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 6);
    this._bgTreeCrownMat = new THREE.MeshStandardMaterial({
      color: 0x3b6334,
      roughness: 0.92,
    });
    const bgTrunkMat = new THREE.MeshStandardMaterial({ color: 0x453429, roughness: 0.95 });

    const bgTreeCount = 34;
    const bgCrowns = new THREE.InstancedMesh(crownGeo, this._bgTreeCrownMat, bgTreeCount);
    const bgTrunks = new THREE.InstancedMesh(trunkGeo, bgTrunkMat, bgTreeCount);
    for (let i = 0; i < bgTreeCount; i++) {
      const ang = (i / bgTreeCount) * Math.PI * 2 + (rand() - 0.5) * 0.16;
      const dist = 21 + rand() * 24;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const s = 2.0 + rand() * 2.8;
      this._dummy.position.set(x, 1.4, z);
      this._dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      this._dummy.scale.set(1, 0.9 + rand() * 0.7, 1);
      this._dummy.updateMatrix();
      bgTrunks.setMatrixAt(i, this._dummy.matrix);

      this._dummy.position.set(x, 2.8 + s * 0.85, z);
      this._dummy.scale.set(s * (0.9 + rand() * 0.35), s * (0.85 + rand() * 0.35), s * (0.9 + rand() * 0.35));
      this._dummy.updateMatrix();
      bgCrowns.setMatrixAt(i, this._dummy.matrix);
    }
    bgCrowns.instanceMatrix.needsUpdate = true;
    bgTrunks.instanceMatrix.needsUpdate = true;
    this.scene.add(bgTrunks);
    this.scene.add(bgCrowns);
  }

  // ==========================================================================
  // 3. Instanced Wind-Swaying Grass (~46,000 blades!)
  // ==========================================================================
  _buildGrass() {
    const rand = mulberry32(2026);
    const bladeCount = 46000;

    // Sculpted arched 3-segment tapered blade geometry (7 vertices, 5 triangles)
    const bladeGeo = new THREE.BufferGeometry();
    const w0 = 0.028;
    const w1 = 0.022;
    const w2 = 0.012;
    const h1 = 0.095;
    const h2 = 0.19;
    const h3 = 0.275;
    const positions = new Float32Array([
      -w0, 0.0, 0.0,
       w0, 0.0, 0.0,
      -w1, h1, 0.008,
       w1, h1, 0.008,
      -w2, h2, 0.028,
       w2, h2, 0.028,
       0.0, h3, 0.062,
    ]);
    // Soft upward-biased normals for lush meadow shading
    const normals = new Float32Array([
      -0.25, 0.94, 0.22,
       0.25, 0.94, 0.22,
      -0.22, 0.95, 0.2,
       0.22, 0.95, 0.2,
      -0.18, 0.96, 0.18,
       0.18, 0.96, 0.18,
       0.0, 0.98, 0.18,
    ]);
    const indices = [
      0, 1, 2,
      1, 3, 2,
      2, 3, 4,
      3, 5, 4,
      4, 5, 6,
    ];
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bladeGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    bladeGeo.setIndex(indices);

    const aRand = new Float32Array(bladeCount * 2);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const u = this._sharedUniforms;
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = u.uTime;
      shader.uniforms.uWindStrength = u.uWindStrength;
      shader.uniforms.uWindDir = u.uWindDir;
      shader.uniforms.uBaseColor = u.uGrassBaseColor;
      shader.uniforms.uTipColor = u.uGrassTipColor;
      shader.uniforms.uSnowCover = u.uSnowCover;
      shader.uniforms.uWetness = u.uWetness;
      shader.uniforms.uSunColor = u.uSunColor;
      shader.uniforms.uSunIntensity = u.uSunIntensity;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec2 aRand;
          uniform float uTime;
          uniform float uWindStrength;
          uniform vec2 uWindDir;
          varying float vBladeH;
          varying vec2 vRand;
          varying vec3 vGrassWorld;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float hNorm = clamp(position.y / 0.275, 0.0, 1.0);
          vBladeH = hNorm;
          vRand = aRand;

          vec3 instPos = vec3(0.0);
          #ifdef USE_INSTANCING
            instPos = instanceMatrix[3].xyz;
          #endif
          vGrassWorld = instPos;

          // Traveling wind gust waves across the lawn
          float phase = dot(instPos.xz, uWindDir) * 0.42 - uTime * (1.7 + uWindStrength * 2.6);
          float gust = sin(phase) * 0.65 + sin(phase * 2.1 + aRand.x * 6.2831) * 0.35;
          float micro = sin(uTime * 3.4 + instPos.x * 1.9 + instPos.z * 2.3 + aRand.y * 6.2831) * 0.18;
          float bend = (0.045 + uWindStrength * 0.26) * (gust * 0.55 + 0.45 + micro) * (hNorm * hNorm);

          // Rotate world wind into local instance space
          #ifdef USE_INSTANCING
            vec2 ax = normalize(vec2(instanceMatrix[0].x, instanceMatrix[0].z) + vec2(0.0001, 0.0));
            vec2 az = normalize(vec2(instanceMatrix[2].x, instanceMatrix[2].z) + vec2(0.0, 0.0001));
            transformed.x += dot(uWindDir, ax) * bend;
            transformed.z += dot(uWindDir, az) * bend;
          #else
            transformed.x += uWindDir.x * bend;
            transformed.z += uWindDir.y * bend;
          #endif
          transformed.y -= abs(bend) * 0.28 * hNorm;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uBaseColor;
          uniform vec3 uTipColor;
          uniform float uSnowCover;
          uniform float uWetness;
          uniform vec3 uSunColor;
          uniform float uSunIntensity;
          varying float vBladeH;
          varying vec2 vRand;
          varying vec3 vGrassWorld;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          // Macro meadow variation + per-blade tint
          float macro = 0.5 + 0.5 * sin(vGrassWorld.x * 0.38 + cos(vGrassWorld.z * 0.34));
          vec3 col = mix(uBaseColor, uTipColor, smoothstep(0.05, 0.95, vBladeH));
          col *= (0.86 + 0.28 * vRand.x) * (0.9 + 0.2 * macro);
          // Warm backlit tip glow in sunlight
          col += uSunColor * (0.08 * uSunIntensity * vBladeH * vBladeH);
          // Root ambient occlusion
          col *= mix(0.55, 1.0, smoothstep(0.0, 0.42, vBladeH));
          // Wetness darkens grass slightly
          col *= mix(1.0, 0.78, uWetness);
          // Snow frost & blanket on blades
          float snowTip = smoothstep(0.18, 0.88, uSnowCover + (vBladeH - 0.3) * 0.35 + (vRand.y - 0.5) * 0.2);
          col = mix(col, vec3(0.93, 0.96, 1.0), snowTip * smoothstep(0.05, 0.65, uSnowCover));
          diffuseColor.rgb = col;`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.32, uWetness * (1.0 - uSnowCover * 0.7));`
        );
    };

    const grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, bladeCount);
    grassMesh.castShadow = false;
    grassMesh.receiveShadow = true;
    grassMesh.frustumCulled = false;

    const L = this._layout;
    let placed = 0;
    let attempts = 0;

    while (placed < bladeCount && attempts < bladeCount * 3) {
      attempts++;
      const x = -14.0 + rand() * 28.0;
      const z = -10.35 + rand() * 24.35;

      // Skip pond water
      const pd = Math.hypot((x - L.pond.x) / (L.pond.rx * 0.97), (z - L.pond.z) / (L.pond.rz * 0.97));
      if (pd < 1.02) continue;

      // Skip flowerbed interior soil
      if (Math.abs(x - L.flowerbed.x) < L.flowerbed.hx && Math.abs(z - L.flowerbed.z) < L.flowerbed.hz) {
        continue;
      }

      // Skip doghouse interior footprint
      if (Math.hypot(x - L.doghousePos.x, z - L.doghousePos.z) < 0.95) continue;

      // Skip hero tree solid trunk
      if (Math.hypot(x - L.treePos.x, z - L.treePos.z) < 0.78) continue;

      // Skip directly on top of stepping stones (keep sparse tufts peeking around rims!)
      let onStone = false;
      for (let s = 0; s < L.steppingStones.length; s++) {
        const st = L.steppingStones[s];
        const dx = x - st.x;
        const dz = z - st.z;
        if ((dx * dx) / (st.rx * st.rx * 0.92) + (dz * dz) / (st.rz * st.rz * 0.92) < 1.0) {
          onStone = true;
          break;
        }
      }
      if (onStone) continue;

      const y = this.getGroundHeight(x, z);

      // Slightly taller natural tufts near fence edges, pond bank, tree base, and rocks
      let heightBoost = 1.0;
      if (Math.abs(x) > 12.8 || z > 12.8 || z < -9.5) heightBoost += 0.38;
      if (pd < 1.25) heightBoost += 0.45;
      if (Math.hypot(x - L.treePos.x, z - L.treePos.z) < 2.0) heightBoost += 0.22;

      const sY = (0.62 + rand() * 0.78) * heightBoost;
      const sXZ = 0.8 + rand() * 0.65;

      this._dummy.position.set(x, y - 0.015, z);
      this._dummy.rotation.set(
        (rand() - 0.5) * 0.25,
        rand() * Math.PI * 2,
        (rand() - 0.5) * 0.2
      );
      this._dummy.scale.set(sXZ, sY, sXZ);
      this._dummy.updateMatrix();
      grassMesh.setMatrixAt(placed, this._dummy.matrix);

      aRand[placed * 2] = rand();
      aRand[placed * 2 + 1] = rand();
      placed++;
    }

    grassMesh.count = placed;
    bladeGeo.setAttribute('aRand', new THREE.InstancedBufferAttribute(aRand, 2));
    grassMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(grassMesh);
  }

  // ==========================================================================
  // 4. Traditional Japanese House & Engawa (North Side)
  // ==========================================================================
  _buildHouseAndEngawa() {
    const house = new THREE.Group();
    const wallZ = -12.4;

    // Materials
    const plasterMat = new THREE.MeshStandardMaterial({
      map: this._tex.shikkui,
      roughness: 0.92,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      map: this._tex.woodDark.map,
      bumpMap: this._tex.woodDark.bumpMap,
      bumpScale: 0.02,
      roughness: 0.82,
    });
    const engawaWoodMat = new THREE.MeshStandardMaterial({
      map: this._tex.woodEngawa.map,
      bumpMap: this._tex.woodEngawa.bumpMap,
      bumpScale: 0.015,
      roughness: 0.66,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: this._tex.kawara.map,
      bumpMap: this._tex.kawara.bumpMap,
      bumpScale: 0.045,
      roughness: 0.68,
      metalness: 0.08,
    });
    const foundationMat = new THREE.MeshStandardMaterial({
      map: this._tex.stoneDark.map,
      bumpMap: this._tex.stoneDark.bumpMap,
      bumpScale: 0.03,
      roughness: 0.9,
    });
    this._wettableMaterials.push(
      { mat: darkWoodMat, baseRough: 0.82 },
      { mat: engawaWoodMat, baseRough: 0.66 },
      { mat: roofMat, baseRough: 0.68 },
      { mat: foundationMat, baseRough: 0.9 }
    );

    // Solid house main body (width 22m, depth 6m, height 4.1m)
    const body = new THREE.Mesh(new THREE.BoxGeometry(22.0, 4.1, 6.0), plasterMat);
    body.position.set(0, 2.05, wallZ - 3.0);
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    // Stone foundation plinth
    const found = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.45, 6.2), foundationMat);
    found.position.set(0, 0.2, wallZ - 3.0);
    found.receiveShadow = true;
    house.add(found);

    // Dark cedar lower wainscot (koshita) across front wall flanks
    const wainscotL = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.35, 0.14), darkWoodMat);
    wainscotL.position.set(-8.8, 1.05, wallZ + 0.04);
    wainscotL.receiveShadow = true;
    house.add(wainscotL);

    const wainscotR = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.35, 0.14), darkWoodMat);
    wainscotR.position.set(8.8, 1.05, wallZ + 0.04);
    wainscotR.receiveShadow = true;
    house.add(wainscotR);

    // Timber structural posts (hashira) & horizontal beams (nageshi)
    const postXs = [-10.9, -6.6, -2.2, 2.2, 6.6, 10.9];
    for (const px of postXs) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.1, 0.18), darkWoodMat);
      post.position.set(px, 2.05, wallZ + 0.06);
      post.castShadow = true;
      post.receiveShadow = true;
      house.add(post);
    }
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.22, 0.24), darkWoodMat);
    topBeam.position.set(0, 3.85, wallZ + 0.08);
    topBeam.castShadow = true;
    house.add(topBeam);

    const midBeam = new THREE.Mesh(new THREE.BoxGeometry(22.1, 0.15, 0.2), darkWoodMat);
    midBeam.position.set(0, 2.75, wallZ + 0.08);
    house.add(midBeam);

    // Sliding Shoji Doors (6 large panels along the engawa — glow warmly at night!)
    this._shojiMat = new THREE.MeshStandardMaterial({
      map: this._tex.shoji,
      roughness: 0.72,
      emissive: new THREE.Color('#ffaa55'),
      emissiveMap: this._tex.shoji,
      emissiveIntensity: 0.0,
    });
    const shojiPanelPositions = [-5.45, -3.35, -1.05, 1.05, 3.35, 5.45];
    for (let i = 0; i < shojiPanelPositions.length; i++) {
      const sx = shojiPanelPositions[i];
      const stagger = (i % 2) * 0.05;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.12, 2.28, 0.05), this._shojiMat);
      panel.position.set(sx, 1.56, wallZ + 0.07 + stagger);
      panel.receiveShadow = true;
      house.add(panel);
    }

    // Side small shoji windows on left/right flanks
    for (const wx of [-8.8, 8.8]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.06), this._shojiMat);
      win.position.set(wx, 2.1, wallZ + 0.07);
      house.add(win);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.18), darkWoodMat);
      sill.position.set(wx, 1.54, wallZ + 0.1);
      house.add(sill);
    }

    // Engawa (wooden veranda deck protruding to z = -10.5)
    const engawaDeck = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.12, 1.95), engawaWoodMat);
    engawaDeck.position.set(0, 0.36, wallZ + 0.98);
    engawaDeck.castShadow = true;
    engawaDeck.receiveShadow = true;
    house.add(engawaDeck);

    // Lived-in Japanese home touches on the engawa: indigo zabuton cushion & tea tray
    const zabutonMat = new THREE.MeshStandardMaterial({ color: 0x3b4f6b, roughness: 0.92 });
    const zabuton = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.62), zabutonMat);
    zabuton.position.set(1.65, 0.46, wallZ + 1.15);
    zabuton.rotation.y = 0.14;
    zabuton.castShadow = true;
    zabuton.receiveShadow = true;
    house.add(zabuton);

    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.28), darkWoodMat);
    tray.position.set(2.35, 0.435, wallZ + 1.28);
    tray.rotation.y = -0.18;
    tray.castShadow = true;
    house.add(tray);

    const teaPotMat = new THREE.MeshStandardMaterial({ color: 0x383430, roughness: 0.45 });
    const teaPot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), teaPotMat);
    teaPot.scale.set(1.1, 0.85, 1.1);
    teaPot.position.set(2.28, 0.5, wallZ + 1.26);
    house.add(teaPot);

    const teaCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.025, 0.065, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9d2c1, roughness: 0.35 })
    );
    teaCup.position.set(2.44, 0.48, wallZ + 1.31);
    house.add(teaCup);

    // Engawa front fascia beam
    const engawaBeam = new THREE.Mesh(new THREE.BoxGeometry(16.7, 0.14, 0.12), darkWoodMat);
    engawaBeam.position.set(0, 0.28, wallZ + 1.92);
    engawaBeam.castShadow = true;
    house.add(engawaBeam);

    // Engawa support legs (tsuka) & plinth stones
    for (let x = -7.8; x <= 7.81; x += 2.6) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), darkWoodMat);
      leg.position.set(x, 0.15, wallZ + 1.78);
      leg.castShadow = true;
      house.add(leg);

      const footStone = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.09, 8), foundationMat);
      footStone.position.set(x, 0.02, wallZ + 1.78);
      house.add(footStone);
    }

    // Dark recessed space underneath engawa
    const underShadow = new THREE.Mesh(
      new THREE.BoxGeometry(16.2, 0.32, 1.65),
      new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 1.0 })
    );
    underShadow.position.set(0, 0.15, wallZ + 0.85);
    house.add(underShadow);

    // Overhanging Kawara Tiled Roof (front slope + back slope + gable + eaves rafters)
    const frontRoofSlope = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.18, 5.8), roofMat);
    frontRoofSlope.position.set(0, 4.48, wallZ - 0.15);
    frontRoofSlope.rotation.x = 0.34;
    frontRoofSlope.castShadow = true;
    frontRoofSlope.receiveShadow = true;
    house.add(frontRoofSlope);

    const backRoofSlope = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.18, 5.2), roofMat);
    backRoofSlope.position.set(0, 4.58, wallZ - 5.1);
    backRoofSlope.rotation.x = -0.34;
    backRoofSlope.castShadow = true;
    house.add(backRoofSlope);

    // Roof snow cap layer (appears smoothly with snowCover)
    const roofSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf0f4fa,
      roughness: 0.82,
      transparent: true,
      opacity: 0.0,
    });
    const frontRoofSnow = new THREE.Mesh(new THREE.BoxGeometry(23.8, 0.09, 5.65), roofSnowMat);
    frontRoofSnow.position.set(0, 4.59, wallZ - 0.1);
    frontRoofSnow.rotation.x = 0.34;
    frontRoofSnow.receiveShadow = true;
    house.add(frontRoofSnow);
    this._snowCapMeshes.push(frontRoofSnow);

    // Roof ridge beam (mune) & end tiles (onigawara)
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(24.2, 0.34, 0.44), roofMat);
    ridge.position.set(0, 5.45, wallZ - 2.75);
    ridge.castShadow = true;
    house.add(ridge);

    for (const side of [-1, 1]) {
      const oni = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 0.56), roofMat);
      oni.position.set(side * 12.05, 5.56, wallZ - 2.75);
      house.add(oni);
    }

    // Exposed wooden eaves rafters (taruki) beneath front overhang
    const rafterGeo = new THREE.BoxGeometry(0.08, 0.1, 2.7);
    const rafterCount = 31;
    const rafters = new THREE.InstancedMesh(rafterGeo, darkWoodMat, rafterCount);
    for (let i = 0; i < rafterCount; i++) {
      const rx = -11.4 + (i / (rafterCount - 1)) * 22.8;
      this._dummy.position.set(rx, 3.85, wallZ + 1.25);
      this._dummy.rotation.set(0.34, 0, 0);
      this._dummy.scale.set(1, 1, 1);
      this._dummy.updateMatrix();
      rafters.setMatrixAt(i, this._dummy.matrix);
    }
    rafters.instanceMatrix.needsUpdate = true;
    house.add(rafters);

    // Copper rain gutter & downspout
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0x4c3c31,
      roughness: 0.45,
      metalness: 0.65,
    });
    const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 24.0, 8), copperMat);
    gutter.rotation.z = Math.PI / 2;
    gutter.position.set(0, 3.48, wallZ + 2.58);
    house.add(gutter);

    const downspout = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.55, 8), copperMat);
    downspout.position.set(10.8, 1.72, wallZ + 2.48);
    house.add(downspout);

    // Hanging Porch Lantern (Andon) under the engawa eaves
    const porchLantern = new THREE.Group();
    porchLantern.position.set(0.0, 3.05, wallZ + 1.55);
    const lChain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), darkWoodMat);
    lChain.position.y = 0.25;
    porchLantern.add(lChain);
    const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.14, 4), darkWoodMat);
    lCap.rotation.y = Math.PI / 4;
    lCap.position.y = 0.12;
    porchLantern.add(lCap);

    this._porchLanternGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfff3dc,
      emissive: new THREE.Color('#ffaa44'),
      emissiveIntensity: 0.0,
      roughness: 0.6,
    });
    const lBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.24), this._porchLanternGlowMat);
    lBox.position.y = -0.1;
    porchLantern.add(lBox);
    const lBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.28), darkWoodMat);
    lBase.position.y = -0.28;
    porchLantern.add(lBase);
    house.add(porchLantern);

    // Night PointLights (NO shadows per SPEC.md)
    this._porchLight = new THREE.PointLight(0xffa850, 0, 12.5, 1.65);
    this._porchLight.position.set(0.0, 2.75, wallZ + 1.65);
    this._porchLight.castShadow = false;
    this.scene.add(this._porchLight);

    this._shojiSpillLight = new THREE.PointLight(0xff9c44, 0, 9.5, 1.75);
    this._shojiSpillLight.position.set(-2.5, 1.6, wallZ + 1.35);
    this._shojiSpillLight.castShadow = false;
    this.scene.add(this._shojiSpillLight);

    this.scene.add(house);
  }

  // ==========================================================================
  // 5. Wooden Cedar Fence (Itabei) Enclosing the Yard
  // ==========================================================================
  _buildFence() {
    const L = this._layout;
    const fenceMat = new THREE.MeshStandardMaterial({
      map: this._tex.woodCedar.map,
      bumpMap: this._tex.woodCedar.bumpMap,
      bumpScale: 0.02,
      roughness: 0.85,
    });
    const postMat = new THREE.MeshStandardMaterial({
      map: this._tex.woodDark.map,
      bumpMap: this._tex.woodDark.bumpMap,
      bumpScale: 0.02,
      roughness: 0.88,
    });
    this._wettableMaterials.push(
      { mat: fenceMat, baseRough: 0.85 },
      { mat: postMat, baseRough: 0.88 }
    );

    const fenceH = 1.68;
    const segments = [
      // South fence
      { x1: L.fenceMinX, z1: L.fenceMaxZ, x2: L.fenceMaxX, z2: L.fenceMaxZ },
      // West fence
      { x1: L.fenceMinX, z1: -12.4, x2: L.fenceMinX, z2: L.fenceMaxZ },
      // East fence
      { x1: L.fenceMaxX, z1: -12.4, x2: L.fenceMaxX, z2: L.fenceMaxZ },
      // Short wing walls connecting house sides to fence corners
      { x1: L.fenceMinX, z1: -12.4, x2: -10.9, z2: -12.4 },
      { x1: 10.9, z1: -12.4, x2: L.fenceMaxX, z2: -12.4 },
    ];

    const postMatrices = [];
    const slatMatrices = [];
    const railMatrices = [];
    const capSnowMatrices = [];
    const rand = mulberry32(3030);

    for (const seg of segments) {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz); // local Z along fence

      // Posts every ~2.35m
      const postSteps = Math.max(1, Math.round(len / 2.35));
      for (let i = 0; i <= postSteps; i++) {
        const t = i / postSteps;
        const px = lerp(seg.x1, seg.x2, t);
        const pz = lerp(seg.z1, seg.z2, t);
        const gy = this.getGroundHeight(px, pz);
        this._dummy.position.set(px, gy + fenceH * 0.5, pz);
        this._dummy.rotation.set(0, ang, 0);
        this._dummy.scale.set(1, 1, 1);
        this._dummy.updateMatrix();
        postMatrices.push(this._dummy.matrix.clone());
      }

      // Vertical cedar slats
      const slatSpacing = 0.215;
      const slatCount = Math.floor(len / slatSpacing);
      for (let i = 0; i < slatCount; i++) {
        const t = (i + 0.5) / slatCount;
        const sx = lerp(seg.x1, seg.x2, t);
        const sz = lerp(seg.z1, seg.z2, t);
        const gy = this.getGroundHeight(sx, sz);
        this._dummy.position.set(sx, gy + fenceH * 0.48, sz);
        this._dummy.rotation.set(0, ang, (rand() - 0.5) * 0.012);
        this._dummy.scale.set(1, 0.96 + rand() * 0.04, 1);
        this._dummy.updateMatrix();
        slatMatrices.push(this._dummy.matrix.clone());
      }

      // Top cap rail + two horizontal crossbars
      const midX = (seg.x1 + seg.x2) * 0.5;
      const midZ = (seg.z1 + seg.z2) * 0.5;
      const midY = this.getGroundHeight(midX, midZ);
      for (const railY of [0.35, 1.32, fenceH + 0.03]) {
        const isCap = railY > fenceH;
        this._dummy.position.set(midX, midY + railY, midZ);
        this._dummy.rotation.set(0, ang, 0);
        this._dummy.scale.set(isCap ? 1.55 : 0.9, isCap ? 1.15 : 0.9, len + 0.12);
        this._dummy.updateMatrix();
        railMatrices.push(this._dummy.matrix.clone());
        if (isCap) {
          this._dummy.position.set(midX, midY + railY + 0.06, midZ);
          this._dummy.scale.set(1.45, 0.55, len);
          this._dummy.updateMatrix();
          capSnowMatrices.push(this._dummy.matrix.clone());
        }
      }
    }

    const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, fenceH + 0.14, 0.13), postMat, postMatrices.length);
    postMatrices.forEach((m, i) => postMesh.setMatrixAt(i, m));
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    postMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(postMesh);

    const slatMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, fenceH - 0.08, 0.195), fenceMat, slatMatrices.length);
    slatMatrices.forEach((m, i) => slatMesh.setMatrixAt(i, m));
    slatMesh.castShadow = true;
    slatMesh.receiveShadow = true;
    slatMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(slatMesh);

    const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.08, 1.0), postMat, railMatrices.length);
    railMatrices.forEach((m, i) => railMesh.setMatrixAt(i, m));
    railMesh.castShadow = true;
    railMesh.receiveShadow = true;
    railMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(railMesh);

    // Snow cap strips atop fence rails
    const fenceSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf2f6fc,
      roughness: 0.82,
      transparent: true,
      opacity: 0.0,
    });
    const fenceSnowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.08, 1.0), fenceSnowMat, capSnowMatrices.length);
    capSnowMatrices.forEach((m, i) => fenceSnowMesh.setMatrixAt(i, m));
    fenceSnowMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(fenceSnowMesh);
    this._snowCapMeshes.push(fenceSnowMesh);
  }

  // ==========================================================================
  // 6. Doghouse, Water Bowl & Food Bowl
  // ==========================================================================
  _buildDoghouseAndBowls() {
    const dh = this._layout.doghousePos;
    const gy = this.getGroundHeight(dh.x, dh.z);
    const group = new THREE.Group();
    group.position.set(dh.x, gy, dh.z);
    group.rotation.y = dh.rotY;

    const wallMat = new THREE.MeshStandardMaterial({
      map: this._tex.woodCedar.map,
      bumpMap: this._tex.woodCedar.bumpMap,
      bumpScale: 0.015,
      color: 0xe6d2bc,
      roughness: 0.82,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      map: this._tex.woodDark.map,
      roughness: 0.78,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x7c3b2c,
      bumpMap: this._tex.kawara.bumpMap,
      bumpScale: 0.025,
      roughness: 0.75,
    });
    this._wettableMaterials.push(
      { mat: wallMat, baseRough: 0.82 },
      { mat: roofMat, baseRough: 0.75 }
    );

    const w = 1.44;
    const d = 1.62;
    const h = 0.96;

    // Raised floor platform
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.1, d + 0.24), trimMat);
    floor.position.set(0, 0.06, 0.06);
    floor.castShadow = true;
    floor.receiveShadow = true;
    group.add(floor);

    // Side & Back walls
    const leftW = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, d), wallMat);
    leftW.position.set(-w * 0.5 + 0.04, 0.1 + h * 0.5, 0);
    leftW.castShadow = true;
    leftW.receiveShadow = true;
    group.add(leftW);

    const rightW = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, d), wallMat);
    rightW.position.set(w * 0.5 - 0.04, 0.1 + h * 0.5, 0);
    rightW.castShadow = true;
    rightW.receiveShadow = true;
    group.add(rightW);

    const backW = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), wallMat);
    backW.position.set(0, 0.1 + h * 0.5, -d * 0.5 + 0.04);
    backW.castShadow = true;
    backW.receiveShadow = true;
    group.add(backW);

    // Front wall with arched doorway cutout (ShapeGeometry extruded!)
    const frontShape = new THREE.Shape();
    frontShape.moveTo(-w * 0.5, 0);
    frontShape.lineTo(w * 0.5, 0);
    frontShape.lineTo(w * 0.5, h);
    frontShape.lineTo(0, h + 0.48);
    frontShape.lineTo(-w * 0.5, h);
    frontShape.closePath();

    const doorW = 0.36;
    const doorH = 0.62;
    const doorHole = new THREE.Path();
    doorHole.moveTo(-doorW, 0);
    doorHole.lineTo(-doorW, doorH);
    doorHole.absarc(0, doorH, doorW, Math.PI, 0, true);
    doorHole.lineTo(doorW, 0);
    doorHole.closePath();
    frontShape.holes.push(doorHole);

    const frontWallGeo = new THREE.ExtrudeGeometry(frontShape, { depth: 0.08, bevelEnabled: false });
    const frontWall = new THREE.Mesh(frontWallGeo, wallMat);
    frontWall.position.set(0, 0.1, d * 0.5 - 0.08);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    group.add(frontWall);

    // Back gable triangle
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-w * 0.5, 0);
    gableShape.lineTo(w * 0.5, 0);
    gableShape.lineTo(0, 0.48);
    gableShape.closePath();
    const backGable = new THREE.Mesh(
      new THREE.ExtrudeGeometry(gableShape, { depth: 0.08, bevelEnabled: false }),
      wallMat
    );
    backGable.position.set(0, 0.1 + h, -d * 0.5);
    backGable.castShadow = true;
    group.add(backGable);

    // Cozy cushioned dog bed inside
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xb8523c, roughness: 0.95 });
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.11, 20), cushionMat);
    cushion.scale.set(1.0, 1.0, 1.15);
    cushion.position.set(0, 0.15, -0.08);
    cushion.receiveShadow = true;
    group.add(cushion);

    // Cute bone nameplate above doorway
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xf4ead4, roughness: 0.7 });
    const boneBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.075, 0.03), boneMat);
    boneBar.position.set(0, 1.24, d * 0.5 + 0.02);
    group.add(boneBar);
    for (const bx of [-0.14, 0.14]) {
      for (const by of [-0.032, 0.032]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), boneMat);
        knob.position.set(bx, 1.24 + by, d * 0.5 + 0.02);
        group.add(knob);
      }
    }

    // Pitched roof slopes with generous overhang
    const slopeLen = 1.05;
    const roofAngle = Math.atan2(0.48, w * 0.5);
    const roofSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf2f6fc,
      roughness: 0.8,
      transparent: true,
      opacity: 0.0,
    });
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.08, d + 0.44), roofMat);
      slope.position.set(side * 0.41, 0.1 + h + 0.24, 0.05);
      slope.rotation.z = -side * roofAngle;
      slope.castShadow = true;
      slope.receiveShadow = true;
      group.add(slope);

      const snowSlab = new THREE.Mesh(new THREE.BoxGeometry(slopeLen - 0.04, 0.055, d + 0.4), roofSnowMat);
      snowSlab.position.set(side * 0.41, 0.1 + h + 0.295, 0.05);
      snowSlab.rotation.z = -side * roofAngle;
      group.add(snowSlab);
      this._snowCapMeshes.push(snowSlab);
    }
    const dhRidge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, d + 0.48), trimMat);
    dhRidge.position.set(0, 0.1 + h + 0.52, 0.05);
    group.add(dhRidge);

    this.scene.add(group);

    // ---- Water Bowl & Food Bowl ----
    const createBowlMesh = (colorHex) => {
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.21, 0.0),
        new THREE.Vector2(0.23, 0.03),
        new THREE.Vector2(0.195, 0.125),
        new THREE.Vector2(0.175, 0.13),
        new THREE.Vector2(0.16, 0.03),
        new THREE.Vector2(0.0, 0.025),
      ];
      const geo = new THREE.LatheGeometry(pts, 28);
      const mat = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        roughness: 0.22,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    // Water Bowl (indigo ceramic + clear shimmering water surface)
    const wb = this._layout.waterBowlPos;
    const wbY = this.getGroundHeight(wb.x, wb.z);
    const waterBowlGroup = new THREE.Group();
    waterBowlGroup.position.set(wb.x, wbY, wb.z);
    waterBowlGroup.add(createBowlMesh(0x3a5f7d));

    const bowlWaterMat = new THREE.MeshPhysicalMaterial({
      color: 0x8cc9e8,
      roughness: 0.06,
      metalness: 0.08,
      transmission: 0.55,
      transparent: true,
      opacity: 0.86,
      clearcoat: 1.0,
    });
    const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.165, 24), bowlWaterMat);
    bowlWater.rotation.x = -Math.PI / 2;
    bowlWater.position.y = 0.098;
    waterBowlGroup.add(bowlWater);
    this.scene.add(waterBowlGroup);

    // Food Bowl (warm cream-terracotta ceramic + dynamic kibble mound scaled by foodLevel)
    const fb = this._layout.foodBowlPos;
    const fbY = this.getGroundHeight(fb.x, fb.z);
    const foodBowlGroup = new THREE.Group();
    foodBowlGroup.position.set(fb.x, fbY, fb.z);
    foodBowlGroup.add(createBowlMesh(0xc86b45));

    const kibbleGeo = new THREE.SphereGeometry(0.155, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const kibbleMat = new THREE.MeshStandardMaterial({
      map: this._tex.kibble,
      roughness: 0.9,
    });
    this._kibbleMesh = new THREE.Mesh(kibbleGeo, kibbleMat);
    this._kibbleMesh.position.y = 0.032;
    this._kibbleMesh.scale.set(1.0, 0.55, 1.0);
    this._kibbleMesh.receiveShadow = true;
    foodBowlGroup.add(this._kibbleMesh);
    this.scene.add(foodBowlGroup);
  }

  // ==========================================================================
  // 7. Hero Seasonal Tree (Sakura -> Hazakura -> Summer -> Autumn -> Bare Winter)
  // ==========================================================================
  _buildHeroTree() {
    const rand = mulberry32(4040);
    const tp = this._layout.treePos;
    const gy = this.getGroundHeight(tp.x, tp.z);
    const treeGroup = new THREE.Group();
    treeGroup.position.set(tp.x, gy - 0.08, tp.z);

    const barkMat = new THREE.MeshStandardMaterial({
      map: this._tex.bark.map,
      bumpMap: this._tex.bark.bumpMap,
      bumpScale: 0.04,
      roughness: 0.92,
    });
    this._wettableMaterials.push({ mat: barkMat, baseRough: 0.92 });

    // Helper: create curved tapered organic branch along 3 control points
    const buildBranch = (p0, p1, p2, rStart, rEnd, radialSegs = 8, tubularSegs = 10) => {
      const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const geo = new THREE.TubeGeometry(curve, tubularSegs, 1.0, radialSegs, false);
      const pos = geo.attributes.position;
      const center = new THREE.Vector3();
      const v = new THREE.Vector3();
      for (let i = 0; i <= tubularSegs; i++) {
        const t = i / tubularSegs;
        curve.getPointAt(t, center);
        const rad = lerp(rStart, rEnd, Math.pow(t, 0.85));
        for (let j = 0; j <= radialSegs; j++) {
          const idx = i * (radialSegs + 1) + j;
          v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(rad).add(center);
          pos.setXYZ(idx, v.x, v.y, v.z);
        }
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, barkMat);
      m.castShadow = true;
      m.receiveShadow = true;
      treeGroup.add(m);
      return curve;
    };

    // Sculptural gnarled main trunk
    buildBranch(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.18, 1.45, 0.14),
      new THREE.Vector3(-0.08, 2.85, 0.06),
      0.56,
      0.34,
      12,
      12
    );

    // Flared surface root buttresses
    for (let r = 0; r < 6; r++) {
      const a = (r / 6) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      buildBranch(
        new THREE.Vector3(Math.cos(a) * 0.25, 0.55, Math.sin(a) * 0.25),
        new THREE.Vector3(Math.cos(a) * 0.68, 0.18, Math.sin(a) * 0.68),
        new THREE.Vector3(Math.cos(a) * 1.15, -0.08, Math.sin(a) * 1.15),
        0.22,
        0.05,
        7,
        6
      );
    }

    // Collect outer twig anchor points for lush canopy placement
    const canopyPoints = [];
    const primaryCount = 6;
    const branchSnowPoints = [];

    for (let i = 0; i < primaryCount; i++) {
      const ang = (i / primaryCount) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      const spread = 2.6 + rand() * 1.3;
      const tipH = 5.0 + rand() * 1.65;
      const start = new THREE.Vector3(-0.06, 2.4 + rand() * 0.55, 0.04);
      const mid = new THREE.Vector3(
        Math.cos(ang) * spread * 0.52,
        lerp(start.y, tipH, 0.58) + 0.35,
        Math.sin(ang) * spread * 0.52
      );
      const end = new THREE.Vector3(Math.cos(ang) * spread, tipH, Math.sin(ang) * spread);
      const pCurve = buildBranch(start, mid, end, 0.22, 0.085, 8, 9);
      branchSnowPoints.push(mid.clone().add(new THREE.Vector3(0, 0.12, 0)));

      // 3 secondary boughs per primary branch
      for (let j = 0; j < 3; j++) {
        const t = 0.45 + j * 0.25;
        const sStart = pCurve.getPointAt(t);
        const sAng = ang + (j - 1) * 0.68 + (rand() - 0.5) * 0.3;
        const sLen = 1.45 + rand() * 1.15;
        const sEnd = new THREE.Vector3(
          sStart.x + Math.cos(sAng) * sLen,
          sStart.y + 0.75 + rand() * 1.25,
          sStart.z + Math.sin(sAng) * sLen
        );
        const sMid = sStart.clone().lerp(sEnd, 0.5);
        sMid.y += 0.3;
        const sCurve = buildBranch(sStart, sMid, sEnd, 0.095, 0.032, 6, 6);

        canopyPoints.push(sEnd.clone());
        canopyPoints.push(sCurve.getPointAt(0.68));
        branchSnowPoints.push(sMid.clone().add(new THREE.Vector3(0, 0.07, 0)));

        // Fine twigs
        for (let k = 0; k < 2; k++) {
          const tAng = sAng + (k === 0 ? -0.55 : 0.55) + (rand() - 0.5) * 0.3;
          const tStart = sCurve.getPointAt(0.55 + k * 0.35);
          const tEnd = new THREE.Vector3(
            tStart.x + Math.cos(tAng) * (0.75 + rand() * 0.55),
            tStart.y + 0.35 + rand() * 0.65,
            tStart.z + Math.sin(tAng) * (0.75 + rand() * 0.55)
          );
          buildBranch(tStart, tStart.clone().lerp(tEnd, 0.5), tEnd, 0.035, 0.012, 5, 4);
          canopyPoints.push(tEnd.clone());
        }
      }
    }

    // Crown apex branch
    const crownEnd = new THREE.Vector3(0.15, 7.2, -0.1);
    buildBranch(
      new THREE.Vector3(-0.08, 2.75, 0.06),
      new THREE.Vector3(0.12, 5.1, -0.05),
      crownEnd,
      0.19,
      0.04,
      7,
      8
    );
    canopyPoints.push(crownEnd.clone(), new THREE.Vector3(0.05, 6.2, 0.1));

    // Snow cushions resting on upper boughs in winter
    const bSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5fc,
      roughness: 0.85,
      transparent: true,
      opacity: 0.0,
    });
    const bSnowMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 8, 6), bSnowMat, branchSnowPoints.length);
    branchSnowPoints.forEach((pt, idx) => {
      this._dummy.position.copy(pt);
      this._dummy.rotation.set(0, rand() * Math.PI, 0);
      this._dummy.scale.set(1.3, 0.35, 1.0);
      this._dummy.updateMatrix();
      bSnowMesh.setMatrixAt(idx, this._dummy.matrix);
    });
    bSnowMesh.instanceMatrix.needsUpdate = true;
    treeGroup.add(bSnowMesh);
    this._snowCapMeshes.push(bSnowMesh);

    // Crossed botanical cluster card geometry (2 intersecting slightly curved planes -> rich volume from every angle!)
    const makeCrossedCardGeo = () => {
      const p1 = new THREE.PlaneGeometry(1.15, 1.15, 2, 2);
      const p2 = new THREE.PlaneGeometry(1.15, 1.15, 2, 2);
      p2.rotateY(Math.PI * 0.5);
      p2.rotateX(0.28);

      // Gentle cup curvature on each plane
      for (const p of [p1, p2]) {
        const pa = p.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i);
          const y = pa.getY(i);
          pa.setZ(i, pa.getZ(i) - (x * x + y * y) * 0.18);
        }
        p.computeVertexNormals();
      }

      const geo = new THREE.BufferGeometry();
      const pos1 = p1.attributes.position.array;
      const pos2 = p2.attributes.position.array;
      const norm1 = p1.attributes.normal.array;
      const norm2 = p2.attributes.normal.array;
      const uv1 = p1.attributes.uv.array;
      const uv2 = p2.attributes.uv.array;
      const idx1 = p1.index.array;
      const idx2 = p2.index.array;

      const mergedPos = new Float32Array(pos1.length + pos2.length);
      mergedPos.set(pos1, 0);
      mergedPos.set(pos2, pos1.length);

      const mergedNorm = new Float32Array(norm1.length + norm2.length);
      mergedNorm.set(norm1, 0);
      mergedNorm.set(norm2, norm1.length);

      const mergedUv = new Float32Array(uv1.length + uv2.length);
      mergedUv.set(uv1, 0);
      mergedUv.set(uv2, uv1.length);

      const vOffset = pos1.length / 3;
      const mergedIdx = new Uint16Array(idx1.length + idx2.length);
      mergedIdx.set(idx1, 0);
      for (let i = 0; i < idx2.length; i++) mergedIdx[idx1.length + i] = idx2[i] + vOffset;

      geo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));
      geo.setIndex(new THREE.BufferAttribute(mergedIdx, 1));
      return geo;
    };

    const cardGeo = makeCrossedCardGeo();
    const u = this._sharedUniforms;

    const attachCanopySway = (mat, scaleUniform, tintUniformA, tintUniformB) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = u.uTime;
        shader.uniforms.uWindStrength = u.uWindStrength;
        shader.uniforms.uCanopyScale = scaleUniform;
        if (tintUniformA) {
          shader.uniforms.uTintA = tintUniformA;
          shader.uniforms.uTintB = tintUniformB;
        }

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            attribute float aLeafRand;
            uniform float uTime;
            uniform float uWindStrength;
            uniform float uCanopyScale;
            varying float vLeafRand;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vLeafRand = aLeafRand;
            transformed *= uCanopyScale;
            vec3 instP = vec3(0.0);
            #ifdef USE_INSTANCING
              instP = instanceMatrix[3].xyz;
            #endif
            float flutter = sin(uTime * (1.8 + uWindStrength * 2.4) + instP.x * 1.4 + instP.z * 1.2 + aLeafRand * 6.2831);
            float amp = (0.04 + uWindStrength * 0.16) * uCanopyScale;
            transformed.x += flutter * amp;
            transformed.y += cos(uTime * 1.5 + instP.y + aLeafRand * 6.2831) * amp * 0.55;`
          );

        if (tintUniformA) {
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              `#include <common>
              uniform vec3 uTintA;
              uniform vec3 uTintB;
              varying float vLeafRand;`
            )
            .replace(
              '#include <color_fragment>',
              `#include <color_fragment>
              vec3 seasonCol = mix(uTintA, uTintB, vLeafRand);
              diffuseColor.rgb *= seasonCol * 1.18;`
            );
        }
      };
    };

    this._sakuraScaleU = { value: 0.0 };
    this._leafScaleU = { value: 1.0 };
    this._treeLeafColorAU = { value: SEASON_COLORS.treeLeafA.summer.clone() };
    this._treeLeafColorBU = { value: SEASON_COLORS.treeLeafB.summer.clone() };

    // Blossom canopy (Spring Sakura)
    const sakuraMat = new THREE.MeshStandardMaterial({
      map: this._tex.sakuraCluster,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.72,
    });
    attachCanopySway(sakuraMat, this._sakuraScaleU, null, null);

    const sakuraDepthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: this._tex.sakuraCluster,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
    });
    attachCanopySway(sakuraDepthMat, this._sakuraScaleU, null, null);

    // Leaf canopy (Hazakura / Summer / Autumn)
    const leafMat = new THREE.MeshStandardMaterial({
      map: this._tex.leafCluster,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.74,
    });
    attachCanopySway(leafMat, this._leafScaleU, this._treeLeafColorAU, this._treeLeafColorBU);

    const leafDepthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: this._tex.leafCluster,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
    });
    attachCanopySway(leafDepthMat, this._leafScaleU, null, null);

    const clusterCount = 460;
    const blossomGeo = cardGeo.clone();
    const leafGeo = cardGeo.clone();
    const leafRands = new Float32Array(clusterCount);

    this._sakuraCanopy = new THREE.InstancedMesh(blossomGeo, sakuraMat, clusterCount);
    this._leafCanopy = new THREE.InstancedMesh(leafGeo, leafMat, clusterCount);
    this._sakuraCanopy.customDepthMaterial = sakuraDepthMat;
    this._leafCanopy.customDepthMaterial = leafDepthMat;
    this._sakuraCanopy.castShadow = true;
    this._sakuraCanopy.receiveShadow = true;
    this._leafCanopy.castShadow = true;
    this._leafCanopy.receiveShadow = true;

    for (let i = 0; i < clusterCount; i++) {
      const anchor = canopyPoints[i % canopyPoints.length];
      const theta = rand() * Math.PI * 2;
      const rad = Math.pow(rand(), 0.6) * 1.35;
      const dy = (rand() - 0.42) * 1.15;
      const s = 0.72 + rand() * 0.72;

      this._dummy.position.set(
        anchor.x + Math.cos(theta) * rad,
        anchor.y + dy,
        anchor.z + Math.sin(theta) * rad
      );
      this._dummy.rotation.set(
        (rand() - 0.5) * 0.9,
        rand() * Math.PI * 2,
        (rand() - 0.5) * 0.9
      );
      this._dummy.scale.setScalar(s);
      this._dummy.updateMatrix();

      this._sakuraCanopy.setMatrixAt(i, this._dummy.matrix);
      this._leafCanopy.setMatrixAt(i, this._dummy.matrix);
      leafRands[i] = rand();
    }
    blossomGeo.setAttribute('aLeafRand', new THREE.InstancedBufferAttribute(leafRands, 1));
    leafGeo.setAttribute('aLeafRand', new THREE.InstancedBufferAttribute(leafRands, 1));
    this._sakuraCanopy.instanceMatrix.needsUpdate = true;
    this._leafCanopy.instanceMatrix.needsUpdate = true;

    treeGroup.add(this._sakuraCanopy);
    treeGroup.add(this._leafCanopy);
    this.scene.add(treeGroup);
  }

  // ==========================================================================
  // 8. Natural Pond, Animated Water Shader, Boulders, Lily Pads, Reeds & Koi
  // ==========================================================================
  _buildPond() {
    const pond = this._layout.pond;
    const rand = mulberry32(5050);

    // Animated Pond Water Surface
    const waterGeo = new THREE.CircleGeometry(1.0, 48);
    waterGeo.rotateX(-Math.PI / 2);
    waterGeo.scale(pond.rx * 0.95, 1, pond.rz * 0.95);

    const u = this._sharedUniforms;
    this._waterMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: u.uTime,
        uWindStrength: u.uWindStrength,
        uSunDir: u.uSunDir,
        uSunColor: u.uSunColor,
        uSkyColor: u.uSkyColor,
        uSunIntensity: u.uSunIntensity,
        uRainIntensity: u.uRainIntensity,
        uSnowCover: u.uSnowCover,
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWindStrength;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 p = position;
          float wave = sin(p.x * 3.8 + uTime * 2.1) * cos(p.z * 4.2 - uTime * 1.7) * (0.005 + uWindStrength * 0.01);
          p.y += wave;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uWindStrength;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyColor;
        uniform float uSunIntensity;
        uniform float uRainIntensity;
        uniform float uSnowCover;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float rainRipple(vec2 p, vec2 center, float tOffset) {
          float t = fract(uTime * 1.35 + tOffset);
          float d = length(p - center);
          float ring = sin((d - t * 0.95) * 34.0) * exp(-d * 4.5) * (1.0 - t);
          return ring;
        }

        void main() {
          vec2 p = vWorldPos.xz;
          float edgeDist = length((vUv - vec2(0.5)) * 2.0);

          // Layered organic water ripples
          float r1 = sin(p.x * 5.2 + uTime * 1.8) * cos(p.y * 4.8 - uTime * 1.4);
          float r2 = sin((p.x - p.y) * 7.5 - uTime * 2.4) * 0.5;
          float rr = 0.0;
          if (uRainIntensity > 0.02) {
            rr += rainRipple(p, vec2(5.4, 5.8), 0.13);
            rr += rainRipple(p, vec2(6.9, 6.7), 0.47);
            rr += rainRipple(p, vec2(6.1, 5.1), 0.81);
            rr += rainRipple(p, vec2(7.3, 5.5), 0.29);
            rr *= uRainIntensity * 1.4;
          }

          float amp = 0.045 + uWindStrength * 0.055;
          vec3 N = normalize(vec3((r1 + r2) * amp + rr * 0.16, 1.0, (r1 - r2) * amp + rr * 0.16));
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(uSunDir);

          float fresnel = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 3.2);
          fresnel = clamp(0.14 + fresnel * 0.82, 0.0, 0.95);

          // Shallow emerald rim -> deeper jade pond center
          vec3 shallowCol = vec3(0.16, 0.34, 0.31);
          vec3 deepCol = vec3(0.06, 0.17, 0.21);
          vec3 waterBody = mix(deepCol, shallowCol, smoothstep(0.35, 0.95, edgeDist));
          waterBody *= mix(0.28, 1.05, clamp(uSunIntensity * 0.7 + 0.3, 0.0, 1.0));

          // Sky reflection
          vec3 reflCol = uSkyColor * (0.85 + 0.25 * uSunIntensity);
          vec3 col = mix(waterBody, reflCol, fresnel);

          // Sun / moon specular sparkle
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0001), 110.0) * (0.4 + uSunIntensity * 1.4);
          col += uSunColor * spec;

          // Subtle frosty rim in snowy winter
          float frost = smoothstep(0.74, 0.98, edgeDist) * smoothstep(0.35, 0.95, uSnowCover);
          col = mix(col, vec3(0.86, 0.92, 0.97), frost * 0.65);

          float alpha = mix(0.76, 0.92, fresnel) * smoothstep(1.0, 0.86, edgeDist);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    const waterMesh = new THREE.Mesh(waterGeo, this._waterMat);
    waterMesh.position.set(pond.x, pond.waterY, pond.z);
    waterMesh.renderOrder = 2;
    this.scene.add(waterMesh);

    // Mossy perimeter river boulders around pond bank
    const rockMat = new THREE.MeshStandardMaterial({
      map: this._tex.stone.map,
      bumpMap: this._tex.stone.bumpMap,
      bumpScale: 0.035,
      roughness: 0.88,
    });
    this._wettableMaterials.push({ mat: rockMat, baseRough: 0.88 });

    const rockGeo = new THREE.DodecahedronGeometry(0.45, 1);
    const rPos = rockGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const n = 0.85 + 0.26 * Math.sin(vx * 5.2 + vy * 3.7) * Math.cos(vz * 4.4);
      rPos.setXYZ(i, vx * n, vy * n * 0.72, vz * n);
    }
    rockGeo.computeVertexNormals();

    const boulderCount = 26;
    for (let i = 0; i < boulderCount; i++) {
      const ang = (i / boulderCount) * Math.PI * 2 + (rand() - 0.5) * 0.14;
      // Leave a gentle grassy viewing opening toward poi.pond (West bank, ang ≈ π)
      if (Math.abs(ang - Math.PI) < 0.36) continue;
      const distFactor = 0.96 + rand() * 0.16;
      const bx = pond.x + Math.cos(ang) * pond.rx * distFactor;
      const bz = pond.z + Math.sin(ang) * pond.rz * distFactor;
      const by = this.getGroundHeight(bx, bz);
      const boulder = new THREE.Mesh(rockGeo, rockMat);
      const s = 0.55 + rand() * 1.15;
      boulder.scale.set(s * (0.85 + rand() * 0.45), s * (0.55 + rand() * 0.45), s * (0.85 + rand() * 0.45));
      boulder.position.set(bx, by + s * 0.12, bz);
      boulder.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.scene.add(boulder);
    }

    // Floating Lily Pads & Summer Waterlilies
    this._lilyGroup = new THREE.Group();
    const padMat = new THREE.MeshStandardMaterial({ color: 0x3b7a38, roughness: 0.65, side: THREE.DoubleSide });
    const lotusMat = new THREE.MeshStandardMaterial({ color: 0xffd8e6, roughness: 0.55 });
    const lotusCenterMat = new THREE.MeshStandardMaterial({ color: 0xf7cf47, roughness: 0.6 });
    this._summerWaterlilies = [];

    const padSpots = [
      { x: 5.5, z: 6.7, r: 0.24 },
      { x: 5.9, z: 7.1, r: 0.19 },
      { x: 7.1, z: 5.6, r: 0.26 },
      { x: 7.5, z: 6.1, r: 0.18 },
      { x: 6.6, z: 7.2, r: 0.21 },
    ];
    for (let i = 0; i < padSpots.length; i++) {
      const ps = padSpots[i];
      const padGeo = new THREE.CircleGeometry(ps.r, 18, 0.25, Math.PI * 1.85);
      padGeo.rotateX(-Math.PI / 2);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(ps.x, pond.waterY + 0.014, ps.z);
      pad.rotation.y = rand() * Math.PI * 2;
      pad.receiveShadow = true;
      this._lilyGroup.add(pad);

      if (i === 0 || i === 2) {
        const flower = new THREE.Group();
        flower.position.set(ps.x, pond.waterY + 0.03, ps.z);
        for (let p = 0; p < 8; p++) {
          const pet = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.1, 5), lotusMat);
          const a = (p / 8) * Math.PI * 2;
          pet.position.set(Math.cos(a) * 0.045, 0.03, Math.sin(a) * 0.045);
          pet.rotation.z = -Math.cos(a) * 0.7;
          pet.rotation.x = Math.sin(a) * 0.7;
          flower.add(pet);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), lotusCenterMat);
        core.position.y = 0.025;
        flower.add(core);
        this._lilyGroup.add(flower);
        this._summerWaterlilies.push(flower);
      }
    }
    this.scene.add(this._lilyGroup);

    // Pond Reeds on East/South-East bank
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x4b7738, roughness: 0.82 });
    this._reedMat = reedMat;
    const reedGeo = new THREE.CylinderGeometry(0.008, 0.02, 0.85, 5);
    reedGeo.translate(0, 0.425, 0);
    const reedCount = 38;
    const reeds = new THREE.InstancedMesh(reedGeo, reedMat, reedCount);
    for (let i = 0; i < reedCount; i++) {
      const a = -0.6 + rand() * 1.85;
      const rx = pond.x + Math.cos(a) * (pond.rx * (0.94 + rand() * 0.18));
      const rz = pond.z + Math.sin(a) * (pond.rz * (0.94 + rand() * 0.18));
      const ry = this.getGroundHeight(rx, rz);
      this._dummy.position.set(rx, ry - 0.05, rz);
      this._dummy.rotation.set((rand() - 0.5) * 0.28, rand() * Math.PI * 2, (rand() - 0.5) * 0.28);
      this._dummy.scale.set(1, 0.65 + rand() * 0.75, 1);
      this._dummy.updateMatrix();
      reeds.setMatrixAt(i, this._dummy.matrix);
    }
    reeds.castShadow = true;
    reeds.instanceMatrix.needsUpdate = true;
    this.scene.add(reeds);

    // 3 Graceful Swimming Koi Fish beneath the water surface
    this._koiList = [];
    const koiColors = [0xf26426, 0xfaf6ee, 0xf4a82e];
    for (let i = 0; i < 3; i++) {
      const koi = new THREE.Group();
      const kMat = new THREE.MeshStandardMaterial({ color: koiColors[i], roughness: 0.35 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), kMat);
      body.scale.set(0.65, 0.75, 2.2);
      koi.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 4), kMat);
      tail.rotation.x = Math.PI / 2;
      tail.scale.set(0.25, 1, 1);
      tail.position.z = -0.14;
      koi.add(tail);
      this.scene.add(koi);
      this._koiList.push({
        group: koi,
        tail,
        phase: i * 2.15,
        speed: 0.24 + i * 0.06,
        rx: 0.8 + i * 0.34,
        rz: 0.6 + i * 0.25,
        depth: pond.waterY - 0.16 - i * 0.04,
      });
    }
  }

  // ==========================================================================
  // 9. Seasonal Flowerbed (Tulips / Sunflowers / Cosmos / Winter Earth)
  // ==========================================================================
  _buildFlowerbed() {
    const rand = mulberry32(6060);
    const fb = this._layout.flowerbed;
    const gy = this.getGroundHeight(fb.x, fb.z);
    const bedGroup = new THREE.Group();
    bedGroup.position.set(fb.x, gy, fb.z);

    // Weathered timber log border
    const logMat = new THREE.MeshStandardMaterial({
      map: this._tex.woodDark.map,
      bumpMap: this._tex.woodDark.bumpMap,
      bumpScale: 0.02,
      roughness: 0.88,
    });
    this._wettableMaterials.push({ mat: logMat, baseRough: 0.88 });

    const borderParts = [
      { x: 0, z: -fb.hz, w: fb.hx * 2 + 0.18, d: 0.16 },
      { x: 0, z: fb.hz, w: fb.hx * 2 + 0.18, d: 0.16 },
      { x: -fb.hx, z: 0, w: 0.16, d: fb.hz * 2 },
      { x: fb.hx, z: 0, w: 0.16, d: fb.hz * 2 },
    ];
    for (const bp of borderParts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bp.w, 0.22, bp.d), logMat);
      m.position.set(bp.x, 0.09, bp.z);
      m.castShadow = true;
      m.receiveShadow = true;
      bedGroup.add(m);
    }

    // Rich dark soil bed inside
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x3b2c1e, roughness: 0.96 });
    this._wettableMaterials.push({ mat: soilMat, baseRough: 0.96 });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(fb.hx * 2 - 0.14, 0.14, fb.hz * 2 - 0.14), soilMat);
    soil.position.set(0, 0.05, 0);
    soil.receiveShadow = true;
    bedGroup.add(soil);

    // Snow cover inside flowerbed
    const fbSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5fb,
      roughness: 0.84,
      transparent: true,
      opacity: 0.0,
    });
    const fbSnow = new THREE.Mesh(new THREE.BoxGeometry(fb.hx * 2 - 0.16, 0.06, fb.hz * 2 - 0.16), fbSnowMat);
    fbSnow.position.set(0, 0.14, 0);
    bedGroup.add(fbSnow);
    this._snowCapMeshes.push(fbSnow);

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f7c2f, roughness: 0.78 });

    // --- SPRING: Tulips ---
    this._springFlowers = new THREE.Group();
    const tulipColors = [0xe83b4a, 0xff8ea6, 0xffd23f, 0xfff5e4, 0xf26444];
    const tulipMats = tulipColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.58 }));
    const tulipCupPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.048, 0.025),
      new THREE.Vector2(0.056, 0.075),
      new THREE.Vector2(0.036, 0.125),
    ];
    const tulipCupGeo = new THREE.LatheGeometry(tulipCupPts, 10);
    const tulipStemGeo = new THREE.CylinderGeometry(0.008, 0.011, 0.34, 5);
    const tulipLeafGeo = new THREE.PlaneGeometry(0.07, 0.24);
    const tulipLeafMat = new THREE.MeshStandardMaterial({
      color: 0x4b8e3a,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 42; i++) {
      const fx = (rand() - 0.5) * (fb.hx * 1.72);
      const fz = (rand() - 0.5) * (fb.hz * 1.62);
      const h = 0.24 + rand() * 0.15;
      const tulip = new THREE.Group();
      tulip.position.set(fx, 0.12, fz);

      const st = new THREE.Mesh(tulipStemGeo, stemMat);
      st.scale.y = h / 0.34;
      st.position.y = h * 0.5;
      tulip.add(st);

      const cup = new THREE.Mesh(tulipCupGeo, tulipMats[i % tulipMats.length]);
      cup.position.y = h;
      cup.castShadow = true;
      tulip.add(cup);

      for (let lf = 0; lf < 2; lf++) {
        const leaf = new THREE.Mesh(tulipLeafGeo, tulipLeafMat);
        leaf.position.set(lf === 0 ? -0.025 : 0.025, h * 0.38, 0);
        leaf.rotation.y = rand() * Math.PI;
        leaf.rotation.z = lf === 0 ? 0.35 : -0.35;
        tulip.add(leaf);
      }
      this._springFlowers.add(tulip);
    }
    bedGroup.add(this._springFlowers);

    // --- SUMMER: Sunflowers ---
    this._summerFlowers = new THREE.Group();
    const sfDiscMat = new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.92 });
    const sfPetalMat = new THREE.MeshStandardMaterial({ color: 0xffc61a, roughness: 0.62, side: THREE.DoubleSide });
    const sfLeafMat = new THREE.MeshStandardMaterial({ color: 0x377227, roughness: 0.8, side: THREE.DoubleSide });
    const sfPetalGeo = new THREE.PlaneGeometry(0.055, 0.14);

    for (let i = 0; i < 16; i++) {
      const fx = -fb.hx * 0.78 + (i / 15) * (fb.hx * 1.56) + (rand() - 0.5) * 0.22;
      const fz = (rand() - 0.5) * (fb.hz * 1.35);
      const h = 0.82 + rand() * 0.55;
      const sf = new THREE.Group();
      sf.position.set(fx, 0.12, fz);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, h, 6), stemMat);
      stem.position.y = h * 0.5;
      stem.castShadow = true;
      sf.add(stem);

      for (let lf = 0; lf < 3; lf++) {
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.11, 7), sfLeafMat);
        leaf.scale.set(1.2, 0.85, 1);
        const a = lf * 2.1 + rand();
        leaf.position.set(Math.cos(a) * 0.09, h * (0.3 + lf * 0.2), Math.sin(a) * 0.09);
        leaf.rotation.x = -Math.PI * 0.35;
        leaf.rotation.z = a;
        sf.add(leaf);
      }

      // Radiant sunflower head facing sunny South
      const head = new THREE.Group();
      head.position.set(0, h, 0.02);
      head.rotation.x = 0.28 + (rand() - 0.5) * 0.2;
      head.rotation.y = (rand() - 0.5) * 0.55;

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.1, 0.04, 14), sfDiscMat);
      disc.rotation.x = Math.PI / 2;
      head.add(disc);

      for (let p = 0; p < 14; p++) {
        const a = (p / 14) * Math.PI * 2;
        const pet = new THREE.Mesh(sfPetalGeo, sfPetalMat);
        pet.position.set(Math.cos(a) * 0.155, Math.sin(a) * 0.155, -0.005);
        pet.rotation.z = a - Math.PI / 2;
        head.add(pet);
      }
      sf.add(head);
      this._summerFlowers.add(sf);
    }
    bedGroup.add(this._summerFlowers);

    // --- AUTUMN: Cosmos ---
    this._autumnFlowers = new THREE.Group();
    const cosmosColors = [0xe45a92, 0xf8a7c7, 0xfff7fa, 0xd43e7c];
    const cosmosMats = cosmosColors.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, side: THREE.DoubleSide })
    );
    const cosCenterMat = new THREE.MeshStandardMaterial({ color: 0xf5be28, roughness: 0.7 });
    const cosPetalGeo = new THREE.PlaneGeometry(0.036, 0.088);

    for (let i = 0; i < 38; i++) {
      const fx = (rand() - 0.5) * (fb.hx * 1.72);
      const fz = (rand() - 0.5) * (fb.hz * 1.62);
      const h = 0.45 + rand() * 0.42;
      const cos = new THREE.Group();
      cos.position.set(fx, 0.12, fz);

      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, h, 5), stemMat);
      st.position.y = h * 0.5;
      cos.add(st);

      const bloom = new THREE.Group();
      bloom.position.set(0, h, 0);
      bloom.rotation.x = -0.35 + (rand() - 0.5) * 0.4;
      bloom.rotation.y = rand() * Math.PI * 2;

      const mat = cosmosMats[i % cosmosMats.length];
      for (let p = 0; p < 8; p++) {
        const a = (p / 8) * Math.PI * 2;
        const pet = new THREE.Mesh(cosPetalGeo, mat);
        pet.position.set(Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055);
        pet.rotation.x = -Math.PI / 2;
        pet.rotation.z = -a + Math.PI / 2;
        bloom.add(pet);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), cosCenterMat);
      bloom.add(center);
      cos.add(bloom);
      this._autumnFlowers.add(cos);
    }
    bedGroup.add(this._autumnFlowers);

    this.scene.add(bedGroup);
  }

  // ==========================================================================
  // 10. Stepping Stones, Stone Lanterns (Toro), Toy Ball & Corner Shrubs
  // ==========================================================================
  _buildSteppingStonesAndProps() {
    const L = this._layout;
    const rand = mulberry32(7070);

    // Stepping Stones (Tobi-ishi)
    const stepMat = new THREE.MeshStandardMaterial({
      map: this._tex.stoneDark.map,
      bumpMap: this._tex.stoneDark.bumpMap,
      bumpScale: 0.025,
      roughness: 0.84,
    });
    this._wettableMaterials.push({ mat: stepMat, baseRough: 0.84 });

    const stoneGeo = new THREE.CylinderGeometry(1.0, 1.06, 0.09, 14);
    for (let i = 0; i < L.steppingStones.length; i++) {
      const st = L.steppingStones[i];
      const gy = this.getGroundHeight(st.x, st.z);
      const m = new THREE.Mesh(stoneGeo, stepMat);
      m.scale.set(st.rx, 1.0, st.rz);
      m.position.set(st.x, gy + 0.015, st.z);
      m.rotation.y = st.rot;
      m.receiveShadow = true;
      m.castShadow = true;
      this.scene.add(m);
    }

    // Traditional Stone Lanterns (Yukimi-doro by pond + Tachi-gata on west lawn)
    const lanternStoneMat = new THREE.MeshStandardMaterial({
      map: this._tex.stone.map,
      bumpMap: this._tex.stone.bumpMap,
      bumpScale: 0.03,
      roughness: 0.9,
    });
    this._wettableMaterials.push({ mat: lanternStoneMat, baseRough: 0.9 });

    this._gardenLanternGlowMats = [];
    this._gardenLanternLights = [];

    L.lanterns.forEach((lan, idx) => {
      const isYukimi = idx === 0;
      const gy = this.getGroundHeight(lan.x, lan.z);
      const g = new THREE.Group();
      g.position.set(lan.x, gy, lan.z);

      const glowMat = new THREE.MeshStandardMaterial({
        color: 0xf7ecd4,
        emissive: new THREE.Color('#ffaa48'),
        emissiveIntensity: 0.0,
        roughness: 0.6,
      });
      this._gardenLanternGlowMats.push(glowMat);

      let lightY = 1.05;
      if (isYukimi) {
        // 3 arched legs
        for (let leg = 0; leg < 3; leg++) {
          const a = (leg / 3) * Math.PI * 2;
          const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.56, 7), lanternStoneMat);
          legMesh.position.set(Math.cos(a) * 0.22, 0.26, Math.sin(a) * 0.22);
          legMesh.rotation.z = Math.cos(a) * 0.25;
          legMesh.rotation.x = -Math.sin(a) * 0.25;
          legMesh.castShadow = true;
          g.add(legMesh);
        }
        // Platform
        const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.1, 6), lanternStoneMat);
        plat.position.y = 0.56;
        plat.castShadow = true;
        g.add(plat);
        // Glowing firebox
        const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 6), glowMat);
        fire.position.y = 0.74;
        g.add(fire);
        // Stone mullions around firebox
        for (let m = 0; m < 6; m++) {
          const a = (m / 6) * Math.PI * 2;
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.27, 0.035), lanternStoneMat);
          bar.position.set(Math.cos(a) * 0.17, 0.74, Math.sin(a) * 0.17);
          g.add(bar);
        }
        // Broad umbrella snow-viewing hat (kasa)
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.26, 6), lanternStoneMat);
        hat.position.y = 0.99;
        hat.castShadow = true;
        hat.receiveShadow = true;
        g.add(hat);
        // Finial (hoju)
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), lanternStoneMat);
        finial.position.y = 1.15;
        g.add(finial);
        lightY = 0.76;
      } else {
        // Classic standing Tachi-gata lantern
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.2, 6), lanternStoneMat);
        base.position.y = 0.1;
        base.castShadow = true;
        g.add(base);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.85, 8), lanternStoneMat);
        pillar.position.y = 0.6;
        pillar.castShadow = true;
        g.add(pillar);
        const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.12, 6), lanternStoneMat);
        plat.position.y = 1.08;
        plat.castShadow = true;
        g.add(plat);
        const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 6), glowMat);
        fire.position.y = 1.28;
        g.add(fire);
        for (let m = 0; m < 6; m++) {
          const a = (m / 6) * Math.PI * 2;
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.31, 0.035), lanternStoneMat);
          bar.position.set(Math.cos(a) * 0.16, 1.28, Math.sin(a) * 0.16);
          g.add(bar);
        }
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.24, 6), lanternStoneMat);
        hat.position.y = 1.54;
        hat.castShadow = true;
        hat.receiveShadow = true;
        g.add(hat);
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), lanternStoneMat);
        finial.position.y = 1.69;
        g.add(finial);
        lightY = 1.3;
      }

      // Snow cap on lantern roof
      const lSnow = new THREE.Mesh(
        new THREE.ConeGeometry(isYukimi ? 0.54 : 0.4, 0.16, 6),
        new THREE.MeshStandardMaterial({ color: 0xf2f6fc, roughness: 0.84, transparent: true, opacity: 0.0 })
      );
      lSnow.position.y = isYukimi ? 1.04 : 1.59;
      g.add(lSnow);
      this._snowCapMeshes.push(lSnow);

      this.scene.add(g);

      // Warm night PointLight (castShadow = false per SPEC.md)
      const pt = new THREE.PointLight(0xffb15c, 0, 10.0, 1.75);
      pt.position.set(lan.x, gy + lightY, lan.z);
      pt.castShadow = false;
      this.scene.add(pt);
      this._gardenLanternLights.push(pt);
    });

    // Corner Ornamental Shrubs (soften fence corners, shift color by season)
    this._shrubMat = new THREE.MeshStandardMaterial({
      color: SEASON_COLORS.shrub.spring.clone(),
      roughness: 0.88,
    });
    const bushGeo = new THREE.DodecahedronGeometry(0.6, 1);
    for (const sh of L.cornerShrubs) {
      const gy = this.getGroundHeight(sh.x, sh.z);
      const bushGroup = new THREE.Group();
      bushGroup.position.set(sh.x, gy, sh.z);
      for (let k = 0; k < 4; k++) {
        const puff = new THREE.Mesh(bushGeo, this._shrubMat);
        const a = (k / 4) * Math.PI * 2 + rand();
        const r = k === 0 ? 0 : 0.42;
        const sc = k === 0 ? 1.2 : 0.72 + rand() * 0.35;
        puff.scale.set(sc, sc * 0.82, sc);
        puff.position.set(Math.cos(a) * r, sc * 0.42, Math.sin(a) * r);
        puff.castShadow = true;
        puff.receiveShadow = true;
        bushGroup.add(puff);
      }
      this.scene.add(bushGroup);
    }

    // Toy Ball (at poi.toy)
    const ballMat = new THREE.MeshStandardMaterial({
      map: this._tex.ball,
      roughness: 0.42,
      metalness: 0.04,
    });
    this._wettableMaterials.push({ mat: ballMat, baseRough: 0.42 });
    this._toyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.135, 22, 16), ballMat);
    const toyY = this.getGroundHeight(this.poi.toy.x, this.poi.toy.z) + 0.135;
    this._toyMesh.position.set(this.poi.toy.x, toyY, this.poi.toy.z);
    this._toyMesh.rotation.set(0.35, 0.8, 0.2);
    this._toyMesh.castShadow = true;
    this._toyMesh.receiveShadow = true;
    this.scene.add(this._toyMesh);
  }

  // ==========================================================================
  // 11. Butterflies (Spring & Summer Daytime, Chased by Dog)
  // ==========================================================================
  _buildButterflies() {
    const rand = mulberry32(8080);
    const count = 6;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x241e1a, roughness: 0.8 });

    // Wing geometry hinged cleanly at x = 0
    const wingGeoR = new THREE.PlaneGeometry(0.085, 0.095);
    wingGeoR.translate(0.0425, 0, 0);
    const wingGeoL = new THREE.PlaneGeometry(0.085, 0.095);
    wingGeoL.scale(-1, 1, 1);
    wingGeoL.translate(-0.0425, 0, 0);

    this._butterflyData = [];

    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.036, 4, 6), bodyMat);
      body.rotation.x = Math.PI / 2;
      g.add(body);

      const wMat = new THREE.MeshStandardMaterial({
        map: this._tex.butterflyWings[i % this._tex.butterflyWings.length],
        alphaTest: 0.25,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.6,
      });

      const wingR = new THREE.Mesh(wingGeoR, wMat);
      wingR.rotation.x = -Math.PI / 2;
      g.add(wingR);

      const wingL = new THREE.Mesh(wingGeoL, wMat);
      wingL.rotation.x = -Math.PI / 2;
      g.add(wingL);

      const homeX = i < 3 ? this._layout.flowerbed.x + (rand() - 0.5) * 4.5 : (rand() - 0.5) * 14.0;
      const homeZ = i < 3 ? this._layout.flowerbed.z + (rand() - 0.5) * 3.5 : (rand() - 0.5) * 12.0;
      g.position.set(homeX, 0.9 + rand() * 0.7, homeZ);
      g.visible = false;
      this.scene.add(g);

      this.butterflies.push(g);
      this._butterflyData.push({
        group: g,
        wingL,
        wingR,
        homeX,
        homeZ,
        radiusX: 2.0 + rand() * 3.2,
        radiusZ: 1.8 + rand() * 3.0,
        speed: 0.42 + rand() * 0.35,
        phase: rand() * Math.PI * 2,
        flapRate: 13.0 + rand() * 6.0,
        baseY: 0.55 + rand() * 0.95,
      });
    }
  }

  // ==========================================================================
  // 12. Little Garden Birds (Daytime, Swooping Down to Hop on Lawn)
  // ==========================================================================
  _buildBirds() {
    const rand = mulberry32(9090);
    const count = 4;
    // Japanese Sparrow (Suzume) & Mejiro-inspired colorways
    const palettes = [
      { body: 0x8b6a4e, belly: 0xe8dfd0, head: 0x6b442a, wing: 0x5c422c }, // Sparrow
      { body: 0x8e6e52, belly: 0xeae2d4, head: 0x6d472e, wing: 0x5e442f }, // Sparrow 2
      { body: 0x6f9442, belly: 0xebe8d5, head: 0x769d46, wing: 0x537230 }, // Mejiro
      { body: 0x5d646b, belly: 0xf4f4f2, head: 0x2c3035, wing: 0x3b4046 }, // Wagtail
    ];

    const perchSpots = [
      new THREE.Vector3(this._layout.fenceMinX, 1.82, -2.5),
      new THREE.Vector3(this._layout.fenceMaxX, 1.82, 2.0),
      new THREE.Vector3(this._layout.treePos.x - 1.8, 4.6, this._layout.treePos.z + 1.2),
      new THREE.Vector3(0.5, 1.82, this._layout.fenceMaxZ),
    ];

    this._birdData = [];

    for (let i = 0; i < count; i++) {
      const pal = palettes[i % palettes.length];
      const g = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({ color: pal.body, roughness: 0.85 });
      const bellyMat = new THREE.MeshStandardMaterial({ color: pal.belly, roughness: 0.9 });
      const headMat = new THREE.MeshStandardMaterial({ color: pal.head, roughness: 0.85 });
      const wingMat = new THREE.MeshStandardMaterial({ color: pal.wing, roughness: 0.82 });
      const beakMat = new THREE.MeshStandardMaterial({ color: 0x3d332a, roughness: 0.6 });

      // Plump sparrow body (+Z forward)
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), bodyMat);
      body.scale.set(0.85, 0.88, 1.38);
      body.position.set(0, 0.085, 0);
      body.castShadow = true;
      g.add(body);

      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), bellyMat);
      belly.scale.set(0.84, 0.72, 1.15);
      belly.position.set(0, 0.068, 0.01);
      g.add(belly);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), headMat);
      head.position.set(0, 0.135, 0.055);
      head.castShadow = true;
      g.add(head);

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.036, 5), beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.13, 0.105);
      g.add(beak);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.009, 0.088), wingMat);
      tail.position.set(0, 0.095, -0.095);
      tail.rotation.x = 0.25;
      g.add(tail);

      // Articulated Wings
      const wingGeo = new THREE.BoxGeometry(0.11, 0.012, 0.062);
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.geometry.translate(-0.055, 0, 0);
      wingL.position.set(-0.038, 0.098, 0.0);
      g.add(wingL);

      const wingRGeo = new THREE.BoxGeometry(0.11, 0.012, 0.062);
      wingRGeo.translate(0.055, 0, 0);
      const wingR = new THREE.Mesh(wingRGeo, wingMat);
      wingR.position.set(0.038, 0.098, 0.0);
      g.add(wingR);

      // Tiny legs
      const legGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.05, 4);
      const legL = new THREE.Mesh(legGeo, beakMat);
      legL.position.set(-0.016, 0.025, 0);
      g.add(legL);
      const legR = new THREE.Mesh(legGeo, beakMat);
      legR.position.set(0.016, 0.025, 0);
      g.add(legR);

      // Start half the birds on the ground right away so garden feels alive immediately
      const startGround = i < 2;
      const gp = this.randomWalkablePoint();
      const perch = perchSpots[i % perchSpots.length].clone();
      if (startGround) {
        g.position.set(gp.x, this.getGroundHeight(gp.x, gp.z), gp.z);
      } else {
        g.position.copy(perch);
      }

      this.scene.add(g);
      this.birds.push(g);
      this._birdData.push({
        group: g,
        wingL,
        wingR,
        head,
        state: startGround ? 'ground' : 'perch',
        timer: 3.0 + rand() * 8.0,
        perchPos: perch,
        startPos: g.position.clone(),
        targetPos: new THREE.Vector3(gp.x, this.getGroundHeight(gp.x, gp.z), gp.z),
        flightT: 0,
        flightDur: 2.0,
        hopPhase: rand() * Math.PI * 2,
        hopHeading: rand() * Math.PI * 2,
      });
    }
  }

  // ==========================================================================
  // 13. Seasonal & Weather Particles (Sakura Petals, Autumn Leaves, Snow, Rain)
  // ==========================================================================
  _buildParticles() {
    const rand = mulberry32(10101);

    // --- A. Sakura Petals (InstancedMesh, Spring) ---
    const petalCount = 520;
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, -0.022);
    petalShape.bezierCurveTo(-0.022, -0.008, -0.02, 0.02, -0.004, 0.024);
    petalShape.lineTo(0, 0.016); // Classic sakura notch
    petalShape.lineTo(0.004, 0.024);
    petalShape.bezierCurveTo(0.02, 0.02, 0.022, -0.008, 0, -0.022);
    const petalGeo = new THREE.ShapeGeometry(petalShape, 5);
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xffd0e0,
      emissive: 0x3a1824,
      emissiveIntensity: 0.15,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    this._petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
    this._petalMesh.frustumCulled = false;
    this._petalMesh.visible = false;
    this.scene.add(this._petalMesh);

    this._petals = [];
    for (let i = 0; i < petalCount; i++) {
      this._petals.push({
        x: -14 + rand() * 28,
        y: 0.5 + rand() * 9.0,
        z: -10 + rand() * 24,
        rx: rand() * Math.PI * 2,
        ry: rand() * Math.PI * 2,
        rz: rand() * Math.PI * 2,
        vy: -(0.38 + rand() * 0.36),
        swayPhase: rand() * Math.PI * 2,
        swayAmp: 0.45 + rand() * 0.65,
        spin: (rand() - 0.5) * 2.8,
        scale: 0.75 + rand() * 0.65,
      });
    }

    // --- B. Autumn Leaves (InstancedMesh with per-instance red/orange/gold color) ---
    const leafCount = 340;
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, -0.042);
    leafShape.quadraticCurveTo(-0.032, -0.01, -0.024, 0.022);
    leafShape.lineTo(0, 0.048);
    leafShape.lineTo(0.024, 0.022);
    leafShape.quadraticCurveTo(0.032, -0.01, 0, -0.042);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 4);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });
    this._autumnLeafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    this._autumnLeafMesh.frustumCulled = false;
    this._autumnLeafMesh.visible = false;
    const autumnCols = [
      new THREE.Color('#c8341c'),
      new THREE.Color('#e26a1c'),
      new THREE.Color('#f0ab24'),
      new THREE.Color('#a42818'),
      new THREE.Color('#d98422'),
    ];
    for (let i = 0; i < leafCount; i++) {
      this._autumnLeafMesh.setColorAt(i, autumnCols[i % autumnCols.length]);
    }
    this._autumnLeafMesh.instanceColor.needsUpdate = true;
    this.scene.add(this._autumnLeafMesh);

    this._autumnLeaves = [];
    for (let i = 0; i < leafCount; i++) {
      this._autumnLeaves.push({
        x: -14 + rand() * 28,
        y: 0.5 + rand() * 9.5,
        z: -10 + rand() * 24,
        rx: rand() * Math.PI * 2,
        ry: rand() * Math.PI * 2,
        rz: rand() * Math.PI * 2,
        vy: -(0.52 + rand() * 0.45),
        swayPhase: rand() * Math.PI * 2,
        swayAmp: 0.55 + rand() * 0.8,
        spin: (rand() - 0.5) * 3.4,
        scale: 0.8 + rand() * 0.65,
      });
    }

    // --- C. Snowflakes (Soft glowing Points) ---
    const snowCount = 1500;
    const snowPos = new Float32Array(snowCount * 3);
    this._snowMeta = new Float32Array(snowCount * 2); // speed, phase
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = -16 + rand() * 32;
      snowPos[i * 3 + 1] = rand() * 14;
      snowPos[i * 3 + 2] = -12 + rand() * 28;
      this._snowMeta[i * 2] = 0.65 + rand() * 0.75;
      this._snowMeta[i * 2 + 1] = rand() * Math.PI * 2;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    this._snowMat = new THREE.PointsMaterial({
      map: this._tex.glow,
      color: 0xf6f9ff,
      size: 0.14,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this._snowPoints = new THREE.Points(snowGeo, this._snowMat);
    this._snowPoints.frustumCulled = false;
    this._snowPoints.visible = false;
    this.scene.add(this._snowPoints);

    // --- D. Rain Streaks (Slanted translucent InstancedMesh) ---
    const rainCount = 1400;
    const rainGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.58, 3);
    this._rainMat = new THREE.MeshBasicMaterial({
      color: 0xcbdcf0,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this._rainMesh = new THREE.InstancedMesh(rainGeo, this._rainMat, rainCount);
    this._rainMesh.frustumCulled = false;
    this._rainMesh.visible = false;
    this.scene.add(this._rainMesh);

    this._rainDrops = [];
    for (let i = 0; i < rainCount; i++) {
      this._rainDrops.push({
        x: -16 + rand() * 32,
        y: rand() * 15,
        z: -12 + rand() * 28,
        speed: 11.5 + rand() * 5.0,
      });
    }

    // --- E. Ground Rain Splash Rings ---
    const splashCount = 80;
    const splashGeo = new THREE.RingGeometry(0.03, 0.055, 12);
    splashGeo.rotateX(-Math.PI / 2);
    this._splashMat = new THREE.MeshBasicMaterial({
      color: 0xd8e8fa,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this._splashMesh = new THREE.InstancedMesh(splashGeo, this._splashMat, splashCount);
    this._splashMesh.frustumCulled = false;
    this._splashMesh.visible = false;
    this.scene.add(this._splashMesh);

    this._splashes = [];
    for (let i = 0; i < splashCount; i++) {
      const sx = -13 + rand() * 26;
      const sz = -9.5 + rand() * 22.5;
      this._splashes.push({
        x: sx,
        z: sz,
        t: rand(),
        rate: 1.8 + rand() * 1.4,
      });
    }

    // Proxy Object3D pool for public `this.fallingThings` (synchronized to live airborne petals/leaves/snow)
    this._fallingPool = [];
    for (let i = 0; i < 24; i++) {
      const obj = new THREE.Object3D();
      obj.userData.kind = 'petal';
      this._fallingPool.push(obj);
    }
  }

  // ==========================================================================
  // Main Per-Frame Update
  // ==========================================================================
  update(realDt, clock) {
    const dt = Math.min(Math.max(realDt || 0.016, 0.001), 0.1);
    this._elapsed += dt;
    this._sharedUniforms.uTime.value = this._elapsed;

    // Safely unpack WorldClock properties
    const worldDt =
      clock && typeof clock.gameDtFromReal === 'function'
        ? clock.gameDtFromReal(dt)
        : dt * 30;
    const worldHoursDt = worldDt / 3600;
    const hours = clock && typeof clock.hours === 'number' ? clock.hours : 12;
    const dayOfYear = clock && typeof clock.dayOfYear === 'number' ? clock.dayOfYear : 100;
    const season = (clock && clock.season) || 'spring';
    const weights = (clock && clock.seasonWeights) || {
      spring: season === 'spring' ? 1 : 0,
      summer: season === 'summer' ? 1 : 0,
      autumn: season === 'autumn' ? 1 : 0,
      winter: season === 'winter' ? 1 : 0,
    };
    const sunElev = clock && typeof clock.sunElevation === 'number' ? clock.sunElevation : 0.7;
    const sunAz = clock && typeof clock.sunAzimuth === 'number' ? clock.sunAzimuth : Math.PI;
    const isNight = clock && typeof clock.isNight === 'boolean' ? clock.isNight : sunElev < -0.07;

    this._sunElevation = sunElev;
    this._isNight = isNight;

    // 1. Meal refill schedule (7:00 & 18:00 world time)
    this._updateFoodSchedule(clock, hours, dayOfYear);

    // 2. Weather state machine, wetness, snowCover & organic wind
    this._updateWeather(dt, worldHoursDt, season, weights, sunElev);

    // 3. Sky, Sun, Moon, Stars, Clouds, Lights, Night Lanterns, Fog & PMREM
    this._updateSkyAndLights(dt, hours, dayOfYear, sunElev, sunAz, isNight, weights);

    // 4. Seasonal flora visuals (Grass, Tree Sakura/Hazakura/Autumn/Winter, Flowerbed, Snow Caps, Wetness)
    this._updateSeasonalVisuals(dayOfYear, weights);

    // 5. Pond koi animation & Toy ball position sync (if dog moves poi.toy)
    this._updateKoi(dt);
    if (this._toyMesh && this.poi.toy) {
      const tx = this.poi.toy.x;
      const tz = this.poi.toy.z;
      const dx = tx - this._toyMesh.position.x;
      const dz = tz - this._toyMesh.position.z;
      if (dx * dx + dz * dz > 1e-6) {
        this._toyMesh.rotation.x += dz / 0.135;
        this._toyMesh.rotation.z -= dx / 0.135;
      }
      this._toyMesh.position.set(tx, this.getGroundHeight(tx, tz) + 0.135, tz);
    }

    // 6. Living creatures (Butterflies & Birds)
    this._updateButterflies(dt, weights, sunElev, isNight);
    this._updateBirds(dt, sunElev, isNight);

    // 7. Falling particles (Petals, Autumn Leaves, Snow, Rain + Splashes)
    this._updateParticles(dt, dayOfYear, weights);
  }

  _updateFoodSchedule(clock, hours, dayOfYear) {
    // Determine meal slot index: 2 slots per day (7:00 and 18:00)
    const year = clock && clock.date ? clock.date.getFullYear() : 2026;
    const dayKey = year * 400 + Math.floor(dayOfYear);
    let slot;
    if (hours >= 18) {
      slot = dayKey * 2 + 1;
    } else if (hours >= 7) {
      slot = dayKey * 2;
    } else {
      slot = (dayKey - 1) * 2 + 1;
    }
    if (this._lastMealSlot !== null && slot !== this._lastMealSlot) {
      this.foodLevel = 1.0;
    }
    this._lastMealSlot = slot;

    this.foodLevel = clamp(this.foodLevel, 0, 1);

    // Visually scale kibble mound inside the food bowl
    if (this._kibbleMesh) {
      const f = this.foodLevel;
      this._kibbleMesh.visible = f > 0.02;
      this._kibbleMesh.scale.set(0.65 + f * 0.35, 0.08 + f * 0.52, 0.65 + f * 0.35);
      this._kibbleMesh.position.y = 0.022 + f * 0.018;
    }
  }

  _updateWeather(dt, worldHoursDt, season, weights, sunElev) {
    // Prevent snow outside winter
    if (season !== 'winter' && weights.winter < 0.45 && this._targetWeather === 'snow') {
      this._targetWeather = 'rain';
    }

    this._weatherTimerHours -= worldHoursDt;
    if (this._weatherTimerHours <= 0) {
      this._weatherTimerHours = 3.0 + Math.random() * 4.5;
      const r = Math.random();
      if (season === 'spring') {
        this._targetWeather = r < 0.5 ? 'clear' : r < 0.78 ? 'cloudy' : 'rain';
      } else if (season === 'summer') {
        this._targetWeather = r < 0.56 ? 'clear' : r < 0.78 ? 'cloudy' : 'rain';
      } else if (season === 'autumn') {
        this._targetWeather = r < 0.58 ? 'clear' : r < 0.84 ? 'cloudy' : 'rain';
      } else {
        // Winter: snow allowed
        this._targetWeather = r < 0.46 ? 'clear' : r < 0.68 ? 'cloudy' : r < 0.78 ? 'rain' : 'snow';
      }
    }

    // Smoothly transition weatherIntensity & switch weather label at low intensity
    const transitionSpeed = 0.085; // ~12 real seconds for full smooth crossfade
    if (this.weather !== this._targetWeather) {
      if (this.weather === 'clear') {
        this.weather = this._targetWeather;
      } else {
        this.weatherIntensity = Math.max(0, this.weatherIntensity - dt * transitionSpeed);
        if (this.weatherIntensity <= 0.02) {
          this.weather = this._targetWeather;
          this.weatherIntensity = 0.02;
        }
      }
    } else {
      const targetInt =
        this.weather === 'clear'
          ? 0.0
          : this.weather === 'cloudy'
            ? 0.68
            : 0.78 + 0.16 * Math.sin(this._elapsed * 0.12);
      this.weatherIntensity = lerp(this.weatherIntensity, targetInt, Math.min(1, dt * transitionSpeed * 1.4));
    }

    // Wetness accumulation & evaporation
    const sunDryBoost = Math.max(0, Math.sin(Math.max(0, sunElev))) * (this.weather === 'clear' ? 1.8 : 0.7);
    if (this.weather === 'rain') {
      this.wetness = clamp(this.wetness + dt * 0.045 * this.weatherIntensity, 0, 1);
    } else {
      const dryRate = 0.008 + sunDryBoost * 0.015;
      this.wetness = clamp(this.wetness - dt * dryRate, 0, 1);
    }

    // Snow cover accumulation & melt
    if (this.weather === 'snow') {
      this.snowCover = clamp(this.snowCover + dt * 0.03 * this.weatherIntensity, 0, 1);
    } else {
      const warmFactor = 1.0 - weights.winter * 0.78;
      const rainMelt = this.weather === 'rain' ? 0.04 : 0.0;
      const meltRate = (0.003 + sunDryBoost * 0.012) * warmFactor + rainMelt;
      this.snowCover = clamp(this.snowCover - dt * meltRate, 0, 1);
    }

    // Organic layered wind with gusts & seasonal/weather modulation
    const t = this._elapsed;
    const baseWind =
      this.weather === 'rain'
        ? 0.48
        : this.weather === 'snow'
          ? 0.36
          : this.weather === 'cloudy'
            ? 0.28
            : 0.16;
    const seasonWind = weights.spring * 0.08 + weights.autumn * 0.08;
    const gust =
      0.5 +
      0.3 * Math.sin(t * 0.23) +
      0.2 * Math.sin(t * 0.67 + 1.4) +
      0.15 * Math.cos(t * 1.31 - 0.8);
    const targetWind = clamp(baseWind + seasonWind + (gust - 0.5) * 0.32, 0.04, 1.0);
    this.windStrength = lerp(this.windStrength, targetWind, Math.min(1, dt * 1.2));

    // Slowly drifting wind angle
    const windAng = 0.55 + 0.38 * Math.sin(t * 0.07);
    this._sharedUniforms.uWindStrength.value = this.windStrength;
    this._sharedUniforms.uWindDir.value.set(Math.cos(windAng), Math.sin(windAng));
    this._sharedUniforms.uWetness.value = this.wetness;
    this._sharedUniforms.uSnowCover.value = this.snowCover;
    this._sharedUniforms.uRainIntensity.value = this.weather === 'rain' ? this.weatherIntensity : 0.0;
  }

  _updateSkyAndLights(dt, hours, dayOfYear, sunElev, sunAz, isNight, weights) {
    // Convert spherical sunElevation & sunAzimuth (North = -Z, East = +X, South = +Z)
    const cosEl = Math.cos(sunElev);
    this._sunDir.set(
      cosEl * Math.sin(sunAz),
      Math.sin(sunElev),
      -cosEl * Math.cos(sunAz)
    ).normalize();
    this._sharedUniforms.uSunDir.value.copy(this._sunDir);

    // Moon follows a gently shifted nocturnal arc opposite the sun
    const moonElev = Math.max(-0.2, -sunElev * 0.85 + 0.22);
    const moonAz = sunAz + Math.PI + (dayOfYear % 29.5) * 0.04;
    this._moonDir.set(
      Math.cos(moonElev) * Math.sin(moonAz),
      Math.sin(moonElev),
      -Math.cos(moonElev) * Math.cos(moonAz)
    ).normalize();

    const cloudCover =
      this.weather === 'clear'
        ? 0.2
        : this.weather === 'cloudy'
          ? lerp(0.25, 0.78, this.weatherIntensity)
          : lerp(0.35, 0.94, this.weatherIntensity);

    // Twilight / Day / Night continuous factors
    const dayFactor = smoothstep(-0.08, 0.22, sunElev);
    const nightFactor = 1.0 - smoothstep(-0.14, 0.06, sunElev);
    const goldenFactor = Math.exp(-Math.pow((sunElev - 0.04) / 0.14, 2.0));

    // Update Three.js Sky uniforms
    const skyU = this._sky.material.uniforms;
    skyU.sunPosition.value.copy(this._sunDir).multiplyScalar(400);
    skyU.turbidity.value = lerp(2.6, 8.5, goldenFactor) + cloudCover * 5.0;
    skyU.rayleigh.value = lerp(1.55, 3.1, goldenFactor) * (1.0 - cloudCover * 0.52);
    skyU.mieCoefficient.value = lerp(0.004, 0.011, goldenFactor) + cloudCover * 0.008;
    skyU.mieDirectionalG.value = lerp(0.82, 0.91, goldenFactor);

    // Night sky indigo dome & stars
    this._nightSkyMat.uniforms.uOpacity.value = nightFactor * 0.96;
    const starVis = nightFactor * clamp(1.0 - cloudCover * 1.05, 0.0, 1.0);
    this._starMat.uniforms.uOpacity.value = starVis;
    this._stars.visible = starVis > 0.01;
    this._stars.rotation.y = this._elapsed * 0.0012;

    // Moon positioning & visibility
    const moonVis = smoothstep(-0.02, 0.12, this._moonDir.y) * smoothstep(0.18, -0.05, sunElev) * clamp(1.0 - cloudCover * 0.85, 0.1, 1.0);
    this._moonGroup.position.copy(this._moonDir).multiplyScalar(320);
    this._moonMat.opacity = moonVis * 0.95;
    this._moonHaloMat.opacity = moonVis * 0.42;
    this._moonGroup.visible = moonVis > 0.01;

    // Overcast atmospheric veil
    const overcastStrength =
      this.weather === 'clear'
        ? 0.0
        : this.weather === 'cloudy'
          ? this.weatherIntensity * 0.48
          : this.weatherIntensity * 0.78;
    this._overcastMat.uniforms.uOpacity.value = overcastStrength;
    const ovTop = this._tmpColor.set('#647282').lerp(this._tmpColor2.set('#141c2c'), nightFactor);
    const ovHor = this._tmpColor3.set('#9ca7b4').lerp(this._tmpColor2.set('#1f2a3e'), nightFactor);
    if (this.weather === 'snow') {
      ovTop.lerp(this._tmpColor2.set('#96a4b5'), 0.4 * (1 - nightFactor));
      ovHor.lerp(this._tmpColor2.set('#cfd9e5'), 0.5 * (1 - nightFactor));
    }
    this._overcastMat.uniforms.uTopColor.value.copy(ovTop);
    this._overcastMat.uniforms.uHorizonColor.value.copy(ovHor);

    // Procedural FBM clouds lighting
    this._cloudMat.uniforms.uCoverage.value = cloudCover;
    const cloudBright = this._tmpColor
      .set('#ffffff')
      .lerp(this._tmpColor2.set('#ffbe88'), goldenFactor * 0.75)
      .lerp(this._tmpColor2.set('#30405c'), nightFactor * 0.88);
    const cloudShadow = this._tmpColor3
      .set('#a8bdd2')
      .lerp(this._tmpColor2.set('#7a5b6e'), goldenFactor * 0.65)
      .lerp(this._tmpColor2.set('#131b2b'), nightFactor * 0.92);
    if (this.weather === 'rain') {
      cloudBright.multiplyScalar(0.68);
      cloudShadow.multiplyScalar(0.58);
    }
    this._cloudMat.uniforms.uCloudBright.value.copy(cloudBright);
    this._cloudMat.uniforms.uCloudShadow.value.copy(cloudShadow);
    this._cloudMat.uniforms.uSunGlowColor.value
      .set('#ffdcb0')
      .lerp(this._tmpColor2.set('#ff7d40'), goldenFactor * 0.8)
      .multiplyScalar(1.0 - nightFactor * 0.85);
    this._cloudMat.uniforms.uOpacity.value = lerp(0.75, 0.95, cloudCover);

    // Key Directional Light (Sun in daytime, Moon at night, seamless shadow handoff)
    const weatherDim =
      this.weather === 'clear'
        ? 1.0
        : this.weather === 'cloudy'
          ? lerp(1.0, 0.52, this.weatherIntensity)
          : lerp(1.0, 0.34, this.weatherIntensity);

    if (sunElev >= -0.04) {
      // Sun drives key light
      const sunPitch = Math.max(0.11, this._sunDir.y);
      this._keyLight.position.set(
        this._sunDir.x * 38,
        sunPitch * 38,
        this._sunDir.z * 38 - 1
      );
      this._keyLight.color
        .set('#fff6e8')
        .lerp(this._tmpColor.set('#ff9b4e'), goldenFactor * 0.82)
        .lerp(this._tmpColor.set('#d2dde8'), (1 - weatherDim) * 0.55);
      this._keyLight.intensity = lerp(0.12, 3.1, dayFactor) * weatherDim;
    } else {
      // Moon drives soft silver-blue nocturnal shadows
      const moonPitch = Math.max(0.22, this._moonDir.y);
      this._keyLight.position.set(
        this._moonDir.x * 36,
        moonPitch * 36,
        this._moonDir.z * 36 - 1
      );
      this._keyLight.color.set('#8cb2e8');
      this._keyLight.intensity = 0.42 * (1.0 - cloudCover * 0.65);
    }

    // Hemisphere Sky & Ground Bounce
    const skyBounce = this._tmpColor
      .set('#8fc2f2')
      .lerp(this._tmpColor2.set('#e89f7c'), goldenFactor * 0.65)
      .lerp(this._tmpColor2.set('#7a8796'), (1 - weatherDim) * 0.65)
      .lerp(this._tmpColor2.set('#1f3154'), nightFactor * 0.92);

    const groundBounce = blendSeasonColor(this._tmpColor2, SEASON_COLORS.groundBase, weights)
      .lerp(this._tmpColor3.set('#c4d0de'), this.snowCover * 0.78)
      .multiplyScalar(lerp(0.25, 0.92, dayFactor));

    this._hemiLight.color.copy(skyBounce);
    this._hemiLight.groundColor.copy(groundBounce);
    this._hemiLight.intensity = lerp(0.32, 0.78, dayFactor) * lerp(0.72, 1.0, weatherDim);

    // Sync shared shader uniforms for grass & pond water
    this._sharedUniforms.uSunColor.value.copy(this._keyLight.color);
    this._sharedUniforms.uSkyColor.value.copy(skyBounce);
    this._sharedUniforms.uSunIntensity.value = clamp(dayFactor * weatherDim, 0.0, 1.0);

    // PMREM environment intensity modulation
    if (this.scene.environment) {
      this.scene.environmentIntensity = lerp(0.28, 0.85, dayFactor) * lerp(0.6, 1.0, weatherDim);
    }

    // Nighttime Warm Lights: Engawa Hanging Lantern, Shoji Warm Glow, & Garden Stone Lanterns
    const lanternOn = smoothstep(0.11, -0.05, sunElev);
    const flicker1 = 0.95 + 0.05 * Math.sin(this._elapsed * 5.7) * Math.cos(this._elapsed * 3.1);
    const flicker2 = 0.95 + 0.05 * Math.sin(this._elapsed * 6.3 + 1.9);

    this._shojiMat.emissiveIntensity = lanternOn * 0.82;
    this._porchLanternGlowMat.emissiveIntensity = lanternOn * 1.75 * flicker1;
    this._porchLight.intensity = lanternOn * 3.4 * flicker1;
    this._shojiSpillLight.intensity = lanternOn * 1.9;

    for (let i = 0; i < this._gardenLanternLights.length; i++) {
      const fl = i === 0 ? flicker1 : flicker2;
      this._gardenLanternLights[i].intensity = lanternOn * 2.8 * fl;
      this._gardenLanternGlowMats[i].emissiveIntensity = lanternOn * 1.85 * fl;
    }

    // Atmospheric Fog (synced to horizon, time-of-day & weather)
    const fogCol = this._tmpColor
      .set('#c4dcf0')
      .lerp(this._tmpColor2.set('#e8a882'), goldenFactor * 0.72)
      .lerp(this._tmpColor2.set('#8f9aa6'), (1 - weatherDim) * 0.72)
      .lerp(this._tmpColor2.set('#10192b'), nightFactor * 0.94);
    if (this.weather === 'snow') {
      fogCol.lerp(this._tmpColor2.set(isNight ? '#283448' : '#d5e0ec'), this.weatherIntensity * 0.65);
    }
    this._fog.color.copy(fogCol);

    const targetFogDensity =
      this.weather === 'clear'
        ? 0.0044
        : this.weather === 'cloudy'
          ? lerp(0.0048, 0.0086, this.weatherIntensity)
          : this.weather === 'rain'
            ? lerp(0.006, 0.0155, this.weatherIntensity)
            : lerp(0.006, 0.0185, this.weatherIntensity);
    this._fog.density = lerp(this._fog.density, targetFogDensity, Math.min(1, dt * 1.5));

    // Throttled PMREM sky environment reflection update
    this._updatePMREM(false);
  }

  _updateSeasonalVisuals(dayOfYear, weights) {
    // 1. Grass & Ground seasonal palette
    blendSeasonColor(this._sharedUniforms.uGrassBaseColor.value, SEASON_COLORS.grassBase, weights);
    blendSeasonColor(this._sharedUniforms.uGrassTipColor.value, SEASON_COLORS.grassTip, weights);
    blendSeasonColor(this._sharedUniforms.uGroundColor.value, SEASON_COLORS.groundBase, weights);

    // 2. Shrubs, reeds & distant hills
    blendSeasonColor(this._shrubMat.color, SEASON_COLORS.shrub, weights).lerp(
      this._tmpColor.set('#dde6f0'),
      this.snowCover * 0.65
    );
    blendSeasonColor(this._hillMat.color, SEASON_COLORS.distantHill, weights).lerp(
      this._tmpColor.set('#d6e0ea'),
      this.snowCover * 0.75
    );
    this._bgTreeCrownMat.color.copy(this._shrubMat.color).multiplyScalar(0.88);
    this._reedMat.color.copy(this._sharedUniforms.uGrassTipColor.value).multiplyScalar(0.8);

    // 3. Hero Tree: Sakura Full Bloom -> Hazakura -> Summer Green -> Autumn Foliage -> Winter Bare
    // Spring spans approx dayOfYear 60..151 (Mar 1 - May 31)
    let sakuraScale = 0.0;
    let leafScale = 0.0;

    if (weights.spring > 0.01) {
      // Peak sakura bloom around day 75..112, fading into hazakura day 112..145
      const bloomRamp = smoothstep(58, 82, dayOfYear) * (1.0 - smoothstep(108, 142, dayOfYear));
      sakuraScale = Math.max(sakuraScale, bloomRamp * weights.spring * 1.12);
      // Young green leaves emerge in late spring (hazakura)
      const hazakura = smoothstep(102, 134, dayOfYear);
      leafScale = Math.max(leafScale, (0.14 + hazakura * 0.86) * weights.spring);
    }
    if (weights.summer > 0.01) {
      leafScale = Math.max(leafScale, weights.summer * 1.04);
    }
    if (weights.autumn > 0.01) {
      // Lush autumn leaves that thin gracefully in late November (day 315..345)
      const lateDrop = 1.0 - smoothstep(312, 344, dayOfYear) * 0.75;
      leafScale = Math.max(leafScale, weights.autumn * lateDrop);
    }
    // Smooth total blend
    sakuraScale = clamp(sakuraScale, 0, 1.1);
    leafScale = clamp(leafScale * (1.0 - weights.winter * 0.98), 0, 1.06);

    this._sakuraScaleU.value = sakuraScale;
    this._leafScaleU.value = leafScale;
    this._sakuraCanopy.visible = sakuraScale > 0.03;
    this._leafCanopy.visible = leafScale > 0.03;

    blendSeasonColor(this._treeLeafColorAU.value, SEASON_COLORS.treeLeafA, weights);
    blendSeasonColor(this._treeLeafColorBU.value, SEASON_COLORS.treeLeafB, weights);

    // 4. Flowerbed seasonal plantings (Tulips / Sunflowers / Cosmos / Winter Earth)
    const setFlowerGroup = (grp, w) => {
      const s = smoothstep(0.05, 0.55, w);
      grp.visible = s > 0.01;
      if (grp.visible) {
        grp.scale.set(1, s, 1);
        // Gentle breeze sway on flowerbed stems
        grp.rotation.z = Math.sin(this._elapsed * (1.6 + this.windStrength * 2.0)) * 0.035 * (0.4 + this.windStrength);
      }
    };
    setFlowerGroup(this._springFlowers, weights.spring);
    setFlowerGroup(this._summerFlowers, weights.summer);
    setFlowerGroup(this._autumnFlowers, weights.autumn);

    // Pond lily pads & summer waterlilies
    const lilyVis = clamp(1.0 - weights.winter * 0.9, 0.0, 1.0);
    this._lilyGroup.visible = lilyVis > 0.1;
    const lotusScale = smoothstep(0.15, 0.65, weights.summer);
    for (let i = 0; i < this._summerWaterlilies.length; i++) {
      this._summerWaterlilies[i].visible = lotusScale > 0.02;
      this._summerWaterlilies[i].scale.setScalar(lotusScale);
    }

    // 5. Roof, fence, doghouse, lantern & branch snow caps
    const snowOp = smoothstep(0.08, 0.75, this.snowCover);
    for (let i = 0; i < this._snowCapMeshes.length; i++) {
      const m = this._snowCapMeshes[i];
      m.visible = snowOp > 0.01;
      m.material.opacity = snowOp * 0.96;
    }

    // 6. Wetness glossy sheen on wood, stone & roof
    const wet = this.wetness * (1.0 - this.snowCover * 0.7);
    for (let i = 0; i < this._wettableMaterials.length; i++) {
      const entry = this._wettableMaterials[i];
      entry.mat.roughness = lerp(entry.baseRough, Math.max(0.18, entry.baseRough * 0.36), wet);
    }
  }

  _updateKoi(dt) {
    const pond = this._layout.pond;
    for (let i = 0; i < this._koiList.length; i++) {
      const k = this._koiList[i];
      k.phase += dt * k.speed;
      const x = pond.x + Math.cos(k.phase) * k.rx;
      const z = pond.z + Math.sin(k.phase * 1.15) * k.rz;
      const nx = pond.x + Math.cos(k.phase + 0.08) * k.rx;
      const nz = pond.z + Math.sin((k.phase + 0.08) * 1.15) * k.rz;
      k.group.position.set(x, k.depth, z);
      k.group.rotation.y = Math.atan2(nx - x, nz - z);
      k.tail.rotation.y = Math.sin(this._elapsed * 7.5 + i * 2.0) * 0.45;
    }
  }

  _updateButterflies(dt, weights, sunElev, isNight) {
    const active =
      weights.spring + weights.summer > 0.25 &&
      !isNight &&
      sunElev > 0.08 &&
      this.weather !== 'rain' &&
      this.weather !== 'snow' &&
      this.windStrength < 0.72;

    for (let i = 0; i < this._butterflyData.length; i++) {
      const b = this._butterflyData[i];
      b.group.visible = active;
      if (!active) continue;

      b.phase += dt * b.speed;
      const t = b.phase;
      const px = clamp(
        b.homeX + Math.sin(t) * b.radiusX + Math.cos(t * 2.3) * 0.85,
        -12.5,
        12.5
      );
      const pz = clamp(
        b.homeZ + Math.cos(t * 0.82) * b.radiusZ + Math.sin(t * 1.7) * 0.75,
        -9.2,
        12.5
      );
      const gy = Math.max(this.getGroundHeight(px, pz), this._layout.pond.waterY);
      const py = gy + b.baseY + Math.sin(t * 2.9 + i) * 0.28;

      const prevX = b.group.position.x;
      const prevZ = b.group.position.z;
      b.group.position.set(px, py, pz);
      b.group.rotation.y = Math.atan2(px - prevX, pz - prevZ);

      // Expressive double-beat butterfly wing flutter
      const flap = Math.sin(this._elapsed * b.flapRate + i * 1.7) * 1.05 + 0.15;
      b.wingR.rotation.z = flap;
      b.wingL.rotation.z = -flap;
    }
  }

  _updateBirds(dt, sunElev, isNight) {
    const active = !isNight && sunElev > 0.03 && !(this.weather === 'rain' && this.weatherIntensity > 0.6);

    for (let i = 0; i < this._birdData.length; i++) {
      const b = this._birdData[i];
      b.group.visible = active;
      if (!active) continue;

      b.timer -= dt;

      if (b.state === 'perch') {
        b.group.position.copy(b.perchPos);
        b.wingL.rotation.z = 0.08;
        b.wingR.rotation.z = -0.08;
        // Curious head tilts while perched
        b.head.rotation.y = Math.sin(this._elapsed * 1.8 + i * 2.1) * 0.45;
        b.head.rotation.x = 0;

        if (b.timer <= 0) {
          const pt = this.randomWalkablePoint();
          b.startPos.copy(b.group.position);
          b.targetPos.set(pt.x, this.getGroundHeight(pt.x, pt.z), pt.z);
          b.flightT = 0;
          b.flightDur = 1.6 + Math.random() * 1.0;
          b.state = 'flying_down';
        }
      } else if (b.state === 'flying_down' || b.state === 'flying_up') {
        b.flightT += dt / b.flightDur;
        const t = clamp(b.flightT, 0, 1);
        const arc = Math.sin(t * Math.PI) * 1.9;
        this._tmpVec.lerpVectors(b.startPos, b.targetPos, t);
        this._tmpVec.y += arc;
        const dx = b.targetPos.x - b.startPos.x;
        const dz = b.targetPos.z - b.startPos.z;
        b.group.position.copy(this._tmpVec);
        b.group.rotation.y = Math.atan2(dx, dz);

        const flap = Math.sin(this._elapsed * 22.0 + i) * 0.95;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;

        if (t >= 1) {
          if (b.state === 'flying_down') {
            b.state = 'ground';
            b.timer = 7.0 + Math.random() * 10.0;
            b.hopHeading = Math.random() * Math.PI * 2;
          } else {
            b.state = 'perch';
            b.timer = 4.0 + Math.random() * 7.0;
          }
        }
      } else if (b.state === 'ground') {
        // Cute hopping & pecking on the grass
        b.wingL.rotation.z = 0.06;
        b.wingR.rotation.z = -0.06;
        b.hopPhase += dt * 3.4;
        const cycle = b.hopPhase % 4.0;

        if (cycle < 1.1) {
          // Little forward hop
          const hopT = cycle / 1.1;
          const speed = 0.38 * dt;
          const nx = b.group.position.x + Math.sin(b.hopHeading) * speed;
          const nz = b.group.position.z + Math.cos(b.hopHeading) * speed;
          if (this.isInside(nx, nz, 0.8)) {
            b.group.position.x = nx;
            b.group.position.z = nz;
          } else {
            b.hopHeading += Math.PI * 0.75;
          }
          const gy = this.getGroundHeight(b.group.position.x, b.group.position.z);
          b.group.position.y = gy + Math.sin(hopT * Math.PI) * 0.08;
          b.group.rotation.y = b.hopHeading;
          b.head.rotation.x = 0;
        } else if (cycle < 2.2) {
          // Pecking at grass seeds
          const gy = this.getGroundHeight(b.group.position.x, b.group.position.z);
          b.group.position.y = gy;
          b.head.rotation.x = Math.max(0, Math.sin((cycle - 1.1) * 9.0)) * 0.72;
        } else {
          // Looking around alertly
          const gy = this.getGroundHeight(b.group.position.x, b.group.position.z);
          b.group.position.y = gy;
          b.head.rotation.x = 0;
          b.head.rotation.y = Math.sin(cycle * 3.2) * 0.55;
          if (cycle > 3.85) {
            b.hopHeading += (Math.random() - 0.5) * 1.8;
          }
        }

        if (b.timer <= 0) {
          b.startPos.copy(b.group.position);
          b.targetPos.copy(b.perchPos);
          b.flightT = 0;
          b.flightDur = 1.7 + Math.random() * 0.8;
          b.state = 'flying_up';
        }
      }
    }
  }

  _updateParticles(dt, dayOfYear, weights) {
    const windX = this._sharedUniforms.uWindDir.value.x * (0.4 + this.windStrength * 2.2);
    const windZ = this._sharedUniforms.uWindDir.value.y * (0.4 + this.windStrength * 2.2);

    // Clear active chaseable fallingThings list (repopulated from live low-altitude particles)
    this.fallingThings.length = 0;
    let poolIdx = 0;
    const registerFallingThing = (x, y, z, kind) => {
      if (poolIdx >= this._fallingPool.length) return;
      if (y > 0.12 && y < 2.6 && x > -12.5 && x < 12.5 && z > -9.2 && z < 12.5) {
        const obj = this._fallingPool[poolIdx++];
        obj.position.set(x, y, z);
        obj.visible = true;
        obj.userData.kind = kind;
        this.fallingThings.push(obj);
      }
    };

    // --- 1. Sakura Petals (Spring blossom scatter, boosted during late bloom & breezes) ---
    const petalStrength =
      weights.spring *
      smoothstep(68, 86, dayOfYear) *
      (1.0 - smoothstep(126, 152, dayOfYear)) *
      (this.weather === 'rain' ? 0.55 : 1.0);
    const activePetals = Math.floor(this._petals.length * clamp(petalStrength * (0.55 + this.windStrength * 0.75), 0, 1));
    this._petalMesh.visible = activePetals > 0;
    if (activePetals > 0) {
      this._petalMesh.count = activePetals;
      const tp = this._layout.treePos;
      for (let i = 0; i < activePetals; i++) {
        const p = this._petals[i];
        p.swayPhase += dt * (2.2 + this.windStrength * 1.4);
        p.x += (windX * 0.75 + Math.sin(p.swayPhase) * p.swayAmp) * dt;
        p.z += (windZ * 0.75 + Math.cos(p.swayPhase * 0.85) * p.swayAmp) * dt;
        p.y += p.vy * dt;
        p.rx += p.spin * dt;
        p.ry += p.spin * 0.7 * dt;
        p.rz += Math.sin(p.swayPhase) * dt * 1.5;

        const gy = this.getGroundHeight(p.x, p.z);
        if (p.y < gy + 0.02 || Math.abs(p.x) > 15.5 || p.z > 15.5 || p.z < -12) {
          // Half spawn directly from the sakura tree canopy, half drift across the garden breeze!
          if (i % 2 === 0) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 4.4;
            p.x = tp.x + Math.cos(a) * r;
            p.z = tp.z + Math.sin(a) * r;
            p.y = 3.6 + Math.random() * 3.8;
          } else {
            p.x = -14 + Math.random() * 28;
            p.z = -10 + Math.random() * 24;
            p.y = 5.0 + Math.random() * 4.5;
          }
        }

        this._dummy.position.set(p.x, p.y, p.z);
        this._dummy.rotation.set(p.rx, p.ry, p.rz);
        this._dummy.scale.setScalar(p.scale);
        this._dummy.updateMatrix();
        this._petalMesh.setMatrixAt(i, this._dummy.matrix);

        if (i % 4 === 0) registerFallingThing(p.x, p.y, p.z, 'petal');
      }
      this._petalMesh.instanceMatrix.needsUpdate = true;
    }

    // --- 2. Autumn Falling Leaves ---
    const leafStrength = weights.autumn * (0.45 + this.windStrength * 0.85);
    const activeLeaves = Math.floor(this._autumnLeaves.length * clamp(leafStrength, 0, 1));
    this._autumnLeafMesh.visible = activeLeaves > 0;
    if (activeLeaves > 0) {
      this._autumnLeafMesh.count = activeLeaves;
      const tp = this._layout.treePos;
      for (let i = 0; i < activeLeaves; i++) {
        const lf = this._autumnLeaves[i];
        lf.swayPhase += dt * (2.0 + this.windStrength * 1.6);
        lf.x += (windX * 0.85 + Math.sin(lf.swayPhase) * lf.swayAmp) * dt;
        lf.z += (windZ * 0.85 + Math.cos(lf.swayPhase * 0.9) * lf.swayAmp) * dt;
        lf.y += lf.vy * dt;
        lf.rx += lf.spin * dt;
        lf.ry += lf.spin * 0.8 * dt;

        const gy = this.getGroundHeight(lf.x, lf.z);
        if (lf.y < gy + 0.02 || Math.abs(lf.x) > 15.5 || lf.z > 15.5 || lf.z < -12) {
          if (i % 2 === 0) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 4.5;
            lf.x = tp.x + Math.cos(a) * r;
            lf.z = tp.z + Math.sin(a) * r;
            lf.y = 3.5 + Math.random() * 3.8;
          } else {
            lf.x = -14 + Math.random() * 28;
            lf.z = -10 + Math.random() * 24;
            lf.y = 5.5 + Math.random() * 4.5;
          }
        }

        this._dummy.position.set(lf.x, lf.y, lf.z);
        this._dummy.rotation.set(lf.rx, lf.ry, lf.rz);
        this._dummy.scale.setScalar(lf.scale);
        this._dummy.updateMatrix();
        this._autumnLeafMesh.setMatrixAt(i, this._dummy.matrix);

        if (i % 4 === 0) registerFallingThing(lf.x, lf.y, lf.z, 'leaf');
      }
      this._autumnLeafMesh.instanceMatrix.needsUpdate = true;
    }

    // --- 3. Snowflakes (Winter Snow Weather) ---
    const snowActive = this.weather === 'snow' && this.weatherIntensity > 0.03;
    this._snowPoints.visible = snowActive;
    if (snowActive) {
      this._snowMat.opacity = clamp(this.weatherIntensity * 0.9, 0, 0.92);
      const posAttr = this._snowPoints.geometry.attributes.position;
      const arr = posAttr.array;
      const count = arr.length / 3;
      for (let i = 0; i < count; i++) {
        const sp = this._snowMeta[i * 2];
        const ph = this._snowMeta[i * 2 + 1];
        let x = arr[i * 3];
        let y = arr[i * 3 + 1];
        let z = arr[i * 3 + 2];

        x += (windX * 0.55 + Math.sin(this._elapsed * 1.4 + ph) * 0.42) * dt;
        z += (windZ * 0.55 + Math.cos(this._elapsed * 1.2 + ph) * 0.42) * dt;
        y -= sp * (0.95 + this.weatherIntensity * 0.55) * dt;

        if (y < -0.2 || x < -16 || x > 16 || z < -12 || z > 16) {
          x = -16 + Math.random() * 32;
          y = 11.5 + Math.random() * 3.0;
          z = -12 + Math.random() * 28;
        }
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;

        if (i < 60 && i % 3 === 0) registerFallingThing(x, y, z, 'snow');
      }
      posAttr.needsUpdate = true;
    }

    // --- 4. Rain Streaks & Ground Splashes ---
    const rainActive = this.weather === 'rain' && this.weatherIntensity > 0.03;
    this._rainMesh.visible = rainActive;
    this._splashMesh.visible = rainActive;
    if (rainActive) {
      const rainCount = Math.floor(this._rainDrops.length * clamp(0.25 + this.weatherIntensity * 0.75, 0, 1));
      this._rainMesh.count = rainCount;
      this._rainMat.opacity = clamp(this.weatherIntensity * 0.42, 0.05, 0.44);

      const tiltX = windZ * 0.075;
      const tiltZ = -windX * 0.075;

      for (let i = 0; i < rainCount; i++) {
        const r = this._rainDrops[i];
        r.x += windX * 0.9 * dt;
        r.z += windZ * 0.9 * dt;
        r.y -= r.speed * dt;
        if (r.y < -0.1 || Math.abs(r.x) > 16.5 || r.z > 16.5 || r.z < -12.5) {
          r.x = -16 + Math.random() * 32;
          r.y = 12.5 + Math.random() * 3.5;
          r.z = -12 + Math.random() * 28;
        }
        this._dummy.position.set(r.x, r.y, r.z);
        this._dummy.rotation.set(tiltX, 0, tiltZ);
        this._dummy.scale.set(1, 0.75 + this.weatherIntensity * 0.5, 1);
        this._dummy.updateMatrix();
        this._rainMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this._rainMesh.instanceMatrix.needsUpdate = true;

      // Ground & pond splash ripples
      this._splashMat.opacity = clamp(this.weatherIntensity * 0.36, 0.04, 0.38);
      for (let i = 0; i < this._splashes.length; i++) {
        const sp = this._splashes[i];
        sp.t += dt * sp.rate;
        if (sp.t >= 1.0) {
          sp.t = 0;
          sp.x = -13 + Math.random() * 26;
          sp.z = -9.5 + Math.random() * 22.5;
        }
        const gy = Math.max(this.getGroundHeight(sp.x, sp.z), this._layout.pond.waterY);
        const sc = 0.25 + sp.t * 2.4;
        this._dummy.position.set(sp.x, gy + 0.025, sp.z);
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.set(sc, 1, sc);
        this._dummy.updateMatrix();
        this._splashMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this._splashMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
