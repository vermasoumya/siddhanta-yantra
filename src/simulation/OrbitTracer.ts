/**
 * वक्र-गति पथ — OrbitTracer: high-resolution 3D trails that reveal authentic vakra loops.
 *
 * Source: सूर्यसिद्धान्त २.१–३ (शीघ्रमन्दोच्चपाताख्या ग्रहाणां गतिकारकाः) and २.१२ (अष्टधा गतिः).
 *
 * Each graha keeps a circular buffer (ring) of its recent sphuṭa positions. Every sample is
 * classified by the sign of dλ between successive samples (λ measured in the ecliptic plane of
 * the bhacakra frame, +Y = north ecliptic pole):
 *   dλ < 0 ⇒ vakra (retrograde)   — drawn in the vakra hue
 *   dλ ≥ 0 ⇒ mārgī (direct)       — drawn in the graha's own hue
 * Brightness falls off with age so the trail reads as a comet-like history of motion.
 *
 * The tracer may be parented to any Object3D. Parent it to the bhacakra-aligned frame so that the
 * diurnal sweep of Parāvaha does not smear the loops.
 */

import * as THREE from 'three';
import { GRAHA_BY_ID, type GrahaId } from '../data/planetaryConstants';

const TWO_PI = Math.PI * 2;
const VAKRA_HEX = 0xff4f9a;

interface Trail {
  readonly id: string;
  /** Circular buffer of historical positions. */
  readonly ring: THREE.Vector3[];
  /** 1 where the sample was taken during vakra motion. */
  readonly vakra: Uint8Array;
  readonly longitudes: Float64Array;
  head: number;
  count: number;
  dirty: boolean;
  readonly color: THREE.Color;
  readonly line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly positions: Float32Array;
  readonly colors: Float32Array;
}

function eclipticLongitude(p: THREE.Vector3): number {
  // Inverse of sphericalToCartesian (x = r cos λ, z = −r sin λ). Display-only classification.
  const l = Math.atan2(-p.z, p.x);
  return l < 0 ? l + TWO_PI : l;
}

