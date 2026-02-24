/**
 * Functional Chord Symbol Analysis
 *
 * Converts a chord (root + quality + intervals) and a key (tonic + mode) into
 * one or more Roman-numeral functional harmony analyses, ranked by confidence.
 *
 * Supports:
 *  - Diatonic triads and sevenths (major and minor modes)
 *  - Harmonic-minor handling (raised 7th / leading tone)
 *  - Seventh quality symbols: ° (dim), ø (half-dim), maj7, regular 7
 *  - Applied (secondary) dominants: V/x, vii°/x
 *  - Neapolitan chords: N6 / bII6 / N
 *  - Alternate chord interpretations (multiple candidates ranked by confidence)
 *
 * Limitations:
 *  - Inversions are reflected via chord.rootDegree when available (N6 if bII in first inversion)
 *    but full figured-bass inversion labels (V4/2, V6/5 etc.) are NOT implemented.
 *  - Extensions beyond the 7th (9, 11, 13) are represented with simplified suffix.
 *  - Applied chords beyond V/x and vii°/x are not implemented (e.g., IV/x, ii/x).
 */

import { Chord } from '@tonaljs/chord';
import { Note } from 'tonal';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FunctionalAnalysis = {
  /** The compact Roman-numeral symbol, e.g. "V7", "ii", "bVII", "V7/V", "N6" */
  symbol: string;
  /** Confidence score 0–1 (higher = more likely primary interpretation) */
  confidence: number;
  /** Optional human-readable detail for tooltip/help text */
  label?: string;
};

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const ROMAN_UPPER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const ROMAN_LOWER = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

/**
 * Maps semitones-from-tonic (0..11) to { degree: 1..7, prefix: ''|'b'|'#' }
 * for MAJOR mode.
 * Diatonic semitones: 0,2,4,5,7,9,11 → degrees I..VII with no prefix.
 * Chromatic semitones get the nearest diatonic degree with flat/sharp prefix.
 */
const MAJOR_CHROMATIC: ReadonlyArray<{ degree: number; prefix: '' | 'b' | '#' }> = [
  { degree: 1, prefix: '' },   //  0 – I   (C in C major)
  { degree: 2, prefix: 'b' },  //  1 – bII
  { degree: 2, prefix: '' },   //  2 – II
  { degree: 3, prefix: 'b' },  //  3 – bIII
  { degree: 3, prefix: '' },   //  4 – III
  { degree: 4, prefix: '' },   //  5 – IV
  { degree: 5, prefix: 'b' },  //  6 – bV  (also #IV; bV chosen for readability)
  { degree: 5, prefix: '' },   //  7 – V
  { degree: 6, prefix: 'b' },  //  8 – bVI
  { degree: 6, prefix: '' },   //  9 – VI
  { degree: 7, prefix: 'b' },  // 10 – bVII
  { degree: 7, prefix: '' },   // 11 – VII
];

/**
 * Maps semitones-from-tonic (0..11) to { degree: 1..7, prefix }
 * for MINOR (natural) mode.
 * Diatonic semitones: 0,2,3,5,7,8,10 → degrees i..VII with no prefix.
 * Semitone 11 (raised 7th, harmonic minor leading tone) is represented as
 * prefix '#' degree 7, but see the harmonic-minor override in the code below.
 */
const MINOR_CHROMATIC: ReadonlyArray<{ degree: number; prefix: '' | 'b' | '#' }> = [
  { degree: 1, prefix: '' },   //  0 – i
  { degree: 2, prefix: 'b' },  //  1 – bII  (Neapolitan territory)
  { degree: 2, prefix: '' },   //  2 – ii
  { degree: 3, prefix: '' },   //  3 – III  (minor mediant is diatonic – the minor 3rd)
  { degree: 3, prefix: '#' },  //  4 – #III (chromatic, unusual)
  { degree: 4, prefix: '' },   //  5 – iv
  { degree: 5, prefix: 'b' },  //  6 – bV
  { degree: 5, prefix: '' },   //  7 – V    (also v depending on quality)
  { degree: 6, prefix: '' },   //  8 – VI
  { degree: 6, prefix: '#' },  //  9 – #VI  (between VI and VII, unusual)
  { degree: 7, prefix: '' },   // 10 – VII  (subtonic – natural minor)
  { degree: 7, prefix: '#' },  // 11 – #VII (harmonic-minor leading tone)
];

/**
 * Whether each scale degree has minor quality by default in major mode.
 * Degrees with lowercase Roman numerals in major: ii (2), iii (3), vii (7).
 */
