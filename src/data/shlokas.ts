/**
 * शास्त्र-प्रमाण कोश — The Foundational Sanskrit & Hindi Specification Corpus.
 *
 * Every simulation subsystem in Siddhānta-Yantra cites one of the entries below as its
 * algorithmic ground truth. The mūla ślokas and Gita Press Hindi renderings are embedded
 * verbatim from the project specification. English glosses are concise engineering notes
 * that summarise the Hindi bhāṣya for non-Hindi readers.
 */

export type ShlokaId =
  | 'nasadiya'
  | 'taittiriya'
  | 'pancikarana'
  | 'vivekachudamani'
  | 'bhaskara'
  | 'aryabhata'
  | 'suryaSiddhanta'
  | 'saptaVayu'
  | 'pralaya';

export interface Shloka {
  readonly id: ShlokaId;
  /** Section letter in the specification corpus (A–H). */
  readonly section: string;
  readonly titleDevanagari: string;
  readonly titleIAST: string;
  readonly titleEnglish: string;
  /** Textual citation in Devanagari, e.g. सूर्यसिद्धान्त २.१–३. */
  readonly source: string;
  readonly sourceEnglish: string;
  /** Complete mūla Sanskrit, one pāda / line per entry. */
  readonly mula: readonly string[];
  /** Complete Gita Press Hindi translation. */
  readonly hindi: string;
  readonly hindiAttribution: string;
  /** Concise English gloss of the Hindi bhāṣya. */
  readonly english: string;
  /** The computational law derived from the passage (static form). */
  readonly formula: readonly string[];
  /** The engine module(s) that implement this passage. */
  readonly implementedIn: readonly string[];
}

const GITA_PRESS = 'हिन्दी अनुवाद (गीताप्रेस)';

