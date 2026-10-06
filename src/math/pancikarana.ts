/**
 * पञ्चीकरण — Advaita Pañcīkaraṇa (quintuplication) engine.
 *
 * Source: पञ्चदशी, तत्त्वविवेक १.२७ (स्वामी विद्यारण्य) / पञ्चीकरणम् (आदि शंकराचार्य)
 *
 *   द्विधा विधाय चैकैकं चतुर्धा प्रथमं पुनः।
 *   स्वस्वेतरद्वितीयांशैर्योजनात्पञ्च पञ्च ते॥
 *
 * Each of the five subtle (apañcīkṛta) elements is first split into two equal halves (50 % / 50 %).
 * One half is again divided into four equal eighths (12.5 % each), and these are joined to the
 * retained halves of the other four. Every gross (pañcīkṛta) element E_i is therefore
 *
 *   M_ij = 0.50  if i = j   (svāṁśa — its own subtle element)
 *   M_ij = 0.125 if i ≠ j   (parāṁśa — one eighth of each of the other four)
 *
 * Structurally M = 0.375·I + 0.125·J (J = all-ones). Its eigenvalues are 1 (once — the total
 * "substance" is conserved, every row and column sums to 1) and 0.375 (four times), so M is
 * invertible. The inverse, used here for apañcīkaraṇa (the analytic reversal contemplated in
 * laya-cintana), is closed-form:
 *
 *   M⁻¹ = (8/3)·(I − J/8)   ⇒   diagonal 7/3, off-diagonal −1/3.
 *
 * All vectors are indexed by the Tattva enum in creation order (Taittirīya 2.1):
 *   Ākāśa=0, Vāyu=1, Tejas=2, Āpas=3, Pṛthvī=4.
 */

import { GRAHA_BY_ID, TATTVA_NAMES, Tattva, type GrahaConstants, type GrahaId } from '../data/planetaryConstants';

// ───────────────────────────── Constants ─────────────────────────────

export const TATTVA_COUNT = 5;
/** स्वांश — the retained half of the element's own subtle principle (द्विधा विधाय). */
export const SVA_AMSHA = 0.5;
/** परांश — one of the four eighths received from each other element (चतुर्धा प्रथमं). */
export const PARA_AMSHA = SVA_AMSHA / 4; // 0.125

export type PancaVector = readonly [number, number, number, number, number];
export type MutablePancaVector = [number, number, number, number, number];
export type RGB = readonly [number, number, number];

export const TATTVA_ORDER: readonly Tattva[] = Object.freeze([
  Tattva.Akasha,
  Tattva.Vayu,
  Tattva.Tejas,
  Tattva.Apas,
  Tattva.Prthvi,
]);

export function pancaVector(fill = 0): MutablePancaVector {
  return [fill, fill, fill, fill, fill];
}

function buildMatrix(diag: number, off: number): readonly PancaVector[] {
  return Object.freeze(
    TATTVA_ORDER.map((i) => Object.freeze(TATTVA_ORDER.map((j) => (i === j ? diag : off)) as MutablePancaVector)),
  );
}

/** The Pañcīkaraṇa matrix M (rows = gross element, columns = subtle constituent). */
export const PANCIKARANA_MATRIX: readonly PancaVector[] = buildMatrix(SVA_AMSHA, PARA_AMSHA);

/** अपञ्चीकरण — the exact inverse M⁻¹ = (8/3)(I − J/8). */
export const APANCIKARANA_MATRIX: readonly PancaVector[] = buildMatrix(7 / 3, -1 / 3);

// ───────────────────────────── Linear algebra ─────────────────────────────

/** out = m · v. Safe when out aliases v. */
export function applyMatrix(
  m: readonly PancaVector[],
  v: PancaVector,
  out: MutablePancaVector = pancaVector(),
): MutablePancaVector {
  const v0 = v[0];
  const v1 = v[1];
  const v2 = v[2];
  const v3 = v[3];
  const v4 = v[4];
  for (let i = 0; i < TATTVA_COUNT; i++) {
    const row = m[i];
    out[i] = row[0] * v0 + row[1] * v1 + row[2] * v2 + row[3] * v3 + row[4] * v4;
  }
  return out;
}

/** Quintuplicate an arbitrary subtle (tanmātra) vector into its gross (sthūla) manifestation. */
export function pancikarana(subtle: PancaVector, out?: MutablePancaVector): MutablePancaVector {
  return applyMatrix(PANCIKARANA_MATRIX, subtle, out);
}

/** Recover the subtle constituents from a gross composition (apañcīkaraṇa / laya-cintana). */
export function apancikarana(gross: PancaVector, out?: MutablePancaVector): MutablePancaVector {
  return applyMatrix(APANCIKARANA_MATRIX, gross, out);
}

