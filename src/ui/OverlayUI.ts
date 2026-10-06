/**
 * यन्त्र-पटल — OverlayUI: the glassmorphic HUD of Siddhānta-Yantra.
 *
 *  • काल (Time): play / pause, logarithmic days-per-second scrubber (negative = reverse), "today".
 *  • दृष्टि (View): Siddhānta (Bhū still, Parāvaha sweeps the bhacakra westward) vs.
 *    Āryabhaṭa (Bhū turns on its axis; the stars stand still) — आर्यभटीय, गोलपाद ९.
 *  • स्तर (Layers): Epicycles, Vāyu shells, Dhruva tethers, Vakra trails.
 *  • प्रलय (Pralaya): stage scrubber 0…5, auto-dissolve / re-create, Pañcīkaraṇa composition bar.
 *  • अद्वैत (Advaita): Vyāvahārika ⇄ Pāramārthika toggle.
 *  • Every section carries an ⓘ that opens the governing śloka in the ShlokaInspector.
 */

import { TATTVA_NAMES } from '../data/planetaryConstants';
import type { ShlokaId, StageCaption } from '../data/shlokas';
import type { DiurnalMode } from '../math/vayuDynamics';
import type { ShlokaInspector } from './ShlokaInspector';

export type LayerKey = 'epicycles' | 'shells' | 'tethers' | 'trails';

export interface OverlayState {
  playing: boolean;
  daysPerSecond: number;
  mode: DiurnalMode;
  layers: Record<LayerKey, boolean>;
  /** Normalised dissolution v ∈ [0, 1]; the laya coordinate is L = 5v. */
  pralaya: number;
  advaita: boolean;
}

export interface OverlayCallbacks {
  onPlayToggle?(playing: boolean): void;
  onSpeed?(daysPerSecond: number): void;
  onMode?(mode: DiurnalMode): void;
  onLayer?(key: LayerKey, visible: boolean): void;
  /** stageIndex = ⌊v⌋, progress = v − ⌊v⌋. */
  onPralaya?(stageIndex: number, progress: number): void;
  onPralayaAuto?(direction: 1 | -1): void;
  onAdvaita?(paramarthika: boolean): void;
  onToday?(): void;
  onInspect?(shlokaId: ShlokaId): void;
}

export interface GrahaReadout {
  readonly id: string;
  readonly name: string;
  readonly iast: string;
  readonly color: string;
  readonly position: string;
  readonly gati: string;
  readonly vakra: boolean;
  readonly kutila: boolean;
}

export interface HudReadout {
  readonly date: string;
  readonly ahargana: string;
  readonly kaliYear: string;
  readonly vara: string;
  readonly grahas: readonly GrahaReadout[];
}

const STAGE_LABELS = ['सृष्टि', 'पृथ्वी→जल', 'जल→अग्नि', 'अग्नि→वायु', 'वायु→आकाश', 'अव्यक्त'];
const TATTVA_SWATCH = ['#6a5cff', '#bfe9ff', '#ff7a2e', '#3fa8ff', '#c99a5b'];
const SPEED_MAX_EXP = 3;
/** Laya stages spanned by the normalised Pralaya slider. */
const LAYA_MAX = 5;

/** Slider position v ∈ [−100, 100] → days / second (log scale, ≈ ±500 d/s at the ends). */
function speedFromSlider(v: number): number {
  const a = Math.abs(v) / 100;
  return Math.sign(v) * (Math.pow(10, SPEED_MAX_EXP * a) - 1) * 0.5;
}

function sliderFromSpeed(dps: number): number {
  const a = Math.log10(Math.abs(dps) * 2 + 1) / SPEED_MAX_EXP;
  return Math.sign(dps) * Math.min(100, a * 100);
}

function fmtSpeed(dps: number): string {
  const a = Math.abs(dps);
  const s = dps < 0 ? '−' : '';
  if (a < 0.01) return '0 दिन/से';
  if (a < 1) return `${s}${(a * 24).toFixed(1)} घटी… ${s}${(a * 24).toFixed(1)} h/s`;
  if (a < 30) return `${s}${a.toFixed(2)} दिन/से · days/s`;
  if (a < 365) return `${s}${(a / 30).toFixed(1)} मास/से · months/s`;
  return `${s}${(a / 365.2588).toFixed(2)} वर्ष/से · yrs/s`;
}

function info(id: ShlokaId, label: string): string {
  return `<button type="button" class="hud-info" id="info-${id}-${label}" data-shloka="${id}" title="श्लोक देखें · View the governing verse">ⓘ</button>`;
}

