'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useLibraryStore } from '@/lib/store/libraryStore';
import { useSessionStore } from '@/lib/store/sessionStore';
import {
  createReviewState, processTranscript, resetErrorWord,
  ReviewState, TrackedWord,
} from '@/lib/reviewTracker';
import { playErrorBeep, playWordTick, playCompletionFanfare } from '@/lib/beep';
import { startListening, stopListening } from '@/lib/speechRecognizer';
import BookAutocompleteInput from '@/components/BookAutocompleteInput';
import { parseVerseIntoPhrases } from '@/lib/phraseParser';

type PageState = 'setup' | 'hint-choice' | 'listening' | 'error' | 'complete';
type HintsMode = 'on' | 'off';
type PracticeMode = 'full' | 'parts';

const QUICK_REFS = [
  'John 3:16', 'Psalm 23:1', 'Romans 8:28', 'Philippians 4:13',
  'Isaiah 40:31', 'Proverbs 3:5', 'Jeremiah 29:11', 'Ephesians 2:8',
];

function ReviewPageInner() {
  const searchParams = useSearchParams();
  const { translation: defaultTranslation } = useSettingsStore();
  const { recordReview, recordWordError, getWordErrors } = useLibraryStore();
  const { setVerse } = useSessionStore();
  const router = useRouter();

  // ─── Setup state ────────────────────────────────────────────────────────────
  const [ref, setRef] = useState('');
  const [translation, setTranslation] = useState<'BSB' | 'KJV'>(defaultTranslation);
  const [verseText, setVerseText] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fromLibrary, setFromLibrary] = useState(false);

  // ─── Review state ────────────────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>('setup');
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const [hintsMode, setHintsMode] = useState<HintsMode>('off');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('full');
  const [verseCollapsed, setVerseCollapsed] = useState(false);

  // Track how many transcript words we've already processed
  const processedCountRef = useRef(0);
  const reviewStateRef = useRef<ReviewState | null>(null);
  const pageStateRef = useRef<PageState>('setup');

  useEffect(() => { reviewStateRef.current = reviewState; }, [reviewState]);
  useEffect(() => { pageStateRef.current = pageState; }, [pageState]);

  // Auto-fetch if launched from library with ?ref=&translation= params
  // Then auto-advance to hint-choice screen (skipping the 'Choose Verse' UI)
  useEffect(() => {
    const urlRef = searchParams.get('ref');
    const urlTrans = searchParams.get('translation') as 'BSB' | 'KJV' | null;
    if (urlRef) {
      const t = urlTrans ?? defaultTranslation;
      setRef(urlRef);
      setTranslation(t);
      setFromLibrary(true);
      fetchVerseForLibrary(urlRef, t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  // Variant that also advances to hint-choice once the verse is loaded
  const fetchVerseForLibrary = async (r: string, t: 'BSB' | 'KJV') => {
    setFetchLoading(true);
    setFetchError('');
    setVerseText('');
    try {
      const res = await fetch(`/api/bible?ref=${encodeURIComponent(r)}&translation=${t}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const data = await res.json();
      setVerseText(data.text);
      setRef(r);
      setPageState('hint-choice');
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setFetchLoading(false);
    }
  };

  // ─── Shared listener options builder ────────────────────────────────────────
  // Both startReview and resumeAfterError use identical onResult/onEnd logic.
  // Extracting it here fixes the bug where the auto-restart after silence
  // would spawn a new session with empty callbacks, causing recite to freeze.
  const buildListenerOptions = useCallback(() => ({
    onResult: ({ transcript }: { transcript: string; isFinal: boolean; confidence: number }) => {
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

      for (const event of events) {
        if (event === 'correct') {
          playWordTick();
        } else if (event === 'error') {
          playErrorBeep();
          setErrorWord(newState.errorWord);
          setPageState('error');
          stopListening();
          if (newState.errorWord) {
            const normalized = newState.errorWord.toLowerCase().replace(/[^a-z0-9']/g, '').trim();
            if (normalized) recordWordError(ref, normalized);
          }
          break;
        } else if (event === 'complete') {
          const accuracy = newState.correctCount / Math.max(newState.correctCount + newState.errorCount, 1);
          recordReview(ref, accuracy);
          playCompletionFanfare();
          setPageState('complete');
          stopListening();
          break;
        }
      }
    },
    onEnd: () => {
      // Speech recognition ended naturally (browser silence timeout).
      // If we're still supposed to be listening, restart automatically.
      if (pageStateRef.current === 'listening') {
        setTimeout(() => {
          if (pageStateRef.current === 'listening') {
            // Re-use this same builder so the restarted session has full callbacks
            startListening(buildListenerOptions());
          }
        }, 300);
      }
    },
    onError: (err: string) => {
      // Ignore 'no-speech' — it's normal and the onEnd handler will restart.
      if (err === 'no-speech') return;
      // For other errors, stop gracefully so the UI doesn't get stuck
      if (pageStateRef.current === 'listening') {
        setTimeout(() => {
          if (pageStateRef.current === 'listening') {
            startListening(buildListenerOptions());
          }
        }, 500);
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ref]);

  // ─── Start review session ─────────────────────────────────────────────────────
  const startReview = useCallback(() => {
    if (!verseText) return;
    const state = createReviewState(verseText);
    setReviewState(state);
    processedCountRef.current = 0;
    setLiveTranscript('');
    setErrorWord(null);
    setPageState('listening');
    startListening(buildListenerOptions());
  }, [verseText, buildListenerOptions]);

  // ─── Resume after error ────────────────────────────────────────────────────
  const resumeAfterError = useCallback(() => {
    if (!reviewState) return;
    const fixed = resetErrorWord(reviewState);
    setReviewState(fixed);
    setErrorWord(null);
    processedCountRef.current = 0;
    setLiveTranscript('');
    setPageState('listening');
    startListening(buildListenerOptions());
  }, [reviewState, buildListenerOptions]);

  const handleReset = () => {
    stopListening();
    // If we came from library, go back to hint-choice (not the verse-search setup)
    setPageState(fromLibrary ? 'hint-choice' : 'setup');
    setReviewState(null);
    setLiveTranscript('');
    setErrorWord(null);
  };

  const handleStartWithHints = (mode: HintsMode) => {
    setHintsMode(mode);
    startReview();
  };

  const handleStartInParts = () => {
    if (!verseText) return;
    const phrases = parseVerseIntoPhrases(verseText);
    setVerse(ref, verseText, phrases, translation);
    router.push('/session');
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

      {/* Setup — only shown when not coming from library */}
      {pageState === 'setup' && (
        <div className="review-setup">
          <div className="review-card">
            <h2 className="card-heading">Choose a Verse or Passage</h2>

            <div className="search-row" style={{ marginBottom: 12 }}>
              <BookAutocompleteInput
                id="review-ref-input"
                value={ref}
                onChange={setRef}
                onSubmit={() => fetchVerse(ref, translation)}
                placeholder="e.g. John 3:16"
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
            <button
              id="start-review-btn"
              className="start-btn"
              onClick={() => setPageState('hint-choice')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
                <path d="M19 10a7 7 0 0 1-14 0H3a9 9 0 0 0 18 0h-2z"/>
                <path d="M11 20h2v3h-2z"/>
              </svg>
              Continue
            </button>
          )}
        </div>
      )}

      {/* Practice options — shown before reciting, whether from library or manual search */}
      {pageState === 'hint-choice' && (
        <div className="review-setup">
          <div className="review-card hint-choice-card">

            {/* ── Mode selection ─────────────────────────────────────────── */}
            <h2 className="card-heading" style={{ marginBottom: 6 }}>How do you want to practice?</h2>
            <p className="section-desc" style={{ marginBottom: 18 }}>
              Practice the full passage in one go, or re-learn it phrase by phrase.
            </p>
            <div className="practice-mode-btns">
              <button
                id="mode-full-btn"
                className={`practice-mode-btn ${practiceMode === 'full' ? 'practice-mode-active' : ''}`}
                onClick={() => setPracticeMode('full')}
              >
                <span className="hint-choice-icon">🎙</span>
                <span className="hint-choice-label">Practice Full</span>
                <span className="hint-choice-sub">Recite the whole passage</span>
              </button>
              <button
                id="mode-parts-btn"
                className={`practice-mode-btn ${practiceMode === 'parts' ? 'practice-mode-active' : ''}`}
                onClick={() => setPracticeMode('parts')}
              >
                <span className="hint-choice-icon">🧩</span>
                <span className="hint-choice-label">Practice in Parts</span>
                <span className="hint-choice-sub">Build phrase by phrase</span>
              </button>
            </div>

            {/* ── Hints option — only for full mode ──────────────────────── */}
            {practiceMode === 'full' && (
              <>
                <div className="hint-divider" />
                <h3 className="card-subheading" style={{ marginBottom: 6 }}>Do you want hints?</h3>
                <p className="section-desc" style={{ marginBottom: 18 }}>
                  Hints show the first letter of every third word to jog your memory.
                </p>
                <div className="hint-choice-btns">
                  <button
                    id="hints-off-btn"
                    className="hint-choice-btn hint-choice-off"
                    onClick={() => handleStartWithHints('off')}
                  >
                    <span className="hint-choice-icon">🧠</span>
                    <span className="hint-choice-label">No hints</span>
                    <span className="hint-choice-sub">Pure recall</span>
                  </button>
                  <button
                    id="hints-on-btn"
                    className="hint-choice-btn hint-choice-on"
                    onClick={() => handleStartWithHints('on')}
                  >
                    <span className="hint-choice-icon">💡</span>
                    <span className="hint-choice-label">Show hints</span>
                    <span className="hint-choice-sub">First letters visible</span>
                  </button>
                </div>
              </>
            )}

            {/* ── Go button — only for parts mode ───────────────────────── */}
            {practiceMode === 'parts' && (
              <button
                id="start-parts-btn"
                className="start-btn"
                onClick={handleStartInParts}
                style={{ marginTop: 8 }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Begin Parts Session
              </button>
            )}

            {/* ── Verse text — collapsible, shown below choices ──────────── */}
            <div className="hint-divider" style={{ marginTop: 20 }} />
            <button
              className="verse-collapse-toggle"
              onClick={() => setVerseCollapsed((v) => !v)}
              aria-expanded={!verseCollapsed}
            >
              <span>{verseCollapsed ? '▸' : '▾'} {ref} · {translation}</span>
              <span className="verse-collapse-hint">{verseCollapsed ? 'Show passage' : 'Hide passage'}</span>
            </button>
            {!verseCollapsed && (
              <div className="hint-verse-preview" style={{ marginTop: 10 }}>
                <p className="idle-preview-text">{verseText}</p>
              </div>
            )}

          </div>
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

          {/* Word display — the whole passage with word-by-word coloring + weakness history */}
          <div className="review-word-display">
            {reviewState.words.map((word: TrackedWord, i: number) => {
              // Hints mode: every 3rd pending word shows first letter
              const isHintWord = hintsMode === 'on' && word.status === 'pending' && (i + 1) % 3 === 0;
              const displayText = isHintWord
                ? word.original[0] + '\u2009' + '_ '.repeat(Math.max(word.original.length - 2, 1)).trim()
                : word.original;
              // Weakness history from past sessions
              const wordErrors = getWordErrors(ref);
              const errorCount = wordErrors[word.normalized] ?? 0;
              const weaknessClass = errorCount >= 6 ? ' word-weak-high'
                : errorCount >= 3 ? ' word-weak-mid'
                : errorCount >= 1 ? ' word-weak-low'
                : '';
              return (
              <span
                key={i}
                className={`review-word review-word-${word.status}${isHintWord ? ' review-word-hint' : ''}${weaknessClass}`}
                title={errorCount > 0 ? `Missed ${errorCount}× in past sessions` : undefined}
              >
                {displayText}{' '}
              </span>
              );
            })}
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

          {/* Weakness legend — only if this verse has error history */}
          {Object.keys(getWordErrors(ref)).length > 0 && (
            <div className="weakness-legend">
              <span className="weakness-legend-label">Past trouble spots:</span>
              <span className="weakness-dot dot-low" /> <span className="weakness-legend-txt">1–2×</span>
              <span className="weakness-dot dot-mid" /> <span className="weakness-legend-txt">3–5×</span>
              <span className="weakness-dot dot-high" /> <span className="weakness-legend-txt">6+×</span>
            </div>
          )}

          {/* Controls — pinned to bottom of screen */}
          <div className="review-controls-bar">
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
              <Link href="/library" className="complete-btn" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '14px 28px', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                📚 View Library
              </Link>
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

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    }>
      <ReviewPageInner />
    </Suspense>
  );
}