export function sumPanca(v: PancaVector): number {
  return v[0] + v[1] + v[2] + v[3] + v[4];
}

/** Index of the predominant tattva (vaiśeṣya — "an element is named after its predominant part", Brahmasūtra 2.4.22). */
export function dominantTattva(v: PancaVector): Tattva {
  let best = 0;
  for (let i = 1; i < TATTVA_COUNT; i++) if (v[i] > v[best]) best = i;
  return TATTVA_ORDER[best];
}

/**
 * भेद-सूचकांक — differentiation index in [0, 1]: 1 − H(w)/ln 5.
 * 0 = perfectly undifferentiated (advaita-like homogeneity), 1 = a single pure tattva.
 * A pañcīkṛta element scores ≈ 0.139.
 */
export function bhedaIndex(v: PancaVector): number {
  const total = sumPanca(v);
  if (total <= 0) return 0;
  let h = 0;
  for (let i = 0; i < TATTVA_COUNT; i++) {
    const p = v[i] / total;
    if (p > 0) h -= p * Math.log(p);
  }
  return 1 - h / Math.log(TATTVA_COUNT);
}

// ───────────────────────────── Composition ─────────────────────────────

export interface AmshaShare {
  readonly tattva: Tattva;
  readonly weight: number;
  readonly devanagari: string;
  readonly iast: string;
  readonly tanmatra: string;
}

export interface ElementalComposition {
  readonly element: Tattva;
  readonly devanagari: string;
  readonly iast: string;
  readonly english: string;
  /** Full 5-vector, indexed by Tattva. Sums to exactly 1. */
  readonly weights: PancaVector;
  /** The retained 50 % of its own subtle element. */
  readonly sthula: AmshaShare;
  /** The four 12.5 % eighths received from the other subtle elements. */
  readonly sukshma: readonly AmshaShare[];
}

function share(t: Tattva, weight: number): AmshaShare {
  const n = TATTVA_NAMES[t];
  return Object.freeze({ tattva: t, weight, devanagari: n.devanagari, iast: n.iast, tanmatra: n.tanmatra });
}

const COMPOSITIONS: readonly ElementalComposition[] = Object.freeze(
  TATTVA_ORDER.map((t) => {
    const n = TATTVA_NAMES[t];
    return Object.freeze({
      element: t,
      devanagari: n.devanagari,
      iast: n.iast,
      english: n.english,
      weights: PANCIKARANA_MATRIX[t],
      sthula: share(t, SVA_AMSHA),
      sukshma: Object.freeze(TATTVA_ORDER.filter((o) => o !== t).map((o) => share(o, PARA_AMSHA))),
    });
  }),
);

export type CompositionSource = Tattva | GrahaId | GrahaConstants;

function resolveTattva(src: CompositionSource): Tattva {
  if (typeof src === 'number') {
    if (!Number.isInteger(src) || src < 0 || src >= TATTVA_COUNT) {
      throw new RangeError(`Invalid tattva index ${src}; expected 0–4 (Ākāśa…Pṛthvī).`);
    }
    return src;
  }
  if (typeof src === 'string') {
    const g = GRAHA_BY_ID[src];
    if (!g) throw new RangeError(`Unknown graha "${src}".`);
    return g.tattva;
  }
  return src.tattva;
}

/**
 * Exact subtle-element distribution of a gross element (or of the element governing a graha):
 * 0.5 of its own tanmātra + 4 × 0.125 of the others.
 */
export function getComposition(element: CompositionSource): ElementalComposition {
  return COMPOSITIONS[resolveTattva(element)];
}

// ───────────────────────────── Verse-traced derivation ─────────────────────────────

export interface PancikaranaPart {
  readonly tattva: Tattva;
  readonly fraction: number;
  readonly role: 'svamsha' | 'divided-half' | 'paramsha';
}

export interface PancikaranaStep {
  readonly stage: 1 | 2 | 3;
  readonly pada: string;
  readonly description: string;
  readonly parts: readonly PancikaranaPart[];
}

