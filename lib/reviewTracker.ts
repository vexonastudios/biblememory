/**
 * reviewTracker.ts
 *
 * Word-by-word live review tracker for "Recite Mode".
 *
 * The user speaks a passage aloud. As each word lands:
 *  - If it matches the next expected word → mark correct, advance pointer
 *  - If it doesn't match → stop and signal an error
 *
 * Normalization strips punctuation and lowercases so "world," === "world".
 * Common filler words (um, uh, like) are silently skipped.
 */

export type WordStatus = 'pending' | 'current' | 'correct' | 'error';

export interface TrackedWord {
  original: string;     // Original text including punctuation
  normalized: string;   // Lowercase, no punctuation — used for comparison
  status: WordStatus;
}

const FILLER_WORDS = new Set([
  'um', 'uh', 'ah', 'er', 'like', 'you know', 'hmm', 'hm',
]);

/**
 * Strip punctuation and lowercase a word for comparison.
 */
export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[^a-z0-9']/g, '')
    .trim();
}

/**
 * Build the initial word state array from a passage of text.
 */
export function buildTrackedWords(text: string): TrackedWord[] {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((original) => ({
      original,
      normalized: normalizeWord(original),
      status: 'pending' as WordStatus,
    }));
}

export interface ReviewState {
  words: TrackedWord[];
  pointer: number;          // Index of next expected word
  errorWord: string | null; // What the user said that was wrong
  isComplete: boolean;
  correctCount: number;
  errorCount: number;
}

export function createReviewState(text: string): ReviewState {
  const words = buildTrackedWords(text);
  if (words.length > 0) words[0].status = 'current';
  return {
    words,
    pointer: 0,
    errorWord: null,
    isComplete: false,
    correctCount: 0,
    errorCount: 0,
  };
}

export interface ProcessResult {
  type: 'correct' | 'error' | 'skip' | 'complete' | 'no-change';
  state: ReviewState;
}

/**
 * Process a new spoken word against the current review state.
 * Returns a new immutable state + what happened.
 *
 * @param state   Current review state
 * @param spokenWord  A single word from speech recognition
 */
export function processSpokenWord(state: ReviewState, spokenWord: string): ProcessResult {
  const normalized = normalizeWord(spokenWord);

  if (!normalized) return { type: 'no-change', state };

  // Silently skip filler words
  if (FILLER_WORDS.has(normalized)) {
    return { type: 'skip', state };
  }

  const { words, pointer } = state;
  if (pointer >= words.length) return { type: 'no-change', state };

  const expected = words[pointer];

  // ── Match ──────────────────────────────────────────────────────────────────
  if (normalized === expected.normalized || isSoftMatch(normalized, expected.normalized)) {
    const newWords = words.map((w, i) => {
      if (i === pointer) return { ...w, status: 'correct' as WordStatus };
      if (i === pointer + 1) return { ...w, status: 'current' as WordStatus };
      return w;
    });

    const newPointer = pointer + 1;
    const isComplete = newPointer >= words.length;

    return {
      type: isComplete ? 'complete' : 'correct',
      state: {
        ...state,
        words: newWords,
        pointer: newPointer,
        errorWord: null,
        isComplete,
        correctCount: state.correctCount + 1,
      },
    };
  }

  // ── Mismatch ───────────────────────────────────────────────────────────────
  // Mark the current expected word as error, keep pointer here
  const newWords = words.map((w, i) => {
    if (i === pointer) return { ...w, status: 'error' as WordStatus };
    return w;
  });

  return {
    type: 'error',
    state: {
      ...state,
      words: newWords,
      errorWord: spokenWord,
      errorCount: state.errorCount + 1,
    },
  };
}

/**
 * After an error, reset the current word back to 'current' so the user
 * can try again without re-penalizing.
 */
export function resetErrorWord(state: ReviewState): ReviewState {
  const newWords = state.words.map((w, i) => {
    if (i === state.pointer) return { ...w, status: 'current' as WordStatus };
    return w;
  });
  return { ...state, words: newWords, errorWord: null };
}

/**
 * Process a full transcript string (multiple words) word by word.
 * Returns the final state after processing all new words.
 *
 * @param state        Current review state
 * @param transcript   Full transcript from speech recognition
 * @param processedCount  How many words we've already handled from previous transcripts
 */
export function processTranscript(
  state: ReviewState,
  transcript: string,
  processedCount: number
): { state: ReviewState; processedCount: number; events: ProcessResult['type'][] } {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const newWords = words.slice(processedCount);

  let current = state;
  let count = processedCount;
  const events: ProcessResult['type'][] = [];

  for (const word of newWords) {
    const result = processSpokenWord(current, word);
    events.push(result.type);
    current = result.state;
    count++;

    // Stop processing on first error — user must correct before continuing
    if (result.type === 'error' || result.type === 'complete') break;
  }

  return { state: current, processedCount: count, events };
}

/**
 * Soft match: allow 1 character difference for words > 4 chars
 * (handles slight speech recognition noise like "looved" → "loved").
 */
function isSoftMatch(spoken: string, expected: string): boolean {
  if (Math.abs(spoken.length - expected.length) > 2) return false;
  if (expected.length <= 3) return false; // Short words must match exactly
  return levenshtein(spoken, expected) <= 1;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
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
