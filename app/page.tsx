'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import VerseSearch from '@/components/VerseSearch';
import { parseVerseIntoPhrases, Phrase } from '@/lib/phraseParser';
import { useSessionStore } from '@/lib/store/sessionStore';
import { useSettingsStore, PRESET_VOICES } from '@/lib/store/settingsStore';
import { useLibraryStore } from '@/lib/store/libraryStore';
import Link from 'next/link';

interface FetchedVerse {
  reference: string;
  text: string;
  translation: string;
  phrases: Phrase[];
  verseCount?: number;
}

export default function HomePage() {
  const router = useRouter();
  const { setVerse } = useSessionStore();
  const {
    translation: defaultTranslation, setTranslation,
    theme, setTheme,
    voiceId, setVoiceId,
    hasSelectedVoice, setHasSelectedVoice
  } = useSettingsStore();
  const addVerse = useLibraryStore((s) => s.addVerse);
  const dueCount = useLibraryStore((s) => s.dueCount());

  // Voice selection states for first-time modal
  // Initialize directly from voiceId — the store always has a default (Finley),
  // so the Confirm button is never stuck in a disabled state.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [selectedModalVoice, setSelectedModalVoice] = useState<string>(
    voiceId || PRESET_VOICES[0].voice_id
  );

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  const handlePlayPreview = async (vId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioElement) {
      audioElement.pause();
      setPlayingId(null);
    }
    if (playingId === vId) {
      setPlayingId(null);
      return;
    }
    setPreviewLoadingId(vId);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "I have hidden Your word in my heart that I might not sin against You.",
          voiceId: vId,
          speed: 0.85
        })
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setAudioElement(audio);
      setPlayingId(vId);
      setPreviewLoadingId(null);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingId(null);
      };
      audio.play().catch(() => setPlayingId(null));
    } catch {
      setPreviewLoadingId(null);
    }
  };

  const handleSaveModalVoice = () => {
    setVoiceId(selectedModalVoice);
    setHasSelectedVoice(true);
    if (audioElement) {
      audioElement.pause();
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
  };

  const [translation, setLocalTranslation] = useState<'BSB' | 'KJV'>(defaultTranslation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState<FetchedVerse | null>(null);
  const [editedPhrases, setEditedPhrases] = useState<Phrase[]>([]);
  const phraseEditorRef = useRef<HTMLDivElement>(null);

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
        verseCount: data.verseCount,
      };
      setFetched(v);
      setEditedPhrases(phrases);
      // Scroll to phrase editor after a short delay so the DOM has rendered
      setTimeout(() => {
        phraseEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = () => {
    if (!fetched) return;
    // Claim this passage immediately — adds to library and recite mode
    // (store skips if already present, so no duplicate risk)
    addVerse(fetched.reference, fetched.text, fetched.translation as 'BSB' | 'KJV');
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
        {/* How it works — only shown to first-time visitors alongside the voice modal */}
        {!hasSelectedVoice && (
          <div className="how-it-works">
            <div className="how-step">
              <span className="how-num">1</span>
              <span className="how-txt">Choose a verse or passage</span>
            </div>
            <div className="how-arrow">→</div>
            <div className="how-step">
              <span className="how-num">2</span>
              <span className="how-txt">Listen &amp; repeat</span>
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
        )}

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
              {fetched.verseCount && fetched.verseCount > 1 && (
                <span className="verse-count-badge">{fetched.verseCount} verses</span>
              )}
            </div>

            <div className="phrase-editor" ref={phraseEditorRef}>
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

      {/* First-Time Voice Selection Modal */}
      {!hasSelectedVoice && (
        <div className="voice-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(9, 13, 26, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="voice-modal-box" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glow)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px',
            maxWidth: '540px',
            width: '100%',
            boxShadow: 'var(--shadow-gold)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <img src="/logo.png" alt="Inscribed Logo" style={{ height: '54px', width: 'auto' }} />
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Welcome to Inscribed
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                To write Scripture on the tablet of your heart, choose the voice you'd like to listen to. Listen to each preview below and select your favorite.
              </p>
            </div>

            <div style={{
              background: 'rgba(var(--gold-rgb), 0.04)',
              border: '1px dashed var(--border-glow)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview Passage:</span>
              <p style={{ fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--gold)', marginTop: '4px', fontWeight: 500 }}>
                "I have hidden Your word in my heart that I might not sin against You." <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(Psalm 119:11)</span>
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PRESET_VOICES.map((v) => (
                <div
                  key={v.voice_id}
                  onClick={() => setSelectedModalVoice(v.voice_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid ' + (selectedModalVoice === v.voice_id ? 'var(--gold)' : 'var(--border)'),
                    background: selectedModalVoice === v.voice_id ? 'var(--gold-dim)' : 'rgba(255, 255, 255, 0.01)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedModalVoice === v.voice_id ? 'var(--shadow-glow)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: '2px solid ' + (selectedModalVoice === v.voice_id ? 'var(--gold)' : 'var(--text-muted)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {selectedModalVoice === v.voice_id && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }}></div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{v.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{[v.gender, v.accent, v.age].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handlePlayPreview(v.voice_id, e)}
                    className="preview-play-btn"
                    title="Listen to preview"
                    aria-label={`Listen to preview of ${v.name}`}
                    style={{
                      padding: '8px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: playingId === v.voice_id ? 'var(--gold)' : 'rgba(var(--gold-rgb), 0.08)',
                      color: playingId === v.voice_id ? '#fff' : 'var(--gold)',
                      border: 'none',
                      cursor: 'pointer',
                      width: '32px',
                      height: '32px',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {previewLoadingId === v.voice_id ? (
                      <span className="spinner-small" style={{ width: '14px', height: '14px' }}></span>
                    ) : playingId === v.voice_id ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveModalVoice}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--gold)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 4px 12px rgba(var(--gold-rgb), 0.3)',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
            >
              Confirm and Get Started
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
