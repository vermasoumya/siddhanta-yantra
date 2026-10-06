/**
 * सप्त वायु-मार्ग — The seven concentric Vāyu strata as rotating velocity fields.
 *
 * Source: महाभारत, शान्तिपर्व (मोक्षधर्मपर्व) एवं हरिवंश
 *
 *   महारूपो महाघोरः परावह इहोच्यते।
 *   येन चक्रं समाविद्धं ध्रुवस्यैतन्नभस्तले॥
 *
 * Each Vāyu-mārga i occupies a spherical shell r_i,in ≤ |x⃗| < r_i,out around Bhū and rotates
 * rigidly about the Dhruva axis ω̂_dhruva:
 *
 *   v⃗_i(x⃗)  = ω⃗_i × x⃗
 *   ω⃗_i     = ω̂_dhruva · (Ω_i,intrinsic − δ_mode · ω_diurnal)
 *   a⃗_drag  = k_i · (v⃗_i − v⃗_particle)
 *
 * Relativity of diurnal motion (आर्यभटीय, गोलपाद ९ — अनुलोमगतिर्नौस्थः …):
 *   • Āryabhaṭa mode  (δ = 0): Bhū spins eastward at ω_d; the bhacakra is at rest.
 *   • Siddhānta mode  (δ = 1): Bhū is still; Pravaha/Parāvaha sweep the bhacakra westward at ω_d.
 * Āvaha — the surface atmosphere — always co-rotates with Bhū. The rotation observed from Bhū,
 * ω_i − ω_bhū, is therefore identical in both frames: exactly the boatman's illusion of the verse.
 *
 * Angular rates are in degrees per civil (sāvana) day; positive = anuloma (eastward,
 * counter-clockwise seen from the north), negative = viloma (westward).
 */

import {
  GRAHAS,
  GRAHA_BY_ID,
  PARAMA_APAKRAMA_DEG,
  SIDEREAL_ROTATIONS_PER_CIVIL_DAY,
  VAYU_SHELL_RADII,
  type GrahaId,
} from '../data/planetaryConstants';
import { VAYU_DESCRIPTIONS } from '../data/shlokas';
import { meanDailyMotion } from './epicycleEngine';
import { normalizeDeg, sphericalToCartesian, type Vec3Like } from './suryaTrig';

// ───────────────────────────── Frame ─────────────────────────────

export type DiurnalMode = 'aryabhata' | 'siddhanta';

/** ω_d — one nākṣatra (sidereal) rotation per sidereal day, expressed per civil day (≈ 360.9856°). */
export const DIURNAL_RATE_DEG_PER_DAY = 360 * SIDEREAL_ROTATIONS_PER_CIVIL_DAY;

const DEG2RAD = Math.PI / 180;

