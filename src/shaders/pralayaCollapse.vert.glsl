// ═══════════════════════════════════════════════════════════════════════════════════════
//  प्रलय-संहार — Pralaya collapse : vertex displacement for cosmological dissolution
//
//  श्रीमद्भागवत १२.४ · महाभारत शान्तिपर्व २३१–२३३
//    भूमिः सलिलत्वमुपगच्छति… सलिलाच्चैवोत्तस्थौ तेजः… ततस्तेजः शाम्यति वातेन…
//    वातश्चाकाशं प्रतिपद्यते।
//
//  Prākṛtika laya runs creation (Taittirīya 2.1) backwards:
//    Pṛthvī —melts→ Āpas —evaporates→ Tejas —quelled by→ Vāyu —rests in→ Ākāśa —merges→ Avyakta
//
//  uLaya ∈ [0,5]. Every particle carries its native tattva (aTattva: 0 Ākāśa … 4 Pṛthvī).
//  Its present (continuous) element is   e_p = min(tattva_p, 4 − L)   — the laya front reaches
//  a particle only when the dissolution has descended to its own element. e_p < 0 ⇒ Avyakta.
//  Each element owns a "home" configuration; the particle is interpolated between the homes of
//  the two elements that bracket e_p.
//
//  Gross colour per element follows Pañcīkaraṇa:  M = 0.375·I + 0.125·J
//    (0.5 of its own sūkṣma tattva + 0.125 of each of the other four).
//
//  Also drives: Nitya pralaya (per-particle birth/decay life cycle), Naimittika pralaya
//  (the deluge of the trilokī) and Ātyantika pralaya (total fade — Māyā-nivṛtti).
// ═══════════════════════════════════════════════════════════════════════════════════════

uniform float uTime;
uniform float uLaya;          // 0 = fully manifest … 5 = Avyakta
uniform float uNitya;         // 0…1 intensity of momentary decay
uniform float uFlood;         // 0…1 Naimittika deluge level
uniform float uFloodRadius;   // radius reached by the deluge (trilokī)
uniform float uAtyantika;     // 0…1 Māyā-nivṛtti
uniform float uVikshepa;      // 1 = Vyāvahārika projection, 0 = projection withdrawn
uniform float uPanca[5];      // aggregate Pañcīkaraṇa composition under laya (sums to 1)
uniform vec3  uTattvaColor;   // composition-weighted tattva-varṇa
uniform float uEmissive;
uniform float uFluidity;
uniform float uDensity;
uniform vec3  uAxis;          // ω̂_dhruva
uniform float uPointScale;    // drawingBufferHeight / 2
uniform float uSize;
uniform float uBhuRadius;
uniform float uCosmosRadius;

attribute vec4  aSeed;
attribute float aTattva;

varying vec3  vColor;
varying float vAlpha;
varying float vHeat;
varying vec4  vW;       // (Pṛthvī, Āpas, Tejas, Vāyu) weights
varying float vAkasha;  // Ākāśa (+ Avyakta) weight
varying float vSeed;
varying float vFlood;

// ───────────────────────── Tattva-varṇa (Ṣaṭcakra-nirūpaṇa) ─────────────────────────
const vec3 C_AKASHA = vec3(0.12, 0.10, 0.42);
const vec3 C_VAYU   = vec3(0.55, 0.60, 0.66);
const vec3 C_TEJAS  = vec3(1.00, 0.32, 0.08);
const vec3 C_APAS   = vec3(0.82, 0.92, 0.98);
const vec3 C_PRTHVI = vec3(0.86, 0.66, 0.20);

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

vec3 noiseVec(vec3 p) {
  return vec3(
    snoise(p),
    snoise(p + vec3(31.416, 17.23, 9.11)),
    snoise(p + vec3(-7.31, 45.17, 23.71))
  );
}

