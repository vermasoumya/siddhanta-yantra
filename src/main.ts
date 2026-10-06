/**
 * सिद्धांत-यंत्र — Siddhānta-Yantra entry point.
 *
 * Assembles the scene and drives the frame loop:
 *   काल (ahargaṇa clock) → VayuState → EpicycleEngine → CelestialSphere / grahas / epicycles
 *   → OrbitTracer · WindTethers → PralayaEngine ⇄ AdvaitaOverlay → HUD readout → render.
 *
 * The grahas, their kakṣyā (deferent), manda & śīghra epicycles and karṇa are built here inside
 * CelestialSphere.bhacakra (the ecliptic frame borne westward by Parāvaha), so that trails and
 * tethers parented to the same frame share one coordinate system.
 */

import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { GRAHAS, GRAHA_BY_ID, RASHI_NAMES, SIDEREAL_YEAR_DAYS, VARA_NAMES, type GrahaConstants, type GrahaId } from './data/planetaryConstants';
import type { ShlokaId } from './data/shlokas';
import {
  EpicycleEngine,
  GATI_NAMES,
  aharganaFromDate,
  dateFromAhargana,
  traceOrbit,
  type EpicycleFrame,
  type GrahaState,
} from './math/epicycleEngine';
import { formatRashi } from './math/suryaTrig';
import { VAYU_LAYER_COUNT, VayuState, layerIndexOfGraha, vayuFormula } from './math/vayuDynamics';
import { AdvaitaOverlay } from './simulation/AdvaitaOverlay';
import { CelestialSphere, getGlowTexture, makeLabel, resolvePick, type PickTag } from './simulation/CelestialSphere';
import { OrbitTracer } from './simulation/OrbitTracer';
import { MaterialFader, PralayaEngine } from './simulation/PralayaEngine';
import { WindTethers } from './simulation/WindTethers';
import { OverlayUI, type GrahaReadout, type LayerKey } from './ui/OverlayUI';
import { ShlokaInspector, type ShlokaContext } from './ui/ShlokaInspector';

// ───────────────────────────── DOM ─────────────────────────────

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[Siddhānta-Yantra] missing #${id} in index.html`);
  return el as T;
}

const canvasHost = byId<HTMLDivElement>('webgl-canvas');
const labelHost = byId<HTMLDivElement>('label-layer');
const hudHost = byId<HTMLDivElement>('hud-overlay');
const shlokaHost = byId<HTMLDivElement>('shloka-modal');
const bootEl = document.getElementById('boot');

// ───────────────────────────── Renderer / camera / controls ─────────────────────────────

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  if (bootEl) bootEl.querySelector('.boot-en')!.textContent = 'WebGL is unavailable in this browser.';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05060f, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasHost.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
labelHost.style.pointerEvents = 'none';
labelHost.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 600);
const HOME_POSITION = new THREE.Vector3(20, 15, 38);
camera.position.copy(HOME_POSITION);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2.4;
controls.maxDistance = 150;
controls.rotateSpeed = 0.6;
controls.target.set(0, 0, 0);
controls.update();

scene.add(new THREE.AmbientLight(0x3a4670, 0.55));
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x1a1020, 0.35));

// ───────────────────────────── Simulation modules ─────────────────────────────

const vayuState = new VayuState();
const epicycle = new EpicycleEngine({ latitudeScale: 2.5 });

const celestial = new CelestialSphere();
scene.add(celestial.root);

const advaita = new AdvaitaOverlay(scene, camera);
const pralaya = new PralayaEngine(scene);

// Grahas + epicycle apparatus (in the bhacakra / ecliptic frame).
const UNIT_CIRCLE = (() => {
  const seg = 128;
  const pts: number[] = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    pts.push(Math.cos(a), 0, -Math.sin(a));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
})();

interface FadingLine {
  readonly material: THREE.LineBasicMaterial;
  readonly base: number;
}

