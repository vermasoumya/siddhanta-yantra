/**
 * सूर्यसिद्धान्त ग्रह-मान — Sūrya Siddhānta planetary constants.
 *
 * Revolution counts per Mahāyuga (SS 1.29–34), apsidal/nodal revolutions per Kalpa (SS 1.41–44),
 * epicycle peripheries in degrees (SS 2.34–38) and maximum latitudes (SS 1.68–70).
 * Peripheries for Maṅgala, Guru and Śani follow the project specification exactly.
 */

// ───────────────────────────── Kāla-māna (time measures) ─────────────────────────────
export const MAHAYUGA_YEARS = 4_320_000;
export const KALPA_MAHAYUGAS = 1000;
export const KALPA_YEARS = MAHAYUGA_YEARS * KALPA_MAHAYUGAS; // 4.32 × 10⁹ — one day of Brahmā
export const BRAHMA_AHORATRA_YEARS = 2 * KALPA_YEARS; // day + night
export const BRAHMA_YEAR_YEARS = 360 * BRAHMA_AHORATRA_YEARS; // 3.1104 × 10¹²
export const BRAHMA_LIFE_YEARS = 100 * BRAHMA_YEAR_YEARS; // 3.1104 × 10¹⁴ = dvi-parārdha (311.04 trillion)
export const MANVANTARA_MAHAYUGAS = 71;

/** Sāvana (civil) days in a Mahāyuga (SS 1.37). */
export const CIVIL_DAYS_PER_MAHAYUGA = 1_577_917_828;
/** Nākṣatra (sidereal) days in a Mahāyuga (SS 1.34). */
export const SIDEREAL_DAYS_PER_MAHAYUGA = 1_582_237_828;
/** Sidereal year in civil days = 365.258756… */
export const SIDEREAL_YEAR_DAYS = CIVIL_DAYS_PER_MAHAYUGA / MAHAYUGA_YEARS;
/** Ratio of the Earth's rotation to civil days. */
export const SIDEREAL_ROTATIONS_PER_CIVIL_DAY = SIDEREAL_DAYS_PER_MAHAYUGA / CIVIL_DAYS_PER_MAHAYUGA;

/** Julian Day of the Kali-yuga epoch: midnight at Laṅkā, 17/18 February 3102 BCE. */
export const KALI_EPOCH_JD = 588465.5;

/** Years elapsed from the start of creation in this Kalpa to the Kali epoch (SS 1.21–24). */
export const YEARS_KALPA_START_TO_KALI = 1_972_944_000;
/** Of which 17,064,000 years were spent in creation (sṛṣṭi-kāla); planets move only after it. */
export const SRSHTI_KALA_YEARS = 17_064_000;
/** Mahāyugas (incl. fraction) elapsed from planetary motion start to Kali: 1,955,880,000 / 4,320,000. */
export const MAHAYUGAS_MOTION_TO_KALI = (YEARS_KALPA_START_TO_KALI - SRSHTI_KALA_YEARS) / MAHAYUGA_YEARS; // 452.75
/** Civil days from the start of planetary motion to Kali epoch. */
export const DAYS_MOTION_TO_KALI = MAHAYUGAS_MOTION_TO_KALI * CIVIL_DAYS_PER_MAHAYUGA;
/** Completed years of the present Brahmā (we are in the first day of his 51st year). */
export const BRAHMA_YEARS_COMPLETED = 50;

// ───────────────────────────── Trigonometric radius ─────────────────────────────
/** Trijyā — the radius of the Siddhāntic circle in arc-minutes (R = 3438′). */
export const JYA_RADIUS = 3438;
/** Parama-apakrama — the greatest declination (obliquity), SS 2.28. */
export const PARAMA_APAKRAMA_DEG = 24;

// ───────────────────────────── Pañca-mahābhūta indices ─────────────────────────────
/** Creation order (Taittirīya 2.1): Ākāśa=0, Vāyu=1, Tejas=2, Āpas=3, Pṛthvī=4. */
export enum Tattva {
  Akasha = 0,
  Vayu = 1,
  Tejas = 2,
  Apas = 3,
  Prthvi = 4,
}

