/**
 * प्रलय-यन्त्र — PralayaEngine: the five-stage Prākṛtika dissolution timeline.
 *
 * Sources:
 *   श्रीमद्भागवत १२.४.४, २४ — नित्यः सदैव भूतानां जन्मप्रलय उच्यते। … तदा प्रकृतयः सप्त कल्पन्ते प्रलयाय हि॥
 *   महाभारत शान्तिपर्व २३१–२३३ — भूमिः सलिलत्वमुपगच्छति… सलिलाच्चैवोत्तस्थौ तेजः…
 *                                 ततस्तेजः शाम्यति वातेन… वातश्चाकाशं प्रतिपद्यते।
 *
 * Stage index s and transition progress p combine into the continuous laya coordinate
 *     L = clamp(s + p, 0, 5)
 *   0 Sṛṣṭi (manifest) → 1 Pṛthvī→Āpas → 2 Āpas→Tejas → 3 Tejas→Vāyu → 4 Vāyu→Ākāśa
 *   → 5 Ākāśa→Avyakta (the unmanifest; Pāramārthika ground).
 *
 * L drives `uLaya` of pralayaCollapse.vert.glsl. The aggregate Pañcīkaraṇa composition of the
 * dissolving cosmos (uPanca) is computed from the gross-element matrix
 *     M_ij = 0.50 (i = j),  0.125 (i ≠ j)          (पञ्चदशी १.२७)
 * applied to every particle's present element e_p = min(tattva_p, 4 − L).
 *
 * The engine also yields the Vikṣepa / Āvaraṇa levels consumed by the Brahman field, the
 * Naimittika deluge level, and visibility factors for the manifest scene graph.
 */

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { BHU_RADIUS, DHRUVA_RADIUS, Tattva, VAYU_SHELL_RADII } from '../data/planetaryConstants';
import { LAYA_CAPTIONS, type StageCaption } from '../data/shlokas';
import pralayaVert from '../shaders/pralayaCollapse.vert.glsl';
import pralayaFrag from '../shaders/pralayaCollapse.frag.glsl';
import { AXIS, mulberry32 } from './CelestialSphere';

export const PRALAYA_STAGE_COUNT = 6;

export const PRALAYA_STAGES: readonly { devanagari: string; iast: string; english: string }[] = [
  { devanagari: 'सृष्टि', iast: 'Sṛṣṭi', english: 'Manifest universe' },
  { devanagari: 'पृथ्वी → जल', iast: 'Pṛthvī → Āpas', english: 'Earth melts into Water' },
  { devanagari: 'जल → अग्नि', iast: 'Āpas → Tejas', english: 'Water evaporates into Fire' },
  { devanagari: 'अग्नि → वायु', iast: 'Tejas → Vāyu', english: 'Fire is quelled by Air' },
  { devanagari: 'वायु → आकाश', iast: 'Vāyu → Ākāśa', english: 'Air rests in Space' },
  { devanagari: 'अव्यक्त · ब्रह्म', iast: 'Avyakta · Brahman', english: 'Pāramārthika — the Unmanifest' },
];

// ───────────────────────────── Pañcīkaraṇa ─────────────────────────────

const N = 5;
/** Gross-element matrix row i = composition of gross element i in subtle tattvas. */
const PANCA_MATRIX: readonly number[][] = Array.from({ length: N }, (_, i) =>
  Array.from({ length: N }, (_, j) => (i === j ? 0.5 : 0.125)),
);

/** Tattva-varṇa (index = Tattva enum: Ākāśa, Vāyu, Tejas, Āpas, Pṛthvī). */
const TATTVA_COLORS: readonly THREE.Color[] = [
  new THREE.Color(0x6a5cff), // Ākāśa — deep indigo (śabda)
  new THREE.Color(0xbfe9ff), // Vāyu — pale azure (sparśa)
  new THREE.Color(0xff7a2e), // Tejas — flame (rūpa)
  new THREE.Color(0x3fa8ff), // Āpas — water-blue (rasa)
  new THREE.Color(0xc99a5b), // Pṛthvī — ochre earth (gandha)
];
const TATTVA_DENSITY = [0.02, 0.1, 0.25, 0.7, 1.0];
const TATTVA_FLUIDITY = [0.2, 1.0, 0.8, 0.9, 0.05];
const TATTVA_EMISSIVE = [0.45, 0.3, 1.4, 0.35, 0.15];