export const SHLOKAS: Readonly<Record<ShlokaId, Shloka>> = {
  // ───────────────────────────── A. ब्रह्माण्ड की उत्पत्ति ─────────────────────────────
  nasadiya: {
    id: 'nasadiya',
    section: 'A',
    titleDevanagari: 'ब्रह्माण्ड की उत्पत्ति — नासदीय सूक्त',
    titleIAST: 'Brahmāṇḍa kī Utpatti — Nāsadīya Sūkta',
    titleEnglish: 'Cosmogenesis & the Primordial Singularity',
    source: 'ऋग्वेद, नासदीय सूक्त (१०.१२९.१, ३)',
    sourceEnglish: 'Ṛgveda, Nāsadīya Sūkta 10.129.1, 3',
    mula: [
      'नासदासीन्नो सदासीत्तदानीं नासीद्रजो नो व्योमा परो यत्।',
      'तम आसीत्तमसा गूळ्हमग्रेऽप्रकेतं सलिलं सर्वमा इदम्॥',
    ],
    hindi:
      'सृष्टि से पूर्व न असत् था, न सत्; न अंतरिक्ष था, न उससे परे आकाश। सर्वप्रथम अंधकार से ढका हुआ एक अविभाज्य, अनिर्वचनीय सलिल (तरल ऊर्जा-क्षेत्र) सर्वत्र व्याप्त था।',
    hindiAttribution: GITA_PRESS,
    english:
      'Before creation there was neither non-being nor being, neither atmosphere nor the sky beyond. Darkness concealed by darkness — an undifferentiated, indescribable “salila” (fluid energy-field) pervaded all.',
    formula: [
      'Avyakta state: L = 0  (tattva-level)',
      'salila(x,t) = ε · wave(x,t),  ε → 0  (tamas · tamasā gūḷham)',
      'No geometry, no metric: all mesh opacities = 0',
    ],
    implementedIn: ['simulation/CosmogenesisEngine.ts', 'shaders/pralayaCollapse.vert.glsl'],
  },

  taittiriya: {
    id: 'taittiriya',
    section: 'A',
    titleDevanagari: 'पञ्चमहाभूत-उत्पत्ति क्रम',
    titleIAST: 'Pañca-mahābhūta Utpatti Krama',
    titleEnglish: 'Sequential Emergence of the Five Elements',
    source: 'तैत्तिरीयोपनिषद् (ब्रह्मानन्दवल्ली, २.१)',
    sourceEnglish: 'Taittirīya Upaniṣad, Brahmānanda Vallī 2.1',
    mula: [
      'तस्माद्वा एतस्मादात्मन आकाशः संभूतः।',
      'आकाशाद्वायुः। वायोरग्निः। अग्नेरापः। अद्भ्यः पृथिवी।',
    ],
    hindi:
      'उस आत्म-तत्त्व (ब्रह्म) से आकाश (Space-field) उत्पन्न हुआ; आकाश से वायु (Kinetic Force); वायु से अग्नि (Thermal/Plasma); अग्नि से जल (Liquid); जल से ठोस पृथ्वी (Matter) उत्पन्न हुई।',
    hindiAttribution: GITA_PRESS,
    english:
      'From that Self (Brahman) arose Ākāśa (space-field); from Ākāśa, Vāyu (kinetic force); from Vāyu, Agni (thermal plasma); from Agni, Āpas (liquid); from Āpas, solid Pṛthvī (matter).',
    formula: [
      'State machine:  Avyakta → Ākāśa → Vāyu → Tejas → Āpas → Pṛthvī',
      'L(t) ∈ [0,5],  manifest_k = clamp(L − k, 0, 1),  k = 0…4',
      'Each state k is caused by state k−1 (kāraṇa → kārya)',
    ],
    implementedIn: ['simulation/CosmogenesisEngine.ts'],
  },

  // ───────────────────────────── B. पञ्चीकरण ─────────────────────────────
  pancikarana: {
    id: 'pancikarana',
    section: 'B',
    titleDevanagari: 'अद्वैत वेदांत: पञ्चीकरण प्रक्रिया',
    titleIAST: 'Advaita Vedānta: Pañcīkaraṇa Prakriyā',
    titleEnglish: 'The Five-Element Quintuplication Matrix',
    source: 'पञ्चदशी (तत्त्वविवेक, १.२७) — स्वामी विद्यारण्य मुनि / पञ्चीकरणम् (आदि शंकराचार्य)',
    sourceEnglish: 'Pañcadaśī, Tattvaviveka 1.27 — Vidyāraṇya; Pañcīkaraṇam — Ādi Śaṅkarācārya',
    mula: ['द्विधा विधाय चैकैकं चतुर्धा प्रथमं पुनः।', 'स्वस्वेतरद्वितीयांशैर्योजनात्पञ्च पञ्च ते॥'],
    hindi:
      'पाँचों सूक्ष्म तत्त्वों में से प्रत्येक को पहले दो बराबर भागों (५०%-५०%) में विभाजित किया जाता है। फिर पहले आधे भाग को चार बराबर भागों (१२.५% प्रत्येक) में बाँटकर शेष चार तत्त्वों के आधे भाग में मिला दिया जाता है। इस प्रकार प्रत्येक स्थूल तत्त्व बनता है।',
    hindiAttribution: GITA_PRESS,
    english:
      'Each subtle element is halved; one half is divided into four eighths (12.5% each) and given to the other four. Every gross element is thus 50% itself and 12.5% of each of the other four.',
    formula: [
      'M_ij = 0.50  if i = j  (svakīya sūkṣma tattva)',
      'M_ij = 0.125 if i ≠ j  (anya catur sūkṣma tattva)',
      'Gross property P_i = Σ_j M_ij · p_j   (albedo, density, emission, colour)',
    ],
    implementedIn: ['math/pancikarana.ts', 'shaders/graha.frag.glsl', 'shaders/pralayaCollapse.vert.glsl'],
  },

  // ───────────────────────────── C. विवर्तवाद एवं माया ─────────────────────────────
  vivekachudamani: {
    id: 'vivekachudamani',
    section: 'C',
    titleDevanagari: 'अद्वैत वेदांत: विवर्तवाद एवं माया',
    titleIAST: 'Advaita Vedānta: Vivartavāda evaṁ Māyā',
    titleEnglish: 'Apparent Transformation & the Māyā Toggle',
    source: 'विवेकचूड़ामणि (श्लोक १११, ११३) — आदि शंकराचार्य',
    sourceEnglish: 'Vivekacūḍāmaṇi 111, 113 — Ādi Śaṅkarācārya',
    mula: [
      'विक्षेपशक्तिर्लिङ्गमादिका महदवसानां तनुते प्रपञ्चम्।',
      'कवलितदिनभर्त्रीव भाति चावृत्या तमसा महता॥',
      'ब्रह्म सत्यं जगन्मिथ्या जीवो ब्रह्मैव नापरः।',
    ],
    hindi:
      'माया की आवरण शक्ति वास्तविक सत्य (ब्रह्म) को ढक लेती है और विक्षेप शक्ति महत्तत्त्व से लेकर समस्त दृश्य प्रपञ्च (ग्रह, नक्षत्र, आकाश) का आभासी प्रक्षेपण करती है। वस्तुतः ब्रह्म ही एकमात्र सत्य है, जगत् नाम-रूपात्मक प्रतीति मात्र है।',
    hindiAttribution: GITA_PRESS,
    english:
      'Māyā’s veiling power (āvaraṇa) conceals Brahman; its projecting power (vikṣepa) projects the entire visible cosmos from Mahat downward. Brahman alone is real; the world is name-and-form appearance.',
    formula: [
      'Vyāvahārika:  vikṣepa = 1, āvaraṇa = 1  → prapañca rendered',
      'Pāramārthika: vikṣepa → 0 (world dissolves), then āvaraṇa → 0 (light revealed)',
      'pixel = scene·vikṣepa + (1−vikṣepa)·(1−āvaraṇa)·B(ω̂),   Var[B] → 0',
    ],
    implementedIn: ['simulation/AdvaitaOverlay.ts', 'shaders/brahmanField.frag.glsl'],
  },

  // ───────────────────────────── D. गुरुत्वाकर्षण ─────────────────────────────
  bhaskara: {
    id: 'bhaskara',
    section: 'D',
    titleDevanagari: 'गुरुत्वाकर्षण एवं निराधार पृथ्वी',
    titleIAST: 'Gurutvākarṣaṇa evaṁ Nirādhāra Pṛthvī',
    titleEnglish: 'Inherent Gravity & the Unsupported Earth',
    source: 'सिद्धान्तशिरोमणि, गोलाध्याय (भुवनकोश, श्लोक ४ एवं ६) — भास्कराचार्य',
    sourceEnglish: 'Siddhānta Śiromaṇi, Golādhyāya, Bhuvanakośa 4 & 6 — Bhāskarācārya II',
    mula: [
      'मूर्तो धर्त्ता चेत्तदस्याप्यनन्तो घोरेऽधस्तात् खार्णवेऽभ्युत्पतेद्वा।',
      'अथोत्पत्तेश्चेत्तदप्यन्यथैव शक्त्यानन्ता चेत् समानेव सापि॥ (४)',
      'आकृष्टशक्तिश्च मही तया यत् खस्थं गुरु स्वाभिमुखं स्वशक्त्या।',
      'आकृष्यते तत्पततीव भाति समे समन्तात् क्व पतत्वियं खे॥ (६)',
    ],
    hindi:
      "यदि पृथ्वी का कोई आधार मानोगे तो उसका भी दूसरा आधार मानना पड़ेगा, जिससे अनवस्था दोष होगा। पृथ्वी शून्य आकाश में अपनी स्वाभाविक अनंत शक्ति से स्थित है। पृथ्वी में 'आकृष्ट-शक्ति' (आकर्षण बल) है, जिससे वह आकाश में स्थित सभी भारी वस्तुओं को अपनी ओर खींचती है। वे गिरती हुई प्रतीत होती हैं, किंतु चारों ओर से समान बल होने से पृथ्वी स्वयं शून्य में कहीं नहीं गिरती।",
    hindiAttribution: GITA_PRESS,
    english:
      'Posit a support for the Earth and that support needs another — infinite regress. The Earth abides in space by its own power. It possesses ākṛṣṭi-śakti, drawing every heavy body toward itself; they seem to fall, but being pulled equally from all sides, where could the Earth itself fall?',
    formula: [
      'F⃗ = −G_s · M_bhū / r² · r̂',
      '“adhaḥ” (down) ≡ −r̂ : purely radial, no universal direction',
      'Σ F⃗ on Bhū-gola (isotropic) = 0  → nirādhāra (unsupported) equilibrium',
    ],
    implementedIn: ['math/akrshti.ts', 'simulation/CelestialSphere.ts'],
  },

  // ───────────────────────────── E. गति की सापेक्षता ─────────────────────────────
  aryabhata: {
    id: 'aryabhata',
    section: 'E',
    titleDevanagari: 'गति की सापेक्षता',
    titleIAST: 'Gati kī Sāpekṣatā',
    titleEnglish: 'Relativity of Diurnal Motion',
    source: 'आर्यभटीय, गोलपाद (श्लोक ९) — आर्यभट',
    sourceEnglish: 'Āryabhaṭīya, Golapāda 9 — Āryabhaṭa',
    mula: ['अनुलोमगतिर्नौस्थः पश्यत्यचलं विलोमगं यद्वत्।', 'अचलानि भानि तद्वत् समपश्चिमगानि लङ्कायाम्॥'],
    hindi:
      'जिस प्रकार नाव में आगे की ओर जाता हुआ मनुष्य किनारे पर स्थित स्थिर वृक्षों और पत्थरों को पीछे भागता हुआ देखता है, उसी प्रकार भूमध्य रेखा (लंका) पर खड़े द्रष्टा को स्थिर नक्षत्र-मण्डल पश्चिम की ओर एक समान गति से जाता दिखाई देता है।',
    hindiAttribution: GITA_PRESS,
    english:
      'Just as a man in a boat moving forward sees stationary objects on the shore moving backward, so an observer at Laṅkā (equator) sees the fixed stars moving uniformly westward.',
    formula: [
      'Āryabhaṭa mode:  ω_bhū = +ω_d (eastward),  ω_bha = 0',
      'Siddhānta mode:  ω_bhū = 0,  ω_bha = −ω_d (Pravaha, westward)',
      'Observed relative rotation  ω_bha − ω_bhū = −ω_d  (identical in both frames)',
    ],
    implementedIn: ['simulation/CelestialSphere.ts', 'math/vayuDynamics.ts'],
  },

  // ───────────────────────────── F. मंद-शीघ्र परिधि ─────────────────────────────
  suryaSiddhanta: {
    id: 'suryaSiddhanta',
    section: 'F',
    titleDevanagari: 'मंद-शीघ्र परिधि और वक्री गति',
    titleIAST: 'Manda-Śīghra Paridhi aura Vakrī Gati',
    titleEnglish: 'Dual Epicycles & Retrograde Loops',
    source: 'सूर्यसिद्धान्त, अध्याय २ (श्लोक १–३)',
    sourceEnglish: 'Sūrya Siddhānta 2.1–3',
    mula: [
      'अदृश्यरूपिणः काला भुवनेषु व्यवस्थिताः।',
      'शीघ्रमन्दोच्चपाताख्या ग्रहाणां गतिकारकाः॥',
      'तद्वातविशिखैर्बद्धास्तेऽपकृष्यन्त मूर्त्तयः।',
      'प्राक्पश्चादपकृष्यन्ते यथासन्नं स्वदिङ्मुखम्॥',
    ],
    hindi:
      'काल के अदृश्य नियामक केंद्र (मन्दोच्च, शीघ्रोच्च और पात) वायु रूपी रश्मियों (वात-रश्मि) से ग्रहों को अपनी ओर खींचते हैं, जिससे उनकी गति कभी तीव्र, कभी मन्द और कभी उल्टी (वक्री) हो जाती है।',
    hindiAttribution: GITA_PRESS,
    english:
      'Invisible forms of Time — the śīghrocca, mandocca and pāta — pull the planets with cords of wind (vāta-raśmi), making their motion now swift, now slow, and at times reversed (vakra).',
    formula: [
      'jyā(Δθ_manda) = (r_manda / R) · jyā(θ_mean − θ_mandocca),   R = 3438′',
      'tan(Δθ_śīghra) = r_ś · jyā(κ) / (R + r_ś · kojyā(κ)),   κ = θ_śīghrocca − θ_manda-sphuṭa',
      'dθ_true/dt < 0 → वक्री (vakrī);  ≈ 0 → कुटिल (kuṭila);  > 0 → मार्गी',
    ],
    implementedIn: ['math/suryaTrig.ts', 'math/epicycleEngine.ts', 'simulation/OrbitTracer.ts', 'simulation/WindTethers.ts'],
  },

  // ───────────────────────────── G. सप्त वायु-मार्ग ─────────────────────────────
  saptaVayu: {
    id: 'saptaVayu',
    section: 'G',
    titleDevanagari: 'सप्त वायु-मार्ग',
    titleIAST: 'Sapta Vāyu-Mārga',
    titleEnglish: 'The Seven Dynamic Hydrodynamic Strata',
    source: 'महाभारत, शान्तिपर्व (मोक्षधर्मपर्व) एवं हरिवंश',
    sourceEnglish: 'Mahābhārata, Śānti Parva (Mokṣadharma) & Harivaṁśa',
    mula: ['महारूपो महाघोरः परावह इहोच्यते।', 'येन चक्रं समाविद्धं ध्रुवस्यैतन्नभस्तले॥'],
    hindi:
      '१. आवह: भू-सतह का वायुमण्डल (मेघ, वर्षा)। २. प्रवह: उल्का-पात और ऊपरी तेज वायु। ३. उद्वह: चन्द्रमा की कक्षा और ज्वार-भाटा का नियामक। ४. संवह: सूर्य का मण्डल और वार्षिक गति। ५. विवह: पाँच तारा-ग्रहों (बुध, शुक्र, मंगल, गुरु, शनि) का मण्डल। ६. परिवह: सप्तर्षि एवं २७ नक्षत्रों का मण्डल। ७. परावह: ध्रुव तारे से जुड़ा बाह्यतम महा-भंवर जो सम्पूर्ण खगोल को घुमाता है।',
    hindiAttribution: 'हिन्दी विवरण (गीताप्रेस)',
    english:
      'Seven concentric winds: Āvaha (clouds, rain), Pravaha (meteors, upper gales), Udvaha (Moon, tides), Saṁvaha (Sun, annual motion), Vivaha (five star-planets), Parivaha (Saptarṣi & 27 nakṣatras), and Parāvaha — the mighty outermost vortex bound to Dhruva that whirls the entire sphere.',
    formula: [
      'v⃗_i(x⃗) = ω⃗_i × x⃗   for  r_i,in ≤ |x⃗| < r_i,out,   i = 1…7',
      'ω⃗_i = ω̂_dhruva · (Ω_i,intrinsic − δ_mode · ω_diurnal)',
      'a⃗_drag = k_i · (v⃗_i − v⃗_particle)',
    ],
    implementedIn: ['math/vayuDynamics.ts', 'simulation/CelestialSphere.ts', 'simulation/WindTethers.ts'],
  },

  // ───────────────────────────── H. चतुर्विध महाप्रलय ─────────────────────────────
  pralaya: {
    id: 'pralaya',
    section: 'H',
    titleDevanagari: 'चतुर्विध महाप्रलय',
    titleIAST: 'Caturvidha Mahāpralaya',
    titleEnglish: 'The Four-Fold Dissolution',
    source: 'श्रीमद्भागवत महापुराण (द्वादश स्कन्ध, अध्याय ४) एवं महाभारत (शान्तिपर्व, २३१–२३३)',
    sourceEnglish: 'Śrīmad Bhāgavatam 12.4 & Mahābhārata, Śānti Parva 231–233',
    mula: [
      'नित्यः सदैव भूतानां जन्मप्रलय उच्यते। (४)',
      'द्विपरार्धे त्वतिक्रान्ते ब्रह्मणः परमेष्ठिनः। तदा प्रकृतयः सप्त कल्पन्ते प्रलयाय हि॥ (२४)',
      'भूमिः सलिलत्वमुपगच्छति... सलिलाच्चैवोत्तस्थौ तेजः... ततस्तेजः शाम्यति वातेन... वातश्चाकाशं प्रतिपद्यते।',
    ],
    hindi:
      '१. नित्य प्रलय: प्रत्येक क्षण होने वाला आणविक व कोशिकीय क्षय। २. नैमित्तिक प्रलय: कल्प के अंत (४.३२ अरब वर्ष) पर ब्रह्मा की रात्रि में त्रिलोकी का जलमग्न होना। ३. प्राकृतिक प्रलय: महाकल्प के अंत (३११.०४ ट्रिलियन वर्ष) पर प्रकृति का विपरीत क्रम में लय: ठोस पृथ्वी → (पिघलना) जल → (वाष्पीकरण) अग्नि (तेज) → (शमन) वायु → (विश्राम) आकाश → (विलीन) अव्यक्त/ब्रह्म। ४. आत्यन्तिक प्रलय: अद्वैत आत्मज्ञान द्वारा अविद्या (माया) की सर्वथा निवृत्ति।',
    hindiAttribution: GITA_PRESS,
    english:
      'Nitya: momentary atomic & cellular decay. Naimittika: at the end of a Kalpa (4.32 billion years), Brahmā’s night submerges the three worlds. Prākṛtika: at the end of the Mahākalpa (311.04 trillion years), Prakṛti dissolves in reverse order — earth melts to water, water evaporates to fire, fire is quelled by wind, wind rests in space, space merges into the Unmanifest. Ātyantika: final cessation of avidyā through non-dual knowledge.',
    formula: [
      'Nitya:      α_p(t) = life(fract(τ·κ_p + s_p))   per particle, every frame',
      'Naimittika: flood(Y) = night(Y mod 8.64×10⁹ yr),  R_flood → trilokī',
      'Prākṛtika:  L = 5·(1 − p),  e_p = min(element_p, L − 1)   (reverse of sṛṣṭi)',
      'Ātyantika:  āvaraṇa, vikṣepa → 0 (Māyā-nivṛtti)',
    ],
    implementedIn: ['simulation/PralayaEngine.ts', 'shaders/pralayaCollapse.vert.glsl', 'shaders/pralayaCollapse.frag.glsl'],
  },
};

