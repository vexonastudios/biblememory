'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store/sessionStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useLibraryStore } from '@/lib/store/libraryStore';
import { buildAccumulatedPhrases } from '@/lib/phraseParser';
import { buildRepeatedSSML } from '@/lib/ssmlBuilder';
import { startListening, stopListening, fuzzyMatch } from '@/lib/speechRecognizer';
import PhraseDisplay from '@/components/PhraseDisplay';
import MicButton from '@/components/MicButton';
import ProgressRing from '@/components/ProgressRing';
import Link from 'next/link';

export default function SessionPage() {
  const router = useRouter();

  const {
    reference, fullVerseText, phrases, currentStep,
    phase, loopIndex,
    transcript, matchScore,
    setPhase, setLoopIndex, setTranscript, setMatchScore,
    advanceStep, resetSession, markComplete,
  } = useSessionStore();

  const { addVerse } = useLibraryStore();

  const {
    elevenLabsApiKey, voiceId, repeatCount, matchThreshold,
    pauseBetweenMs, readingSpeed,
  } = useSettingsStore();

  const [serverHasKey, setServerHasKey] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setServerHasKey(data.hasApiKey))
      .catch(() => {});
  }, []);

  // Refs to avoid stale closures in callbacks
  const phaseRef = useRef(phase);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const accumulated = buildAccumulatedPhrases(phrases);

  // Redirect if no verse loaded
  useEffect(() => {
    if (!phrases.length) router.replace('/');
  }, [phrases, router]);

  // ─── TTS playback ────────────────────────────────────────────────────────────
  // We now send ONE request per step containing all N repetitions via SSML.
  // ElevenLabs reads the phrase, pauses (SSML <break>), reads again, pauses, etc.
  // This is far more natural than our previous approach of N separate API calls.

  const playTTS = useCallback(
    async (phraseText: string): Promise<void> => {
      return new Promise(async (resolve) => {
        try {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }

          // Build SSML with all repeats + pacing breaks in a single string
          const ssml = buildRepeatedSSML(phraseText, repeatCount, {
            pauseBetweenMs,
            speed: readingSpeed,
            naturalBreaths: true,
          });

          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ssml,
              voiceId,
              apiKey: elevenLabsApiKey,
              speed: readingSpeed,
            }),
          });

          if (!res.ok) {
            console.warn('TTS failed, continuing anyway');
            resolve();
            return;
          }

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play().catch(() => resolve());
        } catch {
          resolve();
        }
      });
    },
    [voiceId, elevenLabsApiKey, repeatCount, pauseBetweenMs, readingSpeed]
  );

  // ─── Speech recognition ───────────────────────────────────────────────────────

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
            setPhase('passed');
            setTimeout(() => advanceStep(), 1200);
          }
        },
        onEnd: () => {
          if (phaseRef.current === 'listening') setPhase('failed');
        },
        onError: () => {
          if (phaseRef.current === 'listening') setPhase('failed');
        },
      });
    },
    [matchThreshold, setTranscript, setMatchScore, setPhase, advanceStep]
  );

  // ─── Main session loop ────────────────────────────────────────────────────────
  // Now: ONE TTS call that contains all repeats (ElevenLabs handles the pacing).
  // Then: brief pre-mic pause (300ms) so user isn't surprised by the mic opening.

  const runLoop = useCallback(
    async (step: number) => {
      if (!phrases[step]) return;
      const text = accumulated[step];

      if (phaseRef.current !== 'reading') return;

      // Show loop counter as "loading" while TTS generates
      setLoopIndex(1);

      // Single call — all repeats inside the SSML
      await playTTS(text);

      // Brief breath before mic opens
      await new Promise((r) => setTimeout(r, 400));

      if (phaseRef.current === 'reading') {
        setPhase('listening');
        openMic(text);
      }
    },
    [phrases, accumulated, setLoopIndex, playTTS, setPhase, openMic]
  );

  useEffect(() => {
    if (phase === 'reading' && phrases.length > 0) {
      runLoop(currentStep);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep]);

  useEffect(() => {
    if (phase === 'failed') stopListening();
  }, [phase]);

  useEffect(() => {
    return () => {
      stopListening();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  // Auto-save to library + mark complete when phase becomes 'complete'
  useEffect(() => {
    if (phase === 'complete') {
      markComplete();
      // Add to spaced repetition library — triggers 1-day review schedule
      if (reference && fullVerseText) {
        addVerse(reference, fullVerseText, (useSettingsStore.getState().translation) as 'BSB' | 'KJV');
      }
    }
  }, [phase, markComplete, addVerse, reference, fullVerseText]);

  const handleStart = () => setPhase('reading');
  const handleRetry = () => { setPhase('reading'); };
  const handleRestart = () => {
    stopListening();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    resetSession();
    router.replace('/');
  };
  const handleSkip = () => {
    stopListening();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    advanceStep();
  };

  if (!phrases.length) return null;

  const stepLabel = `${currentStep + 1} / ${phrases.length}`;
  const isComplete = phase === 'complete';
  const progressPercent = isComplete ? 100 : (currentStep / phrases.length) * 100;

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
              <p>Then the mic opens — speak the text back to advance.</p>
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
            <div className="top-indicators">
              <ProgressRing current={loopIndex} total={repeatCount} />
              <div className="phase-label">
                {phase === 'reading'   && <span className="phase-reading">🔊 Listen…</span>}
                {phase === 'listening' && <span className="phase-listening">🎙 Your turn</span>}
                {phase === 'passed'    && <span className="phase-passed">✓ Passed!</span>}
                {phase === 'failed'    && <span className="phase-failed">Try again</span>}
              </div>
            </div>

            <PhraseDisplay phrases={phrases} currentStep={currentStep} phase={phase} />

            <MicButton
              isListening={phase === 'listening'}
              transcript={transcript}
              matchScore={matchScore}
              phase={phase}
            />

            <div className="session-controls">
              {phase === 'failed' && (
                <button id="retry-btn" className="ctrl-btn retry" onClick={handleRetry}>↻ Retry</button>
              )}
              {(phase === 'reading' || phase === 'listening' || phase === 'failed') && (
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
