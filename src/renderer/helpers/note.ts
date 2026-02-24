/* eslint-disable no-bitwise */
import { Key, Note, Range } from "tonal";

export type KeySignatureConfig = {
  alteration: number;
  tonic: string;
  mode: "major" | "minor";
  notes: string[];
  scale: string[];
};

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const REGEX_FLAT = /b/g;
const REGEX_SHARP = /#/g;

const FLAT = "♭";
const SHARP = "♯";

const getKeySignatureNotes = (scale: string[], useSharps = false) => {
  const scaleChromas = scale.map(Note.chroma);
  const range = Range.chromatic(["C4", "B4"], {
    sharps: useSharps,
    pitchClass: true,
  }).map((note, chroma) => {
    const noteInScale = scaleChromas.indexOf(chroma);
    return noteInScale > -1 ? scale[noteInScale] : note;
  });

  return range;
};

const rotateScaleToTonic = (scale: string[], tonic: string) => {
  const tonicChroma = Note.chroma(tonic);
  if (tonicChroma === undefined) return scale;

  const index = scale.findIndex((n) => Note.chroma(n) === tonicChroma);
  if (index < 0) return scale;

  return [...scale.slice(index), ...scale.slice(0, index)];
};

export const getKeySignature = (
  note: string,
  useSharps = false,
  mode: "major" | "minor" = "major",
): KeySignatureConfig => {
  const tonic = Note.chroma(note) !== undefined ? note : "C";
  const keyNote = mode === "minor" ? Note.transpose(tonic, "m3") : tonic;

  let majorKey = Key.majorKey(keyNote);
  if (!majorKey.tonic) {
    majorKey = Key.majorKey("C");
  }

  if (majorKey.alteration > 7) {
    majorKey = Key.majorKey(
      Note.transposeFifths(
        majorKey.tonic,
        ~~((majorKey.alteration + 12) / 12) * -12,
      ),
    );
  }
  if (majorKey.alteration < -7) {
    majorKey = Key.majorKey(
      Note.transposeFifths(
        majorKey.tonic,
        ~~((majorKey.alteration - 12) / 12) * -12,
      ),
    );
  }

  const sharps =
    majorKey.alteration === 0 ? useSharps : majorKey.alteration > 0;
  const scale =
    mode === "minor"
      ? rotateScaleToTonic([...majorKey.scale], tonic)
      : [...majorKey.scale];
  const notes = getKeySignatureNotes(scale, sharps);

  return {
    alteration: majorKey.alteration,
    tonic,
    mode,
    notes,
    scale,
  };
};

export const getNoteInKeySignature = (
  note: string,
  keySignatureNotes?: string[],
) => {
  const chroma = Note.chroma(note);

  if (chroma !== undefined && keySignatureNotes && keySignatureNotes[chroma]) {
    return Note.enharmonic(note, keySignatureNotes[chroma]);
  }

  return note;
};

export const formatSharpsFlats = (str: string) =>
  str ? str.replace(REGEX_FLAT, FLAT).replace(REGEX_SHARP, SHARP) : str;