/** The seven Vāyu-mārgas with their Gita Press descriptions (Section G). */
export interface VayuDescription {
  readonly index: number;
  readonly nameDevanagari: string;
  readonly nameIAST: string;
  readonly hindi: string;
  readonly english: string;
}

export const VAYU_DESCRIPTIONS: readonly VayuDescription[] = [
  { index: 1, nameDevanagari: 'आवह', nameIAST: 'Āvaha', hindi: 'भू-सतह का वायुमण्डल (मेघ, वर्षा)।', english: 'Surface atmosphere — clouds and rain.' },
  { index: 2, nameDevanagari: 'प्रवह', nameIAST: 'Pravaha', hindi: 'उल्का-पात और ऊपरी तेज वायु।', english: 'Meteor-fall and the swift upper winds.' },
  { index: 3, nameDevanagari: 'उद्वह', nameIAST: 'Udvaha', hindi: 'चन्द्रमा की कक्षा और ज्वार-भाटा का नियामक।', english: 'Orbit of the Moon; regulator of the tides.' },
  { index: 4, nameDevanagari: 'संवह', nameIAST: 'Saṁvaha', hindi: 'सूर्य का मण्डल और वार्षिक गति।', english: 'Sphere of the Sun and its annual motion.' },
  { index: 5, nameDevanagari: 'विवह', nameIAST: 'Vivaha', hindi: 'पाँच तारा-ग्रहों (बुध, शुक्र, मंगल, गुरु, शनि) का मण्डल।', english: 'Sphere of the five star-planets.' },
  { index: 6, nameDevanagari: 'परिवह', nameIAST: 'Parivaha', hindi: 'सप्तर्षि एवं २७ नक्षत्रों का मण्डल।', english: 'Sphere of the Saptarṣi and the 27 nakṣatras.' },
  { index: 7, nameDevanagari: 'परावह', nameIAST: 'Parāvaha', hindi: 'ध्रुव तारे से जुड़ा बाह्यतम महा-भंवर जो सम्पूर्ण खगोल को घुमाता है।', english: 'Outermost great vortex bound to Dhruva, whirling the whole sphere.' },
];

