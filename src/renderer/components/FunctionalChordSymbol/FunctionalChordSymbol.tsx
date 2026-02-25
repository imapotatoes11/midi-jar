import React, { useState, useCallback, useRef, useEffect } from 'react';
import classnames from 'classnames/bind';

import { Chord } from '@tonaljs/chord';
import { getFunctionalAnalyses, FunctionalAnalysis } from 'renderer/helpers/functionalChords';
import { formatSharpsFlats } from 'renderer/helpers/note';

import styles from './FunctionalChordSymbol.module.scss';

const cx = classnames.bind(styles);

/** Chromatic pitch classes in display order (C through B). */
const KEY_CHOICES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

type Props = {
  chord?: Chord | null;
  keyTonic?: string | null;
  keyMode: 'major' | 'minor';
  /** Called when the user picks a new key tonic from the inline picker. */
  onKeyChange?: (key: string) => void;
  /** Called when the user toggles major/minor from the inline picker. */
  onModeChange?: (mode: 'major' | 'minor') => void;
  className?: string;
  /** If true, show the key label before the symbol. When callbacks are provided
   *  the label becomes a clickable button that opens the inline key+mode picker. */
  showKey?: boolean;
};

/**
 * Renders a Roman-numeral functional harmony symbol for a chord in a given key.
 *
 * When `onKeyChange` or `onModeChange` callbacks are provided the key label
 * becomes a clickable button that opens a compact inline key+mode picker so the
 * user can switch keys without opening the settings panel.
 *
 * Clicking the Roman-numeral symbol itself toggles a list of alternate analyses.
 */
export const FunctionalChordSymbol: React.FC<Props> = ({
  chord,
  keyTonic,
  keyMode,
  onKeyChange,
  onModeChange,
  className,
  showKey = false,
}) => {
  const [showAlts, setShowAlts] = useState(false);
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggleAlts = useCallback(() => {
    setShowAlts((v) => !v);
  }, []);

  const handleKeyLabelClick = useCallback(() => {
    setShowKeyPicker((v) => !v);
    setShowAlts(false);
  }, []);

  const handleKeySelect = useCallback(
    (key: string) => {
      onKeyChange?.(key);
      setShowKeyPicker(false);
    },
    [onKeyChange]
  );

  const handleModeSelect = useCallback(
    (mode: 'major' | 'minor') => {
      onModeChange?.(mode);
    },
    [onModeChange]
  );

  // Close key picker when clicking outside the component.
  useEffect(() => {
    if (!showKeyPicker) return undefined;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowKeyPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showKeyPicker]);

  const canPickKey = !!(onKeyChange || onModeChange);

  const analyses: FunctionalAnalysis[] = chord && keyTonic
    ? getFunctionalAnalyses(chord, keyTonic, keyMode)
    : [];

  const primary = analyses[0];
  const alternates = analyses.slice(1);

  const displaySymbol = primary ? primary.symbol : '—';
  const hasAlternates = alternates.length > 0;
  const keyLabel = keyTonic
    ? `${formatSharpsFlats(keyTonic)} ${keyMode === 'major' ? 'maj' : 'min'}`
    : '—';

  return (
    <div ref={containerRef} className={cx('base', className, { 'base--hasAlts': hasAlternates })}>

      {/* Inline key + mode picker panel – appears above the key label */}
      {canPickKey && showKeyPicker && (
        <div className={cx('keyPicker')}>
          <div className={cx('keyPickerModes')}>
            <button
              type="button"
              className={cx('modeBtn', { 'modeBtn--active': keyMode === 'major' })}
              onClick={() => handleModeSelect('major')}
            >
              Major
            </button>
            <button
              type="button"
              className={cx('modeBtn', { 'modeBtn--active': keyMode === 'minor' })}
              onClick={() => handleModeSelect('minor')}
            >
              Minor
            </button>
          </div>
          <div className={cx('keyPickerGrid')}>
            {KEY_CHOICES.map((k) => (
              <button
                key={k}
                type="button"
                className={cx('keyBtn', { 'keyBtn--active': k === keyTonic })}
                onClick={() => handleKeySelect(k)}
              >
                {formatSharpsFlats(k)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Key label – clickable when callbacks are provided */}
      {showKey && (
        canPickKey ? (
          <button
            type="button"
            className={cx('keyLabel', 'keyLabel--interactive')}
            onClick={handleKeyLabelClick}
            title="Click to change key / mode"
            aria-expanded={showKeyPicker}
          >
            {keyLabel}
            <span
              className={cx('keyLabelChevron', { 'keyLabelChevron--open': showKeyPicker })}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
        ) : (
          <span className={cx('keyLabel')}>{keyLabel}</span>
        )
      )}

      {/* Primary functional symbol */}
      <button
        type="button"
        className={cx('symbol', { 'symbol--placeholder': !primary })}
        onClick={hasAlternates ? handleToggleAlts : undefined}
        title={primary?.label}
        aria-expanded={hasAlternates ? showAlts : undefined}
      >
        <span className={cx('symbolText')}>{displaySymbol}</span>
        {hasAlternates && (
          <span className={cx('toggle', { 'toggle--open': showAlts })} aria-hidden="true">
            ▾
          </span>
        )}
      </button>

      {/* Alternate analyses panel */}
      {hasAlternates && showAlts && (
        <div className={cx('alts')}>
          {alternates.map((alt) => (
            <span
              key={alt.symbol}
              className={cx('altItem')}
              title={alt.label}
            >
              {alt.symbol}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

FunctionalChordSymbol.defaultProps = {
  chord: null,
  keyTonic: null,
  onKeyChange: undefined,
  onModeChange: undefined,
  className: undefined,
  showKey: false,
};

export default FunctionalChordSymbol;