export const TATTVA_NAMES: readonly { devanagari: string; iast: string; english: string; tanmatra: string }[] = [
  { devanagari: 'आकाश', iast: 'Ākāśa', english: 'Space-field', tanmatra: 'शब्द (śabda)' },
  { devanagari: 'वायु', iast: 'Vāyu', english: 'Kinetic force', tanmatra: 'स्पर्श (sparśa)' },
  { devanagari: 'तेजस्', iast: 'Tejas', english: 'Thermal / plasma', tanmatra: 'रूप (rūpa)' },
  { devanagari: 'आपः', iast: 'Āpas', english: 'Liquid', tanmatra: 'रस (rasa)' },
  { devanagari: 'पृथ्वी', iast: 'Pṛthvī', english: 'Solid matter', tanmatra: 'गन्ध (gandha)' },
];

// ───────────────────────────── Graha definitions ─────────────────────────────
export type GrahaId = 'surya' | 'chandra' | 'mangala' | 'budha' | 'guru' | 'shukra' | 'shani';
export type GrahaClass = 'luminary' | 'superior' | 'inferior';

export interface Periphery {
  /** Periphery (degrees of 360) at the end of even quadrants (kendra 0°, 180°). */
  readonly even: number;
  /** Periphery at the end of odd quadrants (kendra 90°, 270°). */
  readonly odd: number;
}

export interface GrahaConstants {
  readonly id: GrahaId;
  readonly nameDevanagari: string;
  readonly nameIAST: string;
  readonly english: string;
  readonly cls: GrahaClass;
  /** Revolutions of the mean planet (madhyama graha) in a Mahāyuga. For inferior planets = Sun's. */
  readonly meanRevolutions: number;
  /** Revolutions of the own śīghrocca in a Mahāyuga (inferior planets only). */
  readonly shighroccaRevolutions?: number;
  /** Apsis (mandocca) revolutions — per Kalpa for planets, per Mahāyuga for the Moon. */
  readonly mandoccaRevolutions: number;
  readonly mandoccaPer: 'kalpa' | 'mahayuga';
  /** Node (pāta) revolutions (retrograde) — per Kalpa for planets, per Mahāyuga for the Moon. */
  readonly pataRevolutions: number;
  readonly pataPer: 'kalpa' | 'mahayuga';
  readonly manda: Periphery;
  readonly shighra: Periphery | null;
  /** Greatest latitude (vikṣepa) in degrees. */
  readonly maxLatitudeDeg: number;
  /** Elemental nature (BPHS) used for Pañcīkaraṇa composition. */
  readonly tattva: Tattva;
  /** Vāyu-mārga index (1–7) carrying this graha. */
  readonly vayuLayer: number;
  /** Visual kakṣyā (orbit) radius in scene units. */
  readonly kakshaRadius: number;
  /** Visual body radius in scene units. */
  readonly bodyRadius: number;
  /** Visual exaggeration of karṇa (distance) variation so loops are legible on canvas. */
  readonly loopScale: number;
  /** Trail span in days for the OrbitTracer. */
  readonly trailDays: number;
  readonly color: number;
}

