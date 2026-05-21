'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  isListening: boolean;
  transcript: string;
  matchScore: number;
  phase: string;
}

export default function MicButton({ isListening, transcript, matchScore, phase }: Props) {
  const [bars, setBars] = useState<number[]>(Array(12).fill(4));
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isListening) {
      animRef.current = setInterval(() => {
        setBars(Array(12).fill(0).map(() => Math.random() * 36 + 4));
      }, 100);
    } else {
      if (animRef.current) clearInterval(animRef.current);
      setBars(Array(12).fill(4));
    }
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [isListening]);

  const scorePercent = Math.round(matchScore * 100);
  const isPassed = phase === 'passed';
  const isFailed = phase === 'failed';

  return (
    <div className={`mic-container ${isListening ? 'listening' : ''} ${isPassed ? 'passed' : ''} ${isFailed ? 'failed' : ''}`}>
      <div className="mic-ring">
        <div className="mic-icon">
          {isListening ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
              <path d="M19 10a7 7 0 0 1-14 0H3a9 9 0 0 0 18 0h-2z"/>
              <path d="M11 20h2v3h-2z"/>
            </svg>
          ) : isPassed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="32" height="32">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : isFailed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="32" height="32">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
              <path d="M19 10a7 7 0 0 1-14 0H3a9 9 0 0 0 18 0h-2z"/>
              <path d="M11 20h2v3h-2z"/>
            </svg>
          )}
        </div>
      </div>

      {isListening && (
        <div className="waveform">
          {bars.map((h, i) => (
            <div key={i} className="waveform-bar" style={{ height: `${h}px` }} />
          ))}
        </div>
      )}

      {isListening && transcript && (
        <div className="live-transcript">
          <span className="transcript-label">Hearing:</span>
          <span className="transcript-text">&ldquo;{transcript}&rdquo;</span>
        </div>
      )}

      {isListening && matchScore > 0 && (
        <div className="match-bar-wrap">
          <div className="match-bar" style={{ width: `${scorePercent}%` }} />
          <span className="match-pct">{scorePercent}%</span>
        </div>
      )}

      {isPassed && <p className="mic-status-msg passed-msg">✓ Great job!</p>}
      {isFailed && <p className="mic-status-msg failed-msg">Try again — speak clearly</p>}
    </div>
  );
}