/** The four Pralayas (Section H). */
export type PralayaKind = 'nitya' | 'naimittika' | 'prakrtika' | 'atyantika';

export interface PralayaDescription {
  readonly kind: PralayaKind;
  readonly nameDevanagari: string;
  readonly nameIAST: string;
  readonly hindi: string;
  readonly english: string;
}

export const PRALAYA_DESCRIPTIONS: Readonly<Record<PralayaKind, PralayaDescription>> = {
  nitya: { kind: 'nitya', nameDevanagari: 'नित्य प्रलय', nameIAST: 'Nitya Pralaya', hindi: 'प्रत्येक क्षण होने वाला आणविक व कोशिकीय क्षय।', english: 'Momentary atomic and cellular decay.' },
  naimittika: { kind: 'naimittika', nameDevanagari: 'नैमित्तिक प्रलय', nameIAST: 'Naimittika Pralaya', hindi: 'कल्प के अंत (४.३२ अरब वर्ष) पर ब्रह्मा की रात्रि में त्रिलोकी का जलमग्न होना।', english: 'Submersion of the three worlds in Brahmā’s night at the end of a Kalpa.' },
  prakrtika: { kind: 'prakrtika', nameDevanagari: 'प्राकृतिक प्रलय', nameIAST: 'Prākṛtika Pralaya', hindi: 'महाकल्प के अंत (३११.०४ ट्रिलियन वर्ष) पर प्रकृति का विपरीत क्रम में लय।', english: 'Reverse-order dissolution of Prakṛti at the end of the Mahākalpa.' },
  atyantika: { kind: 'atyantika', nameDevanagari: 'आत्यन्तिक प्रलय', nameIAST: 'Ātyantika Pralaya', hindi: 'अद्वैत आत्मज्ञान द्वारा अविद्या (माया) की सर्वथा निवृत्ति।', english: 'Total cessation of avidyā (Māyā) through non-dual Self-knowledge.' },
};