export const GRAHAS: readonly GrahaConstants[] = [
  {
    id: 'surya', nameDevanagari: 'सूर्य', nameIAST: 'Sūrya', english: 'Sun', cls: 'luminary',
    meanRevolutions: 4_320_000,
    mandoccaRevolutions: 387, mandoccaPer: 'kalpa',
    pataRevolutions: 0, pataPer: 'kalpa',
    manda: { even: 14, odd: 13 + 40 / 60 }, shighra: null,
    maxLatitudeDeg: 0, tattva: Tattva.Tejas, vayuLayer: 4,
    kakshaRadius: 6.5, bodyRadius: 0.62, loopScale: 0.6, trailDays: 365, color: 0xffc04d,
  },
  {
    id: 'chandra', nameDevanagari: 'चन्द्र', nameIAST: 'Candra', english: 'Moon', cls: 'luminary',
    meanRevolutions: 57_753_336,
    mandoccaRevolutions: 488_203, mandoccaPer: 'mahayuga',
    pataRevolutions: 232_238, pataPer: 'mahayuga',
    manda: { even: 32, odd: 31 + 40 / 60 }, shighra: null,
    maxLatitudeDeg: 4.5, tattva: Tattva.Apas, vayuLayer: 3,
    kakshaRadius: 3.8, bodyRadius: 0.27, loopScale: 0.6, trailDays: 27.32, color: 0xdfe8ff,
  },
  {
    id: 'budha', nameDevanagari: 'बुध', nameIAST: 'Budha', english: 'Mercury', cls: 'inferior',
    meanRevolutions: 4_320_000, shighroccaRevolutions: 17_937_060,
    mandoccaRevolutions: 368, mandoccaPer: 'kalpa',
    pataRevolutions: 488, pataPer: 'kalpa',
    manda: { even: 30, odd: 28 }, shighra: { even: 133, odd: 132 },
    maxLatitudeDeg: 2, tattva: Tattva.Prthvi, vayuLayer: 5,
    kakshaRadius: 9.6, bodyRadius: 0.2, loopScale: 0.32, trailDays: 360, color: 0x7fe0a8,
  },
  {
    id: 'shukra', nameDevanagari: 'शुक्र', nameIAST: 'Śukra', english: 'Venus', cls: 'inferior',
    meanRevolutions: 4_320_000, shighroccaRevolutions: 7_022_376,
    mandoccaRevolutions: 535, mandoccaPer: 'kalpa',
    pataRevolutions: 903, pataPer: 'kalpa',
    manda: { even: 12, odd: 11 }, shighra: { even: 262, odd: 260 },
    maxLatitudeDeg: 2, tattva: Tattva.Apas, vayuLayer: 5,
    kakshaRadius: 11.2, bodyRadius: 0.3, loopScale: 0.3, trailDays: 700, color: 0xf3e6ff,
  },
  {
    id: 'mangala', nameDevanagari: 'मङ्गल', nameIAST: 'Maṅgala', english: 'Mars', cls: 'superior',
    meanRevolutions: 2_296_832,
    mandoccaRevolutions: 204, mandoccaPer: 'kalpa',
    pataRevolutions: 214, pataPer: 'kalpa',
    // Specification: Manda = 70°, Śīghra = 234°
    manda: { even: 70, odd: 70 }, shighra: { even: 234, odd: 234 },
    maxLatitudeDeg: 1.5, tattva: Tattva.Tejas, vayuLayer: 5,
    kakshaRadius: 13.2, bodyRadius: 0.26, loopScale: 0.34, trailDays: 900, color: 0xff6a4d,
  },
  {
    id: 'guru', nameDevanagari: 'गुरु', nameIAST: 'Guru', english: 'Jupiter', cls: 'superior',
    meanRevolutions: 364_220,
    mandoccaRevolutions: 900, mandoccaPer: 'kalpa',
    pataRevolutions: 174, pataPer: 'kalpa',
    // Specification: Manda = 33°, Śīghra = 70°
    manda: { even: 33, odd: 33 }, shighra: { even: 70, odd: 70 },
    maxLatitudeDeg: 1, tattva: Tattva.Akasha, vayuLayer: 5,
    kakshaRadius: 15.6, bodyRadius: 0.48, loopScale: 0.75, trailDays: 1200, color: 0xffd98a,
  },
  {
    id: 'shani', nameDevanagari: 'शनि', nameIAST: 'Śani', english: 'Saturn', cls: 'superior',
    meanRevolutions: 146_568,
    mandoccaRevolutions: 39, mandoccaPer: 'kalpa',
    pataRevolutions: 662, pataPer: 'kalpa',
    // Specification: Manda = 49°, Śīghra = 39°
    manda: { even: 49, odd: 49 }, shighra: { even: 39, odd: 39 },
    maxLatitudeDeg: 2, tattva: Tattva.Vayu, vayuLayer: 5,
    kakshaRadius: 18.0, bodyRadius: 0.42, loopScale: 0.9, trailDays: 1500, color: 0x9fb4ff,
  },
];

