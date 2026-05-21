'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSettingsStore } from '@/lib/store/settingsStore';
import {
  createReviewState, processTranscript, resetErrorWord,
  ReviewState, TrackedWord,
} from '@/lib/reviewTracker';
import { playErrorBeep, playWordTick, playCompletionFanfare } from '@/lib/beep';
import { startListening, stopListening } from '@/lib/speechRecognizer';

type PageState = 'setup' | 'listening' | 'error' | 'complete';

const QUICK_REFS = [
  'John 3:16', 'Psalm 23:1', 'Romans 8:28', 'Philippians 4:13',
  'Isaiah 40:31', 'Proverbs 3:5', 'Jeremiah 29:11', 'Ephesians 2:8',
];

export default function ReviewPage() {
  const { translation: defaultTranslation } = useSettingsStore();

  // ─── Setup state ────────────────────────────────────────────────────────────
  const [ref, setRef] = useState('');
  const [translation, setTranslation] = useState<'BSB' | 'KJV'>(defaultTranslation);
  const [verseText, setVerseText] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // ─── Review state ────────────────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>('setup');
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorWord, setErrorWord] = useState<string | null>(null);

  // Track how many transcript words we've already processed
  const processedCountRef = useRef(0);
  const reviewStateRef = useRef<ReviewState | null>(null);
  const pageStateRef = useRef<PageState>('setup');

  useEffect(() => { reviewStateRef.current = reviewState; }, [reviewState]);
  useEffect(() => { pageStateRef.current = pageState; }, [pageState]);

  // ─── Fetch verse ─────────────────────────────────────────────────────────────
  const fetchVerse = async (r: string, t: 'BSB' | 'KJV') => {
    setFetchLoading(true);
    setFetchError('');
    setVerseText('');
    try {
      const res = await fetch(`/api/bible?ref=${encodeURIComponent(r)}&translation=${t}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const data = await res.json();
      setVerseText(data.text);
      setRef(r);
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setFetchLoading(false);
    }
  };

  // ─── Start review session ─────────────────────────────────────────────────────
  const startReview = useCallback(() => {
    if (!verseText) return;
    const state = createReviewState(verseText);
    setReviewState(state);
    processedCountRef.current = 0;
    setLiveTranscript('');
    setErrorWord(null);
    setPageState('listening');

    startListening({
      onResult: ({ transcript }) => {
        setLiveTranscript(transcript);

        const currentState = reviewStateRef.current;
        if (!currentState || pageStateRef.current !== 'listening') return;

        const { state: newState, processedCount, events } = processTranscript(
          currentState,
          transcript,
          processedCountRef.current
        );

        processedCountRef.current = processedCount;
        setReviewState(newState);

        // Handle events
        for (const event of events) {
          if (event === 'correct') {
            playWordTick();
          } else if (event === 'error') {
            playErrorBeep();
            setErrorWord(newState.errorWord);
            setPageState('error');
            stopListening();
            break;
          } else if (event === 'complete') {
            playCompletionFanfare();
            setPageState('complete');
            stopListening();
            break;
          }
        }
      },
      onEnd: () => {
        // Speech recognition closed naturally — restart if still in listening mode
        if (pageStateRef.current === 'listening') {
          // Auto-restart listening (speech recognition times out after silence)
          setTimeout(() => {
            if (pageStateRef.current === 'listening') {
              startListening({
                onResult: () => {},
                onEnd: () => {},
                onError: () => {},
              });
            }
          }, 200);
        }
      },
      onError: () => {},
    });
  }, [verseText]);

  // ─── Resume after error ────────────────────────────────────────────────────
  const resumeAfterError = useCallback(() => {
    if (!reviewState) return;
    const fixed = resetErrorWord(reviewState);
    setReviewState(fixed);
    setErrorWord(null);
    processedCountRef.current = 0; // Reset transcript counter — new recognition session
    setLiveTranscript('');
    setPageState('listening');
    startListening({
      onResult: ({ transcript }) => {
        setLiveTranscript(transcript);
        const currentState = reviewStateRef.current;
        if (!currentState || pageStateRef.current !== 'listening') return;

        const { state: newState, processedCount, events } = processTranscript(
          currentState, transcript, processedCountRef.current
        );
        processedCountRef.current = processedCount;
        setReviewState(newState);

        for (const event of events) {
          if (event === 'correct') {
            playWordTick();
          } else if (event === 'error') {
            playErrorBeep();
            setErrorWord(newState.errorWord);
            setPageState('error');
            stopListening();
            break;
          } else if (event === 'complete') {
            playCompletionFanfare();
            setPageState('complete');
            stopListening();
            break;
          }
        }
      },
      onEnd: () => {},
      onError: () => {},
    });
  }, [reviewState]);

  const handleReset = () => {
    stopListening();
    setPageState('setup');
    setReviewState(null);
    setLiveTranscript('');
    setErrorWord(null);
  };

  // Cleanup on unmount
  useEffect(() => () => stopListening(), []);

  const isActive = pageState === 'listening' || pageState === 'error';
  const correctCount = reviewState?.correctCount ?? 0;
  const totalWords = reviewState?.words.length ?? 0;
  const progressPercent = totalWords > 0 ? (correctCount / totalWords) * 100 : 0;

  return (
    <div className="review-page">
      {/* Header */}
      <header className="review-header">
        <Link href="/" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Home
        </Link>
        <div className="review-header-center">
          <h1 className="review-title">Recite Mode</h1>
          <p className="review-subtitle">Speak word-perfect — get instant feedback</p>
        </div>
        <Link href="/settings" className="settings-link" style={{ fontSize: 13 }}>Settings</Link>
      </header>

      {/* Setup */}
      {pageState === 'setup' && (
        <div className="review-setup">
          <div className="review-card">
            <h2 className="card-heading">Choose a Verse or Passage</h2>

            <div className="search-row" style={{ marginBottom: 12 }}>
              <input
                id="review-ref-input"
                className="search-input"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. John 3:16"
                onKeyDown={(e) => e.key === 'Enter' && fetchVerse(ref, translation)}
              />
              <select
                id="review-translation-select"
                className="translation-select"
                value={translation}
                onChange={(e) => setTranslation(e.target.value as 'BSB' | 'KJV')}
              >
                <option value="BSB">BSB</option>
                <option value="KJV">KJV</option>
              </select>
              <button
                id="review-fetch-btn"
                className="search-btn"
                onClick={() => fetchVerse(ref, translation)}
                disabled={fetchLoading || !ref.trim()}
              >
                {fetchLoading
                  ? <span className="spinner" />
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                }
              </button>
            </div>

            {fetchError && <p className="search-error">{fetchError}</p>}

            <div className="quick-refs" style={{ marginBottom: 20 }}>
              <span className="quick-label">Quick:</span>
              {QUICK_REFS.map((r) => (
                <button
                  key={r}
                  className="quick-chip"
                  onClick={() => fetchVerse(r, translation)}
                >
                  {r}
                </button>
              ))}
            </div>

            {verseText && (
              <div className="review-verse-preview">
                <p className="idle-preview-text">{verseText}</p>
                <span className="idle-ref">{ref} · {translation}</span>
              </div>
            )}
          </div>

          {verseText && (
            <div className="review-how">
              <div className="how-step"><span className="how-num">1</span><span className="how-txt">Speak the verse aloud</span></div>
              <div className="how-arrow">→</div>
              <div className="how-step"><span className="how-num">2</span><span className="how-txt">Each word tracked live</span></div>
              <div className="how-arrow">→</div>
              <div className="how-step"><span className="how-num">3</span><span className="how-txt">Wrong word = beep + stop</span></div>
              <div className="how-arrow">→</div>
              <div className="how-step"><span className="how-num">4</span><span className="how-txt">Correct it to continue</span></div>
            </div>
          )}

          {verseText && (
            <button
              id="start-review-btn"
              className="start-btn"
              onClick={startReview}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
                <path d="M19 10a7 7 0 0 1-14 0H3a9 9 0 0 0 18 0h-2z"/>
                <path d="M11 20h2v3h-2z"/>
              </svg>
              Start Reciting
            </button>
          )}
        </div>
      )}

      {/* Active review */}
      {(pageState === 'listening' || pageState === 'error') && reviewState && (
        <div className="review-active">
          {/* Progress bar */}
          <div className="session-progress-bar">
            <div className="session-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          {/* Status indicator */}
          <div className={`review-status-bar ${pageState === 'error' ? 'status-error' : 'status-listening'}`}>
            {pageState === 'listening' && (
              <>
                <span className="status-dot" />
                <span>Listening — speak the verse</span>
              </>
            )}
            {pageState === 'error' && (
              <>
                <span className="error-icon">⚠</span>
                <span>
                  You said <strong>&ldquo;{errorWord}&rdquo;</strong> — say the correct word to continue
                </span>
              </>
            )}
          </div>

          {/* Word display — the whole passage with word-by-word coloring */}
          <div className="review-word-display">
            {reviewState.words.map((word: TrackedWord, i: number) => (
              <span
                key={i}
                className={`review-word review-word-${word.status}`}
              >
                {word.original}{' '}
              </span>
            ))}
          </div>

          {/* Live transcript */}
          {liveTranscript && (
            <div className="live-transcript" style={{ marginTop: 16 }}>
              <span className="transcript-label">Hearing:</span>
              <span className="transcript-text">&ldquo;{liveTranscript}&rdquo;</span>
            </div>
          )}

          {/* Stats */}
          <div className="review-stats">
            <div className="stat-pill correct-pill">✓ {correctCount} correct</div>
            <div className="stat-pill error-pill">✗ {reviewState.errorCount} errors</div>
            <div className="stat-pill neutral-pill">{totalWords - correctCount} remaining</div>
          </div>

          {/* Controls */}
          <div className="review-controls">
            {pageState === 'error' && (
              <button id="resume-btn" className="ctrl-btn retry" onClick={resumeAfterError}>
                ▶ Continue
              </button>
            )}
            <button id="review-restart-btn" className="ctrl-btn skip" onClick={handleReset}>
              ↺ Start Over
            </button>
          </div>
        </div>
      )}

      {/* Complete */}
      {pageState === 'complete' && reviewState && (
        <div className="review-complete">
          <div className="confetti-wrap">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="confetti-particle" style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1.5}s`,
                background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F97316'][i % 5],
              }} />
            ))}
          </div>
          <div className="complete-content">
            <div className="complete-icon">🎙</div>
            <h2 className="complete-title">Word Perfect!</h2>
            <div className="review-score-grid">
              <div className="score-card">
                <span className="score-num" style={{ color: 'var(--accent-green)' }}>{correctCount}</span>
                <span className="score-label">Words Correct</span>
              </div>
              <div className="score-card">
                <span className="score-num" style={{ color: reviewState.errorCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                  {reviewState.errorCount}
                </span>
                <span className="score-label">Corrections</span>
              </div>
              <div className="score-card">
                <span className="score-num" style={{ color: 'var(--gold)' }}>
                  {Math.round((correctCount / (correctCount + reviewState.errorCount || 1)) * 100)}%
                </span>
                <span className="score-label">Accuracy</span>
              </div>
            </div>
            <div className="complete-verse" style={{ marginBottom: 24 }}>
              <p>{verseText}</p>
              <cite>{ref} · {translation}</cite>
            </div>
            <div className="complete-actions">
              <button id="recite-again-btn" className="complete-btn primary" onClick={startReview}>
                Recite Again
              </button>
              <button id="review-home-btn" className="complete-btn" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '14px 28px', borderRadius: 'var(--radius-md)' }} onClick={handleReset}>
                New Verse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