/** Stage captions — verse fragments shown while a phase transition is in progress. */
export interface StageCaption {
  readonly sanskrit: string;
  readonly hindi: string;
  readonly label: string;
}

/** Sṛṣṭi captions indexed by the tattva being born (0 = Avyakta … 5 = Pṛthvī). */
export const SRSHTI_CAPTIONS: readonly StageCaption[] = [
  { sanskrit: 'तम आसीत्तमसा गूळ्हमग्रेऽप्रकेतं सलिलं सर्वमा इदम्॥', hindi: 'अंधकार से ढका हुआ अनिर्वचनीय सलिल सर्वत्र व्याप्त था।', label: 'अव्यक्त · Avyakta' },
  { sanskrit: 'तस्माद्वा एतस्मादात्मन आकाशः संभूतः।', hindi: 'उस आत्म-तत्त्व से आकाश उत्पन्न हुआ।', label: 'आकाश · Ākāśa' },
  { sanskrit: 'आकाशाद्वायुः।', hindi: 'आकाश से वायु।', label: 'वायु · Vāyu' },
  { sanskrit: 'वायोरग्निः।', hindi: 'वायु से अग्नि।', label: 'तेजस् · Tejas' },
  { sanskrit: 'अग्नेरापः।', hindi: 'अग्नि से जल।', label: 'आपः · Āpas' },
  { sanskrit: 'अद्भ्यः पृथिवी।', hindi: 'जल से ठोस पृथ्वी उत्पन्न हुई।', label: 'पृथ्वी · Pṛthvī' },
];

