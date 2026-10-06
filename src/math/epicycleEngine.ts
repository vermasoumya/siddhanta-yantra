/**
 * मन्द-शीघ्र संस्कार — Sūrya-Siddhānta epicycle engine.
 *
 * Source: सूर्यसिद्धान्त, अध्याय २ (श्लोक १–३, ३४–४५, ५६–५७)
 *
 *   अदृश्यरूपिणः काला भुवनेषु व्यवस्थिताः। शीघ्रमन्दोच्चपाताख्या ग्रहाणां गतिकारकाः॥
 *   तद्वातविशिखैर्बद्धास्तेऽपकृष्यन्त मूर्त्तयः। प्राक्पश्चादपकृष्यन्ते यथासन्नं स्वदिङ्मुखम्॥
 *
 * Invisible regents of time — śīghrocca, mandocca and pāta — bind the planets with cords of
 * wind and draw them east or west, making their motion now swift, now slow, now retrograde.
 *
 * Trigonometry is strictly Siddhāntic (R = 3438′). Every sine / cosine / arc in the planetary
 * pipeline goes through jya(), kojya(), arcJya() and capa() from suryaTrig.ts; JavaScript
 * Math.sin / Math.cos / Math.atan are never called here. Math.hypot is used only for the karṇa,
 * which the Siddhānta itself obtains by the Pythagorean rule (bhujā² + koṭi² = karṇa²).
 *
 *   1. Manda-saṁskāra (equation of centre):
 *        sin Δ_manda = (r_manda / R) · sin(θ_mean − θ_mandocca)
 *   2. Śīghra-saṁskāra (parallax / anomaly of conjunction):
 *        tan Δ_śīghra = r_ś sin(θ_ś − θ_ms) / (R + r_ś cos(θ_ś − θ_ms))
 *      evaluated as SS 2.42: sin Δ = R·bhujāphala / karṇa.
 *   3. dθ_true/dt < 0 ⇒ vakra (retrograde); ≈ 0 ⇒ kuṭila (stationary).
 *
 * Star-planets (Maṅgala, Budha, Guru, Śukra, Śani) use the four-step procedure of SS 2.43–45:
 *   ½ śīghra → ½ manda → full manda (applied to the mean) → full śīghra.
 */

import {
  CIVIL_DAYS_PER_MAHAYUGA,
  GRAHAS,
  GRAHA_BY_ID,
  KALI_EPOCH_JD,
  KALPA_MAHAYUGAS,
  MAHAYUGAS_MOTION_TO_KALI,
  type GrahaConstants,
  type GrahaId,
  type Periphery,
} from '../data/planetaryConstants';
import { R, arcJya, capa, jya, kojya, normalizeDeg, sphericalToCartesian, wrapDiffDeg, type Vec3Like } from './suryaTrig';

// ───────────────────────────── Time (ahargaṇa) ─────────────────────────────

const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;