/** Step-by-step derivation of one gross element, keyed to the three movements of Pañcadaśī 1.27. */
export function pancikaranaDerivation(element: CompositionSource): readonly PancikaranaStep[] {
  const t = resolveTattva(element);
  const others = TATTVA_ORDER.filter((o) => o !== t);
  const name = TATTVA_NAMES[t].devanagari;
  return Object.freeze([
    {
      stage: 1,
      pada: 'द्विधा विधाय चैकैकम्',
      description: `प्रत्येक सूक्ष्म तत्त्व दो बराबर भागों में: ${name} का ५०% स्वांश सुरक्षित, ५०% विभाजन हेतु।`,
      parts: [
        { tattva: t, fraction: SVA_AMSHA, role: 'svamsha' },
        { tattva: t, fraction: SVA_AMSHA, role: 'divided-half' },
      ],
    },
    {
      stage: 2,
      pada: 'चतुर्धा प्रथमं पुनः',
      description: 'प्रत्येक तत्त्व का एक अर्ध भाग पुनः चार बराबर अंशों (१२.५% प्रत्येक) में विभक्त।',
      parts: others.map((o) => ({ tattva: o, fraction: PARA_AMSHA, role: 'divided-half' as const })),
    },
    {
      stage: 3,
      pada: 'स्वस्वेतरद्वितीयांशैर्योजनात्पञ्च पञ्च ते',
      description: `स्थूल ${name} = ५०% स्वकीय सूक्ष्म ${name} + शेष चार तत्त्वों से १२.५% × ४।`,
      parts: [
        { tattva: t, fraction: SVA_AMSHA, role: 'svamsha' },
        ...others.map((o) => ({ tattva: o, fraction: PARA_AMSHA, role: 'paramsha' as const })),
      ],
    },
  ]);
}

// ───────────────────────────── Material derivation ─────────────────────────────

/** Intrinsic properties of a pure (apañcīkṛta) subtle element, used as the basis for shading. */
export interface BhutaGuna {
  /** Relative mass density (0 = Ākāśa, 1 = Pṛthvī). */
  readonly density: number;
  /** Diffuse reflectance. */
  readonly albedo: number;
  /** Self-luminosity — the rūpa tanmātra of Tejas. */
  readonly emissive: number;
  /** Mobility of form (0 rigid … 1 freely flowing). */
  readonly fluidity: number;
  /** Optical opacity (0 transparent … 1 opaque). */
  readonly opacity: number;
  /** Specular / glossy reflectance — the smoothness of Āpas. */
  readonly specular: number;
  /** Traditional tattva-varṇa (Ṣaṭcakra-nirūpaṇa), linear RGB. */
  readonly color: RGB;
  /** Number of perceptible guṇas (Tattvabodha): Ākāśa 1 (śabda) … Pṛthvī 5. */
  readonly gunaCount: number;
}

export const SUKSHMA_GUNA: readonly BhutaGuna[] = Object.freeze([
  // आकाश — नील (deep indigo), śabda only
  { density: 0.0, albedo: 0.04, emissive: 0.0, fluidity: 1.0, opacity: 0.0, specular: 0.0, color: [0.12, 0.1, 0.42], gunaCount: 1 },
  // वायु — धूम्र (smoke-grey), śabda + sparśa
  { density: 0.08, albedo: 0.32, emissive: 0.0, fluidity: 0.95, opacity: 0.12, specular: 0.05, color: [0.55, 0.6, 0.66], gunaCount: 2 },
  // तेजस् — रक्त (red-orange), + rūpa
  { density: 0.22, albedo: 0.85, emissive: 1.0, fluidity: 0.75, opacity: 0.55, specular: 0.2, color: [1.0, 0.32, 0.08], gunaCount: 3 },
  // आपः — श्वेत (pearl-white, faint aqua), + rasa
  { density: 0.62, albedo: 0.5, emissive: 0.0, fluidity: 0.85, opacity: 0.5, specular: 0.9, color: [0.82, 0.92, 0.98], gunaCount: 4 },
  // पृथ्वी — पीत (golden ochre), + gandha
  { density: 1.0, albedo: 0.3, emissive: 0.0, fluidity: 0.0, opacity: 1.0, specular: 0.08, color: [0.86, 0.66, 0.2], gunaCount: 5 },
]);

export interface MaterialProfile {
  readonly density: number;
  readonly albedo: number;
  readonly emissive: number;
  readonly fluidity: number;
  readonly opacity: number;
  readonly specular: number;
  /** स्थूलता — grossness, the weighted guṇa count normalised to [0, 1]. */
  readonly sthulata: number;
  readonly color: RGB;
}

/** Gross material properties as the composition-weighted mixture of the subtle properties. */
export function materialProfile(weights: PancaVector): MaterialProfile {
  const total = sumPanca(weights) || 1;
  let density = 0;
  let albedo = 0;
  let emissive = 0;
  let fluidity = 0;
  let opacity = 0;
  let specular = 0;
  let guna = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < TATTVA_COUNT; i++) {
    const w = weights[i] / total;
    const s = SUKSHMA_GUNA[i];
    density += w * s.density;
    albedo += w * s.albedo;
    emissive += w * s.emissive;
    fluidity += w * s.fluidity;
    opacity += w * s.opacity;
    specular += w * s.specular;
    guna += w * s.gunaCount;
    r += w * s.color[0];
    g += w * s.color[1];
    b += w * s.color[2];
  }
  return Object.freeze({
    density,
    albedo,
    emissive,
    fluidity,
    opacity,
    specular,
    sthulata: (guna - 1) / (TATTVA_COUNT - 1),
    color: Object.freeze([r, g, b]) as RGB,
  });
}

