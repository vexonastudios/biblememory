'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  LibraryVerse, createLibraryVerse, scheduleNextReview,
  isDue, sortByUrgency,
} from '@/lib/srs';

interface LibraryState {
  verses: LibraryVerse[];

  /** Add a newly memorized verse. If it already exists, skip (don't overwrite). */
  addVerse: (reference: string, text: string, translation: 'BSB' | 'KJV') => void;

  /** Record the result of a Recite Mode review session. */
  recordReview: (reference: string, accuracy: number) => void;

  /** Increment the error count for a specific word in a verse. */
  recordWordError: (reference: string, normalizedWord: string) => void;

  /** Remove a verse from the library. */
  removeVerse: (reference: string) => void;

  /** How many verses are due right now */
  dueCount: () => number;

  /** Verses due today, sorted by urgency */
  dueVerses: () => LibraryVerse[];

  /** Get the wordErrors map for a verse (empty obj if not found or legacy) */
  getWordErrors: (reference: string) => Record<string, number>;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      verses: [],

      addVerse: (reference, text, translation) => {
        const existing = get().verses.find(
          (v) => v.reference.toLowerCase() === reference.toLowerCase()
        );
        if (existing) return; // Already in library — don't reset progress

        const newVerse = createLibraryVerse(reference, text, translation);
        set((s) => ({ verses: [...s.verses, newVerse] }));
      },

      recordReview: (reference, accuracy) => {
        set((s) => ({
          verses: s.verses.map((v) =>
            v.reference.toLowerCase() === reference.toLowerCase()
              ? scheduleNextReview(v, accuracy)
              : v
          ),
        }));
      },

      recordWordError: (reference, normalizedWord) => {
        set((s) => ({
          verses: s.verses.map((v) => {
            if (v.reference.toLowerCase() !== reference.toLowerCase()) return v;
            const prev = v.wordErrors ?? {};
            return {
              ...v,
              wordErrors: {
                ...prev,
                [normalizedWord]: (prev[normalizedWord] ?? 0) + 1,
              },
            };
          }),
        }));
      },

      removeVerse: (reference) => {
        set((s) => ({
          verses: s.verses.filter(
            (v) => v.reference.toLowerCase() !== reference.toLowerCase()
          ),
        }));
      },

      dueCount: () => get().verses.filter(isDue).length,

      dueVerses: () => sortByUrgency(get().verses.filter(isDue)),

      getWordErrors: (reference) => {
        const verse = get().verses.find(
          (v) => v.reference.toLowerCase() === reference.toLowerCase()
        );
        return verse?.wordErrors ?? {};
      },
    }),
    { name: 'bible-memory-library' }
  )
);
