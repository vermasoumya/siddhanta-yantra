/**
 * शास्त्र-दर्शक — ShlokaInspector: the multilingual verse drawer.
 *
 * For any clicked object (Bhū, an epicycle loop, a Vāyu stratum, a tether, the Pralaya slider…)
 * the drawer shows, from src/data/shlokas.ts:
 *   1. Sanskrit title in Devanagari (+ IAST, English)
 *   2. Textual source citation
 *   3. Complete mūla śloka
 *   4. Complete Gita Press Hindi translation
 *   5. English gloss
 *   6. The computational law derived from the passage — static form plus live values
 */

import { SHLOKAS, type Shloka, type ShlokaId } from '../data/shlokas';
import { devanagariToIAST } from './iast';

export interface ShlokaContext {
  /** Object-specific heading, e.g. "मङ्गल · Maṅgala — vakra". */
  readonly subject?: string;
  /** Extra descriptive lines about the clicked object (Hindi / English). */
  readonly notes?: readonly string[];
  /** Live formula lines with current numbers substituted. */
  readonly live?: readonly string[];
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function isShlokaId(id: string): id is ShlokaId {
  return Object.prototype.hasOwnProperty.call(SHLOKAS, id);
}

export class ShlokaInspector {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly body: HTMLElement;
  private liveEl: HTMLElement | null = null;
  private current: ShlokaId | null = null;
  private liveProvider: (() => readonly string[]) | null = null;
  private liveTimer = 0;

  constructor(containerElement: HTMLElement) {
    this.root = containerElement;
    this.root.classList.add('shloka-modal');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'false');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `
      <div class="sk-backdrop" data-close="1"></div>
      <aside class="sk-panel glass" aria-labelledby="sk-title">
        <button class="sk-close" id="shloka-close" type="button" aria-label="Close verse inspector">✕</button>
        <div class="sk-body"></div>
        <nav class="sk-index" aria-label="All verses"></nav>
      </aside>`;
    this.panel = this.root.querySelector('.sk-panel') as HTMLElement;
    this.body = this.root.querySelector('.sk-body') as HTMLElement;

    const index = this.root.querySelector('.sk-index') as HTMLElement;
    for (const s of Object.values(SHLOKAS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sk-chip';
      b.id = `shloka-chip-${s.id}`;
      b.dataset.shloka = s.id;
      b.title = `${s.titleIAST} — ${s.sourceEnglish}`;
      b.innerHTML = `<span class="sk-chip-sec">${esc(s.section)}</span>${esc(s.titleDevanagari)}`;
      index.appendChild(b);
    }

    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-close]') || target.closest('.sk-close')) {
        this.hide();
        return;
      }
      const chip = target.closest<HTMLElement>('.sk-chip');
      if (chip?.dataset.shloka) this.showShloka(chip.dataset.shloka);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.hide();
    });
    window.addEventListener('shloka:show', (e) => {
      const d = (e as CustomEvent<{ id: string; context?: ShlokaContext }>).detail;
      if (d?.id) this.showShloka(d.id, d.context);
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  get currentId(): ShlokaId | null {
    return this.current;
  }

  showShloka(shlokaId: string, context?: ShlokaContext): void {
    if (!isShlokaId(shlokaId)) {
      console.warn(`[ShlokaInspector] unknown śloka id "${shlokaId}"`);
      return;
    }
    const s = SHLOKAS[shlokaId];
    this.current = shlokaId;
    this.body.innerHTML = this.render(s, context);
    this.liveEl = this.body.querySelector('.sk-live-lines');
    this.root.querySelectorAll('.sk-chip').forEach((c) => c.classList.toggle('active', (c as HTMLElement).dataset.shloka === shlokaId));
    this.root.classList.add('open');
    this.root.setAttribute('aria-hidden', 'false');
    this.panel.scrollTop = 0;
    this.body.classList.remove('sk-enter');
    void this.body.offsetWidth; // restart entry animation
    this.body.classList.add('sk-enter');
  }

  /** Continuously refresh the live-formula block while the drawer is open. */
  setLiveProvider(provider: (() => readonly string[]) | null): void {
    this.liveProvider = provider;
    window.clearInterval(this.liveTimer);
    if (provider) {
      this.liveTimer = window.setInterval(() => {
        if (this.isOpen && this.liveProvider) this.updateLive(this.liveProvider());
      }, 250);
    }
  }

  updateLive(lines: readonly string[]): void {
    if (!this.liveEl) return;
    this.liveEl.innerHTML = lines.map((l) => `<div class="sk-formula-line">${esc(l)}</div>`).join('');
  }

  hide(): void {
    this.root.classList.remove('open');
    this.root.setAttribute('aria-hidden', 'true');
    this.setLiveProvider(null);
    this.root.dispatchEvent(new CustomEvent('shloka:hidden', { bubbles: true }));
  }

  private render(s: Shloka, ctx?: ShlokaContext): string {
    const mula = s.mula
      .map((l) => `<div class="sk-mula-line" lang="sa">${esc(l)}</div><div class="sk-iast-line" lang="sa-Latn">${esc(devanagariToIAST(l))}</div>`)
      .join('');
    const formula = s.formula.map((l) => `<div class="sk-formula-line">${esc(l)}</div>`).join('');
    const impl = s.implementedIn.map((m) => `<code>${esc(m)}</code>`).join(' ');
    const notes = ctx?.notes?.length ? `<div class="sk-notes">${ctx.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : '';
    const live = ctx?.live?.length
      ? `<section class="sk-section sk-live"><h3><span class="sk-dot"></span>सक्रिय गणना · Live computation</h3><div class="sk-live-lines">${ctx.live
          .map((l) => `<div class="sk-formula-line">${esc(l)}</div>`)
          .join('')}</div></section>`
      : '';
    return `
      <header class="sk-head">
        <div class="sk-section-tag">खण्ड ${esc(s.section)}</div>
        ${ctx?.subject ? `<div class="sk-subject">${esc(ctx.subject)}</div>` : ''}
        <h2 id="sk-title" class="sk-title">${esc(s.titleDevanagari)}</h2>
        <div class="sk-title-sub">${esc(s.titleIAST)} · ${esc(s.titleEnglish)}</div>
        <div class="sk-source">📜 ${esc(s.source)} <span>— ${esc(s.sourceEnglish)}</span></div>
      </header>
      ${notes}
      <section class="sk-section sk-mula"><h3>मूल श्लोक · Mūla <span class="sk-h3-sub">Devanāgarī · IAST</span></h3>${mula}</section>
      <section class="sk-section"><h3>${esc(s.hindiAttribution)}</h3><p class="sk-hindi">${esc(s.hindi)}</p></section>
      <section class="sk-section"><h3>English gloss</h3><p class="sk-english">${esc(s.english)}</p></section>
      <section class="sk-section sk-formula"><h3>गणितीय सूत्र · Computational law</h3>${formula}</section>
      ${live}
      <footer class="sk-impl">Implemented in ${impl}</footer>`;
  }
}
