'use client';

import { useState } from 'react';
import BookAutocompleteInput from './BookAutocompleteInput';

interface Props {
  onFetch: (reference: string, translation: 'BSB' | 'KJV') => Promise<void>;
  loading: boolean;
  error: string;
  translation: 'BSB' | 'KJV';
  onTranslationChange: (t: 'BSB' | 'KJV') => void;
}

const QUICK_REFS = [
  { label: 'Psalm 23',         ref: 'Psalm 23' },
  { label: 'Psalm 119:9–16',   ref: 'Psalm 119:9-16' },
  { label: 'Romans 8:28–39',   ref: 'Romans 8:28-39' },
  { label: 'John 3:16–21',     ref: 'John 3:16-21' },
  { label: '1 Cor 13',         ref: '1 Corinthians 13' },
  { label: 'Eph 6:10–18',      ref: 'Ephesians 6:10-18' },
  { label: 'Phil 4:4–13',      ref: 'Philippians 4:4-13' },
  { label: 'Isaiah 40:28–31',  ref: 'Isaiah 40:28-31' },
];

const FORMAT_EXAMPLES = [
  { format: 'John 3:16',       hint: 'Single verse' },
  { format: 'Romans 8:28–39', hint: 'Verse range' },
  { format: 'Psalm 23',        hint: 'Whole chapter' },
];

export default function VerseSearch({ onFetch, loading, error, translation, onTranslationChange }: Props) {
  const [ref, setRef] = useState('');
  const [showFormats, setShowFormats] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ref.trim()) onFetch(ref.trim(), translation);
  };

  const handleQuick = (r: string) => {
    setRef(r);
    onFetch(r, translation);
  };

  return (
    <div className="verse-search">
      <h2 className="search-title">Find a Verse or Passage</h2>
      <p className="search-subtitle">
        Enter a verse, range, or whole chapter —{' '}
        <button
          className="format-hint-toggle"
          type="button"
          onClick={() => setShowFormats((v) => !v)}
        >
          see formats
        </button>
      </p>

      {showFormats && (
        <div className="format-examples">
          {FORMAT_EXAMPLES.map(({ format, hint }) => (
            <button
              key={format}
              className="format-chip"
              type="button"
              onClick={() => { setRef(format); setShowFormats(false); }}
            >
              <span className="format-chip-ref">{format}</span>
              <span className="format-chip-hint">{hint}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-row">
          <BookAutocompleteInput
            id="verse-ref-input"
            value={ref}
            onChange={setRef}
            onSubmit={() => { if (ref.trim()) onFetch(ref.trim(), translation); }}
          />
          <select
            id="translation-select"
            className="translation-select"
            value={translation}
            onChange={(e) => onTranslationChange(e.target.value as 'BSB' | 'KJV')}
          >
            <option value="BSB">BSB</option>
            <option value="KJV">KJV</option>
          </select>
          <button
            id="search-btn"
            type="submit"
            className="search-btn"
            disabled={loading || !ref.trim()}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            )}
          </button>
        </div>
      </form>

      {error && <p className="search-error">{error}</p>}

      <div className="quick-refs">
        <span className="quick-label">Quick pick:</span>
        {QUICK_REFS.map(({ label, ref: r }) => (
          <button
            key={r}
            id={`quick-${r.replace(/[\s:–\-]+/g, '-')}`}
            className="quick-chip"
            onClick={() => handleQuick(r)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
