/**
 * भू-गोल · मेरु · ध्रुव · सप्त वायु-मार्ग — the armillary scaffold of Siddhānta-Yantra.
 *
 *  • Bhū-gola (सिद्धान्तशिरोमणि, भुवनकोश ४, ६): an unsupported sphere held by its own ākṛṣṭi-śakti.
 *    Its surface is shaded from the Pañcīkaraṇa material profiles of Pṛthvī and Āpas.
 *  • Meru-daṇḍa: the axis through Sumeru (north pole) and Vaḍavāmukha (south pole), pointing at
 *    Dhruva — the pole-star to which Parāvaha is bound.
 *  • Seven concentric Vāyu shells (महाभारत, शान्तिपर्व): each a rigidly rotating stratum about the
 *    Dhruva axis, rendered with its velocity vector field v⃗ = ω⃗ × x⃗.
 *  • Bhacakra: the star-wheel (27 nakṣatras, saptarṣi, ecliptic with 12 rāśis). In Siddhānta mode it
 *    is swept westward by Parāvaha; in Āryabhaṭa mode Bhū turns beneath a still bhacakra
 *    (आर्यभटीय, गोलपाद ९).
 */

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
  BHU_RADIUS,
  DHRUVA_RADIUS,
  NAKSHATRAS,
  NAKSHATRA_RADIUS,
  PARAMA_APAKRAMA_DEG,
  RASHI_NAMES,
  SAPTARSHI,
  Tattva,
  type GrahaId,
} from '../data/planetaryConstants';
import { getMaterialProfile } from '../math/pancikarana';
import { cosS, sinS, sphericalToCartesian } from '../math/suryaTrig';
import { DHRUVA_AXIS, VAYU_LAYERS, VAYU_LAYER_COUNT, type VayuLayer, type VayuState } from '../math/vayuDynamics';

const DEG = Math.PI / 180;

// ───────────────────────────── Shared helpers ─────────────────────────────

/** Tag attached to `object.userData.pick` on every clickable object of the scene. */
export type PickTag =
  | { kind: 'bhu' }
  | { kind: 'meru' }
  | { kind: 'dhruva' }
  | { kind: 'city'; name: string }
  | { kind: 'shell'; index: number }
  | { kind: 'nakshatra'; index: number }
  | { kind: 'saptarshi'; index: number }
  | { kind: 'ecliptic' }
  | { kind: 'graha'; id: GrahaId }
  | { kind: 'trail'; id: GrahaId }
  | { kind: 'epicycle'; id: GrahaId }
  | { kind: 'tether'; id: GrahaId };

/** Resolve the pick tag of a raycast hit (point clouds resolve their element index). */
export function resolvePick(hit: THREE.Intersection): PickTag | null {
  let o: THREE.Object3D | null = hit.object;
  while (o) {
    const tag = o.userData.pick as PickTag | undefined;
    if (tag) {
      if ((tag.kind === 'nakshatra' || tag.kind === 'saptarshi') && tag.index < 0) {
        return { kind: tag.kind, index: hit.index ?? 0 };
      }
      return tag;
    }
    o = o.parent;
  }
  return null;
}

/** Unit Dhruva axis ω̂_dhruva as a three.js vector. */
export const AXIS = new THREE.Vector3(DHRUVA_AXIS.x, DHRUVA_AXIS.y, DHRUVA_AXIS.z).normalize();
/** Rotation taking local +Y onto ω̂_dhruva — the equatorial frame. */
export const AXIS_QUATERNION = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), AXIS);

let glowTexture: THREE.CanvasTexture | null = null;

/** Soft radial glow sprite texture (shared). */
export function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.12, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.32)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.06)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/** A Devanagari scene label rendered by CSS2DRenderer. */
export function makeLabel(text: string, cls: string, sub?: string): CSS2DObject {
  const el = document.createElement('div');
  el.className = `lbl ${cls}`;
  el.textContent = text;
  if (sub) {
    const s = document.createElement('span');
    s.textContent = sub;
    el.appendChild(s);
  }
  const obj = new CSS2DObject(el);
  obj.userData.isLabel = true;
  return obj;
}

