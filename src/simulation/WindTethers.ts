/**
 * वात-रश्मि — WindTethers: the cords of wind that bind every graha to Dhruva.
 *
 * Sources:
 *   सूर्यसिद्धान्त २.२ — तद्वातविशिखैर्बद्धास्तेऽपकृष्यन्त मूर्त्तयः।
 *   महाभारत शान्तिपर्व — महारूपो महाघोरः परावह इहोच्यते। येन चक्रं समाविद्धं ध्रुवस्यैतन्नभस्तले॥
 *
 * Each tether is a cubic Bézier from Dhruva (on the ω̂ axis) to the graha. Its shape encodes
 * the state of the Vāyu stratum (VayuState) that carries the graha:
 *
 *   tension  τ = |ω_layer| / (|ω_layer| + ω₀)                 ∈ [0, 1)
 *   sag      s = (1 − τ) · s₀ · |P − D|                        (a slack cord droops toward Bhū)
 *   sweep    w = sgn(ω_layer) · τ · w₀ · |P − D| · (ω̂ × P̂)      (the wind drags the cord along)
 *
 * Opacity pulses at a frequency that rises with τ, and a luminous bead (prāṇa) travels along the
 * cord from Dhruva to the graha — the impulse of Parāvaha transmitted down the tether.
 */

import * as THREE from 'three';
import { GRAHA_BY_ID, type GrahaId } from '../data/planetaryConstants';
import { VAYU_LAYER_COUNT, type VayuState } from '../math/vayuDynamics';
import { AXIS, getGlowTexture } from './CelestialSphere';

const SEGMENTS = 64;
const OMEGA_0 = 6; // °/s at which tension reaches ½
const SAG_0 = 0.32;
const SWEEP_0 = 0.28;
const DHRUVA_HEX = 0xffe2a0;

interface Tether {
  readonly id: string;
  readonly layerIndex: number;
  readonly line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly bead: THREE.Sprite;
  readonly color: THREE.Color;
  phase: number;
  tension: number;
}

export class WindTethers {
  readonly group = new THREE.Group();

  private readonly dhruva: THREE.Vector3;
  private readonly tethers = new Map<string, Tether>();
  private readonly dhruvaColor = new THREE.Color(DHRUVA_HEX);
  private readonly curve = new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Color();
  private readonly pt = new THREE.Vector3();
  private time = 0;
  private lastStamp = -1;
  private opacity = 1;

  /**
   * @param scene          Parent (a THREE.Scene or the bhacakra frame — Dhruva lies on the axis,
   *                       so its position is identical in both).
   * @param dhruvaPosition Anchor of every cord.
   */
  constructor(scene: THREE.Scene | THREE.Object3D, dhruvaPosition: THREE.Vector3) {
    this.dhruva = dhruvaPosition.clone();
    this.group.name = 'WindTethers';
    scene.add(this.group);
  }

  get pickables(): THREE.Object3D[] {
    return [...this.tethers.values()].map((t) => t.line);
  }

  /** Current tension τ ∈ [0,1) of a graha's tether (for the inspector). */
  getTension(id: string): number {
    return this.tethers.get(id)?.tension ?? 0;
  }