interface GrahaView {
  readonly g: GrahaConstants;
  readonly body: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  readonly glow: THREE.Sprite;
  readonly glowBase: number;
  readonly deferent: THREE.LineLoop;
  readonly manda: THREE.LineLoop;
  readonly shighra: THREE.LineLoop;
  readonly arms: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly armPositions: Float32Array;
  readonly position: THREE.Vector3;
  /** Simulated days accumulated since the last trail sample. */
  trailAccum: number;
}

const epicycleRoot = new THREE.Group();
epicycleRoot.name = 'EpicycleApparatus';
epicycleRoot.userData.fadeExempt = true; // faded explicitly by the mechanism factor
celestial.bhacakra.add(epicycleRoot);

const grahaRoot = new THREE.Group();
grahaRoot.name = 'Grahas';
celestial.bhacakra.add(grahaRoot);

const fadingLines: FadingLine[] = [];
const grahaPickables: THREE.Object3D[] = [];
const views = new Map<GrahaId, GrahaView>();
const planetPositions: Record<string, THREE.Vector3> = {};

function lineMaterial(color: THREE.ColorRepresentation, opacity: number): THREE.LineBasicMaterial {
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  fadingLines.push({ material: m, base: opacity });
  return m;
}

for (const g of GRAHAS) {
  const color = new THREE.Color(g.color);
  const pick = { kind: 'graha', id: g.id } satisfies PickTag;
  const epiPick = { kind: 'epicycle', id: g.id } satisfies PickTag;

  const body = new THREE.Mesh(new THREE.SphereGeometry(g.bodyRadius, 32, 20), new THREE.MeshBasicMaterial({ color }));
  body.name = `Graha-${g.nameIAST}`;
  body.userData.pick = pick;
  const glowBase = g.id === 'surya' ? 0.95 : 0.6;
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity: glowBase, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.scale.setScalar(g.bodyRadius * (g.id === 'surya' ? 9 : 5));
  body.add(glow);
  if (g.id === 'surya') {
    const sunLight = new THREE.PointLight(0xffe0b0, 2.4, 0, 0);
    body.add(sunLight);
  }
  const label = makeLabel(g.nameDevanagari, 'lbl-graha', g.nameIAST);
  label.position.set(0, g.bodyRadius + 0.45, 0);
  body.add(label);
  grahaRoot.add(body);
  grahaPickables.push(body);

  const deferent = new THREE.LineLoop(UNIT_CIRCLE, lineMaterial(color, 0.16));
  deferent.scale.setScalar(g.kakshaRadius);
  deferent.userData.pick = epiPick;
  const manda = new THREE.LineLoop(UNIT_CIRCLE, lineMaterial(0x9fe6ff, 0.42));
  manda.userData.pick = epiPick;
  const shighra = new THREE.LineLoop(UNIT_CIRCLE, lineMaterial(color, 0.5));
  shighra.userData.pick = epiPick;
  shighra.visible = g.shighra !== null;

  // Bhū → mean → manda-sphuṭa → body (karṇa construction), plus the full karṇa back to Bhū.
  const armPositions = new Float32Array(5 * 3);
  const armGeo = new THREE.BufferGeometry();
  armGeo.setAttribute('position', new THREE.BufferAttribute(armPositions, 3));
  const arms = new THREE.Line(armGeo, lineMaterial(color, 0.38));
  arms.frustumCulled = false;

  epicycleRoot.add(deferent, manda, shighra, arms);
  grahaPickables.push(deferent, manda, shighra);

  const position = new THREE.Vector3();
  planetPositions[g.id] = position;
  views.set(g.id, { g, body, glow, glowBase, deferent, manda, shighra, arms, armPositions, position, trailAccum: 0 });
}

// Trails and tethers share the bhacakra frame; they are faded through their own opacity API.
const tracer = new OrbitTracer(celestial.bhacakra, 720);
tracer.group.userData.fadeExempt = true;
const tethers = new WindTethers(celestial.bhacakra, celestial.dhruvaPosition);
tethers.group.userData.fadeExempt = true;