const MAJOR_DEGREE_IS_MINOR: ReadonlyArray<boolean> = [
  false, // placeholder for index 0
  false, // I   – major
  true,  // ii  – minor
  true,  // iii – minor
  false, // IV  – major
  false, // V   – major
  true,  // vi  – minor
  true,  // vii – diminished (treated as minor-case for symbol purposes)
];

/**
 * Whether each scale degree has minor quality by default in minor mode.
 * Lowercase Roman numerals in natural minor: i (1), ii (2), iv (4), v (5).
 * Uppercase: III (3), VI (6), VII (7).
 */
const MINOR_DEGREE_IS_MINOR: ReadonlyArray<boolean> = [
  false, // placeholder
  true,  // i   – minor
  true,  // ii° – diminished (treated as minor-case)
  false, // III – major
  true,  // iv  – minor
  true,  // v   – minor (but V if major quality / harmonic minor)
  false, // VI  – major
  false, // VII – major (subtonic)
];

// ---------------------------------------------------------------------------
// Helper: determine quality info from chord intervals
// ---------------------------------------------------------------------------

type ChordQualityInfo = {
  /** true = uppercase Roman numeral (major/augmented), false = lowercase (minor/dim) */
  uppercase: boolean;
  /** Symbol suffix for the quality, e.g. "", "7", "°", "°7", "ø7", "maj7", "+" */
  suffix: string;
};

function getChordQualityInfo(chord: Chord): ChordQualityInfo {
  // Strip optional-interval wildcard markers
  const intervals = chord.intervals.map((i) => i.replace(/\*/g, ''));

  const has3M = intervals.includes('3M');
  const has3m = intervals.includes('3m');
  const has5d = intervals.includes('5d');
  const has5A = intervals.includes('5A');
  const has7m = intervals.includes('7m');
  const has7M = intervals.includes('7M');
  const has7d = intervals.includes('7d');

  // Determine base triad case (uppercase = major-ish)
  let uppercase = true;
  if (has3m) uppercase = false;
  if (!has3M && !has3m) uppercase = true; // power chord or suspended → uppercase by convention

  // Augmented: uppercase + "+"
  if (has3M && has5A && !has7m && !has7M && !has7d) {
    return { uppercase: true, suffix: '+' };
  }

  // Seventh quality overrides
  if (has7d) {
    // Fully diminished seventh (dim7 or °7)
    return { uppercase: false, suffix: '°7' };
  }
  if (has7m && has3m && has5d) {
    // Half-diminished seventh (ø7)
    return { uppercase: false, suffix: 'ø7' };
  }
  if (has7M && has3m) {
    // Minor–major seventh (mΔ7) – e.g. Cm(maj7)
    return { uppercase: false, suffix: 'mM7' };
  }
  if (has7M && has3M) {
    // Major seventh
    return { uppercase: true, suffix: 'maj7' };
  }
  if (has7M && !has3M && !has3m) {
    // Suspended major seventh variant – uppercase
    return { uppercase: true, suffix: 'maj7' };
  }
  if (has7m && has3M) {
    // Dominant seventh
    return { uppercase: true, suffix: '7' };
  }
  if (has7m && has3m && !has5d) {
    // Minor seventh
    return { uppercase: false, suffix: '7' };
  }
  if (has7m && !has3M && !has3m) {
    // Minor seventh no-3rd (e.g. sus4 + 7)
    return { uppercase: true, suffix: '7' };
  }

  // Triadic quality
  if (has3m && has5d) {
    // Diminished triad (no 7th)
    return { uppercase: false, suffix: '°' };
  }

  return { uppercase, suffix: '' };
}

// ---------------------------------------------------------------------------
// Helper: build a Roman numeral string
// ---------------------------------------------------------------------------

function buildRoman(
  degree: number,
  prefix: '' | 'b' | '#',
  uppercase: boolean,
  suffix: string
): string {
  const numerals = uppercase ? ROMAN_UPPER : ROMAN_LOWER;
  const roman = numerals[degree - 1]; // degree is 1-indexed
  return `${prefix}${roman}${suffix}`;
}

// ---------------------------------------------------------------------------
// Helper: get scale degree info for a chromatic offset in a given mode
// Returns the degree + prefix, with harmonic-minor special-case.
// ---------------------------------------------------------------------------

