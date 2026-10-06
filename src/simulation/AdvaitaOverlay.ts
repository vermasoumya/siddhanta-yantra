/**
 * विवर्त-दृष्टि — AdvaitaOverlay: the perspective shift between the two orders of reality.
 *
 * Source: विवेकचूड़ामणि १११, ११३ — आदि शंकराचार्य
 *   विक्षेपशक्तिर्लिङ्गमादिका महदवसानां तनुते प्रपञ्चम्।
 *   कवलितदिनभर्त्रीव भाति चावृत्या तमसा महता॥
 *   ब्रह्म सत्यं जगन्मिथ्या जीवो ब्रह्मैव नापरः।
 *
 *  • व्यावहारिक (Vyāvahārika): empirical order — bhacakra, grahas, epicycles, seven Vāyu strata.
 *  • पारमार्थिक (Pāramārthika): Vikṣepa withdraws the projected world and Āvaraṇa lifts; every
 *    geometric duality (centre/periphery, deferent/epicycle) collapses into the homogeneous,
 *    self-luminous scalar field B(ω̂) of brahmanField.frag.glsl.
 *
 * The overlay owns the full-screen Brahman field (rendered first, behind everything), mixes the
 * veil levels coming from the Pralaya timeline with its own, and publishes visibility factors for
 * the manifest scene graph. The camera's field of view opens slightly as the observer's
 * standpoint dissolves — there is no longer a privileged centre to frame.
 */

import * as THREE from 'three';
import brahmanFrag from '../shaders/brahmanField.frag.glsl';

export type AdvaitaMode = 'vyavaharika' | 'paramarthika';

const BRAHMAN_VERT = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export interface VeilInput {
  readonly vikshepa: number;
  readonly avarana: number;
}

export class AdvaitaOverlay {
  readonly field: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly baseFov: number;
  private mode: AdvaitaMode = 'vyavaharika';
  private blend = 1;
  /** Pāramārthika amount p ∈ [0,1] (0 = fully empirical). */
  private amount = 0;
  private readonly mahavakya: HTMLDivElement;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.baseFov = camera.fov;

    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uVikshepa: { value: 1 },
      uAvarana: { value: 1 },
      // Shared by reference — always current after camera.updateMatrixWorld / updateProjectionMatrix.
      uInvProjection: { value: camera.projectionMatrixInverse },
      uCameraWorld: { value: camera.matrixWorld },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: BRAHMAN_VERT,
      fragmentShader: brahmanFrag,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.field = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.field.name = 'BrahmanField';
    this.field.frustumCulled = false;
    this.field.renderOrder = -1000;
    scene.add(this.field);

    this.mahavakya = document.createElement('div');
    this.mahavakya.className = 'mahavakya';
    this.mahavakya.innerHTML =
      '<div class="mv-sa">ब्रह्म सत्यं जगन्मिथ्या जीवो ब्रह्मैव नापरः।</div>' +
      '<div class="mv-en">Brahman alone is real · the world is appearance · the self is none other than Brahman</div>' +
      '<div class="mv-src">विवेकचूड़ामणि</div>';
    document.body.appendChild(this.mahavakya);
  }

  /**
   * @param mode        Target order of reality.
   * @param blendFactor How completely `mode` is applied (0 = the other mode, 1 = fully `mode`).
   */
  setMode(mode: AdvaitaMode, blendFactor: number): void {
    this.mode = mode;
    this.blend = THREE.MathUtils.clamp(blendFactor, 0, 1);
    this.amount = mode === 'paramarthika' ? this.blend : 1 - this.blend;
  }

  get currentMode(): AdvaitaMode {
    return this.mode;
  }

  /** Pāramārthika amount p ∈ [0,1]. */
  get paramarthika(): number {
    return this.amount;
  }

  /** Visibility of the manifest world (nāma-rūpa). */
  get manifestVisibility(): number {
    return 1 - smoothstep(0.12, 0.85, this.amount);
  }

  /** Mechanical apparatus — epicycles, tethers, trails — dims first. */
  get mechanismVisibility(): number {
    return 1 - smoothstep(0.0, 0.45, this.amount);
  }

  get vikshepa(): number {
    return 1 - smoothstep(0.08, 0.75, this.amount);
  }

  get avarana(): number {
    return 1 - smoothstep(0.35, 1.0, this.amount);
  }

  setResolution(width: number, height: number): void {
    (this.uniforms.uResolution.value as THREE.Vector2).set(width, height);
  }

  /** Drive the field; `veil` carries the Pralaya timeline's own Vikṣepa / Āvaraṇa levels. */
  update(timeSeconds: number, veil?: VeilInput): void {
    const u = this.uniforms;
    u.uTime.value = timeSeconds;
    u.uVikshepa.value = Math.min(this.vikshepa, veil?.vikshepa ?? 1);
    u.uAvarana.value = Math.min(this.avarana, veil?.avarana ?? 1);

    // Collapse of the privileged frame: the view opens as duality dissolves.
    const fov = this.baseFov + 14 * smoothstep(0.1, 1.0, this.amount);
    if (Math.abs(this.camera.fov - fov) > 1e-3) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    const reveal = (1 - (u.uVikshepa.value as number)) * (1 - (u.uAvarana.value as number));
    const mv = smoothstep(0.35, 0.9, reveal);
    this.mahavakya.style.opacity = mv.toFixed(3);
    this.mahavakya.style.visibility = mv > 0.002 ? 'visible' : 'hidden';
    this.mahavakya.style.transform = `translate(-50%, -50%) scale(${(0.96 + 0.04 * mv).toFixed(4)})`;
  }

  /** Current veil uniforms (shared with other shader passes if needed). */
  getShaderUniforms(): Record<string, THREE.IUniform> {
    return this.uniforms;
  }

  dispose(): void {
    this.field.geometry.dispose();
    this.field.material.dispose();
    this.field.removeFromParent();
    this.mahavakya.remove();
  }
}