// Faders must be built after every manifest object exists.
const bhuFader = new MaterialFader(celestial.bhuContainer);
const cosmosFader = new MaterialFader(celestial.cosmos);

// ───────────────────────────── Clock (ahargaṇa) ─────────────────────────────

let ahargana = aharganaFromDate(new Date());
let lastComputedAhargana = Number.NaN;
let frame: EpicycleFrame = epicycle.update(ahargana);

function seedTrails(): void {
  tracer.clear();
  for (const v of views.values()) {
    const trace = traceOrbit(v.g, ahargana - v.g.trailDays, v.g.trailDays, tracer.capacity, epicycle.latitudeScale);
    tracer.seed(v.g.id, trace.positions);
    v.trailAccum = 0;
  }
  epicycle.detector.reset();
}
seedTrails();

// ───────────────────────────── UI ─────────────────────────────

const inspector = new ShlokaInspector(shlokaHost);

function openShloka(id: ShlokaId, context: Omit<ShlokaContext, 'live'> = {}, live?: () => readonly string[]): void {
  inspector.setLiveProvider(null);
  inspector.showShloka(id, { ...context, live: live?.() });
  if (live) inspector.setLiveProvider(live);
}

function grahaLive(id: GrahaId): () => readonly string[] {
  return () => {
    const lines = [...epicycle.formulaFor(id)];
    const s = epicycle.getState(id);
    if (s) lines.push(`sphuṭa = ${formatRashi(s.computation.sphuta, RASHI_NAMES)} · vikṣepa = ${s.computation.latitude.toFixed(3)}°`);
    lines.push(`τ_tether = ${tethers.getTension(id).toFixed(3)}`);
    return lines;
  };
}

function inspectGraha(id: GrahaId): void {
  const g = GRAHA_BY_ID[id];
  const s = epicycle.getState(id);
  const gati = s ? GATI_NAMES[s.gati] : null;
  openShloka(
    'suryaSiddhanta',
    {
      subject: `${g.nameDevanagari} · ${g.nameIAST}${gati ? ` — ${gati.devanagari} (${gati.iast})` : ''}`,
      notes: [
        `${g.english} · ${g.cls === 'luminary' ? 'manda-saṁskāra only' : 'manda + śīghra saṁskāra (SS 2.43–45)'}`,
        `Vāyu-mārga ${g.vayuLayer} · kakṣyā ${g.kakshaRadius.toFixed(1)}`,
      ],
    },
    grahaLive(id),
  );
}

const overlay = new OverlayUI(hudHost, inspector, {
  onPlayToggle: (playing) => overlay.notify(playing ? '▶ काल चलति · time flows' : '❚❚ काल स्थगित · time paused'),
  onSpeed: () => {
    /* read from overlay.state each frame */
  },
  onMode: (mode) =>
    overlay.notify(
      mode === 'aryabhata' ? 'आर्यभट-दृष्टि · Bhū turns, the bhacakra stands still' : 'सिद्धान्त-दृष्टि · Parāvaha sweeps the bhacakra westward',
    ),
  onLayer: (key: LayerKey, visible: boolean) => applyLayer(key, visible),
  onPralaya: (stageIndex, progress) => pralaya.setPhase(stageIndex, progress),
  onPralayaAuto: (direction) => pralaya.autoplay(direction * 0.32),
  onAdvaita: (on) =>
    overlay.notify(on ? 'पारमार्थिक · ब्रह्म सत्यं जगन्मिथ्या' : 'व्यावहारिक · the empirical order returns', on ? 'marga' : 'info'),
  onToday: () => {
    ahargana = aharganaFromDate(new Date());
    lastComputedAhargana = Number.NaN;
    seedTrails();
    overlay.notify('आज · today');
  },
  onInspect: (id) => {
    switch (id) {
      case 'pralaya':
      case 'pancikarana':
        openShloka(id, {}, () => pralaya.formula());
        break;
      case 'saptaVayu':
        openShloka(id, {}, () => vayuFormula(VAYU_LAYER_COUNT - 1, overlay.state.mode));
        break;
      case 'suryaSiddhanta': {
        const vakra = frame.states.find((s) => s.vakra);
        inspectGraha(vakra ? vakra.id : 'mangala');
        break;
      }
      default:
        openShloka(id);
    }
  },
});

