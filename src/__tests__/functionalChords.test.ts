/**
 * Unit tests for the functional chord symbol analysis module.
 *
 * Tests cover:
 *  - Diatonic triads and sevenths in major and minor keys
 *  - Applied (secondary) dominants and leading-tone chords
 *  - Half-diminished (ø7) and diminished (°, °7) quality symbols
 *  - Neapolitan chords (N, N6, bII)
 *  - Alternate chord interpretations (multiple candidates, stable ordering)
 *  - Graceful handling of null/undefined inputs
 */

import { getChord as getChordInfo, Chord } from '@tonaljs/chord';
import { getFunctionalAnalyses, getPrimaryFunctionalSymbol } from '../renderer/helpers/functionalChords';
import { overrideDictionary } from '../renderer/helpers/chords';

// Ensure the custom chord dictionary is loaded before running tests
beforeAll(() => {
  overrideDictionary();
});

// ---------------------------------------------------------------------------
// Helper to build a minimal Chord-like object for testing
// ---------------------------------------------------------------------------

function makeChord(tonic: string, type: string, rootDegree = 0): Chord {
  const c = getChordInfo(type, tonic);
  // rootDegree: 0 = root position, 1 = first inversion (bass note = 3rd), 2 = second inversion
  return { ...c, rootDegree, symbol: tonic + type };
}

// ---------------------------------------------------------------------------
// Helpers for assertions
// ---------------------------------------------------------------------------

function topSymbol(tonic: string, type: string, keyTonic: string, mode: 'major' | 'minor'): string {
  return getPrimaryFunctionalSymbol(makeChord(tonic, type), keyTonic, mode);
}

function symbols(tonic: string, type: string, keyTonic: string, mode: 'major' | 'minor'): string[] {
  return getFunctionalAnalyses(makeChord(tonic, type), keyTonic, mode).map((a) => a.symbol);
}

// ---------------------------------------------------------------------------
// Diatonic triads in C major
// ---------------------------------------------------------------------------

describe('Diatonic triads – C major', () => {
  it('C major → I', () => {
    expect(topSymbol('C', 'maj', 'C', 'major')).toBe('I');
  });
  it('D minor → ii', () => {
    expect(topSymbol('D', 'min', 'C', 'major')).toBe('ii');
  });
  it('E minor → iii', () => {
    expect(topSymbol('E', 'min', 'C', 'major')).toBe('iii');
  });
  it('F major → IV', () => {
    expect(topSymbol('F', 'maj', 'C', 'major')).toBe('IV');
  });
  it('G major → V', () => {
    expect(topSymbol('G', 'maj', 'C', 'major')).toBe('V');
  });
  it('A minor → vi', () => {
    expect(topSymbol('A', 'min', 'C', 'major')).toBe('vi');
  });
  it('B diminished → vii°', () => {
    expect(topSymbol('B', 'dim', 'C', 'major')).toBe('vii°');
  });
});

// ---------------------------------------------------------------------------
// Diatonic sevenths in C major
// ---------------------------------------------------------------------------

describe('Diatonic sevenths – C major', () => {
  it('C major seventh → Imaj7', () => {
    expect(topSymbol('C', 'maj7', 'C', 'major')).toBe('Imaj7');
  });
  it('D minor seventh → ii7', () => {
    expect(topSymbol('D', 'min7', 'C', 'major')).toBe('ii7');
  });
  it('G dominant seventh → V7', () => {
    expect(topSymbol('G', '7', 'C', 'major')).toBe('V7');
  });
  it('A minor seventh → vi7', () => {
    expect(topSymbol('A', 'min7', 'C', 'major')).toBe('vi7');
  });
});

// ---------------------------------------------------------------------------
// Diatonic triads in A minor
// ---------------------------------------------------------------------------

describe('Diatonic triads – A minor', () => {
  it('A minor → i', () => {
    expect(topSymbol('A', 'min', 'A', 'minor')).toBe('i');
  });
  it('B diminished → ii°', () => {
    expect(topSymbol('B', 'dim', 'A', 'minor')).toBe('ii°');
  });
  it('C major → III', () => {
    expect(topSymbol('C', 'maj', 'A', 'minor')).toBe('III');
  });
  it('D minor → iv', () => {
    expect(topSymbol('D', 'min', 'A', 'minor')).toBe('iv');
  });
  it('E major → V (harmonic minor)', () => {
    expect(topSymbol('E', 'maj', 'A', 'minor')).toBe('V');
  });
  it('E minor → v (natural minor dominant)', () => {
    expect(topSymbol('E', 'min', 'A', 'minor')).toBe('v');
  });
  it('F major → VI', () => {
    expect(topSymbol('F', 'maj', 'A', 'minor')).toBe('VI');
  });
  it('G major → VII', () => {
    expect(topSymbol('G', 'maj', 'A', 'minor')).toBe('VII');
  });
});