/** Deterministic PRNG (mulberry32) so the cosmos looks the same on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────────── Bhū-gola surface ─────────────────────────────

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const c000 = hash3(xi, yi, zi);
  const c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi);
  const c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1);
  const c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1);
  const c111 = hash3(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm3(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let k = 0; k < octaves; k++) {
    sum += amp * valueNoise(x, y, z);
    norm += amp;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 3.7;
    z = z * 2.03 + 11.3;
    amp *= 0.5;
  }
  return sum / norm;
}

/**
 * Equirectangular Bhū texture. Land takes the Pañcīkaraṇa profile colour of gross Pṛthvī
 * (golden ochre, पीत), the oceans are tinted by gross Āpas. Graticule: the Laṅkā equator,
 * the Laṅkā–Ujjayinī–Meru prime meridian, and the tropics at ±24° (parama-apakrama).
 */
function createBhuTexture(): THREE.CanvasTexture {
  const W = 768;
  const H = 384;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (!ctx) return tex;

  const land = getMaterialProfile(Tattva.Prthvi).color;
  const water = getMaterialProfile(Tattva.Apas).color;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let py = 0; py < H; py++) {
    const theta = ((py + 0.5) / H) * Math.PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let px = 0; px < W; px++) {
      const phi = ((px + 0.5) / W) * Math.PI * 2;
      // Same parametrisation as THREE.SphereGeometry so the texture is seamless.
      const dx = -Math.cos(phi) * st;
      const dy = ct;
      const dz = Math.sin(phi) * st;
      const h = fbm3(dx * 1.9 + 5.3, dy * 1.9 + 1.7, dz * 1.9 + 9.1, 5);
      const detail = fbm3(dx * 9 + 2.1, dy * 9 + 7.7, dz * 9 + 4.4, 3);
      const e = h - 0.53;
      let r: number;
      let g: number;
      let b: number;
      if (e > 0) {
        const shade = 0.62 + 2.2 * e + 0.35 * (detail - 0.5);
        const lowland = Math.max(0, 1 - e * 9);
        r = land[0] * shade * (1 - 0.45 * lowland) + 0.18 * lowland;
        g = land[1] * shade * (1 - 0.3 * lowland) + 0.3 * lowland;
        b = land[2] * shade * (1 - 0.3 * lowland) + 0.12 * lowland;
      } else {
        const depth = Math.min(1, -e * 5);
        r = 0.04 + (0.008 - 0.04) * depth;
        g = 0.18 + (0.05 - 0.18) * depth;
        b = 0.3 + (0.14 - 0.3) * depth;
        r = r * 0.8 + water[0] * 0.07;
        g = g * 0.8 + water[1] * 0.08;
        b = b * 0.8 + water[2] * 0.09;
      }
      const polar = Math.max(0, (Math.abs(dy) - 0.9) / 0.1);
      r += (0.95 - r) * polar;
      g += (0.9 - g) * polar;
      b += (0.78 - b) * polar;
      const k = (py * W + px) * 4;
      d[k] = Math.min(255, Math.max(0, r * 255));
      d[k + 1] = Math.min(255, Math.max(0, g * 255));
      d[k + 2] = Math.min(255, Math.max(0, b * 255));
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Graticule
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 236, 190, 0.16)';
  for (let k = 0; k < 12; k++) {
    const x = (k / 12) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (const lat of [-60, -30, 30, 60]) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255, 170, 90, 0.4)';
  for (const lat of [-PARAMA_APAKRAMA_DEG, PARAMA_APAKRAMA_DEG]) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Laṅkā equator
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 210, 120, 0.85)';
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  // Laṅkā–Ujjayinī prime meridian (u = 0.5 → local +X)
  ctx.strokeStyle = 'rgba(120, 220, 255, 0.75)';
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  tex.needsUpdate = true;
  return tex;
}

// ───────────────────────────── Vāyu shell shader ─────────────────────────────

