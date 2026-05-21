/**
 * speechRecognizer.ts
 * Web Speech API wrapper for verse recall recognition.
 */

export interface RecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface RecognizerOptions {
  onResult: (result: RecognitionResult) => void;
  onEnd: () => void;
  onError: (error: string) => void;
}

let recognition: SpeechRecognition | null = null;

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

export function startListening(options: RecognizerOptions): void {
  if (!isSpeechRecognitionSupported()) {
    options.onError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
    return;
  }

  // Stop any existing session
  stopListening();

  const SpeechRecognitionImpl =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  recognition = new SpeechRecognitionImpl();
  recognition!.continuous = true;
  recognition!.interimResults = true;
  recognition!.lang = 'en-US';
  recognition!.maxAlternatives = 1;

  recognition!.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      options.onResult({
        transcript: result[0].transcript.trim(),
        isFinal: result.isFinal,
        confidence: result[0].confidence,
      });
    }
  };

  recognition!.onend = () => {
    options.onEnd();
  };

  recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
    options.onError(event.error);
  };

  recognition!.start();
}

export function stopListening(): void {
  if (recognition) {
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
    try {
      recognition.stop();
    } catch (_) {}
    recognition = null;
  }
}

/**
 * Fuzzy match: checks if the spoken transcript sufficiently matches
 * the target phrase. Returns a score from 0 to 1.
 */
export function fuzzyMatch(transcript: string, target: string): number {
  const normalizeStr = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, '')           // remove punctuation
      .replace(/\s+/g, ' ')
      .trim();

  const t = normalizeStr(transcript);
  const tgt = normalizeStr(target);

  if (t === tgt) return 1.0;

  const tWords = t.split(' ');
  const tgtWords = tgt.split(' ');

  if (tgtWords.length === 0) return 1.0;

  // Count how many target words appear in the transcript (in order)
  let matchCount = 0;
  let tIdx = 0;

  for (const word of tgtWords) {
    while (tIdx < tWords.length) {
      if (tWords[tIdx] === word || levenshteinSimilarity(tWords[tIdx], word) > 0.8) {
        matchCount++;
        tIdx++;
        break;
      }
      tIdx++;
    }
  }

  return matchCount / tgtWords.length;
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
