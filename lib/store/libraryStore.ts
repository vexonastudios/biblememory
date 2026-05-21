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

  /** Remove a verse from the library. */
  removeVerse: (reference: string) => void;

  /** How many verses are due right now */
  dueCount: () => number;

  /** Verses due today, sorted by urgency */
  dueVerses: () => LibraryVerse[];
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

      removeVerse: (reference) => {
        set((s) => ({
          verses: s.verses.filter(
            (v) => v.reference.toLowerCase() !== reference.toLowerCase()
          ),
        }));
      },

      dueCount: () => get().verses.filter(isDue).length,

      dueVerses: () => sortByUrgency(get().verses.filter(isDue)),
    }),
    { name: 'bible-memory-library' }
  )
);
