/**
 * सूर्यसिद्धान्त ज्या-सारणी — Sūrya-Siddhānta trigonometry.
 *
 * The 24 tabular R-sines (jyā-piṇḍa) at intervals of 3°45′ (225′) for a circle of radius
 * R = 3438′ (SS 2.15–22). Intermediate values are obtained with Brahmagupta's second-order
 * difference interpolation (Khaṇḍakhādyaka 9.8):
 *
 *   jyā(θ) = J_i + f·(Δ_gata + Δ_bhogya)/2 + f²·(Δ_bhogya − Δ_gata)/2
 *
 * where f is the fraction of the current 225′ step, Δ_gata = J_i − J_{i−1} (the difference just
 * passed) and Δ_bhogya = J_{i+1} − J_i (the difference to be traversed).
 *
 * No planetary computation in this engine calls Math.sin / Math.cos / Math.asin; all of them pass
 * through jya(), kojya(), arcJya() and capa() defined here.
 */

import { JYA_RADIUS } from '../data/planetaryConstants';

export const R = JYA_RADIUS;
/** One tabular step = 3°45′ = 225′. */
export const JYA_STEP_DEG = 3.75;
export const JYA_STEPS = 24;

/** Tabular R-sines J_0 … J_24 (J_0 = 0 added for convenience), SS 2.15–22. */
export const JYA_TABLE: readonly number[] = Object.freeze([
  0, 225, 449, 671, 890, 1105, 1315, 1520, 1719, 1910, 2093, 2267, 2431, 2585, 2728, 2859, 2978, 3084, 3177,
  3256, 3321, 3372, 3409, 3431, 3438,
]);

/** Khaṇḍa-jyā (first tabular differences) — Δ_k = J_k − J_{k−1}, k = 1…24. */
export const KHANDA_JYA: readonly number[] = Object.freeze(
  JYA_TABLE.slice(1).map((v, k) => v - JYA_TABLE[k]),
);

/**
 * Extended tabular access with the natural symmetries of the R-sine:
 * J(−k) = −J(k) and J(24 + k) = J(24 − k).
 */
function tabular(k: number): number {
  if (k < 0) return -JYA_TABLE[-k];
  if (k > JYA_STEPS) return JYA_TABLE[2 * JYA_STEPS - k];
  return JYA_TABLE[k];
}

/** Second-order interpolated R-sine for θ ∈ [0°, 90°]. */
function jyaQuadrant(deg: number): number {
  const u = Math.min(Math.max(deg / JYA_STEP_DEG, 0), JYA_STEPS);
  let i = Math.floor(u);
  if (i >= JYA_STEPS) i = JYA_STEPS - 1;
  const f = u - i;
  const ji = tabular(i);
  const gata = ji - tabular(i - 1);
  const bhogya = tabular(i + 1) - ji;
  return ji + (f * (gata + bhogya)) / 2 + (f * f * (bhogya - gata)) / 2;
}

