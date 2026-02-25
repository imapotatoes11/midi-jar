import React from 'react';
import classnames from 'classnames/bind';

import { useModuleSettings, useSettings } from 'renderer/contexts/Settings';
import useNotes from 'renderer/hooks/useNotes';
import { Notation, PianoKeyboard, ChordIntervals, ChordNameLink, FunctionalChordSymbol } from 'renderer/components';

import styles from './ChordDisplay.module.scss';

const cx = classnames.bind(styles);

type Props = {
  moduleId: string;
};

const ChordDisplayModule: React.FC<Props> = ({ moduleId }) => {
  const { settings } = useSettings();
  const { moduleSettings, updateModuleSetting } = useModuleSettings('chordDisplay', moduleId);

  const { key, accidentals, staffClef, staffTranspose } = settings.notation;
  const {
    midiNotes,
    pitchClasses,
    sustainedMidiNotes,
    playedMidiNotes,
    chords,
    params: { keySignature },
  } = useNotes({
    accidentals,
    key,
    midiChannel: 0,
    allowOmissions: moduleSettings.allowOmissions,
    useSustain: moduleSettings.useSustain,
    detectOnRelease: moduleSettings.detectOnRelease,
    disabledChords: settings.chordDictionary.disabled,
  });

  if (!settings || !moduleSettings) return null;

  const {
    chordNotation,
    highlightAlterations,
    displayKeyboard,
    displayChord,
    displayName,
    displayNotation,
    displayAltChords,
    displayIntervals,
    displayFunctionalChord,
    functionalKey,
    functionalMode,
    keyboard,
  } = moduleSettings;

  // Determine the effective key tonic for functional analysis.
  // Per-module functionalKey overrides the global notation.key.
  const effectiveFunctionalKey = functionalKey || key || null;

  return (
    <div id="chordDisplay" className={cx('base')}>
      <div id="container" className={cx('container')}>
        {displayNotation && (
          <Notation
            id="notation"
            className={cx('notation', { 'notation--withChord': displayChord })}
            midiNotes={midiNotes}
            keySignature={keySignature}
            staffClef={staffClef}
            staffTranspose={staffTranspose}
          />
        )}
        <div id="display" className={cx('display')}>
          {displayChord && (
            <div id="chord" className={cx('chord', { 'chord--withNotation': displayNotation })}>
              <ChordNameLink
                chord={chords[0]}
                notation={chordNotation}
                highlightAlterations={highlightAlterations}
              />
            </div>
          )}
          {displayFunctionalChord && (
            <div id="functionalChord" className={cx('functionalChord')}>
              <FunctionalChordSymbol
                chord={chords[0]}
                keyTonic={effectiveFunctionalKey}
                keyMode={functionalMode}
                onKeyChange={(k) => updateModuleSetting('functionalKey', k)}
                onModeChange={(m) => updateModuleSetting('functionalMode', m)}
                showKey
              />
            </div>
          )}
          {displayName && (
            <div id="name" className={cx('name')}>
              {chords[0] && chords[0].name}
            </div>
          )}
          {displayIntervals && (
            <div id="intervals" className={cx('intervals')}>
              <ChordIntervals
                intervals={chords[0]?.intervals}
                pitchClasses={pitchClasses}
                tonic={chords[0]?.tonic}
              />
            </div>
          )}
          {displayAltChords && (
            <div id="alternativeChords" className={cx('alternativeChords')}>
              {chords.map((chord, index) =>
                index > 0 ? (
                  <ChordNameLink
                    key={index}
                    chord={chord}
                    notation={chordNotation}
                    highlightAlterations={highlightAlterations}
                  />
                ) : null
              )}
            </div>
          )}
        </div>
      </div>
      {displayKeyboard && (
        <div className={cx('piano')}>
          <PianoKeyboard
            id="keyboard"
            className={cx('keyboard', {
              'keyboard--withNotation': displayNotation,
              'keyboard--withChord': displayChord,
            })}
            sustained={sustainedMidiNotes}
            played={playedMidiNotes}
            midi={midiNotes}
            chord={chords[0] ?? undefined}
            keySignature={keySignature}
            keyboard={keyboard}
          />
        </div>
      )}
    </div>
  );
};

export default ChordDisplayModule;