export const GRAHA_BY_ID: Readonly<Record<GrahaId, GrahaConstants>> = Object.fromEntries(
  GRAHAS.map((g) => [g.id, g]),
) as Record<GrahaId, GrahaConstants>;

// ───────────────────────────── Bhū-gola & Vāyu radii ─────────────────────────────
export const BHU_RADIUS = 1.0;

export interface VayuShellGeometry {
  readonly inner: number;
  readonly outer: number;
}

/** Concentric radii of the 7 Vāyu-mārgas in scene units, matched to the graha kakṣyās. */
export const VAYU_SHELL_RADII: readonly VayuShellGeometry[] = [
  { inner: 1.04, outer: 1.7 }, // आवह
  { inner: 1.7, outer: 2.7 }, // प्रवह
  { inner: 2.7, outer: 5.0 }, // उद्वह — Candra
  { inner: 5.0, outer: 8.0 }, // संवह — Sūrya
  { inner: 8.0, outer: 20.0 }, // विवह — tārā-grahas
  { inner: 20.0, outer: 24.5 }, // परिवह — nakṣatras, saptarṣi
  { inner: 24.5, outer: 28.5 }, // परावह — Dhruva vortex
];

export const NAKSHATRA_RADIUS = 22.0;
export const DHRUVA_RADIUS = 27.5;

// ───────────────────────────── 27 Nakṣatras ─────────────────────────────
export interface NakshatraConstants {
  readonly index: number;
  readonly nameDevanagari: string;
  readonly nameIAST: string;
  /** Dhruvaka (polar longitude) of the yoga-tārā in degrees, SS 8.2–9. */
  readonly dhruvakaDeg: number;
  /** Vikṣepa (polar latitude) in degrees; north positive. */
  readonly vikshepaDeg: number;
}