// ---------------------------------------------------------------------------
// Diatonic sevenths in A minor
// ---------------------------------------------------------------------------

describe('Diatonic sevenths – A minor', () => {
  it('D minor seventh → iv7', () => {
    expect(topSymbol('D', 'min7', 'A', 'minor')).toBe('iv7');
  });
  it('E dominant seventh → V7 (harmonic minor)', () => {
    expect(topSymbol('E', '7', 'A', 'minor')).toBe('V7');
  });
  it('G major (no 7th) → VII', () => {
    expect(topSymbol('G', 'maj', 'A', 'minor')).toBe('VII');
  });
});

// ---------------------------------------------------------------------------
// Applied (secondary) dominants – C major
// ---------------------------------------------------------------------------

describe('Applied dominants – C major', () => {
  it('D7 → V7/V (secondary dominant of G)', () => {
    const syms = symbols('D', '7', 'C', 'major');
    expect(syms).toContain('V7/V');
    // Applied dominant should outrank plain II7
    const v7vIdx = syms.indexOf('V7/V');
    const ii7Idx = syms.indexOf('II7');
    // V7/V should appear before II7 (if II7 even appears)
    if (ii7Idx !== -1) {
      expect(v7vIdx).toBeLessThan(ii7Idx);
    }
  });

  it('A7 → V7/ii (secondary dominant of D minor)', () => {
    const syms = symbols('A', '7', 'C', 'major');
    expect(syms).toContain('V7/ii');
  });

  it('E7 → V7/vi (secondary dominant of A minor)', () => {
    const syms = symbols('E', '7', 'C', 'major');
    expect(syms).toContain('V7/vi');
  });

  it('B7 → V7/iii (secondary dominant of E minor)', () => {
    const syms = symbols('B', '7', 'C', 'major');
    expect(syms).toContain('V7/iii');
  });

  it('C7 → V7/IV (secondary dominant of F major)', () => {
    const syms = symbols('C', '7', 'C', 'major');
    expect(syms).toContain('V7/IV');
  });
});

// ---------------------------------------------------------------------------
// Applied leading-tone chords – C major
// ---------------------------------------------------------------------------

describe('Applied leading-tone – C major', () => {
  it('F# dim → vii°/V (leading tone of G)', () => {
    const syms = symbols('F#', 'dim', 'C', 'major');
    expect(syms).toContain('vii°/V');
  });

  it('C# dim → vii°/ii (leading tone of D minor)', () => {
    const syms = symbols('C#', 'dim', 'C', 'major');
    expect(syms).toContain('vii°/ii');
  });
});

// ---------------------------------------------------------------------------
// Half-diminished and diminished sevenths
// ---------------------------------------------------------------------------

describe('Half-diminished and diminished – various keys', () => {
  it('Bm7b5 (Bø7) in C major → viiø7', () => {
    // Bm7b5 = half-diminished, root B = degree 7 in C major
    const syms = symbols('B', 'm7b5', 'C', 'major');
    expect(syms[0]).toBe('viiø7');
  });

  it('G#dim7 in A minor → vii°7 (harmonic minor leading tone)', () => {
    const syms = symbols('G#', 'o7', 'A', 'minor');
    expect(syms[0]).toBe('vii°7');
  });

  it('C#dim7 in D minor → vii°7', () => {
    const syms = symbols('C#', 'o7', 'D', 'minor');
    expect(syms[0]).toBe('vii°7');
  });

  it('F#ø7 in G major → viiø7', () => {
    const syms = symbols('F#', 'm7b5', 'G', 'major');
    expect(syms[0]).toBe('viiø7');
  });
});

// ---------------------------------------------------------------------------
// Neapolitan chords
// ---------------------------------------------------------------------------

