import { Note, Interval, Chord } from "tonal";
import { KeySignatureConfig } from "./note";

export interface FunctionalAnalysis {
  symbol: string;
  confidence: number;
  details: {
    isDiatonic: boolean;
    isApplied: boolean;
    isNeapolitan: boolean;
    isBorrowed: boolean;
    inversion?: string;
  };
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

const getRomanNumeral = (degree: number, isMinor: boolean): string => {
  if (degree < 1 || degree > 7) return "";
  const numeral = ROMAN_NUMERALS[degree - 1];
  return isMinor ? numeral.toLowerCase() : numeral;
};

const getDiatonicFunction = (
  chord: any,
  keySignature: KeySignatureConfig,
): FunctionalAnalysis | null => {
  if (!chord || !chord.tonic) return null;

  const { tonic: chordTonic } = chord;
  const { tonic: keyTonic, mode } = keySignature;
  const tonicChroma = Note.chroma(chordTonic);
  const keyTonicChroma = Note.chroma(keyTonic);

  if (tonicChroma === undefined || keyTonicChroma === undefined) return null;

  const degree = ((tonicChroma - keyTonicChroma + 12) % 12) + 1;

  let symbol: string;
  let isMinorDegree = false;

  if (mode === "major") {
    isMinorDegree = [2, 3, 6].includes(degree);
    symbol = getRomanNumeral(degree, isMinorDegree);
    if (degree === 7) symbol += "°";
  } else {
    isMinorDegree = [1, 2, 4, 5].includes(degree);
    symbol = getRomanNumeral(degree, isMinorDegree);
    if (degree === 2) symbol += "°";
  }

  return {
    symbol,
    confidence: 1.0,
    details: {
      isDiatonic: true,
      isApplied: false,
      isNeapolitan: false,
      isBorrowed: false,
    },
  };
};

type ChordObject = {
  name: string;
  tonic: string;
  type: string;
  notes: string[];
  intervals: string[];
  quality: string;
  empty: boolean;
};

export function analyzeFunctionalHarmony(
  keySignature: KeySignatureConfig,
  chord: ChordObject | null,
  pitchClasses?: string[],
): FunctionalAnalysis[] {
  if (!chord || chord.empty || !chord.tonic) {
    return [];
  }

  const analyses: FunctionalAnalysis[] = [];

  const diatonic = getDiatonicFunction(chord, keySignature);
  if (diatonic) {
    analyses.push(diatonic);
  }

  return analyses.sort((a, b) => b.confidence - a.confidence);
}
