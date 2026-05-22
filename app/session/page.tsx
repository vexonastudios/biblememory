'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store/sessionStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useLibraryStore } from '@/lib/store/libraryStore';
import { buildAccumulatedPhrases } from '@/lib/phraseParser';
import { startListening, stopListening, fuzzyMatch } from '@/lib/speechRecognizer';
import PhraseDisplay from '@/components/PhraseDisplay';
import MicButton from '@/components/MicButton';
import ProgressRing from '@/components/ProgressRing';
import Link from 'next/link';

/**
 * Module-level audio buffer cache.
 * Key  = `${voiceId}::${speed}::${text}` — same key structure as server cache.
 * Value = ArrayBuffer of the MP3.
 *
 * Survives React re-renders (module scope) but clears on full page reload.
 * This is the primary defence against repeated API calls for the same phrase
 * across repeat loops — each phrase is fetched ONCE, then played locally N times.
 */
const audioBufferCache = new Map<string, ArrayBuffer>();

function makeCacheKey(voiceId: string, speed: number, text: string): string {
  return `${voiceId}::${speed}::${text}`;
}

export default function SessionPage() {
  const router = useRouter();

  const {
    reference, fullVerseText, phrases, currentStep,
    phase, loopIndex,
    transcript, matchScore,
    setPhase, setLoopIndex, setTranscript, setMatchScore,
    advanceStep, stepBack, resetSession, markComplete,
  } = useSessionStore();

  const { addVerse } = useLibraryStore();

  const {
    elevenLabsApiKey, voiceId, repeatCount, matchThreshold,
    pauseBetweenMs, readingSpeed,
  } = useSettingsStore();

  const [serverHasKey, setServerHasKey] = useState(false);
  const [failCount, setFailCount] = useState(0);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setServerHasKey(data.hasApiKey))
      .catch(() => {});
  }, []);

  const phaseRef = useRef(phase);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Cancellation token: bump this number to cancel any in-progress loop
  const loopTokenRef = useRef(0);
  // Stable ref to openMic so runLoop doesn't need it in its dep array
  const openMicRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const accumulated = buildAccumulatedPhrases(phrases);

  useEffect(() => {
    if (!phrases.length) router.replace('/');
  }, [phrases, router]);

  // Fetch and play phraseText. Uses client-side buffer cache so each phrase
  // hits ElevenLabs only ONCE — repeats 2, 3, … play from the cached ArrayBuffer.
  const playOnce = useCallback(
    (phraseText: string, token: number): Promise<boolean> => {
      return new Promise((resolve) => {
        // Stop anything still playing
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const cacheKey = makeCacheKey(voiceId, readingSpeed, phraseText);

        const playBuffer = (buffer: ArrayBuffer) => {
          if (loopTokenRef.current !== token) { resolve(false); return; }
          // Clone the buffer so the Audio element gets its own copy
          const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/mpeg' }));
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(true); };
          audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(false); };
          audio.play().catch(() => { URL.revokeObjectURL(url); resolve(false); });
        };

        // ── Cache hit: play immediately, no network call ──────────────────────
        const cached = audioBufferCache.get(cacheKey);
        if (cached) {
          playBuffer(cached);
          return;
        }

        // ── Cache miss: fetch from ElevenLabs, cache the result ───────────────
        fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: phraseText,
            voiceId,
            apiKey: elevenLabsApiKey,
            speed: readingSpeed,
          }),
        })
          .then((res) => {
            if (loopTokenRef.current !== token) { resolve(false); return null; }
            if (!res.ok) { resolve(false); return null; }
            return res.arrayBuffer();
          })
          .then((buf) => {
            if (!buf) return;
            if (loopTokenRef.current !== token) { resolve(false); return; }
            // Store in cache for all subsequent repeats and step-backs
            audioBufferCache.set(cacheKey, buf);
            playBuffer(buf);
          })
          .catch(() => resolve(false));
      });
    },
    [voiceId, elevenLabsApiKey, readingSpeed]
  );

  const openMic = useCallback(
    (targetText: string) => {
      setTranscript('');
      setMatchScore(0);
      startListening({
        onResult: ({ transcript: t }) => {
          setTranscript(t);
          const score = fuzzyMatch(t, targetText);
          setMatchScore(score);
          if (score >= matchThreshold) {
            stopListening();
            setFailCount(0);
            setPhase('passed');
            setTimeout(() => advanceStep(), 1200);
          }
        },
        onEnd: () => {
          if (phaseRef.current === 'listening') {
            const nextFails = failCount + 1;
            setFailCount(nextFails);
            setPhase('failed');
            if (nextFails >= 3) {
              setTimeout(() => { setFailCount(0); stepBack(); }, 1000);
            }
          }
        },
        onError: () => {
          if (phaseRef.current === 'listening') {
            setPhase('failed');
          }
        },
      });
    },
    [matchThreshold, setTranscript, setMatchScore, setPhase, advanceStep, stepBack, failCount]
  );

  // Keep openMicRef current so runLoop can call it without being in its dep array
  useEffect(() => { openMicRef.current = openMic; }, [openMic]);

  const runLoop = useCallback(
    async (step: number, token: number) => {
      const text = accumulated[step];

      for (let i = 1; i <= repeatCount; i++) {
        // Bail if cancelled or phase changed
        if (loopTokenRef.current !== token || phaseRef.current !== 'reading') return;
        setLoopIndex(i);
        await playOnce(text, token);

        // Pause between reads (but not after the final one)
        if (i < repeatCount) {
          if (loopTokenRef.current !== token || phaseRef.current !== 'reading') return;
          await new Promise<void>((r) => setTimeout(r, pauseBetweenMs));
        }
      }

      // Brief breath before mic, then check we're still in reading phase
      await new Promise<void>((r) => setTimeout(r, 600));
      if (loopTokenRef.current !== token || phaseRef.current !== 'reading') return;

      setPhase('listening');
      openMicRef.current?.(text);
    },
    [accumulated, repeatCount, pauseBetweenMs, setLoopIndex, playOnce, setPhase]
  );

  useEffect(() => {
    if (phase === 'reading' && phrases.length > 0) {
      // Bump token — any previous loop sees a stale token and exits
      const token = ++loopTokenRef.current;
      runLoop(currentStep, token);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep]); // Deliberately exclude runLoop — adding it causes re-fires mid-loop

  useEffect(() => {
    if (phase === 'failed') stopListening();
  }, [phase]);

  const handleStart = () => setPhase('reading');
  const handleRetry = () => { setPhase('listening'); openMic(accumulated[currentStep]); };
  const handleRestart = () => {
    // Cancel any in-progress loop immediately
    loopTokenRef.current += 1;
    // Stop audio
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    stopListening();
    resetSession();
    router.replace('/');
  };
  const handleSkip = () => { stopListening(); setFailCount(0); advanceStep(); };

  // Unmount cleanup — fires when user navigates away for any reason
  useEffect(() => {
    return () => {
      loopTokenRef.current += 1;  // cancel any in-progress loop
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      stopListening();
    };
  }, []);

  if (!phrases.length) return null;

  const stepLabel = `${currentStep + 1} / ${phrases.length}`;
  const isComplete = phase === 'complete';
  const progressPercent = isComplete ? 100 : (currentStep / phrases.length) * 100;
  const isSteppingBack = failCount >= 3 && phase === 'failed' && currentStep > 0;

  return (
    <div className="session-page">
      <div className="session-topbar">
        <button id="exit-session-btn" className="exit-btn" onClick={handleRestart}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Exit
        </button>
        <div className="session-ref">
          <span className="ref-label">{reference}</span>
        </div>
        <span className="step-counter">{isComplete ? '✓ Done' : stepLabel}</span>
      </div>

      <div className="session-progress-bar">
        <div className="session-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="session-content">

        {phase === 'idle' && (
          <div className="idle-screen">
            <div className="idle-verse-preview">
              <p className="idle-preview-text">{fullVerseText}</p>
              <span className="idle-ref">{reference}</span>
            </div>
            <div className="idle-info">
              <p>Each phrase is read <strong>{repeatCount}×</strong> with a <strong>{(pauseBetweenMs / 1000).toFixed(1)}s</strong> breath between repeats.</p>
              <p>Then the mic opens — say everything you've learned so far to advance.</p>
              {!elevenLabsApiKey && !serverHasKey && (
                <p className="idle-warning">
                  ⚠ No ElevenLabs API key found.{' '}
                  <Link href="/settings" className="warning-link">Add one in Settings</Link>
                </p>
              )}
            </div>
            <button id="begin-session-btn" className="begin-btn" onClick={handleStart}>
              Begin Session
            </button>
          </div>
        )}

        {(phase === 'reading' || phase === 'listening' || phase === 'passed' || phase === 'failed') && (
          <div className="active-screen">
            {!elevenLabsApiKey && !serverHasKey && (
              <div
                className="active-key-warning"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  textAlign: 'center',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                ⚠ Audio disabled: No ElevenLabs API key found.{' '}
                <Link href="/settings" style={{ textDecoration: 'underline', color: 'inherit' }}>
                  Configure in Settings
                </Link>
              </div>
            )}
            <div className="top-indicators">
              <ProgressRing current={loopIndex} total={repeatCount} />
              <div className="phase-label">
                {phase === 'reading'   && <span className="phase-reading">🔊 Listen…</span>}
                {phase === 'listening' && <span className="phase-listening">🎙 Say it from the beginning</span>}
                {phase === 'passed'    && <span className="phase-passed">✓ Passed!</span>}
                {phase === 'failed'    && !isSteppingBack && <span className="phase-failed">Try again</span>}
                {isSteppingBack        && <span className="phase-failed">Stepping back to review…</span>}
              </div>
            </div>

            <PhraseDisplay phrases={phrases} currentStep={currentStep} phase={phase} />

            <MicButton
              isListening={phase === 'listening'}
              transcript={transcript}
              matchScore={matchScore}
              phase={phase}
            />

            {phase === 'failed' && failCount >= 2 && !isSteppingBack && (
              <p className="fail-hint">
                {failCount === 2
                  ? 'Tip: say all the phrases from the very beginning'
                  : 'One more miss and we\'ll step back to re-learn the prior phrase'}
              </p>
            )}

            <div className="session-controls">
              {phase === 'failed' && !isSteppingBack && (
                <button id="retry-btn" className="ctrl-btn retry" onClick={handleRetry}>↻ Retry</button>
              )}
              {(phase === 'reading' || phase === 'listening' || phase === 'failed') && !isSteppingBack && (
                <button id="skip-btn" className="ctrl-btn skip" onClick={handleSkip}>Skip →</button>
              )}
            </div>
          </div>
        )}

        {isComplete && (
          <div className="complete-screen">
            <div className="confetti-wrap">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="confetti-particle" style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 1.5}s`,
                  background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F97316'][i % 5],
                }} />
              ))}
            </div>
            <div className="complete-content">
              <div className="complete-icon">🏆</div>
              <h2 className="complete-title">Verse Memorized!</h2>
              <blockquote className="complete-verse">
                <p>{fullVerseText}</p>
                <cite>{reference}</cite>
              </blockquote>
              <p className="complete-sub">This verse has been saved to your review list.</p>
              <div className="complete-actions">
                <button id="done-home-btn" className="complete-btn primary" onClick={handleRestart}>
                  Learn Another Verse
                </button>
                <Link href="/library" className="complete-btn" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '14px 28px', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  📚 View Library
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