describe('Neapolitan chords', () => {
  it('Bb major in A minor → N (Neapolitan candidate)', () => {
    const syms = symbols('Bb', 'maj', 'A', 'minor');
    expect(syms).toContain('N');
  });

  it('Bb major in A minor root position → N has higher confidence than bII', () => {
    const analyses = getFunctionalAnalyses(makeChord('Bb', 'maj'), 'A', 'minor');
    const nIdx = analyses.findIndex((a) => a.symbol === 'N');
    const bIIIdx = analyses.findIndex((a) => a.symbol === 'bII');
    expect(nIdx).toBeGreaterThan(-1); // N must exist
    if (bIIIdx !== -1) {
      expect(analyses[nIdx].confidence).toBeGreaterThan(analyses[bIIIdx].confidence);
    }
  });

  it('Bb major first inversion in A minor → N6', () => {
    const chord = makeChord('Bb', 'maj', 2); // rootDegree=2 = first inversion
    const syms = getFunctionalAnalyses(chord, 'A', 'minor').map((a) => a.symbol);
    expect(syms).toContain('N6');
  });

  it('Db major in C major → N candidate (bII in C major = Neapolitan context)', () => {
    // Db is bII of C major (1 semitone above C), the Neapolitan degree
    const syms = symbols('Db', 'maj', 'C', 'major');
    // In major context, Neapolitan is less common but still labelled as N
    expect(syms).toContain('N');
    // The primary label is bII for C major context
    expect(syms).toContain('bII');
  });
});

// ---------------------------------------------------------------------------
// Chromatic / borrowed chords in C major
// ---------------------------------------------------------------------------

describe('Chromatic chords – C major', () => {
  it('Eb major → bIII', () => {
    expect(topSymbol('Eb', 'maj', 'C', 'major')).toBe('bIII');
  });

  it('Ab major → bVI', () => {
    expect(topSymbol('Ab', 'maj', 'C', 'major')).toBe('bVI');
  });

  it('Bb major → bVII', () => {
    expect(topSymbol('Bb', 'maj', 'C', 'major')).toBe('bVII');
  });

  it('Bb dominant 7 → bVII7', () => {
    expect(topSymbol('Bb', '7', 'C', 'major')).toBe('bVII7');
  });
});

// ---------------------------------------------------------------------------
// Multiple candidates and stable ordering
// ---------------------------------------------------------------------------

describe('Multiple candidates and ordering', () => {
  it('D7 in C major: V7/V confidence > primary II7', () => {
    const analyses = getFunctionalAnalyses(makeChord('D', '7'), 'C', 'major');
    const primarySymbol = analyses[0].symbol;
    // The highest-confidence symbol should be one of the functional interpretations
    expect(['V7/V', 'II7']).toContain(primarySymbol);
    // V7/V specifically should outrank bare II7
    const v7v = analyses.find((a) => a.symbol === 'V7/V');
    const ii7 = analyses.find((a) => a.symbol === 'II7');
    if (v7v && ii7) {
      expect(v7v.confidence).toBeGreaterThan(ii7.confidence);
    }
  });

  it('analyses are sorted by confidence descending', () => {
    const analyses = getFunctionalAnalyses(makeChord('D', '7'), 'C', 'major');
    for (let i = 1; i < analyses.length; i++) {
      expect(analyses[i - 1].confidence).toBeGreaterThanOrEqual(analyses[i].confidence);
    }
  });

  it('no duplicate symbols in results', () => {
    const analyses = getFunctionalAnalyses(makeChord('F#', 'dim'), 'C', 'major');
    const uniqueSymbols = new Set(analyses.map((a) => a.symbol));
    expect(uniqueSymbols.size).toBe(analyses.length);
  });
});

// ---------------------------------------------------------------------------
// Graceful null / edge cases
// ---------------------------------------------------------------------------

describe('Graceful null / edge cases', () => {
  it('null chord returns []', () => {
    expect(getFunctionalAnalyses(null, 'C', 'major')).toEqual([]);
  });

  it('undefined chord returns []', () => {
    expect(getFunctionalAnalyses(undefined, 'C', 'major')).toEqual([]);
  });

  it('empty keyTonic returns []', () => {
    expect(getFunctionalAnalyses(makeChord('C', 'maj'), '', 'major')).toEqual([]);
  });

  it('getPrimaryFunctionalSymbol with null key → "—"', () => {
    expect(getPrimaryFunctionalSymbol(makeChord('C', 'maj'), null, 'major')).toBe('—');
  });

  it('getPrimaryFunctionalSymbol with no chord → "—"', () => {
    expect(getPrimaryFunctionalSymbol(null, 'C', 'major')).toBe('—');
  });
});