export function getMaterialProfile(element: CompositionSource): MaterialProfile {
  return materialProfile(getComposition(element).weights);
}

// ───────────────────────────── Laya & Sṛṣṭi cascades ─────────────────────────────

export interface LayaResult {
  /** Remaining manifest weights per tattva. */
  readonly weights: MutablePancaVector;
  /** Fraction already resolved into Avyakta (unmanifest). */
  readonly avyakta: number;
}

/**
 * Prākṛtika-pralaya cascade (Bhāgavata 12.4 / Mahābhārata Śānti 231–233) — reverse of creation:
 *   Pṛthvī → Āpas → Tejas → Vāyu → Ākāśa → Avyakta.
 * progress ∈ [0, 5]; during stage k (k = 0…4) the weight of tattva (4 − k) flows into its cause
 * (3 − k), and at stage 4 Ākāśa itself resolves into Avyakta. Total substance is conserved.
 */
export function layaComposition(base: PancaVector, progress: number, out: MutablePancaVector = pancaVector()): LayaResult {
  out[0] = base[0];
  out[1] = base[1];
  out[2] = base[2];
  out[3] = base[3];
  out[4] = base[4];
  let avyakta = 0;
  const p = Math.min(Math.max(progress, 0), TATTVA_COUNT);
  for (let k = 0; k < TATTVA_COUNT; k++) {
    const t = Math.min(Math.max(p - k, 0), 1);
    if (t <= 0) break;
    const src = TATTVA_COUNT - 1 - k;
    const moved = out[src] * t;
    out[src] -= moved;
    if (src > 0) out[src - 1] += moved;
    else avyakta += moved;
  }
  return { weights: out, avyakta };
}

/**
 * Sṛṣṭi (Taittirīya 2.1): Avyakta → Ākāśa → Vāyu → Tejas → Āpas → Pṛthvī.
 * The exact time-reverse of layaComposition: progress 0 = all unmanifest, 5 = fully manifest target.
 */
export function srishtiComposition(target: PancaVector, progress: number, out?: MutablePancaVector): LayaResult {
  return layaComposition(target, TATTVA_COUNT - Math.min(Math.max(progress, 0), TATTVA_COUNT), out);
}

// ───────────────────────────── Shader uniforms ─────────────────────────────

/** three.js-compatible uniform block (plain { value } objects; arrays are accepted for float[] and vec3). */
export interface PancaUniforms {
  uPanca: { value: number[] };
  uDensity: { value: number };
  uAlbedo: { value: number };
  uEmissive: { value: number };
  uFluidity: { value: number };
  uOpacity: { value: number };
  uSpecular: { value: number };
  uSthulata: { value: number };
  uTattvaColor: { value: [number, number, number] };
}

function weightsOf(src: CompositionSource | PancaVector): PancaVector {
  return Array.isArray(src) ? (src as PancaVector) : getComposition(src as CompositionSource).weights;
}

export function createPancaUniforms(src: CompositionSource | PancaVector): PancaUniforms {
  const u: PancaUniforms = {
    uPanca: { value: [0, 0, 0, 0, 0] },
    uDensity: { value: 0 },
    uAlbedo: { value: 0 },
    uEmissive: { value: 0 },
    uFluidity: { value: 0 },
    uOpacity: { value: 0 },
    uSpecular: { value: 0 },
    uSthulata: { value: 0 },
    uTattvaColor: { value: [0, 0, 0] },
  };
  updatePancaUniforms(u, weightsOf(src));
  return u;
}

/** Refresh an existing uniform block in place (no allocation of the uniform arrays). */
export function updatePancaUniforms(u: PancaUniforms, weights: PancaVector): void {
  const total = sumPanca(weights) || 1;
  for (let i = 0; i < TATTVA_COUNT; i++) u.uPanca.value[i] = weights[i] / total;
  const m = materialProfile(weights);
  u.uDensity.value = m.density;
  u.uAlbedo.value = m.albedo;
  u.uEmissive.value = m.emissive;
  u.uFluidity.value = m.fluidity;
  u.uOpacity.value = m.opacity;
  u.uSpecular.value = m.specular;
  u.uSthulata.value = m.sthulata;
  u.uTattvaColor.value[0] = m.color[0];
  u.uTattvaColor.value[1] = m.color[1];
  u.uTattvaColor.value[2] = m.color[2];
}

/** Human-readable formula string for the Shloka Inspector. */
export function compositionFormula(element: CompositionSource): string {
  const c = getComposition(element);
  const parts = c.sukshma.map((s) => `0.125·${s.iast}`).join(' + ');
  return `${c.iast}(sthūla) = 0.5·${c.iast}(sūkṣma) + ${parts}`;
}