function wrapPi(a: number): number {
  let d = a % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

export class OrbitTracer {
  /** Container for every trail line. */
  readonly group = new THREE.Group();

  private readonly trails = new Map<string, Trail>();
  private readonly maxPoints: number;
  private readonly vakraColor = new THREE.Color(VAKRA_HEX);
  private readonly tmp = new THREE.Color();
  private opacity = 1;

  /**
   * @param scene    Parent object (a THREE.Scene or a bhacakra-aligned frame).
   * @param maxPoints Capacity of each graha's position ring.
   */
  constructor(scene: THREE.Scene | THREE.Object3D, maxPoints = 720) {
    this.maxPoints = Math.max(8, Math.floor(maxPoints));
    this.group.name = 'OrbitTracer';
    scene.add(this.group);
  }

  get capacity(): number {
    return this.maxPoints;
  }

  /** Raycast targets — each carries a `{ kind: 'trail', id }` pick tag. */
  get pickables(): THREE.Object3D[] {
    return [...this.trails.values()].map((t) => t.line);
  }

  /** Append the latest position of each graha supplied. */
  update(planetPositions: Record<string, THREE.Vector3>): void {
    for (const id of Object.keys(planetPositions)) {
      this.push(this.ensure(id), planetPositions[id]);
    }
    this.flush();
  }

  /** Replace a graha's history with a pre-sampled path (x, y, z triples, oldest first). */
  seed(id: string, xyz: ArrayLike<number>): void {
    const t = this.ensure(id);
    t.head = 0;
    t.count = 0;
    const v = new THREE.Vector3();
    const n = Math.floor(xyz.length / 3);
    const start = Math.max(0, n - this.maxPoints);
    for (let i = start; i < n; i++) {
      v.set(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]);
      this.push(t, v);
    }
    this.flush();
  }

  /** Tint a trail (defaults to the graha colour from planetaryConstants). */
  setColor(id: string, color: THREE.ColorRepresentation): void {
    const t = this.ensure(id);
    t.color.set(color);
    t.dirty = true;
    this.flush();
  }

  /** Whether the most recent sample of a graha was vakra. */
  isVakra(id: string): boolean {
    const t = this.trails.get(id);
    if (!t || t.count === 0) return false;
    return t.vakra[(t.head - 1 + this.maxPoints) % this.maxPoints] === 1;
  }

  clear(): void {
    for (const t of this.trails.values()) {
      t.head = 0;
      t.count = 0;
      t.dirty = true;
    }
    this.flush();
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Master opacity (driven by Pralaya / Advaita fades). */
  setOpacity(opacity: number): void {
    const o = THREE.MathUtils.clamp(opacity, 0, 1);
    if (Math.abs(o - this.opacity) < 1e-3) return;
    this.opacity = o;
    for (const t of this.trails.values()) t.line.material.opacity = o;
    this.group.children.forEach((c) => (c.visible = o > 0.003));
  }

  dispose(): void {
    for (const t of this.trails.values()) {
      t.line.geometry.dispose();
      t.line.material.dispose();
      this.group.remove(t.line);
    }
    this.trails.clear();
    this.group.removeFromParent();
  }

  // ───────────────────────────── internals ─────────────────────────────

  private ensure(id: string): Trail {
    const existing = this.trails.get(id);
    if (existing) return existing;

    const cap = this.maxPoints;
    const positions = new Float32Array(cap * 3);
    const colors = new Float32Array(cap * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: this.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.name = `trail:${id}`;
    line.frustumCulled = false;
    line.renderOrder = 3;
    if (id in GRAHA_BY_ID) line.userData.pick = { kind: 'trail', id: id as GrahaId };

    const graha = GRAHA_BY_ID[id as GrahaId];
    const trail: Trail = {
      id,
      ring: Array.from({ length: cap }, () => new THREE.Vector3()),
      vakra: new Uint8Array(cap),
      longitudes: new Float64Array(cap),
      head: 0,
      count: 0,
      dirty: true,
      color: new THREE.Color(graha ? graha.color : 0xffffff),
      line,
      positions,
      colors,
    };
    this.trails.set(id, trail);
    this.group.add(line);
    return trail;
  }

  private push(t: Trail, p: THREE.Vector3): void {
    const cap = this.maxPoints;
    const lambda = eclipticLongitude(p);
    let vakra = 0;
    if (t.count > 0) {
      const prev = (t.head - 1 + cap) % cap;
      const d = wrapPi(lambda - t.longitudes[prev]);
      // Retain the previous classification across exact stations (dλ = 0).
      vakra = d < 0 ? 1 : d > 0 ? 0 : t.vakra[prev];
    }
    t.ring[t.head].copy(p);
    t.longitudes[t.head] = lambda;
    t.vakra[t.head] = vakra;
    t.head = (t.head + 1) % cap;
    t.count = Math.min(t.count + 1, cap);
    t.dirty = true;
  }

  private flush(): void {
    for (const t of this.trails.values()) {
      if (!t.dirty) continue;
      t.dirty = false;
      const cap = this.maxPoints;
      const n = t.count;
      const denom = Math.max(1, n - 1);
      for (let k = 0; k < n; k++) {
        const idx = (t.head - n + k + cap) % cap;
        const v = t.ring[idx];
        t.positions[k * 3] = v.x;
        t.positions[k * 3 + 1] = v.y;
        t.positions[k * 3 + 2] = v.z;
        const age = k / denom; // 0 oldest → 1 newest
        const b = 0.05 + 0.95 * Math.pow(age, 1.6);
        this.tmp.copy(t.vakra[idx] ? this.vakraColor : t.color).multiplyScalar(t.vakra[idx] ? b * 1.25 : b);
        t.colors[k * 3] = this.tmp.r;
        t.colors[k * 3 + 1] = this.tmp.g;
        t.colors[k * 3 + 2] = this.tmp.b;
      }
      const g = t.line.geometry;
      g.setDrawRange(0, n);
      (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      if (n > 1) g.computeBoundingSphere();
    }
  }
}