function applyLayer(key: LayerKey, visible: boolean): void {
  switch (key) {
    case 'epicycles':
      epicycleRoot.visible = visible;
      break;
    case 'shells':
      celestial.setShellsVisible(visible);
      celestial.setVectorFieldVisible(visible);
      break;
    case 'tethers':
      tethers.setVisible(visible);
      break;
    case 'trails':
      tracer.setVisible(visible);
      break;
  }
}
for (const key of Object.keys(overlay.state.layers) as LayerKey[]) applyLayer(key, overlay.state.layers[key]);

hudHost.addEventListener('hud:graha', (e) => {
  const id = (e as CustomEvent<{ id: GrahaId }>).detail?.id;
  if (id && id in GRAHA_BY_ID) inspectGraha(id);
});
shlokaHost.addEventListener('shloka:hidden', () => celestial.setHighlightShell(-1));

// ───────────────────────────── Picking ─────────────────────────────

const raycaster = new THREE.Raycaster();
raycaster.params.Line = { threshold: 0.18 };
raycaster.params.Points = { threshold: 0.35 };
const pointerNdc = new THREE.Vector2();
let hoverDirty = false;
let downX = 0;
let downY = 0;
let downT = 0;

function isShown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function pickAt(clientX: number, clientY: number): PickTag | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const targets = [...grahaPickables, ...celestial.pickables, ...tracer.pickables, ...tethers.pickables].filter(isShown);
  for (const hit of raycaster.intersectObjects(targets, false)) {
    const tag = resolvePick(hit);
    if (tag) return tag;
  }
  return null;
}

function inspectPick(tag: PickTag): void {
  const mode = overlay.state.mode;
  switch (tag.kind) {
    case 'graha':
    case 'trail':
    case 'epicycle':
      inspectGraha(tag.id);
      break;
    case 'tether': {
      const g = GRAHA_BY_ID[tag.id];
      const layer = layerIndexOfGraha(tag.id);
      openShloka(
        'suryaSiddhanta',
        { subject: `वात-रश्मि · ${g.nameDevanagari} ↔ ध्रुव`, notes: ['तद्वातविशिखैर्बद्धास्तेऽपकृष्यन्त मूर्त्तयः। — SS 2.2'] },
        () => [`τ = |ω| / (|ω| + ω₀) = ${tethers.getTension(tag.id).toFixed(3)}`, ...vayuFormula(layer, overlay.state.mode)],
      );
      break;
    }
    case 'shell':
      celestial.setHighlightShell(tag.index);
      openShloka('saptaVayu', { subject: `वायु-मार्ग ${tag.index + 1}` }, () => vayuFormula(tag.index, overlay.state.mode));
      break;
    case 'dhruva':
      openShloka('saptaVayu', { subject: 'ध्रुव · Dhruva — anchor of Parāvaha' }, () => vayuFormula(VAYU_LAYER_COUNT - 1, mode));
      break;
    case 'bhu':
      openShloka('bhaskara', { subject: 'भू-गोल · Bhū-gola — unsupported, held by its own ākṛṣṭi-śakti' });
      break;
    case 'meru':
      openShloka('bhaskara', { subject: 'मेरु-दण्ड · Meru axis → Dhruva' });
      break;
    case 'city':
      openShloka('aryabhata', { subject: `${tag.name} · city on the Laṅkā equator` });
      break;
    case 'nakshatra':
    case 'saptarshi':
    case 'ecliptic':
      openShloka('aryabhata', {
        subject: mode === 'aryabhata' ? 'भपञ्जर स्थिर · the star-cage is still; Bhū turns' : 'भचक्र · the star-wheel borne by Parāvaha',
      });
      break;
  }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  downT = performance.now();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5 || performance.now() - downT > 450) return;
  const tag = pickAt(e.clientX, e.clientY);
  if (tag) inspectPick(tag);
});
let hoverX = 0;
let hoverY = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  hoverX = e.clientX;
  hoverY = e.clientY;
  hoverDirty = e.buttons === 0;
});