export const NAKSHATRAS: readonly NakshatraConstants[] = [
  { index: 1, nameDevanagari: 'अश्विनी', nameIAST: 'Aśvinī', dhruvakaDeg: 8, vikshepaDeg: 10 },
  { index: 2, nameDevanagari: 'भरणी', nameIAST: 'Bharaṇī', dhruvakaDeg: 20, vikshepaDeg: 12 },
  { index: 3, nameDevanagari: 'कृत्तिका', nameIAST: 'Kṛttikā', dhruvakaDeg: 37.5, vikshepaDeg: 5 },
  { index: 4, nameDevanagari: 'रोहिणी', nameIAST: 'Rohiṇī', dhruvakaDeg: 49.5, vikshepaDeg: -5 },
  { index: 5, nameDevanagari: 'मृगशिरा', nameIAST: 'Mṛgaśirā', dhruvakaDeg: 63, vikshepaDeg: -10 },
  { index: 6, nameDevanagari: 'आर्द्रा', nameIAST: 'Ārdrā', dhruvakaDeg: 67, vikshepaDeg: -9 },
  { index: 7, nameDevanagari: 'पुनर्वसु', nameIAST: 'Punarvasu', dhruvakaDeg: 93, vikshepaDeg: 6 },
  { index: 8, nameDevanagari: 'पुष्य', nameIAST: 'Puṣya', dhruvakaDeg: 106, vikshepaDeg: 0 },
  { index: 9, nameDevanagari: 'आश्लेषा', nameIAST: 'Āśleṣā', dhruvakaDeg: 109, vikshepaDeg: -7 },
  { index: 10, nameDevanagari: 'मघा', nameIAST: 'Maghā', dhruvakaDeg: 129, vikshepaDeg: 0 },
  { index: 11, nameDevanagari: 'पूर्वाफाल्गुनी', nameIAST: 'Pūrvaphālgunī', dhruvakaDeg: 144, vikshepaDeg: 12 },
  { index: 12, nameDevanagari: 'उत्तराफाल्गुनी', nameIAST: 'Uttaraphālgunī', dhruvakaDeg: 155, vikshepaDeg: 13 },
  { index: 13, nameDevanagari: 'हस्त', nameIAST: 'Hasta', dhruvakaDeg: 170, vikshepaDeg: -11 },
  { index: 14, nameDevanagari: 'चित्रा', nameIAST: 'Citrā', dhruvakaDeg: 180, vikshepaDeg: -2 },
  { index: 15, nameDevanagari: 'स्वाती', nameIAST: 'Svātī', dhruvakaDeg: 199, vikshepaDeg: 37 },
  { index: 16, nameDevanagari: 'विशाखा', nameIAST: 'Viśākhā', dhruvakaDeg: 212, vikshepaDeg: -1.5 },
  { index: 17, nameDevanagari: 'अनुराधा', nameIAST: 'Anurādhā', dhruvakaDeg: 224, vikshepaDeg: -3 },
  { index: 18, nameDevanagari: 'ज्येष्ठा', nameIAST: 'Jyeṣṭhā', dhruvakaDeg: 229, vikshepaDeg: -4 },
  { index: 19, nameDevanagari: 'मूल', nameIAST: 'Mūla', dhruvakaDeg: 241, vikshepaDeg: -9 },
  { index: 20, nameDevanagari: 'पूर्वाषाढा', nameIAST: 'Pūrvāṣāḍhā', dhruvakaDeg: 254, vikshepaDeg: -5.5 },
  { index: 21, nameDevanagari: 'उत्तराषाढा', nameIAST: 'Uttarāṣāḍhā', dhruvakaDeg: 260, vikshepaDeg: -5 },
  { index: 22, nameDevanagari: 'श्रवण', nameIAST: 'Śravaṇa', dhruvakaDeg: 280, vikshepaDeg: 30 },
  { index: 23, nameDevanagari: 'धनिष्ठा', nameIAST: 'Dhaniṣṭhā', dhruvakaDeg: 290, vikshepaDeg: 36 },
  { index: 24, nameDevanagari: 'शतभिषा', nameIAST: 'Śatabhiṣā', dhruvakaDeg: 320, vikshepaDeg: -0.5 },
  { index: 25, nameDevanagari: 'पूर्वाभाद्रपदा', nameIAST: 'Pūrvabhādrapadā', dhruvakaDeg: 326, vikshepaDeg: 24 },
  { index: 26, nameDevanagari: 'उत्तराभाद्रपदा', nameIAST: 'Uttarabhādrapadā', dhruvakaDeg: 337, vikshepaDeg: 26 },
  { index: 27, nameDevanagari: 'रेवती', nameIAST: 'Revatī', dhruvakaDeg: 359.83, vikshepaDeg: 0 },
];

/** Saptarṣi (Ursa Major) — equatorial RA (hours) / Dec (deg) for placement near Dhruva. */
export const SAPTARSHI: readonly { nameDevanagari: string; nameIAST: string; raHours: number; decDeg: number }[] = [
  { nameDevanagari: 'क्रतु', nameIAST: 'Kratu', raHours: 11.06, decDeg: 61.75 },
  { nameDevanagari: 'पुलह', nameIAST: 'Pulaha', raHours: 11.03, decDeg: 56.38 },
  { nameDevanagari: 'पुलस्त्य', nameIAST: 'Pulastya', raHours: 11.9, decDeg: 53.69 },
  { nameDevanagari: 'अत्रि', nameIAST: 'Atri', raHours: 12.26, decDeg: 57.03 },
  { nameDevanagari: 'अङ्गिरा', nameIAST: 'Aṅgirā', raHours: 12.9, decDeg: 55.96 },
  { nameDevanagari: 'वसिष्ठ', nameIAST: 'Vasiṣṭha', raHours: 13.4, decDeg: 54.93 },
  { nameDevanagari: 'मरीचि', nameIAST: 'Marīci', raHours: 13.79, decDeg: 49.31 },
];

export const RASHI_NAMES: readonly string[] = [
  'मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन',
];

export const VARA_NAMES: readonly string[] = ['रविवार', 'सोमवार', 'मङ्गलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