/** Prākṛtika-laya captions indexed by the tattva being dissolved (5 = Pṛthvī … 1 = Ākāśa). */
export const LAYA_CAPTIONS: Readonly<Record<number, StageCaption>> = {
  5: { sanskrit: 'भूमिः सलिलत्वमुपगच्छति', hindi: 'ठोस पृथ्वी पिघलकर जल बनती है।', label: 'पृथ्वी → जल (पिघलना)' },
  4: { sanskrit: 'सलिलाच्चैवोत्तस्थौ तेजः', hindi: 'जल वाष्पित होकर अग्नि (तेज) में लीन।', label: 'जल → अग्नि (वाष्पीकरण)' },
  3: { sanskrit: 'ततस्तेजः शाम्यति वातेन', hindi: 'तेज वायु द्वारा शान्त होता है।', label: 'अग्नि → वायु (शमन)' },
  2: { sanskrit: 'वातश्चाकाशं प्रतिपद्यते', hindi: 'वायु आकाश में विश्राम करती है।', label: 'वायु → आकाश (विश्राम)' },
  1: { sanskrit: 'द्विपरार्धे त्वतिक्रान्ते ब्रह्मणः परमेष्ठिनः', hindi: 'आकाश अव्यक्त/ब्रह्म में विलीन।', label: 'आकाश → अव्यक्त (विलीन)' },
};

export function getShloka(id: ShlokaId): Shloka {
  return SHLOKAS[id];
}