export function julianDayFromDate(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

export function dateFromJulianDay(jd: number): Date {
  return new Date((jd - UNIX_EPOCH_JD) * MS_PER_DAY);
}

/**
 * Ahargaṇa — civil days elapsed since the Kali-yuga epoch (midnight, Laṅkā).
 * `deshantaraDays` applies an optional longitude (deśāntara) correction from the prime meridian
 * of Laṅkā–Ujjayinī to the observer, in fractions of a day (east positive).
 */
export function aharganaFromJulianDay(jd: number, deshantaraDays = 0): number {
  return jd - KALI_EPOCH_JD + deshantaraDays;
}

export function aharganaFromDate(date: Date, deshantaraDays = 0): number {
  return aharganaFromJulianDay(julianDayFromDate(date), deshantaraDays);
}

export function dateFromAhargana(ahargana: number): Date {
  return dateFromJulianDay(ahargana + KALI_EPOCH_JD);
}

// ───────────────────────────── Madhyama (mean) motion ─────────────────────────────

function frac(x: number): number {
  return x - Math.floor(x);
}

type RevolutionBasis = 'kalpa' | 'mahayuga';

function revolutionsPerMahayuga(revs: number, per: RevolutionBasis): number {
  return per === 'kalpa' ? revs / KALPA_MAHAYUGAS : revs;
}

/**
 * Fractional revolutions completed at a given ahargaṇa (SS 1.53: revolutions × elapsed days ÷
 * civil days). Split into the exactly-representable epoch part (revs × 452.75 Mahāyugas from the
 * start of planetary motion to Kali) plus the part since Kali, so that double precision is
 * preserved even for the Moon's 57 753 336 revolutions.
 */
export function revolutionsElapsed(revs: number, per: RevolutionBasis, ahargana: number): number {
  const epoch = per === 'kalpa' ? frac((revs * MAHAYUGAS_MOTION_TO_KALI) / KALPA_MAHAYUGAS) : frac(revs * MAHAYUGAS_MOTION_TO_KALI);
  const since = frac((revolutionsPerMahayuga(revs, per) * ahargana) / CIVIL_DAYS_PER_MAHAYUGA);
  return frac(epoch + since);
}

/** Mean longitude in degrees. Pātas (nodes) move retrograde (vilomaga, SS 1.44). */
export function meanLongitude(revs: number, per: RevolutionBasis, ahargana: number, retrograde = false): number {
  const deg = revolutionsElapsed(revs, per, ahargana) * 360;
  return retrograde ? normalizeDeg(-deg) : normalizeDeg(deg);
}

/** Mean daily motion (madhyama-gati) in degrees per civil day. */
export function meanDailyMotion(revs: number, per: RevolutionBasis = 'mahayuga'): number {
  return (revolutionsPerMahayuga(revs, per) * 360) / CIVIL_DAYS_PER_MAHAYUGA;
}

export interface MeanElements {
  /** Madhyama graha — mean planet. For Budha/Śukra this is the mean Sun. */
  readonly madhyama: number;
  readonly mandocca: number;
  /** Ascending node (pāta); 0 when the graha has no latitude. */
  readonly pata: number;
  /** Śīghrocca — the mean Sun for superior planets, own conjunction for inferior; null for luminaries. */
  readonly shighrocca: number | null;
}

const SURYA = GRAHA_BY_ID.surya;

export function meanElements(g: GrahaConstants, ahargana: number): MeanElements {
  const madhyama = meanLongitude(g.meanRevolutions, 'mahayuga', ahargana);
  const mandocca = meanLongitude(g.mandoccaRevolutions, g.mandoccaPer, ahargana);
  const pata = g.pataRevolutions > 0 ? meanLongitude(g.pataRevolutions, g.pataPer, ahargana, true) : 0;
  let shighrocca: number | null = null;
  if (g.cls === 'superior') {
    shighrocca = meanLongitude(SURYA.meanRevolutions, 'mahayuga', ahargana);
  } else if (g.cls === 'inferior' && g.shighroccaRevolutions !== undefined) {
    shighrocca = meanLongitude(g.shighroccaRevolutions, 'mahayuga', ahargana);
  }
  return { madhyama, mandocca, pata, shighrocca };
}

// ───────────────────────────── Saṁskāras ─────────────────────────────

/**
 * Variable periphery (SS 2.38): the epicycle contracts from its even-quadrant value toward its
 * odd-quadrant value in proportion to |jyā(kendra)| / R.
 */
export function variablePeriphery(p: Periphery, kendraDeg: number): number {
  return p.even - ((p.even - p.odd) * Math.abs(jya(kendraDeg))) / R;
}

export interface SamskaraResult {
  /** Kendra (anomaly) in degrees [0, 360). */
  readonly kendra: number;
  /** Corrected periphery in degrees of 360. */
  readonly periphery: number;
  /** Antya-phala — epicycle radius on the R = 3438 scale (p·R/360). */
  readonly antyaphala: number;
  /** Bhujā-phala (R-scale). */
  readonly bhujaphala: number;
  /** Koṭi-phala (R-scale). */
  readonly kotiphala: number;
  /** Karṇa — the variable hypotenuse from Bhū-centre to the planet (R-scale). */
  readonly karna: number;
  /** Signed correction (phala) in degrees, to be added. */
  readonly phala: number;
  /** Corrected longitude. */
  readonly sphuta: number;
}

/**
 * Manda-saṁskāra. kendra = θ − θ_mandocca. The planet lags behind its mean place in the half
 * orbit after the apsis and leads it in the half before (SS 2.39–45).
 */
export function mandaSamskara(longitude: number, mandocca: number, p: Periphery): SamskaraResult {
  const kendra = normalizeDeg(longitude - mandocca);
  const periphery = variablePeriphery(p, kendra);
  const ratio = periphery / 360;
  const antyaphala = ratio * R;
  const bhujaphala = ratio * jya(kendra);
  const kotiphala = ratio * kojya(kendra);
  const karna = Math.hypot(R + kotiphala, bhujaphala);
  const phala = -arcJya(bhujaphala);
  return { kendra, periphery, antyaphala, bhujaphala, kotiphala, karna, phala, sphuta: normalizeDeg(longitude + phala) };
}

/**
 * Śīghra-saṁskāra. kendra = θ_śīghrocca − θ_manda-sphuta. Phala is the cāpa of
 * (bhujā-phala, R + koṭi-phala) — identical to arcJya(R·bhujāphala / karṇa) of SS 2.42 and to the
 * tangent form of the specification, valid in every quadrant.
 */
export function shighraSamskara(mandaSphuta: number, shighrocca: number, p: Periphery): SamskaraResult {
  const kendra = normalizeDeg(shighrocca - mandaSphuta);
  const periphery = variablePeriphery(p, kendra);
  const ratio = periphery / 360;
  const antyaphala = ratio * R;
  const bhujaphala = ratio * jya(kendra);
  const kotiphala = ratio * kojya(kendra);
  const karna = Math.hypot(R + kotiphala, bhujaphala);
  const phala = wrapDiffDeg(capa(bhujaphala, R + kotiphala), 0);
  return { kendra, periphery, antyaphala, bhujaphala, kotiphala, karna, phala, sphuta: normalizeDeg(mandaSphuta + phala) };
}

/** Greatest possible manda equation for a graha (degrees). */
export function maxMandaPhala(g: GrahaConstants): number {
  return arcJya((Math.max(g.manda.even, g.manda.odd) / 360) * R);
}

/** Greatest possible śīghra equation (degrees); arcsin(r/R) when the epicycle lies inside the kakṣyā. */
export function maxShighraPhala(g: GrahaConstants): number {
  if (!g.shighra) return 0;
  const r = (Math.max(g.shighra.even, g.shighra.odd) / 360) * R;
  return r < R ? arcJya(r) : 180;
}

// ───────────────────────────── Sphuṭa (true) computation ─────────────────────────────

export interface SamskaraStep {
  readonly labelDevanagari: string;
  readonly labelIAST: string;
  /** Correction applied at this step (degrees). */
  readonly correction: number;
  /** Longitude after this step. */
  readonly longitude: number;
}

export interface SphutaComputation {
  readonly graha: GrahaConstants;
  readonly ahargana: number;
  readonly mean: MeanElements;
  readonly steps: readonly SamskaraStep[];
  /** The full manda correction (for star-planets its sphuta is mean + full manda phala). */
  readonly manda: SamskaraResult;
  readonly shighra: SamskaraResult | null;
  readonly mandaSphuta: number;
  /** Sphuṭa graha — true geocentric longitude. */
  readonly sphuta: number;
  /** Vikṣepa — latitude in degrees (north positive). */
  readonly latitude: number;
}

export function computeSphuta(g: GrahaConstants, ahargana: number): SphutaComputation {
  const mean = meanElements(g, ahargana);
  const m0 = mean.madhyama;
  const steps: SamskaraStep[] = [{ labelDevanagari: 'मध्यम ग्रह', labelIAST: 'madhyama', correction: 0, longitude: m0 }];

  if (!g.shighra || mean.shighrocca === null) {
    // Sūrya & Candra — manda only.
    const manda = mandaSamskara(m0, mean.mandocca, g.manda);
    steps.push({ labelDevanagari: 'मन्द-फल', labelIAST: 'manda-phala', correction: manda.phala, longitude: manda.sphuta });
    const latitude = g.maxLatitudeDeg > 0 ? (g.maxLatitudeDeg * jya(manda.sphuta - mean.pata)) / R : 0;
    return { graha: g, ahargana, mean, steps, manda, shighra: null, mandaSphuta: manda.sphuta, sphuta: manda.sphuta, latitude };
  }

  const S = mean.shighrocca;
  const U = mean.mandocca;

  // (1) half śīghra equation applied to the mean planet
  const s1 = shighraSamskara(m0, S, g.shighra);
  const p1 = normalizeDeg(m0 + s1.phala / 2);
  steps.push({ labelDevanagari: 'अर्ध शीघ्र-फल', labelIAST: 'ardha-śīghra-phala', correction: s1.phala / 2, longitude: p1 });

  // (2) half manda equation computed from (1)
  const m2 = mandaSamskara(p1, U, g.manda);
  const p2 = normalizeDeg(p1 + m2.phala / 2);
  steps.push({ labelDevanagari: 'अर्ध मन्द-फल', labelIAST: 'ardha-manda-phala', correction: m2.phala / 2, longitude: p2 });

  // (3) full manda equation computed from (2), applied to the original mean planet
  const m3 = mandaSamskara(p2, U, g.manda);
  const mandaSphuta = normalizeDeg(m0 + m3.phala);
  const manda: SamskaraResult = { ...m3, sphuta: mandaSphuta };
  steps.push({ labelDevanagari: 'पूर्ण मन्द-फल (मन्दस्फुट)', labelIAST: 'pūrṇa-manda-phala', correction: m3.phala, longitude: mandaSphuta });

  // (4) full śīghra equation computed from the manda-sphuta
  const shighra = shighraSamskara(mandaSphuta, S, g.shighra);
  steps.push({ labelDevanagari: 'पूर्ण शीघ्र-फल (स्फुट)', labelIAST: 'pūrṇa-śīghra-phala', correction: shighra.phala, longitude: shighra.sphuta });

  // Vikṣepa (SS 2.56–57): jyā(argument) × greatest latitude ÷ śīghra-karṇa.
  // For Budha and Śukra the argument is taken from the śīghrocca instead of the manda-sphuta.
  let latitude = 0;
  if (g.maxLatitudeDeg > 0) {
    const arg = (g.cls === 'inferior' ? S : mandaSphuta) - mean.pata;
    latitude = (g.maxLatitudeDeg * jya(arg)) / shighra.karna;
  }

  return { graha: g, ahargana, mean, steps, manda, shighra, mandaSphuta, sphuta: shighra.sphuta, latitude };
}

export function trueLongitude(g: GrahaConstants, ahargana: number): number {
  return computeSphuta(g, ahargana).sphuta;
}

// ───────────────────────────── Gati (motion) & vakra detection ─────────────────────────────

/** The eight-fold motion of the grahas (SS 2.12): वक्रानुवक्रा कुटिला मन्दा मन्दतरा समा। तथा शीघ्रतरा शीघ्रा ग्रहाणामष्टधा गतिः॥ */
export type GatiBheda = 'vakra' | 'anuvakra' | 'kutila' | 'mandatara' | 'manda' | 'sama' | 'shighra' | 'shighratara';

export const GATI_NAMES: Readonly<Record<GatiBheda, { devanagari: string; iast: string; english: string }>> = {
  vakra: { devanagari: 'वक्र', iast: 'vakra', english: 'retrograde (deepening)' },
  anuvakra: { devanagari: 'अनुवक्र', iast: 'anuvakra', english: 'retrograde (slackening)' },
  kutila: { devanagari: 'कुटिल', iast: 'kuṭila', english: 'stationary' },
  mandatara: { devanagari: 'मन्दतर', iast: 'mandatara', english: 'slower' },
  manda: { devanagari: 'मन्द', iast: 'manda', english: 'slow' },
  sama: { devanagari: 'सम', iast: 'sama', english: 'mean' },
  shighra: { devanagari: 'शीघ्र', iast: 'śīghra', english: 'swift' },
  shighratara: { devanagari: 'शीघ्रतर', iast: 'śīghratara', english: 'swifter' },
};

/**
 * Engineering thresholds (as fractions of the mean daily motion) that partition the continuum of
 * sphuṭa-gati into the eight named classes. The sign tests (vakra / kuṭila) follow the
 * specification exactly; the remaining bands are documented interpretive boundaries.
 */
export const GATI_THRESHOLDS = Object.freeze({
  stationary: 0.05,
  mandatara: 0.5,
  manda: 0.95,
  sama: 1.05,
  shighra: 1.5,
});

export interface GatiMeasure {
  /** Sphuṭa-gati — true daily motion (deg/day); negative when vakra. */
  readonly speed: number;
  /** Rate of change of the daily motion (deg/day²). */
  readonly acceleration: number;
  /** Madhyama-gati (deg/day). */
  readonly meanSpeed: number;
}

/** True daily motion by central differences of the full sphuṭa pipeline. */
export function sphutaGati(g: GrahaConstants, ahargana: number, stepDays = 0.25, centerLongitude?: number): GatiMeasure {
  const lp = trueLongitude(g, ahargana + stepDays);
  const lm = trueLongitude(g, ahargana - stepDays);
  const l0 = centerLongitude ?? trueLongitude(g, ahargana);
  const speed = wrapDiffDeg(lp, lm) / (2 * stepDays);
  const acceleration = (wrapDiffDeg(lp, l0) - wrapDiffDeg(l0, lm)) / (stepDays * stepDays);
  return { speed, acceleration, meanSpeed: meanDailyMotion(g.meanRevolutions, 'mahayuga') };
}

export function classifyGati(m: GatiMeasure, stationaryFraction: number = GATI_THRESHOLDS.stationary): GatiBheda {
  const mean = Math.abs(m.meanSpeed) || Number.EPSILON;
  const ratio = m.speed / mean;
  if (Math.abs(ratio) < stationaryFraction) return 'kutila';
  if (ratio < 0) return m.acceleration < 0 ? 'vakra' : 'anuvakra';
  if (ratio < GATI_THRESHOLDS.mandatara) return 'mandatara';
  if (ratio < GATI_THRESHOLDS.manda) return 'manda';
  if (ratio <= GATI_THRESHOLDS.sama) return 'sama';
  if (ratio <= GATI_THRESHOLDS.shighra) return 'shighra';
  return 'shighratara';
}

/** vakrārambha = station before retrogression; mārgārambha = station before direct motion resumes. */
export type VakraEventKind = 'vakrarambha' | 'margarambha';

export interface VakraEvent {
  readonly grahaId: GrahaId;
  readonly kind: VakraEventKind;
  /** Interpolated ahargaṇa of the station. */
  readonly ahargana: number;
  readonly longitude: number;
}

/**
 * Streaming retrograde detector: watches the sign of sphuṭa-gati between successive updates and
 * reports each station (kuṭila point) with a linearly interpolated time. Works when the timeline
 * is scrubbed backwards; ignores jumps larger than `maxGapDays` (which may hide several stations).
 */
export class VakraDetector {
  private readonly prev = new Map<GrahaId, { ahargana: number; speed: number; longitude: number }>();

  constructor(private readonly maxGapDays = 45) {}

  observe(id: GrahaId, ahargana: number, speed: number, longitude: number): VakraEvent | null {
    const p = this.prev.get(id);
    this.prev.set(id, { ahargana, speed, longitude });
    if (!p || p.ahargana === ahargana || Math.abs(ahargana - p.ahargana) > this.maxGapDays) return null;
    if (p.speed >= 0 === speed >= 0) return null;

    const forward = ahargana > p.ahargana;
    const early = forward ? p : { ahargana, speed, longitude };
    const late = forward ? { ahargana, speed, longitude } : p;
    const t = early.speed / (early.speed - late.speed);
    return {
      grahaId: id,
      kind: early.speed >= 0 ? 'vakrarambha' : 'margarambha',
      ahargana: early.ahargana + t * (late.ahargana - early.ahargana),
      longitude: normalizeDeg(early.longitude + t * wrapDiffDeg(late.longitude, early.longitude)),
    };
  }

  reset(id?: GrahaId): void {
    if (id) this.prev.delete(id);
    else this.prev.clear();
  }
}

/** Scan an interval for stations and refine each by bisection on sphuṭa-gati. */
export function findStations(g: GrahaConstants, startAhargana: number, endAhargana: number, stepDays = 1): VakraEvent[] {
  const events: VakraEvent[] = [];
  if (!g.shighra || endAhargana <= startAhargana) return events;
  const speedAt = (t: number): number => sphutaGati(g, t).speed;
  const n = Math.ceil((endAhargana - startAhargana) / stepDays);
  let a = startAhargana;
  let va = speedAt(a);
  for (let k = 1; k <= n; k++) {
    const b = Math.min(startAhargana + k * stepDays, endAhargana);
    const vb = speedAt(b);
    if (va >= 0 !== vb >= 0) {
      let lo = a;
      let hi = b;
      let vlo = va;
      for (let it = 0; it < 40; it++) {
        const mid = 0.5 * (lo + hi);
        const vm = speedAt(mid);
        if (vm >= 0 === vlo >= 0) {
          lo = mid;
          vlo = vm;
        } else {
          hi = mid;
        }
      }
      const t = 0.5 * (lo + hi);
      events.push({ grahaId: g.id, kind: va >= 0 ? 'vakrarambha' : 'margarambha', ahargana: t, longitude: trueLongitude(g, t) });
    }
    a = b;
    va = vb;
  }
  return events;
}

// ───────────────────────────── 3D karṇa geometry ─────────────────────────────

export interface EpicycleGeometry {
  /** Madhyama graha on its kakṣyā (the deferent). Also the manda-epicycle centre. */
  readonly mean: Vec3Like;
  /** Visual manda-epicycle radius (scene units). */
  readonly mandaRadius: number;
  /** Point on the manda epicycle (radius directed toward the mandocca). */
  readonly mandaEpicyclePoint: Vec3Like;
  /** End of the manda karṇa — the manda-sphuṭa place. Also the śīghra-epicycle centre. */
  readonly mandaPoint: Vec3Like;
  /** Visual śīghra-epicycle radius (0 for luminaries). */
  readonly shighraRadius: number;
  /** Point on the śīghra epicycle (radius directed toward the śīghrocca); null for luminaries. */
  readonly shighraEpicyclePoint: Vec3Like | null;
  /** The sphuṭa body position — the variable karṇa vector from Bhū-centre, including vikṣepa. */
  readonly position: Vec3Like;
  /** |position| in scene units. */
  readonly karnaLength: number;
  /** karṇa / R (1 = on the kakṣyā). */
  readonly karnaRatio: number;
  /** Direction markers placed on the kakṣyā. */
  readonly mandocca: Vec3Like;
  readonly shighrocca: Vec3Like | null;
  readonly pata: Vec3Like;
}

/**
 * Visual radius for a karṇa. The longitude is always exact; only the radial departure from the
 * kakṣyā is scaled by the graha's `loopScale` so that the retrograde loops remain legible without
 * planets crossing neighbouring Vāyu shells.
 */
export function visualKarnaRadius(g: GrahaConstants, karna: number): number {
  return g.kakshaRadius * (1 + g.loopScale * (karna / R - 1));
}

function onCircle(center: Vec3Like, lambdaDeg: number, radius: number): Vec3Like {
  const d = sphericalToCartesian(lambdaDeg, 0, radius);
  return { x: center.x + d.x, y: center.y + d.y, z: center.z + d.z };
}

export function epicycleGeometry(c: SphutaComputation, latitudeScale = 1): EpicycleGeometry {
  const g = c.graha;
  const K = g.kakshaRadius;
  const mean = sphericalToCartesian(c.mean.madhyama, 0, K);
  const mandaRadius = (K * g.loopScale * c.manda.antyaphala) / R;
  const mandaEpicyclePoint = onCircle(mean, c.mean.mandocca, mandaRadius);
  const mandaPoint = sphericalToCartesian(c.mandaSphuta, 0, visualKarnaRadius(g, c.manda.karna));

  let shighraRadius = 0;
  let shighraEpicyclePoint: Vec3Like | null = null;
  let shighrocca: Vec3Like | null = null;
  if (c.shighra && c.mean.shighrocca !== null) {
    shighraRadius = (K * g.loopScale * c.shighra.antyaphala) / R;
    shighraEpicyclePoint = onCircle(mandaPoint, c.mean.shighrocca, shighraRadius);
    shighrocca = sphericalToCartesian(c.mean.shighrocca, 0, K);
  }

  const karna = c.shighra ? c.shighra.karna : c.manda.karna;
  const karnaLength = visualKarnaRadius(g, karna);
  const position = sphericalToCartesian(c.sphuta, c.latitude * latitudeScale, karnaLength);

  return {
    mean,
    mandaRadius,
    mandaEpicyclePoint,
    mandaPoint,
    shighraRadius,
    shighraEpicyclePoint,
    position,
    karnaLength,
    karnaRatio: karna / R,
    mandocca: sphericalToCartesian(c.mean.mandocca, 0, K),
    shighrocca,
    pata: sphericalToCartesian(c.mean.pata, 0, K),
  };
}

// ───────────────────────────── Orbit tracing ─────────────────────────────

export interface OrbitTrace {
  readonly grahaId: GrahaId;
  readonly count: number;
  /** count × 3 scene positions. */
  readonly positions: Float32Array;
  readonly longitudes: Float64Array;
  /** Daily motion at each sample (deg/day). */
  readonly speeds: Float32Array;
  /** 1 where the sample lies in vakra (retrograde) motion. */
  readonly vakra: Uint8Array;
  readonly aharganas: Float64Array;
}

/** Sample the true 3D path of a graha — the trail that reveals authentic vakra loops. */
export function traceOrbit(
  g: GrahaConstants,
  startAhargana: number,
  spanDays: number,
  samples: number,
  latitudeScale = 1,
): OrbitTrace {
  const count = Math.max(2, Math.floor(samples));
  const positions = new Float32Array(count * 3);
  const longitudes = new Float64Array(count);
  const speeds = new Float32Array(count);
  const vakra = new Uint8Array(count);
  const aharganas = new Float64Array(count);
  const dt = spanDays / (count - 1);

  for (let i = 0; i < count; i++) {
    const t = startAhargana + i * dt;
    const c = computeSphuta(g, t);
    const geo = epicycleGeometry(c, latitudeScale);
    positions[i * 3] = geo.position.x;
    positions[i * 3 + 1] = geo.position.y;
    positions[i * 3 + 2] = geo.position.z;
    longitudes[i] = c.sphuta;
    aharganas[i] = t;
  }
  for (let i = 0; i < count; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(count - 1, i + 1);
    const v = dt !== 0 ? wrapDiffDeg(longitudes[b], longitudes[a]) / ((b - a) * dt) : 0;
    speeds[i] = v;
    vakra[i] = v < 0 ? 1 : 0;
  }
  return { grahaId: g.id, count, positions, longitudes, speeds, vakra, aharganas };
}

// ───────────────────────────── Engine ─────────────────────────────

export interface GrahaState {
  readonly id: GrahaId;
  readonly graha: GrahaConstants;
  readonly computation: SphutaComputation;
  readonly speed: number;
  readonly acceleration: number;
  readonly meanSpeed: number;
  readonly gati: GatiBheda;
  /** dθ/dt < 0 */
  readonly vakra: boolean;
  /** |dθ/dt| ≈ 0 */
  readonly kutila: boolean;
  readonly geometry: EpicycleGeometry;
}

export interface EpicycleFrame {
  readonly ahargana: number;
  readonly states: readonly GrahaState[];
  readonly events: readonly VakraEvent[];
}

export interface EpicycleEngineOptions {
  readonly grahas?: readonly GrahaConstants[];
  /** Half-width of the central difference used for sphuṭa-gati (days). */
  readonly derivativeStepDays?: number;
  readonly stationaryFraction?: number;
  /** Visual exaggeration of vikṣepa. 1 = authentic. */
  readonly latitudeScale?: number;
}

export function computeGrahaState(
  g: GrahaConstants,
  ahargana: number,
  derivativeStepDays = 0.25,
  stationaryFraction: number = GATI_THRESHOLDS.stationary,
  latitudeScale = 1,
): GrahaState {
  const computation = computeSphuta(g, ahargana);
  const m = sphutaGati(g, ahargana, derivativeStepDays, computation.sphuta);
  const gati = classifyGati(m, stationaryFraction);
  return {
    id: g.id,
    graha: g,
    computation,
    speed: m.speed,
    acceleration: m.acceleration,
    meanSpeed: m.meanSpeed,
    gati,
    vakra: m.speed < 0,
    kutila: gati === 'kutila',
    geometry: epicycleGeometry(computation, latitudeScale),
  };
}

export class EpicycleEngine {
  readonly grahas: readonly GrahaConstants[];
  readonly detector: VakraDetector;
  private readonly derivativeStepDays: number;
  private readonly stationaryFraction: number;
  latitudeScale: number;
  private readonly states = new Map<GrahaId, GrahaState>();
  private frame: EpicycleFrame | null = null;

  constructor(options: EpicycleEngineOptions = {}) {
    this.grahas = options.grahas ?? GRAHAS;
    this.derivativeStepDays = options.derivativeStepDays ?? 0.25;
    this.stationaryFraction = options.stationaryFraction ?? GATI_THRESHOLDS.stationary;
    this.latitudeScale = options.latitudeScale ?? 1;
    this.detector = new VakraDetector();
  }

  update(ahargana: number): EpicycleFrame {
    const states: GrahaState[] = [];
    const events: VakraEvent[] = [];
    for (const g of this.grahas) {
      const s = computeGrahaState(g, ahargana, this.derivativeStepDays, this.stationaryFraction, this.latitudeScale);
      this.states.set(g.id, s);
      states.push(s);
      const ev = this.detector.observe(g.id, ahargana, s.speed, s.computation.sphuta);
      if (ev) events.push(ev);
    }
    this.frame = { ahargana, states, events };
    return this.frame;
  }

  getState(id: GrahaId): GrahaState | undefined {
    return this.states.get(id);
  }

  get lastFrame(): EpicycleFrame | null {
    return this.frame;
  }

  /** Live formula strings for the Shloka Inspector, with the current numbers substituted. */
  formulaFor(id: GrahaId): string[] {
    const s = this.states.get(id);
    if (!s) return [];
    const c = s.computation;
    const lines = [
      `sin Δmanda = (${c.manda.antyaphala.toFixed(1)}/${R}) · sin(${c.manda.kendra.toFixed(2)}°) ⇒ Δ = ${c.manda.phala.toFixed(3)}°`,
    ];
    if (c.shighra) {
      lines.push(
        `tan Δśīghra = ${c.shighra.bhujaphala.toFixed(1)} / (${R} + ${c.shighra.kotiphala.toFixed(1)}) ⇒ Δ = ${c.shighra.phala.toFixed(3)}°`,
        `karṇa = √((R + koṭi)² + bhujā²) = ${c.shighra.karna.toFixed(1)}′`,
      );
    }
    lines.push(`dθ/dt = ${s.speed.toFixed(4)}°/day → ${GATI_NAMES[s.gati].devanagari} (${GATI_NAMES[s.gati].iast})`);
    return lines;
  }
}