// ───────────────────────────── Resize ─────────────────────────────

function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  advaita.setResolution(w, h);
  pralaya.setViewportHeight(renderer.getContext().drawingBufferHeight);
}
window.addEventListener('resize', onResize);
onResize();

// ───────────────────────────── Per-frame helpers ─────────────────────────────

function writeVec(arr: Float32Array, i: number, v: { x: number; y: number; z: number }): void {
  arr[i * 3] = v.x;
  arr[i * 3 + 1] = v.y;
  arr[i * 3 + 2] = v.z;
}

function updateGraha(s: GrahaState, time: number): void {
  const v = views.get(s.id);
  if (!v) return;
  const geo = s.geometry;
  v.position.set(geo.position.x, geo.position.y, geo.position.z);
  v.body.position.copy(v.position);

  // Vakra grahas flare in the vakra hue.
  const pulse = s.vakra ? 1.25 + 0.2 * Math.sin(time * 5) : s.kutila ? 1.1 : 1;
  v.glow.scale.setScalar(v.g.bodyRadius * (v.g.id === 'surya' ? 9 : 5) * pulse);

  v.manda.position.set(geo.mean.x, geo.mean.y, geo.mean.z);
  v.manda.scale.setScalar(Math.max(geo.mandaRadius, 1e-4));
  if (geo.shighraEpicyclePoint) {
    v.shighra.position.set(geo.mandaPoint.x, geo.mandaPoint.y, geo.mandaPoint.z);
    v.shighra.scale.setScalar(Math.max(geo.shighraRadius, 1e-4));
  }

  const a = v.armPositions;
  writeVec(a, 0, { x: 0, y: 0, z: 0 });
  writeVec(a, 1, geo.mean);
  writeVec(a, 2, geo.mandaPoint);
  writeVec(a, 3, geo.position);
  writeVec(a, 4, { x: 0, y: 0, z: 0 });
  v.arms.geometry.attributes.position.needsUpdate = true;
}

function fmtDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getUTCFullYear();
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const time = d.toISOString().slice(11, 16);
  return `${date} ${y < 1 ? `${1 - y} BCE` : y} · ${time} UT`;
}

function updateReadout(): void {
  const days = Math.floor(ahargana);
  const vara = VARA_NAMES[(((days + 5) % 7) + 7) % 7]; // Kali epoch (ahargaṇa 0) fell on a Friday.
  const grahas: GrahaReadout[] = frame.states.map((s) => {
    const gati = GATI_NAMES[s.gati];
    return {
      id: s.id,
      name: s.graha.nameDevanagari,
      iast: s.graha.nameIAST,
      color: `#${new THREE.Color(s.graha.color).getHexString()}`,
      position: formatRashi(s.computation.sphuta, RASHI_NAMES),
      gati: `${gati.devanagari} ${s.speed >= 0 ? '+' : '−'}${Math.abs(s.speed).toFixed(3)}°`,
      vakra: s.vakra,
      kutila: s.kutila,
    };
  });
  overlay.setReadout({
    date: fmtDate(dateFromAhargana(ahargana)),
    ahargana: days.toLocaleString('en-IN'),
    kaliYear: `कलि ${Math.floor(ahargana / SIDEREAL_YEAR_DAYS).toLocaleString('en-IN')}`,
    vara,
    grahas,
  });
}

