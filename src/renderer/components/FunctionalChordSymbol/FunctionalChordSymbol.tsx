import React, { useState, useCallback } from 'react';
import classnames from 'classnames/bind';

import { Chord } from '@tonaljs/chord';
import { getFunctionalAnalyses, FunctionalAnalysis } from 'renderer/helpers/functionalChords';
import { formatSharpsFlats } from 'renderer/helpers/note';

import styles from './FunctionalChordSymbol.module.scss';

const cx = classnames.bind(styles);

type Props = {
  chord?: Chord | null;
  keyTonic?: string | null;
  keyMode: 'major' | 'minor';
  className?: string;
  /** If true, show the key label before the symbol, e.g. "Am: iv" */
  showKey?: boolean;
};

/**
 * Renders a Roman-numeral functional harmony symbol for a chord in a given key.
 * Shows the top-ranked analysis by default; clicking/tapping expands to show
 * alternate interpretations (if any).
 */
export const FunctionalChordSymbol: React.FC<Props> = ({
  chord,
  keyTonic,
  keyMode,
  className,
  showKey = false,
}) => {
  const [showAlts, setShowAlts] = useState(false);

  const handleToggle = useCallback(() => {
    setShowAlts((v) => !v);
  }, []);

  if (!keyTonic) {
    return null;
  }

  const analyses: FunctionalAnalysis[] = chord
    ? getFunctionalAnalyses(chord, keyTonic, keyMode)
    : [];

  const primary = analyses[0];
  const alternates = analyses.slice(1);

  const displaySymbol = primary ? primary.symbol : '—';
  const hasAlternates = alternates.length > 0;
  const keyLabel = `${formatSharpsFlats(keyTonic)} ${keyMode === 'major' ? 'maj' : 'min'}`;

  return (
    <div className={cx('base', className, { 'base--hasAlts': hasAlternates })}>
      {showKey && (
        <span className={cx('keyLabel')}>{keyLabel}:</span>
      )}
      {/* Primary functional symbol */}
      <button
        type="button"
        className={cx('symbol', { 'symbol--placeholder': !primary })}
        onClick={hasAlternates ? handleToggle : undefined}
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
  className: undefined,
  showKey: false,
};

export default FunctionalChordSymbol;
