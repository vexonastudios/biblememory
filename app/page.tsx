'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import VerseSearch from '@/components/VerseSearch';
import { parseVerseIntoPhrases, Phrase } from '@/lib/phraseParser';
import { useSessionStore } from '@/lib/store/sessionStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useLibraryStore } from '@/lib/store/libraryStore';
import Link from 'next/link';

interface FetchedVerse {
  reference: string;
  text: string;
  translation: string;
  phrases: Phrase[];
}

export default function HomePage() {
  const router = useRouter();
  const { setVerse } = useSessionStore();
  const { translation: defaultTranslation, setTranslation, theme, setTheme } = useSettingsStore();
  const dueCount = useLibraryStore((s) => s.dueCount());

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
  };

  const [translation, setLocalTranslation] = useState<'BSB' | 'KJV'>(defaultTranslation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState<FetchedVerse | null>(null);
  const [editedPhrases, setEditedPhrases] = useState<Phrase[]>([]);

  const handleTranslationChange = (t: 'BSB' | 'KJV') => {
    setLocalTranslation(t);
    setTranslation(t);
  };

  const handleFetch = async (ref: string, trans: 'BSB' | 'KJV') => {
    setLoading(true);
    setError('');
    setFetched(null);

    try {
      const res = await fetch(`/api/bible?ref=${encodeURIComponent(ref)}&translation=${trans}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch verse');
      }
      const data = await res.json();
      const phrases = parseVerseIntoPhrases(data.text);
      const v: FetchedVerse = {
        reference: data.reference,
        text: data.text,
        translation: data.translation,
        phrases,
      };
      setFetched(v);
      setEditedPhrases(phrases);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = () => {
    if (!fetched) return;
    setVerse(fetched.reference, fetched.text, editedPhrases, fetched.translation);
    router.push('/session');
  };

  const handlePhraseEdit = (id: number, newText: string) => {
    setEditedPhrases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, text: newText } : p))
    );
  };

  const handleSplitPhrase = (id: number) => {
    setEditedPhrases((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const phrase = prev[idx];
      const words = phrase.text.split(' ');
      if (words.length < 4) return prev;
      const mid = Math.floor(words.length / 2);
      const left = words.slice(0, mid).join(' ');
      const right = words.slice(mid).join(' ');
      const next = [
        ...prev.slice(0, idx),
        { id: phrase.id, text: left },
        { id: phrase.id + 0.5, text: right },
        ...prev.slice(idx + 1),
      ].map((p, i) => ({ ...p, id: i + 1 }));
      return next;
    });
  };

  const handleMergePhrase = (id: number) => {
    setEditedPhrases((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx >= prev.length - 1) return prev;
      const merged = { id: prev[idx].id, text: prev[idx].text + ', ' + prev[idx + 1].text };
      return [...prev.slice(0, idx), merged, ...prev.slice(idx + 2)].map((p, i) => ({ ...p, id: i + 1 }));
    });
  };

  const handleDeletePhrase = (id: number) => {
    setEditedPhrases((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, id: i + 1 })));
  };

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <div className="logo-wrap">
          <img src="/logo.png" alt="Inscribed Logo" className="logo-icon-img" />
          <div>
            <h1 className="logo-title">Inscribed</h1>
            <p className="logo-sub">Write God's Word on the tablet of your heart</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dueCount > 0 && (
            <Link href="/library" id="due-badge-link" className="due-badge">
              📚 {dueCount} due
            </Link>
          )}
          <Link href="/library" id="library-link" className="settings-link">
            Library
          </Link>
          <button
            onClick={toggleTheme}
            className="settings-link theme-toggle-btn"
            style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={`Theme: ${theme}. Click to change.`}
            aria-label="Toggle Theme"
          >
            {theme === 'light' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            )}
            {theme === 'dark' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
            {theme === 'system' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            )}
          </button>
          <Link href="/settings" id="settings-link" className="settings-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </Link>
        </div>
      </header>

      <main className="home-main">
        {/* How it works */}
        <div className="how-it-works">
          <div className="how-step">
            <span className="how-num">1</span>
            <span className="how-txt">Choose a verse</span>
          </div>
          <div className="how-arrow">→</div>
          <div className="how-step">
            <span className="how-num">2</span>
            <span className="how-txt">Listen & repeat</span>
          </div>
          <div className="how-arrow">→</div>
          <div className="how-step">
            <span className="how-num">3</span>
            <span className="how-txt">Build phrase by phrase</span>
          </div>
          <div className="how-arrow">→</div>
          <div className="how-step">
            <span className="how-num">4</span>
            <span className="how-txt">Write it on your heart</span>
          </div>
        </div>

        {/* Search */}
        <VerseSearch
          onFetch={handleFetch}
          loading={loading}
          error={error}
          translation={translation}
          onTranslationChange={handleTranslationChange}
        />

        {/* Result */}
        {fetched && (
          <div className="verse-result">
            <div className="verse-ref-tag">
              <span className="ref-text">{fetched.reference}</span>
              <span className="trans-badge">{fetched.translation}</span>
            </div>

            <blockquote className="verse-full-text">
              {fetched.text}
            </blockquote>

            <div className="phrase-editor">
              <h3 className="editor-title">
                Phrases <span className="editor-count">({editedPhrases.length})</span>
              </h3>
              <p className="editor-hint">
                Auto-split based on punctuation. Edit, split, merge, or delete to your liking.
              </p>
              <div className="phrase-list">
                {editedPhrases.map((phrase) => (
                  <div key={phrase.id} className="phrase-item">
                    <span className="phrase-num">{phrase.id}</span>
                    <input
                      id={`phrase-${phrase.id}`}
                      className="phrase-input"
                      value={phrase.text}
                      onChange={(e) => handlePhraseEdit(phrase.id, e.target.value)}
                    />
                    <div className="phrase-actions">
                      <button
                        id={`split-${phrase.id}`}
                        className="phrase-action-btn"
                        onClick={() => handleSplitPhrase(phrase.id)}
                        title="Split phrase in half"
                      >✂</button>
                      {phrase.id < editedPhrases.length && (
                        <button
                          id={`merge-${phrase.id}`}
                          className="phrase-action-btn"
                          onClick={() => handleMergePhrase(phrase.id)}
                          title="Merge with next phrase"
                        >⊕</button>
                      )}
                      {editedPhrases.length > 1 && (
                        <button
                          id={`del-${phrase.id}`}
                          className="phrase-action-btn danger"
                          onClick={() => handleDeletePhrase(phrase.id)}
                          title="Delete phrase"
                        >✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              id="start-session-btn"
              className="start-btn"
              onClick={handleStartSession}
              disabled={editedPhrases.length === 0}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start Memory Session
            </button>
          </div>
        )}

        {/* Review / Recite Mode banner */}
        <Link href="/review" id="review-mode-link" className="review-mode-banner">
          <span className="review-mode-icon">🎙</span>
          <div className="review-mode-text">
            <h3>Recite Mode</h3>
            <p>Already know a verse? Speak it aloud — get instant word-by-word feedback with error beeps</p>
          </div>
          <span className="review-mode-arrow">›</span>
        </Link>
      </main>
    </div>
  );
}