/** Reduce any angle in degrees to [0, 360). */
export function normalizeDeg(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Signed angular difference a − b wrapped into (−180, 180]. */
export function wrapDiffDeg(a: number, b: number): number {
  let d = normalizeDeg(a - b);
  if (d > 180) d -= 360;
  return d;
}

/** R-sine (jyā) of an arbitrary angle in degrees, in arc-minutes of radius R = 3438. */
export function jya(deg: number): number {
  const t = normalizeDeg(deg);
  if (t <= 90) return jyaQuadrant(t);
  if (t <= 180) return jyaQuadrant(180 - t);
  if (t <= 270) return -jyaQuadrant(t - 180);
  return -jyaQuadrant(360 - t);
}

/** R-cosine (kojyā / koṭi-jyā) = jyā(90° − θ). */
export function kojya(deg: number): number {
  return jya(90 - deg);
}

/** R-versine (utkrama-jyā) = R − kojyā(θ). */
export function utkramaJya(deg: number): number {
  return R - kojya(deg);
}

/** Unit-normalised Siddhāntic sine & cosine (jyā/R, kojyā/R). */
export function sinS(deg: number): number {
  return jya(deg) / R;
}
export function cosS(deg: number): number {
  return kojya(deg) / R;
}

/**
 * Inverse R-sine (cāpa from jyā). Inverts the second-order interpolation exactly by solving
 * the quadratic c·f² + a·f − d = 0 in its numerically stable rationalised form
 * f = 2d / (a + √(a² + 4cd)). Returns degrees in [−90°, 90°].
 */
export function arcJya(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const v = Math.min(Math.abs(value), R);
  if (v >= R) return 90 * sign;
  let i = 0;
  while (i < JYA_STEPS - 1 && JYA_TABLE[i + 1] <= v) i++;
  const ji = tabular(i);
  const gata = ji - tabular(i - 1);
  const bhogya = tabular(i + 1) - ji;
  const a = (gata + bhogya) / 2;
  const c = (bhogya - gata) / 2;
  const d = v - ji;
  const disc = a * a + 4 * c * d;
  const f = disc > 0 ? (2 * d) / (a + Math.sqrt(disc)) : -a / (2 * c);
  return sign * (i + Math.min(Math.max(f, 0), 1)) * JYA_STEP_DEG;
}

/**
 * Cāpa (arc) from a bhujā/koṭi pair — the Siddhāntic replacement for atan2.
 * Uses whichever of jyā or kojyā is smaller so the inversion stays in the well-conditioned
 * part of the table. Returns degrees in [0, 360).
 */
export function capa(bhuja: number, koti: number): number {
  const h = Math.hypot(bhuja, koti);
  if (h === 0) return 0;
  const ab = Math.abs(bhuja);
  const ak = Math.abs(koti);
  const base = ab <= ak ? arcJya((R * ab) / h) : 90 - arcJya((R * ak) / h);
  if (koti >= 0) return bhuja >= 0 ? base : 360 - base;
  return bhuja >= 0 ? 180 - base : 180 + base;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Spherical (longitude λ, latitude β, radius r) → Cartesian, in the ecliptic frame of the
 * scene: +X toward Meṣādi (0° Aries), +Y toward the north ecliptic pole, longitude increasing
 * counter-clockwise when viewed from the north (eastward, anuloma).
 */
export function sphericalToCartesian(lambdaDeg: number, betaDeg: number, r: number, out?: Vec3Like): Vec3Like {
  const cb = cosS(betaDeg);
  const o = out ?? { x: 0, y: 0, z: 0 };
  o.x = r * cb * cosS(lambdaDeg);
  o.y = r * sinS(betaDeg);
  o.z = -r * cb * sinS(lambdaDeg);
  return o;
}

/** Format degrees as rāśi-aṁśa-kalā (sign° ′), e.g. "मेष 12°34′". */
export function formatRashi(deg: number, rashiNames: readonly string[]): string {
  const t = normalizeDeg(deg);
  const rashi = Math.floor(t / 30);
  const within = t - rashi * 30;
  const d = Math.floor(within);
  const m = Math.floor((within - d) * 60);
  return `${rashiNames[rashi]} ${d}°${m.toString().padStart(2, '0')}′`;
}

/** Format degrees as D°M′ with sign. */
export function formatDM(deg: number): string {
  const s = deg < 0 ? '−' : '';
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const m = Math.round((a - d) * 60);
  if (m === 60) return `${s}${d + 1}°00′`;
  return `${s}${d}°${m.toString().padStart(2, '0')}′`;
}

/** Maximum absolute error of the interpolated jyā against exact R·sin over [0°, 90°] (diagnostic). */
export function interpolationError(samples = 900): number {
  let max = 0;
  for (let k = 0; k <= samples; k++) {
    const deg = (90 * k) / samples;
    const exact = R * Math.sin((deg * Math.PI) / 180);
    max = Math.max(max, Math.abs(jya(deg) - exact));
  }
  return max;
}