/** Particle allocation per native tattva. */
const PARTICLE_COUNTS: Readonly<Record<Tattva, number>> = {
  [Tattva.Akasha]: 2200,
  [Tattva.Vayu]: 3200,
  [Tattva.Tejas]: 3200,
  [Tattva.Apas]: 4200,
  [Tattva.Prthvi]: 6200,
};

const COSMOS_RADIUS = VAYU_SHELL_RADII[VAYU_SHELL_RADII.length - 1].outer;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ───────────────────────────── Material fader ─────────────────────────────

interface FadeEntry {
  readonly material: THREE.Material;
  readonly baseOpacity: number;
  readonly baseTransparent: boolean;
  readonly uniform: THREE.IUniform<number> | null;
}

/**
 * Fades every material below a root (opacity × factor, or `uFade` for shader materials) without
 * losing the authored base opacities. Subtrees flagged `userData.fadeExempt` are skipped.
 */
export class MaterialFader {
  private readonly entries: FadeEntry[] = [];
  private readonly labels: HTMLElement[] = [];
  private factor = 1;

  constructor(private readonly root: THREE.Object3D) {
    this.refresh();
  }

  refresh(): void {
    this.entries.length = 0;
    this.labels.length = 0;
    const seen = new Set<THREE.Material>();
    const visit = (o: THREE.Object3D): void => {
      if (o !== this.root && o.userData.fadeExempt) return;
      if (o instanceof CSS2DObject) this.labels.push(o.element);
      const m = (o as THREE.Object3D & { material?: THREE.Material | THREE.Material[] }).material;
      const mats = Array.isArray(m) ? m : m ? [m] : [];
      for (const mat of mats) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        const uniforms = (mat as THREE.ShaderMaterial).uniforms as Record<string, THREE.IUniform> | undefined;
        const uFade = uniforms && uniforms.uFade ? (uniforms.uFade as THREE.IUniform<number>) : null;
        this.entries.push({ material: mat, baseOpacity: mat.opacity, baseTransparent: mat.transparent, uniform: uFade });
      }
      for (const c of o.children) visit(c);
    };
    visit(this.root);
    const f = this.factor;
    this.factor = -1;
    this.set(f);
  }

  set(factor: number): void {
    const f = THREE.MathUtils.clamp(factor, 0, 1);
    if (Math.abs(f - this.factor) < 1e-4) return;
    this.factor = f;
    for (const e of this.entries) {
      if (e.uniform) {
        e.uniform.value = f;
        continue;
      }
      e.material.opacity = e.baseOpacity * f;
      const transparent = e.baseTransparent || f < 0.999;
      if (transparent !== e.material.transparent) {
        e.material.transparent = transparent;
        e.material.needsUpdate = true;
      }
    }
    for (const el of this.labels) el.style.opacity = f.toFixed(3);
    this.root.visible = f > 0.003;
  }

  get value(): number {
    return this.factor;
  }
}

// ───────────────────────────── Engine ─────────────────────────────

export class PralayaEngine {
  /** The dissolving tattva cloud (THREE.Points with the pralayaCollapse shaders). */
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly uniforms: Record<string, THREE.IUniform>;
  private stage = 0;
  private progress = 0;
  private targetLaya = 0;
  private laya = 0;
  private time = 0;
  private atyantika = 0;
  private autoRate = 0;
  private readonly panca = new Array<number>(N).fill(0);
  private readonly tattvaColor = new THREE.Color();
  private readonly fractions: number[];

