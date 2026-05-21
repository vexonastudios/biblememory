'use client';

import { useState } from 'react';

interface Props {
  onFetch: (reference: string, translation: 'BSB' | 'KJV') => Promise<void>;
  loading: boolean;
  error: string;
  translation: 'BSB' | 'KJV';
  onTranslationChange: (t: 'BSB' | 'KJV') => void;
}

const QUICK_REFS = [
  'John 3:16',
  'Philippians 4:13',
  'Romans 8:28',
  'Jeremiah 29:11',
  'Psalm 23:1',
  'Isaiah 40:31',
  'Proverbs 3:5',
  'Ephesians 2:8',
];

export default function VerseSearch({ onFetch, loading, error, translation, onTranslationChange }: Props) {
  const [ref, setRef] = useState('');

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
      <h2 className="search-title">Find Your Verse</h2>
      <p className="search-subtitle">Type a reference like <em>John 3:16</em> or <em>Psalm 23:1</em></p>

      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-row">
          <input
            id="verse-ref-input"
            className="search-input"
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="e.g. Romans 8:28"
            autoComplete="off"
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
        {QUICK_REFS.map((r) => (
          <button
            key={r}
            id={`quick-${r.replace(/\s+/g, '-').replace(':', '-')}`}
            className="quick-chip"
            onClick={() => handleQuick(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
