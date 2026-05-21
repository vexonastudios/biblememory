'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store/sessionStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { buildAccumulatedPhrases } from '@/lib/phraseParser';
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

  const {
    elevenLabsApiKey, voiceId, repeatCount, matchThreshold,
  } = useSettingsStore();

  // Refs to avoid stale closures in callbacks
  const phaseRef = useRef(phase);
  const currentStepRef = useRef(currentStep);
  const loopIndexRef = useRef(loopIndex);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { loopIndexRef.current = loopIndex; }, [loopIndex]);

  const accumulated = buildAccumulatedPhrases(phrases);

  // Redirect if no verse loaded
  useEffect(() => {
    if (!phrases.length) {
      router.replace('/');
    }
  }, [phrases, router]);

  // ─── TTS playback ───────────────────────────────────────────────────────────

  const playTTS = useCallback(
    async (text: string): Promise<void> => {
      return new Promise(async (resolve) => {
        try {
          // Stop any current audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }

          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceId, apiKey: elevenLabsApiKey }),
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

          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            resolve();
          };

          audio.play().catch(() => resolve());
        } catch (e) {
          resolve();
        }
      });
    },
    [voiceId, elevenLabsApiKey]
  );

  // ─── Speech recognition ──────────────────────────────────────────────────────

  const openMic = useCallback(
    (targetText: string) => {
      setTranscript('');
      setMatchScore(0);

      startListening({
        onResult: ({ transcript: t, isFinal }) => {
          setTranscript(t);
          const score = fuzzyMatch(t, targetText);
          setMatchScore(score);

          if (score >= matchThreshold) {
            stopListening();
            setPhase('passed');

            setTimeout(() => {
              advanceStep();
            }, 1200);
          }
        },
        onEnd: () => {
          // mic closed without match — if still listening phase, show failed
          if (phaseRef.current === 'listening') {
            setPhase('failed');
          }
        },
        onError: (err) => {
          console.warn('Speech recognition error:', err);
          if (phaseRef.current === 'listening') {
            setPhase('failed');
          }
        },
      });
    },
    [matchThreshold, setTranscript, setMatchScore, setPhase, advanceStep]
  );

  // ─── Main session loop ───────────────────────────────────────────────────────

  const runLoop = useCallback(
    async (step: number, loopStart: number) => {
      if (!phrases[step]) return;
      const text = accumulated[step];

      for (let loop = loopStart; loop < repeatCount; loop++) {
        if (phaseRef.current !== 'reading') return; // interrupted
        setLoopIndex(loop + 1);
        await playTTS(text);

        // Small gap between repeats
        if (loop < repeatCount - 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // All loops done — open mic
      if (phaseRef.current === 'reading') {
        setPhase('listening');
        openMic(text);
      }
    },
    [phrases, accumulated, repeatCount, setLoopIndex, playTTS, setPhase, openMic]
  );

  // Start reading when phase becomes 'reading'
  useEffect(() => {
    if (phase === 'reading' && phrases.length > 0) {
      runLoop(currentStep, 0);
    }
  }, [phase, currentStep]);

  // On 'failed': stop listening, allow retry button
  useEffect(() => {
    if (phase === 'failed') {
      stopListening();
    }
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Mark complete when phase becomes 'complete'
  useEffect(() => {
    if (phase === 'complete') {
      markComplete();
    }
  }, [phase, markComplete]);

  const handleStart = () => {
    setPhase('reading');
  };

  const handleRetry = () => {
    setPhase('reading');
    runLoop(currentStep, 0);
  };

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
  const progressPercent = isComplete ? 100 : ((currentStep) / phrases.length) * 100;

  return (
    <div className="session-page">
      {/* Top bar */}
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

      {/* Progress bar */}
      <div className="session-progress-bar">
        <div className="session-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Main content */}
      <div className="session-content">

        {/* IDLE — not started yet */}
        {phase === 'idle' && (
          <div className="idle-screen">
            <div className="idle-verse-preview">
              <p className="idle-preview-text">{fullVerseText}</p>
              <span className="idle-ref">{reference}</span>
            </div>
            <div className="idle-info">
              <p>You&apos;ll hear each phrase <strong>{repeatCount}×</strong>, then speak it back.</p>
              <p>The session builds phrase by phrase until you know the whole verse.</p>
              {!elevenLabsApiKey && (
                <p className="idle-warning">
                  ⚠ No ElevenLabs API key found.{' '}
                  <Link href="/settings" className="warning-link">Add one in Settings</Link>{' '}
                  to enable voice playback.
                </p>
              )}
            </div>
            <button id="begin-session-btn" className="begin-btn" onClick={handleStart}>
              Begin Session
            </button>
          </div>
        )}

        {/* ACTIVE session (reading / listening / passed / failed) */}
        {(phase === 'reading' || phase === 'listening' || phase === 'passed' || phase === 'failed') && (
          <div className="active-screen">
            {/* Loop progress ring */}
            <div className="top-indicators">
              <ProgressRing current={loopIndex} total={repeatCount} />
              <div className="phase-label">
                {phase === 'reading' && <span className="phase-reading">🔊 Listening…</span>}
                {phase === 'listening' && <span className="phase-listening">🎙 Your turn</span>}
                {phase === 'passed' && <span className="phase-passed">✓ Passed!</span>}
                {phase === 'failed' && <span className="phase-failed">Try again</span>}
              </div>
            </div>

            {/* Phrase display */}
            <PhraseDisplay
              phrases={phrases}
              currentStep={currentStep}
              phase={phase}
            />

            {/* Mic */}
            <MicButton
              isListening={phase === 'listening'}
              transcript={transcript}
              matchScore={matchScore}
              phase={phase}
            />

            {/* Controls */}
            <div className="session-controls">
              {phase === 'failed' && (
                <button id="retry-btn" className="ctrl-btn retry" onClick={handleRetry}>
                  ↻ Retry
                </button>
              )}
              {(phase === 'reading' || phase === 'listening' || phase === 'failed') && (
                <button id="skip-btn" className="ctrl-btn skip" onClick={handleSkip}>
                  Skip →
                </button>
              )}
            </div>
          </div>
        )}

        {/* COMPLETE */}
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
              <p className="complete-sub">
                This verse has been saved to your review list.
              </p>
              <div className="complete-actions">
                <button id="done-home-btn" className="complete-btn primary" onClick={handleRestart}>
                  Learn Another Verse
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