  constructor(scene: THREE.Scene) {
    const total = Object.values(PARTICLE_COUNTS).reduce((a, b) => a + b, 0);
    this.fractions = [Tattva.Akasha, Tattva.Vayu, Tattva.Tejas, Tattva.Apas, Tattva.Prthvi].map((t) => PARTICLE_COUNTS[t] / total);

    this.uniforms = {
      uTime: { value: 0 },
      uLaya: { value: 0 },
      uNitya: { value: 0.22 },
      uFlood: { value: 0 },
      uFloodRadius: { value: VAYU_SHELL_RADII[3].outer },
      uAtyantika: { value: 0 },
      uVikshepa: { value: 1 },
      uPanca: { value: new Array<number>(N).fill(0.2) },
      uTattvaColor: { value: new THREE.Color() },
      uEmissive: { value: 0.5 },
      uFluidity: { value: 0.3 },
      uDensity: { value: 0.8 },
      uSpecular: { value: 0.4 },
      uAxis: { value: AXIS.clone() },
      uPointScale: { value: 400 },
      uSize: { value: 0.085 },
      uBhuRadius: { value: BHU_RADIUS },
      uCosmosRadius: { value: COSMOS_RADIUS },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: pralayaVert,
      fragmentShader: pralayaFrag,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.buildGeometry(total), material);
    this.points.name = 'PralayaField';
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.points.visible = false;
    scene.add(this.points);
    this.updateComposition();
  }

  // ───────────── control ─────────────

  /** stageIndex ∈ {0…5}, transitionProgress ∈ [0,1] toward the next stage. */
  setPhase(stageIndex: number, transitionProgress: number): void {
    this.stage = THREE.MathUtils.clamp(Math.floor(stageIndex), 0, PRALAYA_STAGE_COUNT - 1);
    this.progress = THREE.MathUtils.clamp(transitionProgress, 0, 1);
    this.targetLaya = THREE.MathUtils.clamp(this.stage + this.progress, 0, 5);
    this.autoRate = 0;
  }

  /** Let the dissolution run on its own at `stagesPerSecond` (negative = re-creation, Sṛṣṭi). */
  autoplay(stagesPerSecond: number): void {
    this.autoRate = stagesPerSecond;
  }

  /** Ātyantika pralaya (Māyā-nivṛtti) from the Advaita overlay, 0…1. */
  setAtyantika(amount: number): void {
    this.atyantika = THREE.MathUtils.clamp(amount, 0, 1);
  }

  /** drawingBufferHeight in device pixels (point-size attenuation). */
  setViewportHeight(drawingBufferHeight: number): void {
    this.uniforms.uPointScale.value = drawingBufferHeight / 2;
  }

  step(dtSeconds: number): void {
    const dt = Math.min(Math.max(dtSeconds, 0), 0.1);
    this.time += dt;

    if (this.autoRate !== 0) {
      this.targetLaya = THREE.MathUtils.clamp(this.targetLaya + this.autoRate * dt, 0, 5);
      this.stage = Math.min(Math.floor(this.targetLaya), PRALAYA_STAGE_COUNT - 1);
      this.progress = this.targetLaya - this.stage;
      if (this.targetLaya <= 0 || this.targetLaya >= 5) this.autoRate = 0;
    }

    // Critically damped approach so slider scrubs feel like a physical process.
    const k = 1 - Math.exp(-dt * 2.4);
    this.laya += (this.targetLaya - this.laya) * k;
    if (Math.abs(this.targetLaya - this.laya) < 1e-4) this.laya = this.targetLaya;

    const u = this.uniforms;
    u.uTime.value = this.time;
    u.uLaya.value = this.laya;
    u.uFlood.value = this.flood;
    u.uAtyantika.value = this.atyantika;
    u.uVikshepa.value = this.vikshepa;
    this.updateComposition();
    this.points.visible = this.laya > 0.004 || this.atyantika > 0.004;
  }