function getScaleDegree(
  semitones: number,
  mode: 'major' | 'minor',
  isLeadingTone: boolean
): { degree: number; prefix: '' | 'b' | '#' } {
  const map = mode === 'major' ? MAJOR_CHROMATIC : MINOR_CHROMATIC;
  const { degree, prefix } = map[((semitones % 12) + 12) % 12];

  // Harmonic-minor override: semitone 11 in minor mode, when the chord is a
  // diminished/leading-tone chord, treat as plain VII (no '#' prefix).
  if (mode === 'minor' && semitones === 11 && isLeadingTone) {
    return { degree: 7, prefix: '' };
  }

  return { degree, prefix };
}

// ---------------------------------------------------------------------------
// Helper: get the default-case Roman numeral for a degree in a mode
// (used for the target in "V/x" notation)
// ---------------------------------------------------------------------------

function targetRoman(degree: number, prefix: '' | 'b' | '#', mode: 'major' | 'minor'): string {
  const isMinorQuality =
    mode === 'major' ? MAJOR_DEGREE_IS_MINOR[degree] : MINOR_DEGREE_IS_MINOR[degree];
  const numerals = isMinorQuality ? ROMAN_LOWER : ROMAN_UPPER;
  return `${prefix}${numerals[degree - 1]}`;
}

// ---------------------------------------------------------------------------
// Helper: compute semitones between two pitch class chromas (0–11)
// Result is always in range 0..11.
// ---------------------------------------------------------------------------

function semitonesFrom(keychroma: number, noteChroma: number): number {
  return ((noteChroma - keychroma) % 12 + 12) % 12;
}

// ---------------------------------------------------------------------------
// Main export: getFunctionalAnalyses
// ---------------------------------------------------------------------------

/**
 * Given a detected chord and a key (tonic + mode), returns one or more
 * functional harmony analyses ranked by confidence (highest first).
 *
 * Returns [] if the chord or key tonic is invalid.
 *
 * @param chord     A Chord object from @tonaljs/chord (tonic, quality, intervals, root, rootDegree)
 * @param keyTonic  Key tonic note name, e.g. "C", "Bb", "F#"
 * @param mode      "major" | "minor"
 */
