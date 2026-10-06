/**
 * लिप्यन्तरण — Devanāgarī → IAST transliteration (ISO-15919-compatible subset).
 *
 * Rule: a consonant carries the inherent vowel "a" unless followed by a vowel sign (mātrā)
 * or the virāma (्). Vedic svara marks, ZWJ / ZWNJ and nukta are dropped.
 */

const CONSONANTS: Readonly<Record<string, string>> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ṅ',
  च: 'c', छ: 'ch', ज: 'j', झ: 'jh', ञ: 'ñ',
  ट: 'ṭ', ठ: 'ṭh', ड: 'ḍ', ढ: 'ḍh', ण: 'ṇ',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
  य: 'y', र: 'r', ल: 'l', व: 'v', ळ: 'ḷ',
  श: 'ś', ष: 'ṣ', स: 's', ह: 'h',
};

const VOWELS: Readonly<Record<string, string>> = {
  अ: 'a', आ: 'ā', इ: 'i', ई: 'ī', उ: 'u', ऊ: 'ū',
  ऋ: 'ṛ', ॠ: 'ṝ', ऌ: 'ḷ', ॡ: 'ḹ', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au',
};

const MATRAS: Readonly<Record<string, string>> = {
  'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū',
  'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ', 'ॣ': 'ḹ', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
};

const MARKS: Readonly<Record<string, string>> = {
  'ं': 'ṃ', 'ः': 'ḥ', 'ँ': 'm̐', 'ऽ': "'", '।': '|', '॥': '||', 'ॐ': 'oṃ',
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

const VIRAMA = '्';
const NUKTA = '़';
/** Udātta / anudātta / svarita marks, ZWNJ, ZWJ. */
const SKIP = new Set(['\u0951', '\u0952', '\u0953', '\u0954', '\u1CDA', '\u200C', '\u200D', NUKTA]);

export function devanagariToIAST(input: string): string {
  const chars = Array.from(input);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (SKIP.has(ch)) continue;

    const cons = CONSONANTS[ch];
    if (cons !== undefined) {
      out += cons;
      // Skip nukta / svara marks between the consonant and its vowel sign.
      let j = i + 1;
      while (j < chars.length && SKIP.has(chars[j])) j++;
      const next = chars[j];
      if (next === VIRAMA) {
        i = j;
      } else if (next !== undefined && MATRAS[next] !== undefined) {
        out += MATRAS[next];
        i = j;
      } else {
        out += 'a';
      }
      continue;
    }

    const v = VOWELS[ch] ?? MARKS[ch];
    out += v !== undefined ? v : ch;
  }
  return out;
}