  getShaderUniforms(): Record<string, THREE.IUniform> {
    return this.uniforms;
  }

  // ───────────── derived state ─────────────

  get currentLaya(): number {
    return this.laya;
  }

  get target(): number {
    return this.targetLaya;
  }

  get stageIndex(): number {
    return Math.min(Math.floor(this.laya + 1e-6), PRALAYA_STAGE_COUNT - 1);
  }

  get isAutoplaying(): boolean {
    return this.autoRate !== 0;
  }

  /** Bhū-gola melts first (Pṛthvī → Āpas). */
  get bhuVisibility(): number {
    return 1 - smoothstep(0.15, 1.0, this.laya);
  }

  /** The rest of the manifest cosmos thins as Tejas and Vāyu are withdrawn. */
  get cosmosVisibility(): number {
    return 1 - smoothstep(1.6, 4.3, this.laya);
  }

  /** Mechanical epicycle apparatus vanishes earlier than the cosmos that hosts it. */
  get mechanismVisibility(): number {
    return 1 - smoothstep(0.8, 3.0, this.laya);
  }

  /** Naimittika deluge level — the waters rise while Pṛthvī becomes Āpas. */
  get flood(): number {
    return smoothstep(0.1, 0.75, this.laya) * (1 - smoothstep(1.35, 2.2, this.laya));
  }

  /** Vikṣepa-śakti (projection) withdraws as Ākāśa returns to Avyakta. */
  get vikshepa(): number {
    return Math.min(1 - smoothstep(3.6, 5.0, this.laya), 1 - this.atyantika);
  }

  /** Āvaraṇa (veil). Prākṛtika laya alone leaves a faint veil; only Ātyantika lifts it fully. */
  get avarana(): number {
    const layaVeil = 1 - 0.7 * smoothstep(4.4, 5.0, this.laya);
    return Math.min(layaVeil, 1 - this.atyantika);
  }

  /** Aggregate Pañcīkaraṇa composition (Ākāśa, Vāyu, Tejas, Āpas, Pṛthvī). */
  get composition(): readonly number[] {
    return this.panca;
  }

  get stageInfo(): (typeof PRALAYA_STAGES)[number] {
    return PRALAYA_STAGES[this.stageIndex];
  }

  /** Verse fragment for the transition in progress (null when fully manifest or at rest). */
  get caption(): StageCaption | null {
    if (this.laya < 0.02) return null;
    const dissolving = 5 - Math.min(Math.floor(this.laya), 4);
    return LAYA_CAPTIONS[dissolving] ?? null;
  }

  /** Live formula lines for the Shloka Inspector. */
  formula(): string[] {
    const p = this.panca.map((v) => v.toFixed(3));
    return [
      `L = s + p = ${this.laya.toFixed(3)}   (0 सृष्टि … 5 अव्यक्त)`,
      `e_p = min(tattva_p, 4 − L) = min(tattva_p, ${(4 - this.laya).toFixed(3)})`,
      `M_ij = 0.50 δ_ij + 0.125 (1 − δ_ij)`,
      `Σ composition [आकाश, वायु, तेज, जल, पृथ्वी] = [${p.join(', ')}]`,
      `vikṣepa = ${this.vikshepa.toFixed(3)}, āvaraṇa = ${this.avarana.toFixed(3)}, jala-plāvana = ${this.flood.toFixed(3)}`,
    ];
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.points.removeFromParent();
  }

  // ───────────── internals ─────────────