// Rodrigues rotation about a unit axis.
vec3 rotateAbout(vec3 p, vec3 axis, float ang) {
  float c = cos(ang);
  float s = sin(ang);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

vec3 seedDir(vec4 s) {
  float u = s.y * 2.0 - 1.0;
  float th = s.z * 6.28318530718;
  float rho = sqrt(max(1.0 - u * u, 0.0));
  return vec3(rho * cos(th), u, rho * sin(th));
}

// Uniform point in the ball of radius uCosmosRadius — the still pervasion of Ākāśa.
vec3 ballPoint(vec4 s) {
  return seedDir(s.wzyx) * uCosmosRadius * pow(max(s.w, 1e-4), 1.0 / 3.0);
}

float isClass(float cls, float k) {
  return step(k - 0.5, cls) * step(cls, k + 0.5);
}

void main() {
  vec3 base = position;
  float r0 = length(base);
  vec3 dir0 = r0 > 1e-4 ? base / r0 : seedDir(aSeed);
  float t = uTime;
  float L = clamp(uLaya, 0.0, 5.0);
  float cls = aTattva;

  // ── Present element e_p = min(tattva_p, 4 − L) and bracketing weights ──
  float ep = min(cls, 4.0 - L);
  float w4 = clamp(1.0 - abs(ep - 4.0), 0.0, 1.0);
  float w3 = clamp(1.0 - abs(ep - 3.0), 0.0, 1.0);
  float w2 = clamp(1.0 - abs(ep - 2.0), 0.0, 1.0);
  float w1 = clamp(1.0 - abs(ep - 1.0), 0.0, 1.0);
  float w0 = clamp(1.0 - abs(ep), 0.0, 1.0);
  float wA = clamp(-ep, 0.0, 1.0);

  // ── पृथ्वी: the solid crust — rigid, motionless ──
  vec3 hP = base;

  // ── आपः: melting — a fluid film flowing tangentially over Bhū (tidal ripple) ──
  vec3 fl = noiseVec(dir0 * 2.2 + vec3(0.0, t * 0.12, aSeed.x * 3.0));
  vec3 tang = fl - dir0 * dot(fl, dir0);
  float ripple = 0.03 * sin(t * 1.7 + aSeed.x * 40.0);
  vec3 hA = normalize(dir0 + tang * 0.45 * uFluidity) * (max(r0, uBhuRadius) + 0.02 + ripple);

  // ── तेजस्: evaporation — rising turbulent plasma; native Tejas flickers in the solar sphere ──
  vec3 turb = noiseVec(dir0 * 1.5 + vec3(t * 0.4, -t * 0.3, aSeed.z * 10.0));
  float rFire = mix(1.3, 7.5, aSeed.y) + 0.6 * turb.x;
  vec3 hTgen = normalize(dir0 + turb * 0.35) * rFire;
  vec3 hT = mix(hTgen, base + turb * 0.3, isClass(cls, 2.0));

  // ── वायु: fire quelled by wind — swept westward into the Dhruva vortex (Parāvaha) ──
  float rWind = mix(2.0, uCosmosRadius * 0.9, aSeed.w);
  vec3 bandDir = normalize(dir0 - uAxis * dot(dir0, uAxis) * 0.7 + 1e-4);
  vec3 windBase = mix(bandDir * rWind, base, isClass(cls, 1.0));
  float omega = (0.9 + 0.6 * aSeed.x) * 2.2 / sqrt(max(length(windBase), 1.0));
  vec3 hV = rotateAbout(windBase, uAxis, -t * omega) + noiseVec(windBase * 0.3 + t * 0.2) * 0.2;

  // ── आकाश: rest — uniform, still pervasion; only a slow śabda tremor remains ──
  vec3 kBase = mix(ballPoint(aSeed), base, isClass(cls, 0.0));
  vec3 hK = kBase + noiseVec(kBase * 0.15 + t * 0.05) * 0.08;

  vec3 p = w4 * hP + w3 * hA + w2 * hT + w1 * hV + (w0 + wA) * hK;

  // ── अव्यक्त: Ākāśa merges into the Unmanifest — contraction into the bindu ──
  float merge = smoothstep(0.0, 1.0, wA);
  p = rotateAbout(p, uAxis, merge * merge * 6.0);
  p *= 1.0 - merge * 0.995;

  // ── नित्य प्रलय: momentary birth & decay of every particle ──
  float kappa = 0.18 + 0.4 * aSeed.y;
  float life = fract(t * kappa + aSeed.x);
  float nityaA = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.6, 1.0, life));
  p += noiseVec(p * 3.0 + t) * 0.015 * uNitya;

  // ── नैमित्तिक प्रलय: the deluge rises over the trilokī; earthy matter floats in its currents ──
  float earthy = step(2.5, cls);
  float rNow = length(p);
  vec3 dirNow = rNow > 1e-4 ? p / rNow : dir0;
  float rFlood = mix(uBhuRadius, uFloodRadius, uFlood);
  vec3 floodPos = rotateAbout(dirNow * mix(uBhuRadius * 1.02, rFlood, aSeed.z), uAxis, t * (0.15 + 0.2 * aSeed.y));
  float floodMix = earthy * uFlood * (1.0 - clamp(L, 0.0, 1.0));
  p = mix(p, floodPos, floodMix);
  rNow = length(p);
  float submerged = uFlood * (1.0 - smoothstep(rFlood - 0.3, rFlood + 0.2, rNow));
  vFlood = max(submerged * 0.6, floodMix);

  // ── Visibility ──
  // Manifest state: Pṛthvī/Āpas hidden under the Bhū-gola mesh, Tejas within the Sun,
  // only a faint Vāyu dust and Ākāśa haze remain visible.
  float aManifest = isClass(cls, 1.0) * 0.22 + isClass(cls, 0.0) * 0.10 + earthy * 0.65 * uNitya;
  float aLaya = (w4 * 0.85 + w3 * 0.75 + w2 * 1.0 + w1 * 0.5 + w0 * 0.32) * (1.0 - wA);
  float engage = smoothstep(0.0, 0.2, L);
  float alpha = mix(aManifest, aLaya, engage);
  alpha = max(alpha, vFlood * 0.7);
  alpha *= mix(1.0, nityaA, uNitya);
  alpha *= (1.0 - uAtyantika) * uVikshepa;

  // ── Pañcīkaraṇa gross colours: 0.375·own + 0.125·Σ all ──
  vec3 sumC = C_AKASHA + C_VAYU + C_TEJAS + C_APAS + C_PRTHVI;
  vec3 gK = 0.375 * C_AKASHA + 0.125 * sumC;
  vec3 gV = 0.375 * C_VAYU + 0.125 * sumC;
  vec3 gT = 0.375 * C_TEJAS + 0.125 * sumC;
  vec3 gA = 0.375 * C_APAS + 0.125 * sumC;
  vec3 gP = 0.375 * C_PRTHVI + 0.125 * sumC;
  vec3 col = w4 * gP + w3 * gA + w2 * gT + w1 * gV + (w0 + wA) * gK;
  col = mix(col, uTattvaColor, 0.25);
  col = mix(col, vec3(0.55, 0.85, 1.0), vFlood * 0.6);

  // Predominant tattva of the aggregate glows brighter (vaiśeṣya).
  float predominance = w0 * uPanca[0] + w1 * uPanca[1] + w2 * uPanca[2] + w3 * uPanca[3] + w4 * uPanca[4];
  col *= 0.7 + 1.5 * predominance;

  vColor = col;
  vAlpha = alpha;
  vHeat = clamp(w2 + 0.25 * w1, 0.0, 1.0) * (0.6 + 0.4 * uEmissive);
  vW = vec4(w4, w3, w2, w1);
  vAkasha = w0 + wA * 0.5;
  vSeed = aSeed.x;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = (w4 * (1.6 + uDensity) + w3 * 2.4 + w2 * 3.6 + w1 * 2.2 + w0 * 1.8) * (1.0 - 0.9 * wA);
  size *= uSize * (0.6 + 0.8 * aSeed.z) * (1.0 + 0.6 * vFlood);
  gl_PointSize = alpha < 0.002 ? 0.0 : clamp(size * uPointScale / max(-mv.z, 0.05), 0.0, 48.0);
}
