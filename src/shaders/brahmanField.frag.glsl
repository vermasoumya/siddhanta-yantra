// ═══════════════════════════════════════════════════════════════════════════════════════
//  ब्रह्म-क्षेत्र — Advaita continuous unmanifest scalar field (background)
//
//  विवेकचूड़ामणि १११, ११३ — विक्षेपशक्तिर्लिङ्गमादिका महदवसानां तनुते प्रपञ्चम्।
//                         कवलितदिनभर्त्रीव भाति चावृत्या तमसा महता॥
//                         ब्रह्म सत्यं जगन्मिथ्या जीवो ब्रह्मैव नापरः।
//
//  pixel = scene · vikṣepa + (1 − vikṣepa) · (1 − āvaraṇa) · B(ω̂),   Var[B] → 0
//
//  • āvaraṇa (veiling) = 1 : B is hidden behind tamas — a dark, structured nebula whose
//    variance stands for nāma-rūpa (name & form).
//  • vikṣepa (projection) → 0 with āvaraṇa still 1 : the world withdraws, darkness deepens —
//    "तम आसीत्तमसा गूळ्हम्" (Nāsadīya).
//  • āvaraṇa → 0 : the veil lifts; B(ω̂) becomes a homogeneous, self-luminous field. Its
//    variance is proportional to āvaraṇa, so the revealed field is without parts (niṣkala) and
//    without a centre — the same in every direction ω̂.
//
//  The field is a function of the world-space view direction ω̂, so it stays anchored to the
//  sky as the camera turns.
// ═══════════════════════════════════════════════════════════════════════════════════════

uniform float uTime;
uniform vec2  uResolution;
uniform float uVikshepa;
uniform float uAvarana;
uniform mat4  uInvProjection;
uniform mat4  uCameraWorld;

varying vec2 vNdc;

// ───────────────────────── Simplex noise (Ashima Arts / S. Gustavson, MIT) ─────────────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 xg = x_ * ns.x + ns.yyyy;
  vec4 yg = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(xg) - abs(yg);
  vec4 b0 = vec4(xg.xy, yg.xy);
  vec4 b1 = vec4(xg.zw, yg.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int k = 0; k < 5; k++) {
    sum += amp * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.4);
    amp *= 0.5;
  }
  return sum;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  // World-space view direction ω̂.
  vec4 viewPos = uInvProjection * vec4(vNdc, 1.0, 1.0);
  viewPos /= viewPos.w;
  vec3 dir = normalize((uCameraWorld * vec4(viewPos.xyz, 0.0)).xyz);
  float t = uTime;

  // ── आवरण: tamas — the veiling nebula, structured by nāma-rūpa (high variance) ──
  vec3 q = dir * 2.2;
  vec3 warp = vec3(
    fbm(q + vec3(0.0, 0.0, t * 0.010)),
    fbm(q + vec3(5.2, 1.3, 2.1) - t * 0.012),
    fbm(q + vec3(1.7, 9.2, 3.3) + t * 0.008)
  );
  float n = fbm(q + 1.8 * warp);
  float neb = pow(clamp(n * 0.5 + 0.5, 0.0, 1.0), 3.0);
  float filament = pow(clamp(warp.x * 0.5 + 0.5, 0.0, 1.0), 4.0);
  vec3 tamas = vec3(0.004, 0.006, 0.016)
             + vec3(0.050, 0.026, 0.105) * neb
             + vec3(0.012, 0.040, 0.070) * filament
             + vec3(0.040, 0.022, 0.010) * pow(clamp(warp.y * 0.5 + 0.5, 0.0, 1.0), 6.0);

  // Withdrawal of vikṣepa with the veil intact: the darkness of the Nāsadīya.
  float withdrawal = (1.0 - uVikshepa) * uAvarana;
  tamas *= 1.0 - 0.85 * withdrawal;

  // ── ब्रह्म: B(ω̂) — homogeneous self-luminosity; Var[B] ∝ āvaraṇa ──
  float variance = uAvarana;
  float ananda = 0.035 * sin(t * 0.55);               // the slow "breath" of ānanda
  float lum = 1.0 + variance * 0.6 * n + ananda;
  vec3 brahman = vec3(1.0, 0.94, 0.80) * lum;

  // Transitional vivarta shimmer: the last traces of form dissolving in the light.
  float reveal = (1.0 - uVikshepa) * (1.0 - uAvarana);
  float shimmer = (1.0 - abs(reveal * 2.0 - 1.0)) * 0.25 * fbm(dir * 6.0 + t * 0.15);
  brahman += vec3(0.6, 0.45, 0.25) * shimmer;

  vec3 col = mix(tamas, brahman, smoothstep(0.0, 1.0, reveal));

  // Faint dither against banding.
  col += (hash12(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) / 255.0;
  // Keep aspect awareness for very wide screens (soft vignette under the veil only).
  vec2 sc = gl_FragCoord.xy / max(uResolution, vec2(1.0)) - 0.5;
  col *= 1.0 - 0.35 * uAvarana * dot(sc, sc);

  gl_FragColor = vec4(col, 1.0);
}