const SHELL_VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vLocal = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SHELL_FRAG = /* glsl */ `
uniform vec3  uColor;
uniform float uOpacity;
uniform float uFade;
uniform float uHighlight;
uniform float uIndex;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 n = normalize(vLocal);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.z, n.x);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - abs(dot(normalize(vWorldNormal), V)), 2.6);
  // Stream-bands parallel to the Dhruva equator; dashes are frozen into the rotating stratum,
  // so the shell's own rotation (ω_i) carries them — the visible flow IS the angular velocity.
  float bands = pow(0.5 + 0.5 * cos(lat * (9.0 + uIndex * 1.5)), 5.0);
  float dash = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(lon * (14.0 + 3.0 * uIndex) + 1.6 * sin(lat * 6.0 + uIndex)));
  float streak = bands * dash;
  float polar = smoothstep(0.75, 1.0, abs(n.y));
  float shimmer = 0.85 + 0.15 * sin(uTime * 0.7 + uIndex * 1.3 + lat * 4.0);
  float a = (0.025 + 0.5 * fres + 0.55 * streak * (0.35 + fres)) * (1.0 - 0.6 * polar);
  a *= uOpacity * uFade * (1.0 + 1.8 * uHighlight) * shimmer;
  vec3 col = uColor * (0.55 + 0.9 * streak + 0.7 * fres + 0.6 * uHighlight);
  gl_FragColor = vec4(col, a);
}
`;

interface ShellView {
  readonly layer: VayuLayer;
  readonly pivot: THREE.Group;
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly field: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  /** Base point p and unit eastward tangent t for each vector-field arrow. */
  readonly base: Float32Array;
  readonly tangent: Float32Array;
  readonly radius: number;
  lastRate: number;
}

// ───────────────────────────── CelestialSphere ─────────────────────────────

export interface CelestialUpdate {
  readonly time: number;
  readonly vayu: VayuState;
  /** Naimittika deluge level 0…1. */
  readonly flood: number;
}

const CITIES: readonly { name: string; lonDeg: number; color: number }[] = [
  { name: 'लङ्का', lonDeg: 0, color: 0xffd27a },
  { name: 'यवकोटि', lonDeg: 90, color: 0x9fe6ff },
  { name: 'सिद्धपुर', lonDeg: 180, color: 0x9fe6ff },
  { name: 'रोमक', lonDeg: 270, color: 0x9fe6ff },
];

export class CelestialSphere {
  /** Add to the scene. */
  readonly root = new THREE.Group();
  /** Fade container for Bhū-gola (melts first in Prākṛtika laya). */
  readonly bhuContainer = new THREE.Group();
  /** Fade container for everything else that is manifest. */
  readonly cosmos = new THREE.Group();
  /** Star-wheel, ecliptic frame; rotates about ω̂_dhruva with Parāvaha. Grahas live here. */
  readonly bhacakra = new THREE.Group();
  /** Dhruva position (identical in world and bhacakra frames — it lies on the axis). */
  readonly dhruvaPosition = AXIS.clone().multiplyScalar(DHRUVA_RADIUS);
  readonly pickables: THREE.Object3D[] = [];

  private readonly bhuSpin = new THREE.Group();
  private readonly bhuMaterial: THREE.MeshStandardMaterial;
  private readonly bhuBaseColor = new THREE.Color(0xffffff);
  private readonly floodColor = new THREE.Color(0x5fb8ff);
  private readonly shellGroup = new THREE.Group();
  private readonly shells: ShellView[] = [];
  private readonly starGroup = new THREE.Group();
  private readonly vortex = new THREE.Group();
  private readonly dhruvaGlow: THREE.Sprite;
  private readonly dhruvaHalo: THREE.Sprite;
  private readonly labels: CSS2DObject[] = [];
  private shellsOn = true;
  private fieldOn = true;
  private highlightShell = -1;

