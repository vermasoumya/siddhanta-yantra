// ═══════════════════════════════════════════════════════════════════════════════════════
//  प्रलय-संहार — Pralaya collapse : multi-phase elemental dissolution (fragment)
//
//  Each tattva is rendered through its own tanmātra (Taittirīya 2.1 / Tattvabodha):
//    पृथ्वी  (gandha) — hard-edged granular matter
//    आपः   (rasa)   — droplet with a specular glint
//    तेजस्  (rūpa)   — incandescent plasma with a white-hot core (black-body ramp)
//    वायु   (sparśa) — soft rotating wisp
//    आकाश  (śabda)  — concentric sound-ripple rings
//  Avyakta has no form: weights → 0, the sprite vanishes.
//
//  Output is additive (THREE.AdditiveBlending): rgb · a is accumulated onto the frame.
// ═══════════════════════════════════════════════════════════════════════════════════════

uniform float uTime;
uniform float uEmissive;
uniform float uSpecular;

varying vec3  vColor;
varying float vAlpha;
varying float vHeat;
varying vec4  vW;
varying float vAkasha;
varying float vSeed;
varying float vFlood;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Black-body ramp for Tejas: deep red → orange → yellow-white.
vec3 blackbody(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = vec3(1.0, 0.18 + 0.72 * t, 0.03 + 0.85 * t * t);
  return c * (0.7 + 0.9 * t);
}

void main() {
  if (vAlpha < 0.002) discard;
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = length(uv);
  if (d > 1.0) discard;

  // पृथ्वी — granular, hard-edged
  float grain = 0.55 + 0.45 * hash12(floor((uv + vSeed * 7.0) * 4.0));
  float prthvi = (1.0 - smoothstep(0.55, 0.78, d)) * grain;

  // आपः — droplet with specular highlight (rasa)
  vec2 hl = uv - vec2(-0.32, 0.32);
  float apas = (1.0 - smoothstep(0.35, 1.0, d)) * 0.8 + (0.4 + uSpecular) * exp(-20.0 * dot(hl, hl));

  // तेजस् — plasma, white-hot core
  float flick = 0.85 + 0.15 * sin(uTime * 13.0 + vSeed * 61.0);
  float tejas = (exp(-3.2 * d * d) + 0.9 * exp(-26.0 * d * d)) * flick;

  // वायु — rotating wisp (sparśa)
  float ang = atan(uv.y, uv.x);
  float vayu = (1.0 - smoothstep(0.15, 1.0, d)) * (0.55 + 0.45 * sin(ang * 2.0 + uTime * 3.0 + vSeed * 20.0));

  // आकाश — concentric śabda ripple
  float akasha = (0.5 + 0.5 * cos(d * 18.0 - uTime * 4.0 - vSeed * 12.0)) * (1.0 - smoothstep(0.35, 1.0, d)) * 0.75;

  float shape = dot(vW, vec4(prthvi, apas, tejas, vayu)) + vAkasha * akasha;

  vec3 col = vColor;
  float heat = clamp(vHeat, 0.0, 1.0);
  col = mix(col, blackbody(heat * (1.0 - 0.5 * d)), heat * 0.85);
  col *= 1.0 + uEmissive * heat * 1.5;
  // Flood waters shimmer
  col += vec3(0.15, 0.35, 0.5) * vFlood * (0.5 + 0.5 * sin(uTime * 2.0 + vSeed * 30.0));

  float a = clamp(shape * vAlpha, 0.0, 1.0);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}