  private updateComposition(): void {
    const L = this.laya;
    const out = this.panca;
    out.fill(0);
    let avyakta = 0;
    for (let c = 0; c < N; c++) {
      const e = Math.min(c, 4 - L);
      const f = this.fractions[c];
      if (e < 0) {
        const wA = Math.min(-e, 1);
        avyakta += f * wA;
        // Remainder still in Ākāśa.
        const rest = f * (1 - wA);
        for (let j = 0; j < N; j++) out[j] += rest * PANCA_MATRIX[0][j];
        continue;
      }
      for (let k = 0; k < N; k++) {
        const w = Math.max(0, 1 - Math.abs(e - k));
        if (w === 0) continue;
        for (let j = 0; j < N; j++) out[j] += f * w * PANCA_MATRIX[k][j];
      }
    }
    const sum = out.reduce((a, b) => a + b, 0);
    if (sum < 1e-6) {
      out.fill(0);
      out[0] = 1;
    } else {
      for (let j = 0; j < N; j++) out[j] /= sum;
    }

    const color = this.tattvaColor.setRGB(0, 0, 0);
    let density = 0;
    let fluidity = 0;
    let emissive = 0;
    for (let j = 0; j < N; j++) {
      color.r += TATTVA_COLORS[j].r * out[j];
      color.g += TATTVA_COLORS[j].g * out[j];
      color.b += TATTVA_COLORS[j].b * out[j];
      density += TATTVA_DENSITY[j] * out[j];
      fluidity += TATTVA_FLUIDITY[j] * out[j];
      emissive += TATTVA_EMISSIVE[j] * out[j];
    }
    const u = this.uniforms;
    const arr = u.uPanca.value as number[];
    for (let j = 0; j < N; j++) arr[j] = out[j];
    (u.uTattvaColor.value as THREE.Color).copy(color);
    u.uDensity.value = density * (1 - avyakta);
    u.uFluidity.value = fluidity;
    u.uEmissive.value = emissive;
    u.uSpecular.value = 0.8 * out[Tattva.Apas] + 0.2 * out[Tattva.Prthvi];
  }

  private buildGeometry(total: number): THREE.BufferGeometry {
    const rand = mulberry32(0x5a11a7a);
    const positions = new Float32Array(total * 3);
    const seeds = new Float32Array(total * 4);
    const tattvas = new Float32Array(total);
    const dir = new THREE.Vector3();

    // Native radial homes per tattva (scene units).
    const homes: Record<Tattva, [number, number]> = {
      [Tattva.Prthvi]: [BHU_RADIUS * 0.55, BHU_RADIUS * 1.0],
      [Tattva.Apas]: [BHU_RADIUS * 1.0, VAYU_SHELL_RADII[0].outer],
      [Tattva.Tejas]: [VAYU_SHELL_RADII[2].inner, VAYU_SHELL_RADII[3].outer],
      [Tattva.Vayu]: [VAYU_SHELL_RADII[1].inner, VAYU_SHELL_RADII[5].outer],
      [Tattva.Akasha]: [VAYU_SHELL_RADII[5].inner, DHRUVA_RADIUS],
    };

    let i = 0;
    for (const t of [Tattva.Prthvi, Tattva.Apas, Tattva.Tejas, Tattva.Vayu, Tattva.Akasha]) {
      const [r0, r1] = homes[t];
      for (let n = 0; n < PARTICLE_COUNTS[t]; n++, i++) {
        const z = rand() * 2 - 1;
        const phi = rand() * Math.PI * 2;
        const s = Math.sqrt(1 - z * z);
        dir.set(s * Math.cos(phi), z, s * Math.sin(phi));
        // Pṛthvī biased to the crust; others uniform in volume.
        const u = t === Tattva.Prthvi ? Math.pow(rand(), 0.35) : Math.cbrt(rand());
        const r = r0 + (r1 - r0) * u;
        positions[i * 3] = dir.x * r;
        positions[i * 3 + 1] = dir.y * r;
        positions[i * 3 + 2] = dir.z * r;
        seeds[i * 4] = rand();
        seeds[i * 4 + 1] = rand();
        seeds[i * 4 + 2] = rand();
        seeds[i * 4 + 3] = rand();
        tattvas[i] = t;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    g.setAttribute('aTattva', new THREE.BufferAttribute(tattvas, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), COSMOS_RADIUS * 1.2);
    return g;
  }
}