function normalize3(v: Vec3Like): Vec3Like {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/**
 * ω̂_dhruva — direction of Dhruva (the celestial north pole) in the ecliptic scene frame.
 * The pole lies at polar longitude 90° and latitude 90° − parama-apakrama (24°, SS 2.28).
 */
export const DHRUVA_AXIS: Readonly<Vec3Like> = Object.freeze(normalize3(sphericalToCartesian(90, 90 - PARAMA_APAKRAMA_DEG, 1)));

// ───────────────────────────── Layers ─────────────────────────────

export interface VayuLayer {
  /** 1 … 7 (Āvaha … Parāvaha). */
  readonly index: number;
  readonly nameDevanagari: string;
  readonly nameIAST: string;
  readonly hindi: string;
  readonly english: string;
  readonly inner: number;
  readonly outer: number;
  /** Ω_i — intrinsic (anuloma) angular rate of the stratum, °/day. */
  readonly intrinsicDegPerDay: number;
  /** True for Āvaha: the surface atmosphere turns with Bhū. */
  readonly coRotatesWithBhu: boolean;
  /** k_i — drag (coupling) coefficient of the stratum, 1/day. */
  readonly drag: number;
  /** Display colour (hex). */
  readonly color: number;
  /** Grahas carried by this stratum. */
  readonly grahas: readonly GrahaId[];
}

function meanMotion(id: GrahaId): number {
  return meanDailyMotion(GRAHA_BY_ID[id].meanRevolutions, 'mahayuga');
}

/** Vivaha carries the five tārā-grahas; its intrinsic rate is the mean of their madhyama-gatis. */
const VIVAHA_GRAHAS: readonly GrahaId[] = ['budha', 'shukra', 'mangala', 'guru', 'shani'];
const VIVAHA_RATE = VIVAHA_GRAHAS.reduce((s, id) => s + meanMotion(id), 0) / VIVAHA_GRAHAS.length;

const LAYER_DYNAMICS: readonly { omega: number; coRot: boolean; drag: number; color: number }[] = [
  { omega: 0, coRot: true, drag: 0.6, color: 0x7cc7ff }, // आवह — clouds & rain, turns with Bhū
  { omega: 0, coRot: false, drag: 1.2, color: 0x9fe6ff }, // प्रवह — the diurnal carrier, upper gales
  { omega: meanMotion('chandra'), coRot: false, drag: 0.9, color: 0xc9d6ff }, // उद्वह — Candra, tides
  { omega: meanMotion('surya'), coRot: false, drag: 0.9, color: 0xffc46b }, // संवह — Sūrya, annual motion
  { omega: VIVAHA_RATE, coRot: false, drag: 0.8, color: 0xb98cff }, // विवह — five star-planets
  { omega: 0, coRot: false, drag: 1.0, color: 0x6fe0c8 }, // परिवह — saptarṣi & 27 nakṣatras (fixed)
  { omega: 0, coRot: false, drag: 1.6, color: 0xff8fd0 }, // परावह — Dhruva vortex (mahāghora)
];

export const VAYU_LAYERS: readonly VayuLayer[] = Object.freeze(
  VAYU_DESCRIPTIONS.map((d, i) => {
    const dyn = LAYER_DYNAMICS[i];
    return Object.freeze({
      index: d.index,
      nameDevanagari: d.nameDevanagari,
      nameIAST: d.nameIAST,
      hindi: d.hindi,
      english: d.english,
      inner: VAYU_SHELL_RADII[i].inner,
      outer: VAYU_SHELL_RADII[i].outer,
      intrinsicDegPerDay: dyn.omega,
      coRotatesWithBhu: dyn.coRot,
      drag: dyn.drag,
      color: dyn.color,
      grahas: Object.freeze(GRAHAS.filter((g) => g.vayuLayer === d.index).map((g) => g.id)),
    });
  }),
);

export const VAYU_LAYER_COUNT = VAYU_LAYERS.length;

/** Zero-based index of the stratum containing radius r, or −1 inside Bhū / beyond Parāvaha. */
export function layerIndexAt(r: number): number {
  for (let i = 0; i < VAYU_LAYER_COUNT; i++) {
    const l = VAYU_LAYERS[i];
    if (r >= l.inner && r < l.outer) return i;
  }
  return -1;
}

/** Layer carrying a given graha (zero-based). */
export function layerIndexOfGraha(id: GrahaId): number {
  return GRAHA_BY_ID[id].vayuLayer - 1;
}

// ───────────────────────────── Angular velocities ─────────────────────────────

/** δ_mode: 1 when the winds carry the bhacakra (Siddhānta), 0 when Bhū itself turns (Āryabhaṭa). */
export function deltaMode(mode: DiurnalMode): number {
  return mode === 'siddhanta' ? 1 : 0;
}

/** ω_bhū — rotation of Bhū-gola itself (°/day). */
export function bhuAngularVelocity(mode: DiurnalMode, diurnal = DIURNAL_RATE_DEG_PER_DAY): number {
  return (1 - deltaMode(mode)) * diurnal;
}

/**
 * ω_i — the inertial angular velocity of stratum i (°/day), the scalar along ω̂_dhruva.
 * `intrinsic` and `diurnal` may be substituted with display-compressed rates (see VayuState).
 */
export function layerAngularVelocity(
  layer: VayuLayer,
  mode: DiurnalMode,
  diurnal = DIURNAL_RATE_DEG_PER_DAY,
  intrinsic = layer.intrinsicDegPerDay,
): number {
  if (layer.coRotatesWithBhu) return intrinsic + bhuAngularVelocity(mode, diurnal);
  return intrinsic - deltaMode(mode) * diurnal;
}

/** Rotation of stratum i as observed from Bhū (ω_i − ω_bhū) — frame independent. */
export function observedAngularVelocity(layer: VayuLayer, diurnal = DIURNAL_RATE_DEG_PER_DAY): number {
  return layerAngularVelocity(layer, 'siddhanta', diurnal) - bhuAngularVelocity('siddhanta', diurnal);
}

// ───────────────────────────── Vector fields ─────────────────────────────

/** out = (ω̂ · ω_rad) × x */
function omegaCross(omegaDegPerDay: number, x: Vec3Like, out: Vec3Like): Vec3Like {
  const w = omegaDegPerDay * DEG2RAD;
  const a = DHRUVA_AXIS;
  const ox = a.x * w;
  const oy = a.y * w;
  const oz = a.z * w;
  const vx = oy * x.z - oz * x.y;
  const vy = oz * x.x - ox * x.z;
  const vz = ox * x.y - oy * x.x;
  out.x = vx;
  out.y = vy;
  out.z = vz;
  return out;
}

/** v⃗_i(x⃗) = ω⃗_i × x⃗ in scene units per day; zero outside the seven strata. */
export function windVelocity(x: Vec3Like, mode: DiurnalMode, out: Vec3Like = { x: 0, y: 0, z: 0 }): Vec3Like {
  const i = layerIndexAt(Math.hypot(x.x, x.y, x.z));
  if (i < 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  return omegaCross(layerAngularVelocity(VAYU_LAYERS[i], mode), x, out);
}

/**
 * Wind velocity measured in a frame that itself rotates about ω̂_dhruva at `frameOmega` (°/day),
 * e.g. the bhacakra. Uses the supplied per-layer rates (inertial, °/day or display units).
 */
export function windVelocityInFrame(
  x: Vec3Like,
  layerRates: ArrayLike<number>,
  frameOmega: number,
  out: Vec3Like = { x: 0, y: 0, z: 0 },
): Vec3Like {
  const i = layerIndexAt(Math.hypot(x.x, x.y, x.z));
  if (i < 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  return omegaCross(layerRates[i] - frameOmega, x, out);
}

/** a⃗_drag = k_i (v⃗_i − v⃗_particle) — the hydrodynamic coupling of a body to its stratum. */
export function dragAcceleration(
  x: Vec3Like,
  vParticle: Vec3Like,
  mode: DiurnalMode,
  out: Vec3Like = { x: 0, y: 0, z: 0 },
): Vec3Like {
  const i = layerIndexAt(Math.hypot(x.x, x.y, x.z));
  if (i < 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  const v = windVelocity(x, mode, out);
  const k = VAYU_LAYERS[i].drag;
  out.x = k * (v.x - vParticle.x);
  out.y = k * (v.y - vParticle.y);
  out.z = k * (v.z - vParticle.z);
  return out;
}

/**
 * आकृष्टि-शक्ति (Siddhānta Śiromaṇi, Bhuvanakośa 6): F⃗ = −G_s · M_bhū / r² · r̂ — purely radial.
 * Returned per unit mass, with G_s · M_bhū = 1 at the Bhū surface (r = 1).
 */
export function akrshtiAcceleration(x: Vec3Like, gm = 1, out: Vec3Like = { x: 0, y: 0, z: 0 }): Vec3Like {
  const r = Math.hypot(x.x, x.y, x.z);
  if (r < 1e-9) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  const s = -gm / (r * r * r);
  out.x = x.x * s;
  out.y = x.y * s;
  out.z = x.z * s;
  return out;
}

// ───────────────────────────── Display integration ─────────────────────────────

/**
 * Monotone, sign-preserving compression of an angular rate for display: c·tanh(x/c).
 * Real rates span 0.03°/day (Śani) to 361°/day (diurnal); compressing the intrinsic and diurnal
 * components separately keeps the frame-independence of ω_i − ω_bhū intact on screen.
 */
export function compressRate(degPerSecond: number, cap: number): number {
  return cap * Math.tanh(degPerSecond / cap);
}

export const DISPLAY_INTRINSIC_CAP_DEG_PER_SEC = 70;
export const DISPLAY_DIURNAL_CAP_DEG_PER_SEC = 18;

/**
 * Integrates the visual rotation angle of every stratum, of Bhū, and of the bhacakra (carried by
 * Parāvaha) for a simulation clock running at `daysPerSecond`.
 */
export class VayuState {
  /** Accumulated rotation of each stratum about ω̂_dhruva (degrees). */
  readonly layerAngles = new Float64Array(VAYU_LAYER_COUNT);
  /** Current display angular rate of each stratum (°/s). */
  readonly layerRates = new Float64Array(VAYU_LAYER_COUNT);
  bhuAngle = 0;
  bhuRate = 0;
  /** The star-wheel is borne by Parāvaha. */
  bhacakraAngle = 0;
  bhacakraRate = 0;
  /** Display diurnal rate (°/s), before δ_mode is applied. */
  diurnalRate = 0;

  step(dtSeconds: number, daysPerSecond: number, mode: DiurnalMode): void {
    const diurnal = compressRate(DIURNAL_RATE_DEG_PER_DAY * daysPerSecond, DISPLAY_DIURNAL_CAP_DEG_PER_SEC);
    this.diurnalRate = diurnal;
    for (let i = 0; i < VAYU_LAYER_COUNT; i++) {
      const layer = VAYU_LAYERS[i];
      const intrinsic = compressRate(layer.intrinsicDegPerDay * daysPerSecond, DISPLAY_INTRINSIC_CAP_DEG_PER_SEC);
      const rate = layerAngularVelocity(layer, mode, diurnal, intrinsic);
      this.layerRates[i] = rate;
      this.layerAngles[i] = normalizeDeg(this.layerAngles[i] + rate * dtSeconds);
    }
    this.bhuRate = bhuAngularVelocity(mode, diurnal);
    this.bhuAngle = normalizeDeg(this.bhuAngle + this.bhuRate * dtSeconds);
    this.bhacakraRate = this.layerRates[VAYU_LAYER_COUNT - 1];
    this.bhacakraAngle = this.layerAngles[VAYU_LAYER_COUNT - 1];
  }
}

// ───────────────────────────── Inspector text ─────────────────────────────

function fmt(v: number, digits = 4): string {
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(digits);
}

/** Live formula lines for a stratum (zero-based index). */
export function vayuFormula(layerIndex: number, mode: DiurnalMode): string[] {
  const l = VAYU_LAYERS[layerIndex];
  const w = layerAngularVelocity(l, mode);
  const obs = observedAngularVelocity(l);
  const rMid = 0.5 * (l.inner + l.outer);
  const speed = Math.abs(w) * DEG2RAD * rMid;
  const modeLabel = mode === 'siddhanta' ? 'सिद्धान्त (δ = 1)' : 'आर्यभट (δ = 0)';
  return [
    `${l.nameDevanagari} (${l.nameIAST}) · ${l.inner.toFixed(2)} ≤ |x| < ${l.outer.toFixed(2)}`,
    l.coRotatesWithBhu
      ? `ω = ω_bhū = (1 − δ)·ω_d = ${fmt(w, 4)}°/day   [${modeLabel}]`
      : `ω = Ω − δ·ω_d = ${fmt(l.intrinsicDegPerDay, 4)} − ${deltaMode(mode)}·${DIURNAL_RATE_DEG_PER_DAY.toFixed(4)} = ${fmt(w, 4)}°/day`,
    `|v⃗| = |ω⃗ × x⃗| at r = ${rMid.toFixed(2)} → ${speed.toFixed(3)} units/day`,
    `seen from Bhū: ω − ω_bhū = ${fmt(obs, 4)}°/day (identical in both frames)`,
    `a⃗_drag = ${l.drag.toFixed(2)} · (v⃗_wind − v⃗_body)`,
  ];
}