// ───────────────────────────── Loop ─────────────────────────────

let last = performance.now();
let elapsed = 0;
let readoutTimer = 0;
let advaitaBlend = 0;
let booted = false;

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
  last = now;
  elapsed += dt;

  const st = overlay.state;
  const dps = st.playing ? st.daysPerSecond : 0;

  // काल — advance the ahargaṇa and the Vāyu strata.
  const dDays = dt * dps;
  ahargana += dDays;
  vayuState.step(dt, dps, st.mode);

  // मन्द-शीघ्र — true places of the grahas.
  if (ahargana !== lastComputedAhargana) {
    frame = epicycle.update(ahargana);
    lastComputedAhargana = ahargana;
    if (Math.abs(dps) <= 120) {
      for (const ev of frame.events) {
        const g = GRAHA_BY_ID[ev.grahaId];
        const start = ev.kind === 'vakrarambha';
        overlay.notify(
          `<b>${g.nameDevanagari}</b> ${start ? 'वक्रारम्भ · retrograde begins' : 'मार्गारम्भ · direct motion resumes'} — ${formatRashi(ev.longitude, RASHI_NAMES)}`,
          start ? 'vakra' : 'marga',
        );
      }
    }
  }
  for (const s of frame.states) updateGraha(s, elapsed);

  // Armillary scaffold.
  celestial.update({ time: elapsed, vayu: vayuState, flood: pralaya.flood });

  // Vakra trails: sample each graha at its own seeded cadence (trailDays / capacity).
  if (dDays !== 0) {
    const due: Record<string, THREE.Vector3> = {};
    let any = false;
    for (const v of views.values()) {
      v.trailAccum += Math.abs(dDays);
      if (v.trailAccum >= v.g.trailDays / tracer.capacity) {
        v.trailAccum = 0;
        due[v.g.id] = v.position;
        any = true;
      }
    }
    if (any) tracer.update(due);
  }
  tethers.update(vayuState, planetPositions);

  // अद्वैत ⇄ प्रलय.
  advaitaBlend += ((st.advaita ? 1 : 0) - advaitaBlend) * (1 - Math.exp(-dt * 1.6));
  advaita.setMode('paramarthika', advaitaBlend);
  pralaya.setAtyantika(advaita.paramarthika);
  pralaya.step(dt);
  advaita.update(elapsed, { vikshepa: pralaya.vikshepa, avarana: pralaya.avarana });

  // Visibility of the manifest world.
  const manifest = advaita.manifestVisibility;
  const cosmosVis = pralaya.cosmosVisibility * manifest;
  bhuFader.set(pralaya.bhuVisibility * manifest);
  cosmosFader.set(cosmosVis);
  const mech = pralaya.mechanismVisibility * advaita.mechanismVisibility * cosmosVis;
  for (const f of fadingLines) f.material.opacity = f.base * mech;
  epicycleRoot.visible = st.layers.epicycles && mech > 0.003;
  tracer.setOpacity(mech);
  tethers.setOpacity(mech);

  // HUD.
  overlay.setComposition(pralaya.composition);
  overlay.setCaption(pralaya.caption);
  if (pralaya.isAutoplaying) overlay.setPralayaValue(pralaya.target / 5);
  readoutTimer -= dt;
  if (readoutTimer <= 0) {
    readoutTimer = 0.25;
    updateReadout();
  }

  // Hover affordance.
  if (hoverDirty) {
    hoverDirty = false;
    renderer.domElement.style.cursor = pickAt(hoverX, hoverY) ? 'pointer' : '';
  }

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  if (!booted) {
    booted = true;
    if (bootEl) {
      bootEl.style.transition = 'opacity 0.9s ease';
      bootEl.style.opacity = '0';
      bootEl.style.pointerEvents = 'none';
      window.setTimeout(() => bootEl.remove(), 1000);
    }
  }
}

updateReadout();
requestAnimationFrame(animate);
