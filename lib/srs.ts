/**
 * srs.ts — Simplified Spaced Repetition System
 *
 * Based on the SM-2 algorithm (used by Anki):
 * https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * Intervals: 1d → 3d → 7d → 14d → 30d → 60d (mastered)
 * On failure (accuracy < threshold): reset to 1 day
 */

export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60]; // days per repetition level
export const MASTERY_LEVEL = SRS_INTERVALS.length - 1; // index 5 = 60 days
export const ACCURACY_PASS_THRESHOLD = 0.75; // 75% accuracy to advance

export interface LibraryVerse {
  reference: string;
  text: string;
  translation: 'BSB' | 'KJV';
  addedDate: string;           // ISO timestamp — when first memorized
  nextReviewDate: string;      // ISO timestamp — when next due
  repetitionLevel: number;     // 0–5 index into SRS_INTERVALS
  lastAccuracy: number;        // 0.0–1.0 from last recite session
  reviewCount: number;         // total times reviewed
  correctStreak: number;       // consecutive successful reviews
  masteredDate: string | null; // date mastered (level 5), else null
  /** Per-word error history: normalized word → total error count across all sessions */
  wordErrors: Record<string, number>;
}

/**
 * Create a new library entry when a verse is first memorized.
 * Next review is set to 1 day from now.
 */
export function createLibraryVerse(
  reference: string,
  text: string,
  translation: 'BSB' | 'KJV'
): LibraryVerse {
  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + SRS_INTERVALS[0]); // +1 day

  return {
    reference,
    text,
    translation,
    addedDate: now.toISOString(),
    nextReviewDate: nextReview.toISOString(),
    repetitionLevel: 0,
    lastAccuracy: 1.0,
    reviewCount: 0,
    correctStreak: 0,
    masteredDate: null,
    wordErrors: {},
  };
}

/**
 * Update a verse after a review session.
 * accuracy: 0.0–1.0 from Recite Mode score
 */
export function scheduleNextReview(
  verse: LibraryVerse,
  accuracy: number
): LibraryVerse {
  const passed = accuracy >= ACCURACY_PASS_THRESHOLD;
  const now = new Date();
  const nextReview = new Date(now);

  let newLevel: number;
  let newStreak: number;

  if (passed) {
    // Advance to next level (cap at mastery)
    newLevel = Math.min(verse.repetitionLevel + 1, MASTERY_LEVEL);
    newStreak = verse.correctStreak + 1;
  } else {
    // Failed — reset to level 0 (review again in 1 day)
    newLevel = 0;
    newStreak = 0;
  }

  const intervalDays = SRS_INTERVALS[newLevel];
  nextReview.setDate(nextReview.getDate() + intervalDays);

  const isMastered = newLevel === MASTERY_LEVEL;

  return {
    ...verse,
    repetitionLevel: newLevel,
    lastAccuracy: accuracy,
    reviewCount: verse.reviewCount + 1,
    correctStreak: newStreak,
    nextReviewDate: nextReview.toISOString(),
    masteredDate: isMastered && !verse.masteredDate ? now.toISOString() : verse.masteredDate,
  };
}

/**
 * Is this verse due for review today or overdue?
 */
export function isDue(verse: LibraryVerse): boolean {
  return new Date(verse.nextReviewDate) <= new Date();
}

/**
 * Is this verse due within the next N days?
 */
export function isDueWithin(verse: LibraryVerse, days: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return new Date(verse.nextReviewDate) <= cutoff;
}

/**
 * Is this verse mastered? (reached max interval)
 */
export function isMastered(verse: LibraryVerse): boolean {
  return verse.repetitionLevel === MASTERY_LEVEL;
}

/**
 * Days until next review (negative = overdue)
 */
export function daysUntilReview(verse: LibraryVerse): number {
  const diffMs = new Date(verse.nextReviewDate).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Human-readable label for the interval level
 */
export function intervalLabel(verse: LibraryVerse): string {
  const days = SRS_INTERVALS[verse.repetitionLevel];
  if (days === 1) return 'Every day';
  if (days < 7) return `Every ${days} days`;
  if (days === 7) return 'Weekly';
  if (days === 14) return 'Bi-weekly';
  if (days === 30) return 'Monthly';
  return '2-month intervals';
}

/**
 * Sort verses by urgency: overdue first, then soonest first
 */
export function sortByUrgency(verses: LibraryVerse[]): LibraryVerse[] {
  return [...verses].sort((a, b) =>
    new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime()
  );
}