  constructor() {
    this.root.name = 'CelestialSphere';
    this.root.add(this.bhuContainer, this.cosmos);

    // ── Bhū-gola (equatorial frame → diurnal spin) ──
    const bhuFrame = new THREE.Group();
    bhuFrame.quaternion.copy(AXIS_QUATERNION);
    bhuFrame.add(this.bhuSpin);
    this.bhuContainer.add(bhuFrame);

    this.bhuMaterial = new THREE.MeshStandardMaterial({
      map: createBhuTexture(),
      roughness: 0.82,
      metalness: 0.0,
      emissive: new THREE.Color(0x0b1424),
      emissiveIntensity: 0.9,
    });
    const bhu = new THREE.Mesh(new THREE.SphereGeometry(BHU_RADIUS, 96, 64), this.bhuMaterial);
    bhu.name = 'Bhu-gola';
    bhu.userData.pick = { kind: 'bhu' } satisfies PickTag;
    this.bhuSpin.add(bhu);
    this.pickables.push(bhu);

    // Sumeru — the golden peak at the north pole; Vaḍavāmukha — submarine fire at the south pole.
    const meruMat = new THREE.MeshStandardMaterial({ color: 0xffcf6a, emissive: 0x7a4a00, emissiveIntensity: 1.2, roughness: 0.35, metalness: 0.6 });
    const meru = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 32), meruMat);
    meru.position.y = BHU_RADIUS + 0.08;
    meru.userData.pick = { kind: 'meru' } satisfies PickTag;
    this.bhuSpin.add(meru);
    this.pickables.push(meru);
    const vadava = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff6a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }),
    );
    vadava.scale.setScalar(0.35);
    vadava.position.y = -BHU_RADIUS - 0.02;
    this.bhuSpin.add(vadava);

    // The four cities of the Laṅkā equator (SS 12.38–40).
    for (const c of CITIES) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(c.lonDeg === 0 ? 0.03 : 0.022, 12, 8),
        new THREE.MeshBasicMaterial({ color: c.color, transparent: true }),
      );
      m.position.set(cosS(c.lonDeg) * BHU_RADIUS * 1.003, 0, -sinS(c.lonDeg) * BHU_RADIUS * 1.003);
      m.userData.pick = { kind: 'city', name: c.name } satisfies PickTag;
      this.bhuSpin.add(m);
      this.pickables.push(m);
    }

    // ── Meru-daṇḍa: axis through the poles to Dhruva ──
    const axisFrame = new THREE.Group();
    axisFrame.quaternion.copy(AXIS_QUATERNION);
    this.cosmos.add(axisFrame);
    const axisLen = DHRUVA_RADIUS * 2;
    const axisCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, axisLen, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const axisGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, axisLen, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const axisPick = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, axisLen, 6, 1, true), new THREE.MeshBasicMaterial({ visible: false }));
    axisPick.userData.pick = { kind: 'meru' } satisfies PickTag;
    axisFrame.add(axisCore, axisGlow, axisPick);
    this.pickables.push(axisPick);

    // Viṣuvad-vṛtta — celestial equator.
    axisFrame.add(this.ring(NAKSHATRA_RADIUS - 1.4, 0x6fd8ff, 0.22, 256));

    // ── Dhruva ──
    const dhruvaCore = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true }));
    dhruvaCore.position.copy(this.dhruvaPosition);
    dhruvaCore.userData.pick = { kind: 'dhruva' } satisfies PickTag;
    this.dhruvaGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xa8dcff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    this.dhruvaGlow.scale.setScalar(4.2);
    this.dhruvaGlow.position.copy(this.dhruvaPosition);
    this.dhruvaHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff9fe0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }),
    );
    this.dhruvaHalo.scale.setScalar(11);
    this.dhruvaHalo.position.copy(this.dhruvaPosition);
    const dhruvaPick = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    dhruvaPick.position.copy(this.dhruvaPosition);
    dhruvaPick.userData.pick = { kind: 'dhruva' } satisfies PickTag;
    this.cosmos.add(dhruvaCore, this.dhruvaGlow, this.dhruvaHalo, dhruvaPick);
    this.pickables.push(dhruvaCore, dhruvaPick);
    const dl = makeLabel('ध्रुव', 'lbl-dhruva', 'Dhruva');
    dl.position.copy(this.dhruvaPosition).addScaledVector(AXIS, 1.4);
    this.cosmos.add(dl);
    this.labels.push(dl);

    // Parāvaha vortex — the great whirl bound to Dhruva.
    this.vortex.position.y = DHRUVA_RADIUS - 0.35;
    this.vortex.add(this.buildVortex());
    axisFrame.add(this.vortex);

    // ── Seven Vāyu shells ──
    const shellFrame = new THREE.Group();
    shellFrame.quaternion.copy(AXIS_QUATERNION);
    shellFrame.add(this.shellGroup);
    this.cosmos.add(shellFrame);
    VAYU_LAYERS.forEach((layer, i) => this.shells.push(this.buildShell(layer, i)));

    // ── Bhacakra ──
    this.cosmos.add(this.bhacakra);
    this.bhacakra.add(this.starGroup);
    this.buildStars();
    this.buildEcliptic();
  }

  // ───────────────────────────── builders ─────────────────────────────

  private ring(radius: number, color: number, opacity: number, segments: number): THREE.LineLoop {
    const pts: number[] = [];
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * 360;
      pts.push(cosS(a) * radius, 0, -sinS(a) * radius);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineLoop(
      geo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
  }

  private buildVortex(): THREE.LineSegments {
    const arms = 4;
    const steps = 140;
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color(0xff8fd0);
    const c2 = new THREE.Color(0x9fd8ff);
    for (let a = 0; a < arms; a++) {
      for (let k = 0; k < steps; k++) {
        for (const kk of [k, k + 1]) {
          const t = kk / steps;
          const ang = (a / arms) * 360 + t * 540;
          const r = 0.4 + t * 3.6;
          pos.push(cosS(ang) * r, -t * 0.6, -sinS(ang) * r);
          const m = c.clone().lerp(c2, t).multiplyScalar(1 - t * 0.85);
          col.push(m.r, m.g, m.b);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
  }

  private buildShell(layer: VayuLayer, i: number): ShellView {
    const pivot = new THREE.Group();
    pivot.name = `Vayu-${layer.nameIAST}`;
    this.shellGroup.add(pivot);
    const color = new THREE.Color(layer.color);
    const material = new THREE.ShaderMaterial({
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_FRAG,
      uniforms: {
        uColor: { value: color },
        uOpacity: { value: 0.55 - i * 0.035 },
        uFade: { value: 1 },
        uHighlight: { value: 0 },
        uIndex: { value: i },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(layer.outer, 72, 36), material);
    mesh.userData.pick = { kind: 'shell', index: i } satisfies PickTag;
    mesh.renderOrder = 2;
    pivot.add(mesh);
    this.pickables.push(mesh);

    // Velocity vector field v⃗ = ω⃗ × x⃗ sampled on the mid-surface of the stratum.
    const radius = 0.5 * (layer.inner + layer.outer);
    const lats = i < 2 ? [-40, 0, 40] : [-52, -26, 0, 26, 52];
    const nLon = 12 + i * 3;
    const n = lats.length * nLon;
    const base = new Float32Array(n * 3);
    const tangent = new Float32Array(n * 3);
    const colors = new Float32Array(n * 6);
    let k = 0;
    for (const lat of lats) {
      for (let j = 0; j < nLon; j++) {
        const lon = (j / nLon) * 360 + (lat / 26) * 7;
        const cl = cosS(lat);
        base[k * 3] = radius * cl * cosS(lon);
        base[k * 3 + 1] = radius * sinS(lat);
        base[k * 3 + 2] = -radius * cl * sinS(lon);
        // ŷ × p̂ (eastward, anuloma)
        tangent[k * 3] = -sinS(lon);
        tangent[k * 3 + 1] = 0;
        tangent[k * 3 + 2] = -cosS(lon);
        colors.set([color.r * 0.08, color.g * 0.08, color.b * 0.08, color.r * 1.2, color.g * 1.2, color.b * 1.2], k * 6);
        k++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const field = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    field.frustumCulled = false;
    pivot.add(field);
    const view: ShellView = { layer, pivot, mesh, field, base, tangent, radius, lastRate: Number.NaN };
    this.writeField(view, 0);
    return view;
  }

  private writeField(v: ShellView, rate: number): void {
    const attr = v.field.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const n = v.base.length / 3;
    const len = Math.sign(rate) * v.radius * 0.17 * Math.tanh(Math.abs(rate) / 14);
    for (let k = 0; k < n; k++) {
      const bx = v.base[k * 3];
      const by = v.base[k * 3 + 1];
      const bz = v.base[k * 3 + 2];
      const tx = v.tangent[k * 3] * len * 0.5;
      const tz = v.tangent[k * 3 + 2] * len * 0.5;
      arr[k * 6] = bx - tx;
      arr[k * 6 + 1] = by;
      arr[k * 6 + 2] = bz - tz;
      arr[k * 6 + 3] = bx + tx;
      arr[k * 6 + 4] = by;
      arr[k * 6 + 5] = bz + tz;
    }
    attr.needsUpdate = true;
    v.lastRate = rate;
  }

  private buildStars(): void {
    const glow = getGlowTexture();
    // 27 nakṣatra yoga-tārās at their dhruvaka / vikṣepa (SS 8.2–9).
    const nPos = new Float32Array(NAKSHATRAS.length * 3);
    const nCol = new Float32Array(NAKSHATRAS.length * 3);
    const warm = new THREE.Color(0xfff1d6);
    const cool = new THREE.Color(0xcfe3ff);
    NAKSHATRAS.forEach((n, i) => {
      const p = sphericalToCartesian(n.dhruvakaDeg, n.vikshepaDeg, NAKSHATRA_RADIUS);
      nPos.set([p.x, p.y, p.z], i * 3);
      const c = warm.clone().lerp(cool, (i % 5) / 4);
      nCol.set([c.r, c.g, c.b], i * 3);
      const lbl = makeLabel(n.nameDevanagari, 'lbl-nak');
      lbl.position.set(p.x * 1.045, p.y * 1.045 + 0.35, p.z * 1.045);
      this.starGroup.add(lbl);
      this.labels.push(lbl);
    });
    const nGeo = new THREE.BufferGeometry();
    nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
    nGeo.setAttribute('color', new THREE.BufferAttribute(nCol, 3));
    const nak = new THREE.Points(
      nGeo,
      new THREE.PointsMaterial({ size: 1.25, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    );
    nak.userData.pick = { kind: 'nakshatra', index: -1 } satisfies PickTag;
    this.starGroup.add(nak);
    this.pickables.push(nak);

    // Saptarṣi (equatorial RA/Dec → ecliptic scene frame, ε = parama-apakrama).
    const eps = PARAMA_APAKRAMA_DEG;
    const sPos = new Float32Array(SAPTARSHI.length * 3);
    const sVec: THREE.Vector3[] = [];
    SAPTARSHI.forEach((s, i) => {
      const ra = s.raHours * 15;
      const cd = cosS(s.decDeg);
      const ex = cd * cosS(ra);
      const ey = cd * sinS(ra);
      const ez = sinS(s.decDeg);
      // rotate equatorial → ecliptic about the equinox line
      const ly = ey * cosS(eps) + ez * sinS(eps);
      const lz = -ey * sinS(eps) + ez * cosS(eps);
      const r = NAKSHATRA_RADIUS + 0.8;
      const v = new THREE.Vector3(ex * r, lz * r, -ly * r);
      sVec.push(v);
      sPos.set([v.x, v.y, v.z], i * 3);
    });
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const sap = new THREE.Points(
      sGeo,
      new THREE.PointsMaterial({ size: 1.0, map: glow, color: 0xbfe6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sap.userData.pick = { kind: 'saptarshi', index: -1 } satisfies PickTag;
    this.starGroup.add(sap);
    this.pickables.push(sap);
    const edges = [0, 1, 1, 2, 2, 3, 3, 0, 3, 4, 4, 5, 5, 6];
    const lPos: number[] = [];
    for (const e of edges) lPos.push(sVec[e].x, sVec[e].y, sVec[e].z);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
    this.starGroup.add(
      new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })),
    );
    const sl = makeLabel('सप्तर्षि', 'lbl-nak', 'Saptarṣi');
    sl.position.copy(sVec[3]).multiplyScalar(1.06);
    this.starGroup.add(sl);
    this.labels.push(sl);

    // Faint stellar dust of the Parivaha stratum.
    const rand = mulberry32(27108);
    const N = 1800;
    const dPos = new Float32Array(N * 3);
    const dCol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const rho = Math.sqrt(1 - u * u);
      const r = 20.6 + rand() * 3.6;
      dPos.set([rho * Math.cos(th) * r, u * r, rho * Math.sin(th) * r], i * 3);
      const b = 0.25 + rand() * 0.6;
      const tint = rand();
      dCol.set([b * (0.85 + 0.15 * tint), b * 0.9, b * (1.0 - 0.15 * tint)], i * 3);
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
    this.starGroup.add(
      new THREE.Points(
        dGeo,
        new THREE.PointsMaterial({ size: 0.22, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      ),
    );
  }

  private buildEcliptic(): void {
    const R = NAKSHATRA_RADIUS - 1.4;
    const ring = this.ring(R, 0xffc46b, 0.4, 360);
    ring.userData.pick = { kind: 'ecliptic' } satisfies PickTag;
    this.bhacakra.add(ring);
    this.pickables.push(ring);
    const pos: number[] = [];
    // 12 rāśi boundaries (long) and 27 nakṣatra divisions of 13°20′ (short).
    for (let k = 0; k < 12; k++) {
      const a = k * 30;
      pos.push(cosS(a) * (R - 0.55), 0, -sinS(a) * (R - 0.55), cosS(a) * (R + 0.55), 0, -sinS(a) * (R + 0.55));
      const lbl = makeLabel(RASHI_NAMES[k], 'lbl-rashi');
      lbl.position.set(cosS(a + 15) * (R + 1.1), 0, -sinS(a + 15) * (R + 1.1));
      this.bhacakra.add(lbl);
      this.labels.push(lbl);
    }
    for (let k = 0; k < 27; k++) {
      const a = (k * 40) / 3;
      pos.push(cosS(a) * (R - 0.2), 0, -sinS(a) * (R - 0.2), cosS(a) * (R + 0.2), 0, -sinS(a) * (R + 0.2));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.bhacakra.add(
      new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })),
    );
  }

  // ───────────────────────────── controls ─────────────────────────────

  setShellsVisible(on: boolean): void {
    this.shellsOn = on;
    for (const s of this.shells) s.mesh.visible = on;
  }

  setVectorFieldVisible(on: boolean): void {
    this.fieldOn = on;
    for (const s of this.shells) s.field.visible = on;
  }

  setStarsVisible(on: boolean): void {
    this.starGroup.visible = on;
  }

  setLabelsVisible(on: boolean): void {
    for (const l of this.labels) l.visible = on;
  }

  /** Emphasise one Vāyu shell (e.g. the one being inspected); −1 clears. */
  setHighlightShell(index: number): void {
    this.highlightShell = index;
  }

  get shellsVisible(): boolean {
    return this.shellsOn;
  }

  get vectorFieldVisible(): boolean {
    return this.fieldOn;
  }

  // ───────────────────────────── frame ─────────────────────────────

  update(u: CelestialUpdate): void {
    const v = u.vayu;
    this.bhuSpin.rotation.y = v.bhuAngle * DEG;
    this.bhacakra.quaternion.setFromAxisAngle(AXIS, v.bhacakraAngle * DEG);
    this.vortex.rotation.y = v.layerAngles[VAYU_LAYER_COUNT - 1] * DEG;

    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      s.pivot.rotation.y = v.layerAngles[i] * DEG;
      const uni = s.mesh.material.uniforms;
      uni.uTime.value = u.time;
      const target = this.highlightShell === i ? 1 : 0;
      uni.uHighlight.value += (target - uni.uHighlight.value) * 0.12;
      const rate = v.layerRates[i];
      if (Math.abs(rate - s.lastRate) > 1e-3 || Number.isNaN(s.lastRate)) this.writeField(s, rate);
    }

    // Dhruva breathes.
    const pulse = 1 + 0.08 * Math.sin(u.time * 2.1);
    this.dhruvaGlow.scale.setScalar(4.2 * pulse);
    this.dhruvaHalo.scale.setScalar(11 * (1 + 0.05 * Math.sin(u.time * 0.9)));

    // Naimittika deluge tints Bhū.
    const f = Math.min(Math.max(u.flood, 0), 1);
    this.bhuMaterial.color.copy(this.bhuBaseColor).lerp(this.floodColor, f * 0.75);
    this.bhuMaterial.emissive.setRGB(0.043 + 0.08 * f, 0.08 + 0.2 * f, 0.14 + 0.3 * f);
  }
}