  update(vayuState: VayuState, planetPositions: Record<string, THREE.Vector3>): void {
    const now = performance.now() / 1000;
    const dt = this.lastStamp < 0 ? 0 : Math.min(now - this.lastStamp, 0.1);
    this.lastStamp = now;
    this.time += dt;

    for (const id of Object.keys(planetPositions)) {
      const t = this.ensure(id);
      const P = planetPositions[id];
      const rate = vayuState.layerRates[t.layerIndex] ?? vayuState.bhacakraRate;
      const tension = Math.abs(rate) / (Math.abs(rate) + OMEGA_0);
      t.tension += (tension - t.tension) * Math.min(1, dt * 4 + 0.02);
      this.shape(t, P, Math.sign(rate) || 1);

      // Pulsing glow — faster, brighter when the wind pulls hard.
      const freq = 0.6 + 3.2 * t.tension;
      t.phase = (t.phase + dt * freq) % 1;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * (1.5 + 4 * t.tension) + t.layerIndex);
      t.line.material.opacity = this.opacity * (0.28 + 0.42 * t.tension + 0.25 * pulse);

      // Prāṇa bead travelling Dhruva → graha.
      this.curve.getPoint(t.phase, this.pt);
      t.bead.position.copy(this.pt);
      const s = 0.35 + 0.5 * t.tension;
      t.bead.scale.setScalar(s * (0.8 + 0.4 * Math.sin(t.phase * Math.PI)));
      t.bead.material.opacity = this.opacity * Math.sin(t.phase * Math.PI) * (0.5 + 0.5 * t.tension);
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setOpacity(opacity: number): void {
    this.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    for (const t of this.tethers.values()) {
      t.line.visible = this.opacity > 0.003;
      t.bead.visible = this.opacity > 0.003;
    }
  }

  dispose(): void {
    for (const t of this.tethers.values()) {
      t.line.geometry.dispose();
      t.line.material.dispose();
      t.bead.material.dispose();
    }
    this.tethers.clear();
    this.group.removeFromParent();
  }

  // ───────────────────────────── internals ─────────────────────────────

  private ensure(id: string): Tether {
    const existing = this.tethers.get(id);
    if (existing) return existing;
    const graha = GRAHA_BY_ID[id as GrahaId];
    const layerIndex = THREE.MathUtils.clamp((graha?.vayuLayer ?? VAYU_LAYER_COUNT) - 1, 0, VAYU_LAYER_COUNT - 1);

    const positions = new Float32Array((SEGMENTS + 1) * 3);
    const colors = new Float32Array((SEGMENTS + 1) * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.name = `tether:${id}`;
    line.frustumCulled = false;
    line.renderOrder = 2;
    if (graha) line.userData.pick = { kind: 'tether', id: graha.id };

    const color = new THREE.Color(graha ? graha.color : 0xffffff);
    const bead = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    bead.renderOrder = 4;

    const t: Tether = { id, layerIndex, line, positions, colors, bead, color, phase: Math.random(), tension: 0 };
    this.tethers.set(id, t);
    this.group.add(line, bead);
    return t;
  }

  private shape(t: Tether, P: THREE.Vector3, dir: number): void {
    const D = this.dhruva;
    const span = this.tmpA.subVectors(P, D).length();

    // Sag toward Bhū (the cord droops inward when slack).
    const sag = (1 - t.tension) * SAG_0 * span;
    // Sweep along the wind: ω̂ × P̂ is the eastward tangent at the graha.
    const sweepDir = this.tmpB.crossVectors(AXIS, P).normalize();
    const sweep = dir * t.tension * SWEEP_0 * span;

    const c = this.curve;
    c.v0.copy(D);
    c.v3.copy(P);
    c.v1.lerpVectors(D, P, 0.33);
    c.v2.lerpVectors(D, P, 0.7);
    // Inward droop: scale control points toward the origin.
    const inward1 = c.v1.length() > 1e-6 ? sag / c.v1.length() : 0;
    const inward2 = c.v2.length() > 1e-6 ? (sag * 0.8) / c.v2.length() : 0;
    c.v1.multiplyScalar(Math.max(0.2, 1 - inward1));
    c.v2.multiplyScalar(Math.max(0.2, 1 - inward2));
    // Wind drag lags the cord behind the graha's eastward carriage.
    c.v1.addScaledVector(sweepDir, -sweep * 0.35);
    c.v2.addScaledVector(sweepDir, -sweep);

    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      c.getPoint(u, this.pt);
      t.positions[i * 3] = this.pt.x;
      t.positions[i * 3 + 1] = this.pt.y;
      t.positions[i * 3 + 2] = this.pt.z;
      // Gradient: Dhruva gold → graha hue, brightest near both anchors.
      const glow = 0.45 + 0.55 * (Math.pow(1 - u, 6) + Math.pow(u, 4));
      this.tmpC.copy(this.dhruvaColor).lerp(t.color, Math.pow(u, 0.7)).multiplyScalar(glow * (0.6 + 0.6 * t.tension));
      t.colors[i * 3] = this.tmpC.r;
      t.colors[i * 3 + 1] = this.tmpC.g;
      t.colors[i * 3 + 2] = this.tmpC.b;
    }
    const g = t.line.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    g.computeBoundingSphere();
  }
}