export class OverlayUI {
  readonly state: OverlayState;

  private readonly root: HTMLElement;
  private readonly inspector: ShlokaInspector;
  private readonly cb: OverlayCallbacks;
  private readonly el: {
    play: HTMLButtonElement;
    speed: HTMLInputElement;
    speedLabel: HTMLElement;
    date: HTMLElement;
    ahargana: HTMLElement;
    kali: HTMLElement;
    vara: HTMLElement;
    grahaTable: HTMLElement;
    modeButtons: HTMLButtonElement[];
    modeCaption: HTMLElement;
    pralaya: HTMLInputElement;
    pralayaLabel: HTMLElement;
    composition: HTMLElement;
    advaita: HTMLButtonElement;
    caption: HTMLElement;
    toasts: HTMLElement;
  };
  private readonly grahaRows = new Map<string, HTMLElement>();

  constructor(containerElement: HTMLElement, inspector: ShlokaInspector, callbacks: OverlayCallbacks = {}, initial?: Partial<OverlayState>) {
    this.root = containerElement;
    this.inspector = inspector;
    this.cb = callbacks;
    this.state = {
      playing: true,
      daysPerSecond: 6,
      mode: 'siddhanta',
      layers: { epicycles: true, shells: true, tethers: true, trails: true },
      pralaya: 0,
      advaita: false,
      ...initial,
    };
    this.root.classList.add('hud');
    this.root.innerHTML = this.template();

    const q = <T extends HTMLElement>(sel: string): T => this.root.querySelector(sel) as T;
    this.el = {
      play: q('#hud-play'),
      speed: q('#hud-speed'),
      speedLabel: q('#hud-speed-label'),
      date: q('#hud-date'),
      ahargana: q('#hud-ahargana'),
      kali: q('#hud-kali'),
      vara: q('#hud-vara'),
      grahaTable: q('#hud-grahas'),
      modeButtons: Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-mode]')),
      modeCaption: q('#hud-mode-caption'),
      pralaya: q('#hud-pralaya'),
      pralayaLabel: q('#hud-pralaya-label'),
      composition: q('#hud-composition'),
      advaita: q('#hud-advaita'),
      caption: q('#hud-caption'),
      toasts: q('#hud-toasts'),
    };
    this.bind();
    this.syncAll();
  }

  // ───────────────────────────── public API ─────────────────────────────

  setReadout(r: HudReadout): void {
    this.el.date.textContent = r.date;
    this.el.ahargana.textContent = r.ahargana;
    this.el.kali.textContent = r.kaliYear;
    this.el.vara.textContent = r.vara;
    for (const g of r.grahas) {
      let row = this.grahaRows.get(g.id);
      if (!row) {
        const btn = document.createElement('button');
        btn.type = 'button';
        row = btn;
        row.className = 'graha-row';
        row.id = `graha-row-${g.id}`;
        row.dataset.graha = g.id;
        row.innerHTML = `<span class="g-dot"></span><span class="g-name"></span><span class="g-pos"></span><span class="g-gati"></span>`;
        (row.querySelector('.g-dot') as HTMLElement).style.background = g.color;
        (row.querySelector('.g-dot') as HTMLElement).style.boxShadow = `0 0 10px ${g.color}`;
        row.addEventListener('click', () => {
          this.root.dispatchEvent(new CustomEvent('hud:graha', { detail: { id: g.id }, bubbles: true }));
        });
        this.el.grahaTable.appendChild(row);
        this.grahaRows.set(g.id, row);
      }
      (row.querySelector('.g-name') as HTMLElement).innerHTML = `${g.name}<small>${g.iast}</small>`;
      (row.querySelector('.g-pos') as HTMLElement).textContent = g.position;
      const gati = row.querySelector('.g-gati') as HTMLElement;
      gati.textContent = g.gati;
      row.classList.toggle('vakra', g.vakra);
      row.classList.toggle('kutila', g.kutila);
    }
  }

  /** v ∈ [0, 1] (normalised dissolution). */
  setPralayaValue(v: number, emit = false): void {
    this.state.pralaya = Math.min(1, Math.max(0, v));
    this.el.pralaya.value = this.state.pralaya.toFixed(4);
    this.syncPralaya();
    if (emit) this.emitPralaya();
  }

  setComposition(c: readonly number[]): void {
    const segs = this.el.composition.children;
    for (let i = 0; i < segs.length && i < c.length; i++) {
      (segs[i] as HTMLElement).style.flexGrow = Math.max(c[i], 0.0001).toFixed(4);
      (segs[i] as HTMLElement).title = `${TATTVA_NAMES[i].devanagari} ${TATTVA_NAMES[i].iast}: ${(c[i] * 100).toFixed(1)}%`;
    }
  }

  setCaption(caption: StageCaption | null): void {
    const el = this.el.caption;
    if (!caption) {
      el.classList.remove('show');
      return;
    }
    const key = caption.label;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.innerHTML = `<div class="cap-label">${caption.label}</div><div class="cap-sa">${caption.sanskrit}</div><div class="cap-hi">${caption.hindi}</div>`;
    }
    el.classList.add('show');
  }

  setAdvaita(on: boolean, emit = false): void {
    this.state.advaita = on;
    this.syncAdvaita();
    if (emit) this.cb.onAdvaita?.(on);
  }

  setPlaying(on: boolean, emit = false): void {
    this.state.playing = on;
    this.syncPlay();
    if (emit) this.cb.onPlayToggle?.(on);
  }

  /** Brief floating notice (e.g. vakrārambha / mārgārambha stations). */
  notify(html: string, tone: 'vakra' | 'marga' | 'info' = 'info'): void {
    const t = document.createElement('div');
    t.className = `toast toast-${tone}`;
    t.innerHTML = html;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstElementChild?.remove();
    window.setTimeout(() => t.classList.add('out'), 3600);
    window.setTimeout(() => t.remove(), 4200);
  }

  // ───────────────────────────── internals ─────────────────────────────

  private bind(): void {
    this.el.play.addEventListener('click', () => this.setPlaying(!this.state.playing, true));

    this.el.speed.addEventListener('input', () => {
      this.state.daysPerSecond = speedFromSlider(Number(this.el.speed.value));
      this.syncSpeed();
      this.cb.onSpeed?.(this.state.daysPerSecond);
    });
    this.el.speed.addEventListener('dblclick', () => {
      this.state.daysPerSecond = 6;
      this.el.speed.value = String(sliderFromSpeed(6));
      this.syncSpeed();
      this.cb.onSpeed?.(6);
    });

    this.root.querySelector('#hud-today')?.addEventListener('click', () => this.cb.onToday?.());

    for (const b of this.el.modeButtons) {
      b.addEventListener('click', () => {
        const mode = b.dataset.mode as DiurnalMode;
        if (mode === this.state.mode) return;
        this.state.mode = mode;
        this.syncMode();
        this.cb.onMode?.(mode);
      });
    }

    this.root.querySelectorAll<HTMLInputElement>('[data-layer]').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.layer as LayerKey;
        this.state.layers[key] = input.checked;
        this.cb.onLayer?.(key, input.checked);
      });
    });

    this.el.pralaya.addEventListener('input', () => {
      this.state.pralaya = Number(this.el.pralaya.value);
      this.syncPralaya();
      this.emitPralaya();
    });
    this.root.querySelector('#hud-pralaya-play')?.addEventListener('click', () => this.cb.onPralayaAuto?.(1));
    this.root.querySelector('#hud-srshti-play')?.addEventListener('click', () => this.cb.onPralayaAuto?.(-1));
    this.root.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b) => {
      b.addEventListener('click', () => this.setPralayaValue(Number(b.dataset.stage) / LAYA_MAX, true));
    });

    this.el.advaita.addEventListener('click', () => this.setAdvaita(!this.state.advaita, true));

    // ⓘ buttons → ShlokaInspector (and the optional callback hook).
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-shloka]');
      if (!btn?.dataset.shloka) return;
      const id = btn.dataset.shloka as ShlokaId;
      if (this.cb.onInspect) this.cb.onInspect(id);
      else this.inspector.showShloka(id);
    });

    // Collapsible panels on small screens.
    this.root.querySelectorAll<HTMLElement>('.hud-collapse').forEach((h) => {
      h.addEventListener('click', () => h.closest('.hud-panel')?.classList.toggle('collapsed'));
    });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.setPlaying(!this.state.playing, true);
      } else if (e.key === 'a' || e.key === 'A') {
        this.setAdvaita(!this.state.advaita, true);
      } else if (e.key === 'm' || e.key === 'M') {
        this.state.mode = this.state.mode === 'siddhanta' ? 'aryabhata' : 'siddhanta';
        this.syncMode();
        this.cb.onMode?.(this.state.mode);
      }
    });
  }

  private emitPralaya(): void {
    const L = this.state.pralaya * LAYA_MAX;
    const stage = Math.min(Math.floor(L), LAYA_MAX);
    this.cb.onPralaya?.(stage, stage >= LAYA_MAX ? 0 : L - stage);
  }

  private syncAll(): void {
    this.el.speed.value = String(sliderFromSpeed(this.state.daysPerSecond));
    this.root.querySelectorAll<HTMLInputElement>('[data-layer]').forEach((i) => {
      i.checked = this.state.layers[i.dataset.layer as LayerKey];
    });
    this.el.pralaya.value = String(this.state.pralaya);
    this.syncPlay();
    this.syncSpeed();
    this.syncMode();
    this.syncPralaya();
    this.syncAdvaita();
  }

  private syncPlay(): void {
    this.el.play.classList.toggle('paused', !this.state.playing);
    this.el.play.setAttribute('aria-pressed', String(this.state.playing));
    this.el.play.innerHTML = this.state.playing
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>';
    this.el.play.title = this.state.playing ? 'विराम · Pause (Space)' : 'चलाएँ · Play (Space)';
  }

  private syncSpeed(): void {
    this.el.speedLabel.textContent = fmtSpeed(this.state.daysPerSecond);
  }

  private syncMode(): void {
    for (const b of this.el.modeButtons) b.classList.toggle('active', b.dataset.mode === this.state.mode);
    this.el.modeCaption.textContent =
      this.state.mode === 'siddhanta'
        ? 'भू स्थिर · प्रवह वायु नक्षत्र-चक्र को पश्चिम की ओर घुमाता है'
        : 'अनुलोमगतिर्नौस्थः… भू अपनी धुरी पर घूमती है · नक्षत्र स्थिर';
  }

  private syncPralaya(): void {
    const v = this.state.pralaya;
    const L = v * LAYA_MAX;
    const stage = Math.min(Math.floor(L + 1e-6), LAYA_MAX);
    this.el.pralayaLabel.textContent = `${STAGE_LABELS[stage]} · ${v.toFixed(2)}`;
    this.el.pralaya.style.setProperty('--fill', `${v * 100}%`);
    this.root.querySelectorAll<HTMLElement>('[data-stage]').forEach((b) => b.classList.toggle('reached', Number(b.dataset.stage) <= L + 1e-6));
  }

  private syncAdvaita(): void {
    const on = this.state.advaita;
    this.el.advaita.classList.toggle('on', on);
    this.el.advaita.setAttribute('aria-pressed', String(on));
    this.el.advaita.innerHTML = on
      ? '<span class="adv-sa">पारमार्थिक</span><span class="adv-en">Pāramārthika · return to Vyāvahārika</span>'
      : '<span class="adv-sa">व्यावहारिक</span><span class="adv-en">Vyāvahārika · lift the veil of Māyā</span>';
    document.body.classList.toggle('paramarthika', on);
  }

  private template(): string {
    const comp = TATTVA_SWATCH.map((c, i) => `<span class="comp-seg" style="background:${c};flex-grow:0.2" data-tattva="${i}"></span>`).join('');
    const ticks = STAGE_LABELS.map((l, i) => `<button type="button" class="stage-tick" id="stage-tick-${i}" data-stage="${i}" title="${l} · ${(i / LAYA_MAX).toFixed(1)}">${(i / LAYA_MAX).toFixed(1)}</button>`).join('');
    return `
      <header class="hud-brand glass">
        <div class="brand-mark" aria-hidden="true"></div>
        <div>
          <h1 class="brand-title">सिद्धांत-यंत्र <span>Siddhānta-Yantra</span></h1>
          <div class="brand-sub">सूर्यसिद्धान्त · आर्यभटीय · सिद्धान्तशिरोमणि · अद्वैत वेदान्त</div>
        </div>
      </header>

      <section class="hud-panel hud-time glass" aria-label="Time controls">
        <div class="hud-panel-head hud-collapse"><h2>काल <span>Kāla · Time</span></h2>${info('suryaSiddhanta', 'time')}</div>
        <div class="time-row">
          <button type="button" id="hud-play" class="btn-play" aria-label="Play or pause"></button>
          <div class="time-readout">
            <div id="hud-date" class="t-date">—</div>
            <div class="t-sub"><span id="hud-vara">—</span> · अहर्गण <b id="hud-ahargana">—</b></div>
            <div class="t-sub">कलि-वर्ष <b id="hud-kali">—</b></div>
          </div>
          <button type="button" id="hud-today" class="btn-ghost" title="आज · Today">आज</button>
        </div>
        <label class="slider-label" for="hud-speed">गति <span id="hud-speed-label"></span></label>
        <input id="hud-speed" class="slider slider-speed" type="range" min="-100" max="100" step="0.5" aria-label="Days per second" />
        <div class="slider-scale"><span>◀ विलोम</span><span>0</span><span>अनुलोम ▶</span></div>
      </section>

      <section class="hud-panel hud-view glass" aria-label="View and layers">
        <div class="hud-panel-head hud-collapse"><h2>दृष्टि <span>Darśana · View</span></h2>${info('aryabhata', 'view')}</div>
        <div class="seg" role="group" aria-label="Diurnal model">
          <button type="button" id="mode-siddhanta" data-mode="siddhanta">सिद्धान्त<small>Bhū still</small></button>
          <button type="button" id="mode-aryabhata" data-mode="aryabhata">आर्यभट<small>Bhū rotates</small></button>
        </div>
        <p id="hud-mode-caption" class="caption-small"></p>
        <div class="layers">
          <label class="toggle"><input type="checkbox" id="layer-epicycles" data-layer="epicycles" /><span class="sw"></span>मन्द-शीघ्र परिधि <small>Epicycles</small>${info('suryaSiddhanta', 'epi')}</label>
          <label class="toggle"><input type="checkbox" id="layer-shells" data-layer="shells" /><span class="sw"></span>सप्त वायु-मार्ग <small>Vāyu shells</small>${info('saptaVayu', 'shells')}</label>
          <label class="toggle"><input type="checkbox" id="layer-tethers" data-layer="tethers" /><span class="sw"></span>ध्रुव वात-रश्मि <small>Dhruva tethers</small>${info('saptaVayu', 'tethers')}</label>
          <label class="toggle"><input type="checkbox" id="layer-trails" data-layer="trails" /><span class="sw"></span>वक्र-पथ <small>Retrograde trails</small>${info('suryaSiddhanta', 'trails')}</label>
        </div>
      </section>

      <section class="hud-panel hud-grahas glass" aria-label="Planetary positions">
        <div class="hud-panel-head hud-collapse"><h2>स्फुट ग्रह <span>Sphuṭa Grahas</span></h2>${info('suryaSiddhanta', 'grahas')}</div>
        <div id="hud-grahas" class="graha-table"></div>
        <div class="hud-foot">
          <button type="button" class="link" data-shloka="bhaskara" id="info-bhaskara">आकृष्टि-शक्ति · Bhū</button>
          <button type="button" class="link" data-shloka="pancikarana" id="info-pancikarana">पञ्चीकरण</button>
          <button type="button" class="link" data-shloka="nasadiya" id="info-nasadiya">नासदीय</button>
          <button type="button" class="link" data-shloka="taittiriya" id="info-taittiriya">तैत्तिरीय</button>
        </div>
      </section>

      <section class="hud-panel hud-pralaya glass" aria-label="Pralaya and Advaita">
        <div class="hud-panel-head hud-collapse"><h2>प्रलय <span>Pralaya · Dissolution</span></h2>${info('pralaya', 'pralaya')}</div>
        <label class="slider-label" for="hud-pralaya">अवस्था <span id="hud-pralaya-label"></span></label>
        <input id="hud-pralaya" class="slider slider-pralaya" type="range" min="0" max="1" step="0.002" aria-label="Pralaya dissolution stage (0 to 1)" />
        <div class="stage-ticks">${ticks}</div>
        <div class="comp-wrap" title="Pañcīkaraṇa composition">
          <div id="hud-composition" class="comp-bar">${comp}</div>
          <div class="comp-legend">${TATTVA_NAMES.map((t, i) => `<span><i style="background:${TATTVA_SWATCH[i]}"></i>${t.devanagari}</span>`).join('')}</div>
        </div>
        <div class="btn-row">
          <button type="button" id="hud-pralaya-play" class="btn-ghost">प्रलय ▶</button>
          <button type="button" id="hud-srshti-play" class="btn-ghost">◀ सृष्टि</button>
        </div>
        <div class="hud-panel-head sub"><h2>अद्वैत <span>Advaita</span></h2>${info('vivekachudamani', 'advaita')}</div>
        <button type="button" id="hud-advaita" class="btn-advaita" aria-pressed="false"></button>
      </section>

      <div id="hud-caption" class="stage-caption glass" aria-live="polite"></div>
      <div id="hud-toasts" class="toasts" aria-live="polite"></div>
      <div class="hud-hint">खींचें · drag to orbit · scroll to zoom · click any body to read its śloka</div>`;
  }
}