export function getFunctionalAnalyses(
  chord: Chord | null | undefined,
  keyTonic: string,
  mode: 'major' | 'minor'
): FunctionalAnalysis[] {
  if (!chord || !chord.tonic || !keyTonic) return [];

  const keyChroma = Note.chroma(keyTonic);
  const rootChroma = Note.chroma(chord.tonic);
  if (keyChroma === undefined || rootChroma === undefined) return [];

  const semitones = semitonesFrom(keyChroma, rootChroma);
  const qualityInfo = getChordQualityInfo(chord);
  const { uppercase, suffix } = qualityInfo;

  const isDominantType = uppercase && (suffix === '7' || suffix === '');
  const isLeadingToneType = !uppercase && (suffix === '°' || suffix === '°7' || suffix === 'ø7');
  const isDiminished = !uppercase && (suffix === '°' || suffix === '°7');

  // -----------------------------------------------------------------------
  // 1. Primary diatonic / chromatic analysis
  // -----------------------------------------------------------------------

  const { degree, prefix } = getScaleDegree(semitones, mode, isLeadingToneType);
  const primarySymbol = buildRoman(degree, prefix, uppercase, suffix);

  // Compute confidence for diatonic membership
  const isDiatonic =
    mode === 'major'
      ? [0, 2, 4, 5, 7, 9, 11].includes(semitones)
      : [0, 2, 3, 5, 7, 8, 10, 11].includes(semitones); // minor includes harmonic leading tone

  // Check if quality matches expected diatonic quality
  let diatonicQualityMatch = false;
  if (isDiatonic) {
    const degreeIsMinor =
      mode === 'major' ? MAJOR_DEGREE_IS_MINOR[degree] : MINOR_DEGREE_IS_MINOR[degree];
    diatonicQualityMatch = uppercase !== degreeIsMinor;
  }

  const primaryConfidence = isDiatonic
    ? diatonicQualityMatch
      ? 0.9
      : 0.65 // diatonic degree, wrong quality (e.g. V in minor when v expected)
    : 0.45; // chromatic degree

  const analyses: FunctionalAnalysis[] = [
    {
      symbol: primarySymbol,
      confidence: primaryConfidence,
      label: `${prefix}${ROMAN_UPPER[degree - 1]} (${mode})`,
    },
  ];

  // -----------------------------------------------------------------------
  // 2. Neapolitan detection (bII major in minor contexts)
  // -----------------------------------------------------------------------

  if (semitones === 1 && uppercase && (suffix === '' || suffix === '7')) {
    // bII major triad (or bII7) – Neapolitan candidate
    const isMinorContext = mode === 'minor';
    const conf = isMinorContext ? 0.82 : 0.5; // stronger in minor

    // If chord has an inversion (rootDegree 2 → first inversion → "6" label)
    const isFirstInversion = chord.rootDegree === 2;
    const neapolitanSymbol = isFirstInversion ? 'N6' : 'N';
    const neapolitanLabel = isFirstInversion
      ? 'Neapolitan sixth chord'
      : 'Neapolitan (root position)';

    analyses.push({
      symbol: neapolitanSymbol,
      confidence: conf,
      label: neapolitanLabel,
    });

    // Also push bII label as an alternate (with lower confidence)
    const bIISymbol = buildRoman(2, 'b', uppercase, suffix);
    if (bIISymbol !== primarySymbol) {
      analyses.push({
        symbol: bIISymbol,
        confidence: conf - 0.1,
        label: 'bII (flat supertonic)',
      });
    }
  }

  // -----------------------------------------------------------------------
  // 3. Applied (secondary) dominant: V/x or V7/x
  // -----------------------------------------------------------------------

  if (isDominantType) {
    // target = chord root + P4 (5 semitones), i.e. the tonic the dominant resolves to
    const targetChroma = (rootChroma + 5) % 12;
    const targetSemitones = semitonesFrom(keyChroma, targetChroma);

    // Is the target a diatonic degree?
    const targetDiatonic =
      mode === 'major'
        ? [0, 2, 4, 5, 7, 9, 11].includes(targetSemitones)
        : [0, 2, 3, 5, 7, 8, 10, 11].includes(targetSemitones);

    if (targetDiatonic && targetSemitones !== 0) {
      // Don't emit V/I (that's just V)
      const { degree: tDeg, prefix: tPfx } = getScaleDegree(targetSemitones, mode, false);
      const tRoman = targetRoman(tDeg, tPfx, mode);
      const appliedSymbol = suffix ? `V${suffix}/${tRoman}` : `V/${tRoman}`;

      // Confidence: higher for primary tonal centres (V, iv/IV, etc.)
      const primaryTargets =
        mode === 'major'
          ? [7, 5, 9, 4] // V, IV, vi, iii semitones
          : [7, 5, 8, 3]; // V, iv, VI, III semitones
      const appliedConf = primaryTargets.includes(targetSemitones) ? 0.8 : 0.65;

      analyses.push({
        symbol: appliedSymbol,
        confidence: appliedConf,
        label: `Applied dominant of ${tRoman}`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // 4. Applied leading-tone: vii°/x or vii°7/x or viiø7/x
  // -----------------------------------------------------------------------

  if (isLeadingToneType) {
    // target = chord root + m2 (1 semitone), i.e. the tonic the leading tone resolves to
    const targetChroma = (rootChroma + 1) % 12;
    const targetSemitones = semitonesFrom(keyChroma, targetChroma);

    const targetDiatonic =
      mode === 'major'
        ? [0, 2, 4, 5, 7, 9, 11].includes(targetSemitones)
        : [0, 2, 3, 5, 7, 8, 10, 11].includes(targetSemitones);

    if (targetDiatonic && targetSemitones !== 0) {
      const { degree: tDeg, prefix: tPfx } = getScaleDegree(targetSemitones, mode, false);
      const tRoman = targetRoman(tDeg, tPfx, mode);
      const ltSuffix = suffix === '°7' ? '°7' : suffix === 'ø7' ? 'ø7' : '°';
      const appliedSymbol = `vii${ltSuffix}/${tRoman}`;

      const primaryTargets =
        mode === 'major' ? [7, 5, 9, 4] : [7, 5, 8, 3];
      const appliedConf = primaryTargets.includes(targetSemitones) ? 0.78 : 0.60;

      analyses.push({
        symbol: appliedSymbol,
        confidence: appliedConf,
        label: `Applied leading-tone chord of ${tRoman}`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // 5. Sort by confidence descending and deduplicate
  // -----------------------------------------------------------------------

  const unique = analyses.filter(
    (a, i) => analyses.findIndex((b) => b.symbol === a.symbol) === i
  );

  return unique.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Convenience: return just the top (highest-confidence) functional symbol for a chord.
 * Returns "—" if analysis is empty or key is not set.
 */
export function getPrimaryFunctionalSymbol(
  chord: Chord | null | undefined,
  keyTonic: string | null | undefined,
  mode: 'major' | 'minor'
): string {
  if (!keyTonic) return '—';
  const analyses = getFunctionalAnalyses(chord, keyTonic, mode);
  return analyses.length > 0 ? analyses[0].symbol : '—';
}
