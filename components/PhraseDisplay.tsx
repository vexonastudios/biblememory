'use client';

import { Phrase } from '@/lib/phraseParser';

interface Props {
  phrases: Phrase[];
  currentStep: number;       // 0-indexed
  phase: string;
}

export default function PhraseDisplay({ phrases, currentStep, phase }: Props) {
  if (!phrases.length) return null;

  const isReading = phase === 'reading';
  const isListening = phase === 'listening';
  const isPassed = phase === 'passed';

  return (
    <div className={`phrase-display ${isReading ? 'reading' : ''} ${isListening ? 'listening' : ''} ${isPassed ? 'passed' : ''}`}>
      <div className="phrase-chunks">
        {phrases.slice(0, currentStep + 1).map((phrase, i) => {
          const isNew = i === currentStep;
          return (
            <span key={phrase.id}>
              <span className={`phrase-chunk ${isNew ? 'phrase-new' : 'phrase-old'}`}>
                {phrase.text}
              </span>
              {i < currentStep && (
                <span className="phrase-separator">, </span>
              )}
            </span>
          );
        })}
      </div>

      {isReading && (
        <div className="reading-indicator">
          <span className="reading-dot" />
          <span className="reading-dot" />
          <span className="reading-dot" />
        </div>
      )}
    </div>
  );
}
